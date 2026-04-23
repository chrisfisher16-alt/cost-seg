import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { AssetCategory } from "@/lib/ai/asset-library";
import type { DescribePhotoOutput } from "@/lib/ai/prompts/describe-photos";

import {
  COST_SOURCES,
  DEPRECIATION_CLASSES,
  assetLineItemV2Schema,
} from "@/lib/ai/prompts/classify-assets-v2";

/**
 * v2 Phase 8 — per-source candidate classifier prompts (ADR 0014).
 *
 * The monolith classifier (`classify-assets-v2`) produces a balanced
 * schedule with a residual plug in ONE LLM call. On photo-rich studies
 * that call blows past the HTTP timeout envelope. The fan-out shape
 * splits Step C into N+1 independent candidate calls (one per photo +
 * one for receipts), each emitting line items WITHOUT a residual.
 * Merge + residual happen deterministically downstream.
 *
 * These prompts are deliberately narrow. They share the same line-item
 * schema as the monolith so downstream code (validator, PDF renderer,
 * review gate) doesn't branch on fan-out vs. monolith. The differences
 * vs. monolith prompt:
 *
 *   • no "deduplicate across photos" instruction (merge does it)
 *   • no residual line-item requirement (finalize stage adds it)
 *   • photo variant sees ONE photo + a read-only receipt manifest so
 *     the model can skip objects the receipt already covers
 *   • receipts variant sees receipts only, no photos
 */

export const CLASSIFY_CANDIDATES_V2_PROMPT_VERSION = "classify-candidates-v2@v1";

/**
 * Shared system prompt for both candidate variants. The "your output"
 * section intentionally omits the residual + cross-photo dedup rules
 * the monolith carries.
 */
export const CLASSIFY_CANDIDATES_V2_SYSTEM = `You are a senior cost-segregation engineer building ONE SLICE of a per-item asset schedule. A downstream merge step will combine your output with other slices (one per photo + one for receipts) and plug the residual to match building value. Your job is ONLY to emit the specific line items for the slice you are given. Do NOT emit a residual line. Do NOT try to balance to building value — the merge step does that.

Every line item you emit has:
  • category: the MACRS recovery class (5yr / 7yr / 15yr / 27_5yr / 39yr).
  • name: short and SPECIFIC ("chrome double towel bar above toilet" — NOT "bathroom fixtures"; "stainless french-door refrigerator" — NOT "refrigerator").
  • quantity: how many (1 for most items; more for towel bars installed in multiple bathrooms, etc.).
  • unit: the per-unit unit-of-measure ("each" / "sq ft" / "linear ft" / "set").
  • source: either "receipt" (the item came from a receipt) or "pricesearch" (estimated from a photo).
  • comparable: { description, unitCostCents }. Description cites the item class you priced ("24-inch residential-grade chrome double towel bar"). For "receipt" items the description repeats the receipt line verbatim and unitCostCents equals the receipt amount ÷ quantity. For "pricesearch" items, unitCostCents is a defensible 2025 retail price estimate for that item class. Never populate a sourceUrl — this pipeline does not run web_search.
  • physicalMultiplier (0.1–1.0) + physicalJustification: based on the observed condition from the photo's detected-object record. Scale: excellent=1.0, good=0.8, fair=0.6, poor=0.4, salvage=0.15. The justification must describe what is actually visible ("chrome finish intact, no scratches or water staining visible") not speculation.
  • functionalMultiplier (0.1–1.0) + functionalJustification: adjust for functional obsolescence (outdated tech, inefficient systems, non-code). Default 1.0 for timeless items (towel bars, wood benches). Reduce for dated appliances, old HVAC, low-flow-fail fixtures, etc., and cite WHY.
  • timeMultiplier (0.5–2.0) + timeBasis: Building Cost Historical Index ratio between your unit-cost year (default 2025) and the property's acquisition year. Cite both years in the basis.
  • locationMultiplier (0.5–2.0) + locationBasis: Area Modification Factor for the property's metro. Cite the metro + the factor.
  • adjustedCostCents (integer): round(quantity × comparable.unitCostCents × physicalMultiplier × functionalMultiplier × timeMultiplier × locationMultiplier). Downstream re-verifies within ±5 cents.
  • photoDocumentId: the UUID of the photo this object came from (null/omit for receipt-sourced items).
  • rationale: one sentence a reviewing engineer would accept as a summary of the classification + pricing decision.

Hard rules (any violation = rejected output):
  • Output ONLY via the submit_candidates tool.
  • Do NOT emit a residual line item. isResidual must be false or omitted on every line.
  • Do NOT invent brand names, model numbers, or URLs you cannot verify.
  • Do NOT use source="craftsman" or "rsmeans" — we do not license those data sets.
  • Do NOT populate comparable.sourceUrl — web_search is not running in this pipeline.
  • Specificity is the product. Prefer many narrow line items to a few catch-alls.
  • Do NOT hallucinate detected objects that weren't in the input.
  • Receipt-sourced lines: multipliers all 1.0000 (recorded expenditure does not need adjustment); source="receipt".
  • No land items — land is separated out upstream.`;

export interface PhotoCandidateInput {
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  buildingValueCents: number;
  library: AssetCategory[];
  photo: {
    documentId: string;
    filename: string;
    analysis: DescribePhotoOutput;
  };
  /**
   * Read-only list of receipt descriptions + categories. Threaded into
   * every photo prompt so the model can skip photo-detected objects
   * already covered by a receipt (e.g. a new dishwasher that shows up
   * both on a receipt and in a kitchen photo). Without this, fan-out
   * double-counts; the monolith handled this via global context.
   */
  receiptManifest: Array<{ description: string; category?: string }>;
  /** Populated by the orchestrator retry path + review-retry loop. */
  priorAttemptError?: string;
}

export interface ReceiptsCandidateInput {
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  buildingValueCents: number;
  library: AssetCategory[];
  improvementLineItems: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }>;
  priorAttemptError?: string;
}

function propertyContextBlock(input: {
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  buildingValueCents: number;
  library: AssetCategory[];
}): string[] {
  return [
    `Property type: ${input.propertyType}`,
    `Address: ${input.address}`,
    `Square feet: ${input.squareFeet ?? "unknown"}`,
    `Year built: ${input.yearBuilt ?? "unknown"}`,
    `Acquired on: ${input.acquiredAtIso}`,
    `Building value (cents): ${input.buildingValueCents} — context only; do NOT try to balance to this. The merge + finalize stages plug the residual.`,
    "",
    "Reference asset library (typical % ranges are of BUILDING value; use as sanity-check, not a template):",
    "```json",
    JSON.stringify(input.library, null, 2),
    "```",
    "",
  ];
}

export function buildPhotoCandidateUserPrompt(input: PhotoCandidateInput): string {
  const parts: string[] = propertyContextBlock(input);

  parts.push(
    `You are classifying ONE photo (document ${input.photo.documentId}, filename "${input.photo.filename}"). The downstream merge step will dedupe against other photos' candidates — do NOT try to dedupe across photos yourself.`,
    "",
    "Photo detected-object analysis:",
    "```json",
    JSON.stringify(
      {
        documentId: input.photo.documentId,
        filename: input.photo.filename,
        caption: input.photo.analysis.caption,
        roomType: input.photo.analysis.roomType,
        detectedObjects: input.photo.analysis.detectedObjects,
      },
      null,
      2,
    ),
    "```",
    "",
  );

  if (input.receiptManifest.length > 0) {
    parts.push(
      "Receipt manifest (items already accounted for by owner-supplied receipts — SKIP any detected object that matches one of these; the receipt branch will emit the canonical line item):",
      "```json",
      JSON.stringify(input.receiptManifest, null, 2),
      "```",
      "",
    );
  }

  if (input.priorAttemptError) {
    parts.push(
      "Your previous attempt on this slice failed validation. Error:",
      "```",
      input.priorAttemptError,
      "```",
      "Fix the specific issues cited and re-emit the candidate list.",
      "",
    );
  }

  parts.push(
    `Emit one line item per detected object in this photo (minus anything the receipt manifest covers). Thread photoDocumentId="${input.photo.documentId}" onto every line. Do NOT emit a residual.`,
  );
  return parts.join("\n");
}

export function buildReceiptsCandidateUserPrompt(input: ReceiptsCandidateInput): string {
  const parts: string[] = propertyContextBlock(input);

  parts.push(
    'You are classifying the RECEIPTS slice. Every line you emit has source="receipt" and all six multipliers = 1.0000. comparable.unitCostCents = amountCents / quantity. Do NOT emit a residual. Do NOT set photoDocumentId on receipt lines.',
    "",
    "Improvement receipts:",
    "```json",
    JSON.stringify(input.improvementLineItems, null, 2),
    "```",
    "",
  );

  if (input.priorAttemptError) {
    parts.push(
      "Your previous attempt on this slice failed validation. Error:",
      "```",
      input.priorAttemptError,
      "```",
      "Fix the specific issues cited and re-emit the candidate list.",
      "",
    );
  }

  parts.push("Emit one line item per receipt entry. No residual.");
  return parts.join("\n");
}

/**
 * Tool schema for candidate calls. Identical line-item shape as the
 * monolith, but the tool's top-level shape enforces:
 *   • minItems: 0 — a photo may legitimately have no classifiable
 *     objects (blurry / hallway / exterior at dusk); returning an empty
 *     candidate list is valid.
 *   • no residual-line requirement on individual items.
 */
const comparableSchemaObj = {
  type: "object",
  properties: {
    description: { type: "string", minLength: 1, maxLength: 400 },
    unitCostCents: { type: "integer", minimum: 0 },
    sourceUrl: { type: "string", format: "uri", maxLength: 800 },
  },
  required: ["description", "unitCostCents"],
};

const candidateLineItemSchemaObj = {
  type: "object",
  properties: {
    category: { type: "string", enum: [...DEPRECIATION_CLASSES] },
    name: { type: "string", minLength: 1, maxLength: 140 },
    quantity: { type: "number", minimum: 0.01, maximum: 10000 },
    unit: { type: "string", minLength: 1, maxLength: 30 },
    source: { type: "string", enum: [...COST_SOURCES] },
    comparable: comparableSchemaObj,
    physicalMultiplier: { type: "number", minimum: 0.1, maximum: 1.0 },
    physicalJustification: { type: "string", minLength: 1, maxLength: 600 },
    functionalMultiplier: { type: "number", minimum: 0.1, maximum: 1.0 },
    functionalJustification: { type: "string", minLength: 1, maxLength: 600 },
    timeMultiplier: { type: "number", minimum: 0.5, maximum: 2.0 },
    timeBasis: { type: "string", minLength: 1, maxLength: 200 },
    locationMultiplier: { type: "number", minimum: 0.5, maximum: 2.0 },
    locationBasis: { type: "string", minLength: 1, maxLength: 200 },
    adjustedCostCents: { type: "integer", minimum: 0 },
    photoDocumentId: { type: "string" },
    isResidual: { type: "boolean" },
    rationale: { type: "string", minLength: 1, maxLength: 400 },
  },
  required: [
    "category",
    "name",
    "quantity",
    "unit",
    "source",
    "comparable",
    "physicalMultiplier",
    "physicalJustification",
    "functionalMultiplier",
    "functionalJustification",
    "timeMultiplier",
    "timeBasis",
    "locationMultiplier",
    "locationBasis",
    "adjustedCostCents",
    "rationale",
  ],
};

export const CLASSIFY_CANDIDATES_V2_TOOL: Anthropic.Messages.Tool = {
  name: "submit_candidates",
  description:
    "Record the candidate line items for one slice (one photo or the receipts slice). No residual line — the downstream merge + finalize stages handle reconciliation.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        minItems: 0,
        maxItems: 80,
        items: candidateLineItemSchemaObj,
      },
      assumptions: {
        type: "string",
        description: "Short free-text list of assumptions for this slice.",
        maxLength: 1500,
      },
    },
    required: ["lineItems", "assumptions"],
  },
};

/**
 * Output schema for a single candidate call. Reuses the monolith's
 * per-item schema so the merge stage can work over a flat array without
 * any shape coercion. `isResidual` stays optional in the line-item
 * schema; we assert downstream that no candidate sets it to true.
 */
export const classifyCandidatesV2OutputSchema = z.object({
  lineItems: z.array(assetLineItemV2Schema).min(0).max(80),
  assumptions: z.string().max(1500),
});

export type ClassifyCandidatesV2Output = z.infer<typeof classifyCandidatesV2OutputSchema>;
