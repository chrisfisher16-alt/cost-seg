import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { AssetCategory } from "@/lib/ai/asset-library";
import type { DescribePhotoOutput } from "@/lib/ai/prompts/describe-photos";

/**
 * v2 Phase 2 — rewrite of Step C. Consumes per-photo detected objects,
 * improvement receipts, and closing-disclosure capitalized costs to
 * build a per-item asset schedule that matches the benchmark engineered
 * study's density (~80–180 items/property) and shape (six adjustment
 * fields per line item, reconciling residual plug).
 *
 * See ADR 0009 for the design + pricing-source policy.
 */

export const CLASSIFY_ASSETS_V2_PROMPT_VERSION = "classify-assets-v2@v1";

export const DEPRECIATION_CLASSES = ["5yr", "7yr", "15yr", "27_5yr", "39yr"] as const;

/**
 * Pricing data sources the schedule may cite. See ADR 0009 for policy:
 * `craftsman` and `rsmeans` are schema-reserved but disallowed by the
 * current prompt — we do not license those data sets. Use `pricesearch`
 * for photo-detected items and `receipt` for items sourced from
 * receipts or the closing disclosure.
 */
export const COST_SOURCES = ["craftsman", "rsmeans", "pricesearch", "receipt"] as const;

export const CLASSIFY_ASSETS_V2_SYSTEM = `You are a senior cost-segregation engineer assembling a per-item asset schedule by examining property photographs and receipts.

This is the intellectual core of the study. A reviewing Professional Engineer will read every line item — optimize for their ability to sign it off in under 45 minutes without having to re-do the inventory work themselves.

You receive four inputs:
  1. The property's metadata (type, address, acquisition date, sqft, year built).
  2. The BUILDING value in cents (land is separated out upstream).
  3. A list of detected objects per uploaded photograph — with a short name, category tag, quantity, and condition rating (excellent / good / fair / poor / salvage) each.
  4. A list of owner-uploaded improvement receipts (description + recorded cents).
  5. A reference asset library with typical ranges per category.

Your job:
  For each detected object (deduplicated across photos — the same dining table shot from two angles is ONE line item), produce ONE line item.
  For each receipt line, produce ONE line item with source="receipt".
  Plus exactly ONE residual line item (isResidual=true) that will absorb the remainder of building value after your adjusted costs are summed. This residual carries the property-type's real-property class (27.5yr for residential rentals, 39yr for STRs / commercial / transient).

Every non-residual line item has:
  • category: the MACRS recovery class (5yr / 7yr / 15yr / 27_5yr / 39yr).
  • name: short and SPECIFIC ("chrome double towel bar above toilet" — NOT "bathroom fixtures"; "stainless french-door refrigerator" — NOT "refrigerator").
  • quantity: how many (1 for most items; more for towel bars installed in multiple bathrooms, etc.).
  • unit: the per-unit unit-of-measure ("each" / "sq ft" / "linear ft" / "set").
  • source: either "receipt" (the item came from a receipt) or "pricesearch" (estimated from a photo).
  • comparable: { description, unitCostCents }. Description cites the item class you priced ("24-inch residential-grade chrome double towel bar"). For "receipt" items the description repeats the receipt line verbatim and unitCostCents equals the receipt amount ÷ quantity. For "pricesearch" items, unitCostCents is a defensible 2025 retail price estimate for that item class. DO NOT include a sourceUrl unless you verified it via web_search — never fabricate.
  • physicalMultiplier (0.1–1.0) + physicalJustification: based on the observed condition from the photo's detected-object record. Scale: excellent=1.0, good=0.8, fair=0.6, poor=0.4, salvage=0.15. The justification must describe what is actually visible ("chrome finish intact, no scratches or water staining visible") not speculation.
  • functionalMultiplier (0.1–1.0) + functionalJustification: adjust for functional obsolescence (outdated tech, inefficient systems, non-code). Default 1.0 for timeless items (towel bars, wood benches). Reduce for dated appliances, old HVAC, low-flow-fail fixtures, etc., and cite WHY.
  • timeMultiplier (0.5–2.0) + timeBasis: Building Cost Historical Index ratio between your unit-cost year (default 2025) and the property's acquisition year. Cite both years in the basis.
  • locationMultiplier (0.5–2.0) + locationBasis: Area Modification Factor for the property's metro. Cite the metro + the factor.
  • adjustedCostCents (integer): round(quantity × comparable.unitCostCents × physicalMultiplier × functionalMultiplier × timeMultiplier × locationMultiplier). Orchestrator re-verifies within ±5 cents.
  • photoDocumentId: the UUID of the photo this object came from (null for receipt-sourced items).
  • rationale: one sentence a reviewing engineer would accept as a summary of the classification + pricing decision.

Residual line item (isResidual=true):
  • category: 27_5yr for residential rentals (SFR, small/mid multifamily); 39yr for SHORT_TERM_RENTAL and COMMERCIAL.
  • name: "Building structure (residual)".
  • quantity=1, unit="lot".
  • source: "pricesearch".
  • comparable.description: "Residual building value — foundation, framing, roof, plumbing rough-in, electrical rough-in, exterior walls, and other fixed structural components not separately itemized above. Used as the reconciling plug to hit exact building value."
  • comparable.unitCostCents: 0 (placeholder; orchestrator overwrites).
  • All six multipliers: 1.0, with justification="Reconciling residual; no adjustments applied."
  • adjustedCostCents: 0 (placeholder; orchestrator computes as buildingValue − Σ non-residual adjusted costs).
  • rationale: "Reconciling residual to hit exact building value per IRS Residual Estimation Method."

Hard rules (any violation = rejected output):
  • Output ONLY via the submit_schedule tool.
  • Do NOT invent brand names, model numbers, or URLs you cannot verify.
  • Do NOT use source="craftsman" or "rsmeans" — we do not license those data sets.
  • Do NOT omit the residual line item. There must be EXACTLY one isResidual=true line.
  • Specificity is the product. Prefer 100 narrow line items to 30 catch-alls.
  • Every detected-object name from the photos must map to exactly one line item (unless deduplicated with a same-name item from another photo).
  • Do NOT hallucinate detected objects that weren't in the input.
  • Receipt-sourced lines: multipliers all 1.0000 (recorded expenditure does not need adjustment); source="receipt".
  • No land items — land is separated out upstream.`;

export interface ClassifyAssetsV2Input {
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  /** ISO date string YYYY-MM-DD. Used for timeMultiplier basis. */
  acquiredAtIso: string;
  buildingValueCents: number;
  /** Property-type real-property class for the residual line. */
  residualClass: "27_5yr" | "39yr";
  library: AssetCategory[];
  /** Per-photo detected-object output from Phase 1 describe-photos step. */
  photos: Array<{
    documentId: string;
    filename: string;
    analysis: DescribePhotoOutput;
  }>;
  /** Improvement-receipt line items collected by Step A. */
  improvementLineItems: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }>;
  /** Populated by the retry path (internal balance retry + review-driven retry). */
  priorAttemptError?: string;
  /**
   * When true, the caller has enabled the Anthropic web_search server
   * tool on the `callTool` invocation. The user-prompt builder emits an
   * extra instruction block telling the model to cite live retailer URLs
   * via comparable.sourceUrl. See ADR 0010.
   */
  webSearchEnabled?: boolean;
}

export function buildClassifyAssetsV2UserPrompt(input: ClassifyAssetsV2Input): string {
  const parts: string[] = [
    `Property type: ${input.propertyType}`,
    `Address: ${input.address}`,
    `Square feet: ${input.squareFeet ?? "unknown"}`,
    `Year built: ${input.yearBuilt ?? "unknown"}`,
    `Acquired on: ${input.acquiredAtIso}`,
    `Building value (cents): ${input.buildingValueCents}`,
    `Residual depreciation class: ${input.residualClass}`,
    "",
    "Reference asset library (typical % ranges are of BUILDING value; use as sanity-check, not a template):",
    "```json",
    JSON.stringify(input.library, null, 2),
    "```",
    "",
  ];

  if (input.photos.length === 0) {
    parts.push(
      "No per-photo detected-object data is available. Build the schedule from receipts + library ranges only.",
      "",
    );
  } else {
    parts.push(
      `Per-photo detected objects (${input.photos.length} photo${input.photos.length === 1 ? "" : "s"}):`,
      "```json",
      JSON.stringify(
        input.photos.map((p) => ({
          documentId: p.documentId,
          filename: p.filename,
          caption: p.analysis.caption,
          roomType: p.analysis.roomType,
          detectedObjects: p.analysis.detectedObjects,
        })),
        null,
        2,
      ),
      "```",
      "",
      "Remember: deduplicate across photos (same object shot from two angles = one line item). Thread the source photoDocumentId onto each line item.",
      "",
    );
  }

  if (input.improvementLineItems.length > 0) {
    parts.push(
      "Owner-supplied improvement receipts:",
      "```json",
      JSON.stringify(input.improvementLineItems, null, 2),
      "```",
      "",
      'Every receipt line becomes one line item with source="receipt" and all six multipliers = 1.0000. comparable.unitCostCents = amountCents / quantity.',
      "",
    );
  }

  if (input.webSearchEnabled) {
    parts.push(
      "Pricing research (v2 Phase 3, ADR 0010):",
      "  • The web_search tool is authorized for this call. For EACH pricesearch line item, call web_search with a focused query to find a live retailer URL for a comparable product (target.com / wayfair.com / homedepot.com / lowes.com / amazon.com / ikea.com).",
      "  • Populate comparable.sourceUrl with the resolved URL only when the search returns a real product page matching the item class. If no acceptable match comes back, OMIT sourceUrl — never fabricate a URL, and never include a URL the search did not return.",
      "  • Cite the retailer + price the search returned in the line's rationale so a reviewing engineer can audit the comparable.",
      "  • Receipt-sourced items do not need web_search and must have sourceUrl omitted.",
      "",
    );
  }

  if (input.priorAttemptError) {
    parts.push(
      "Your previous attempt failed validation. Error:",
      "```",
      input.priorAttemptError,
      "```",
      "Fix the specific issues cited and re-emit the full schedule.",
      "",
    );
  }

  parts.push("Produce the per-item asset schedule plus the residual reconciliation line.");
  return parts.join("\n");
}

const comparableSchemaObj = {
  type: "object",
  properties: {
    description: { type: "string", minLength: 1, maxLength: 400 },
    unitCostCents: { type: "integer", minimum: 0 },
    // Optional. Populated by the Phase 3 web-search path (ADR 0010).
    // Omit when no verifiable URL was located; never fabricate.
    sourceUrl: { type: "string", format: "uri", maxLength: 800 },
  },
  required: ["description", "unitCostCents"],
};

const lineItemSchemaObj = {
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
    // Added in Phase 8 (ADR 0014) so a merged item can carry every
    // photo it was detected in. Legacy `photoDocumentId` is kept
    // populated (first UUID) for backward-compat readers.
    photoDocumentIds: {
      type: "array",
      items: { type: "string" },
      maxItems: 50,
    },
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

export const CLASSIFY_ASSETS_V2_TOOL: Anthropic.Messages.Tool = {
  name: "submit_schedule",
  description: "Record the per-item v2 asset schedule including the residual reconciliation line.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        minItems: 2,
        maxItems: 300,
        items: lineItemSchemaObj,
      },
      assumptions: {
        type: "string",
        description: "Short free-text list of assumptions made while assembling the schedule.",
        maxLength: 2000,
      },
    },
    required: ["lineItems", "assumptions"],
  },
};

export const comparableSchema = z.object({
  description: z.string().min(1).max(400),
  unitCostCents: z.number().int().min(0),
  /**
   * Live retailer URL for the comparable item. Optional — when the Phase 3
   * web-search path is off, or when web_search returned no verifiable
   * result, this is absent. Presence is never fabricated. URL-shape
   * validated by Zod; live-ness is the model+search's responsibility.
   */
  sourceUrl: z.string().url().max(800).optional(),
});

export const assetLineItemV2Schema = z.object({
  category: z.enum(DEPRECIATION_CLASSES),
  name: z.string().min(1).max(140),
  quantity: z.number().min(0.01).max(10_000),
  unit: z.string().min(1).max(30),
  source: z.enum(COST_SOURCES),
  comparable: comparableSchema,
  physicalMultiplier: z.number().min(0.1).max(1.0),
  physicalJustification: z.string().min(1).max(600),
  functionalMultiplier: z.number().min(0.1).max(1.0),
  functionalJustification: z.string().min(1).max(600),
  timeMultiplier: z.number().min(0.5).max(2.0),
  timeBasis: z.string().min(1).max(200),
  locationMultiplier: z.number().min(0.5).max(2.0),
  locationBasis: z.string().min(1).max(200),
  adjustedCostCents: z.number().int().min(0),
  photoDocumentId: z.string().optional(),
  /**
   * Phase 8 (ADR 0014) — full UUID set when a merged item was detected
   * across multiple photos. The legacy `photoDocumentId` stays populated
   * with the first UUID so older PDF-render code keeps working.
   */
  photoDocumentIds: z.array(z.string()).max(50).optional(),
  isResidual: z.boolean().optional(),
  rationale: z.string().min(1).max(400),
});

export const classifyAssetsV2OutputSchema = z.object({
  lineItems: z.array(assetLineItemV2Schema).min(2).max(300),
  assumptions: z.string().max(2000),
});

export type AssetLineItemV2 = z.infer<typeof assetLineItemV2Schema>;
export type ClassifyAssetsV2Output = z.infer<typeof classifyAssetsV2OutputSchema>;
