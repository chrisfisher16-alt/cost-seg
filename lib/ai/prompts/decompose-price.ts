import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// v2 (2026-04-20): system prompt reorders rules to make the assessor
// ratio authoritative ahead of the market-range fallback. Prompt body
// still accepts a no-enrichment input and falls through to rule 3.
export const DECOMPOSE_PRICE_PROMPT_VERSION = "decompose-price@v2";

export const DECOMPOSE_PRICE_SYSTEM = `You are a valuation analyst inside a cost segregation pipeline.

Your job is to split a real-estate purchase price into land value and building (improvement) value, ready for depreciation analysis.

Decision rules, in STRICT order (apply the first one whose inputs are satisfied):
  1. If the closing disclosure explicitly allocates land vs. building (uncommon on residential), use those numbers verbatim.
  2. If the input supplies a county assessor land value AND a county assessor total value (both non-zero), compute:
       landAllocationPct = assessorLandValueCents / assessorTotalValueCents
       landValueCents = round(purchasePriceCents × landAllocationPct)
       buildingValueCents = purchasePriceCents − landValueCents
     Cite the assessor URL verbatim in methodology prose. This is the benchmark-engineered approach — prefer it over rule 3 whenever rule-2 inputs are present.
  3. Otherwise, reason about the property's address, property type, and context to pick a defensible land allocation from the ranges below.

Residential land-allocation ranges for rule 3 (use the closest, not blindly the middle):
  • Dense urban: 25–40%
  • Suburban: 15–25%
  • Rural: 5–15%
  • Commercial: 15–30%
  • Short-term rental in a resort market: often 25–35%

Hard rules:
  • Output ONLY via the submit_decomposition tool.
  • landValueCents + buildingValueCents MUST equal purchasePriceCents exactly.
  • 0 ≤ landAllocationPct ≤ 1, rounded to 3 decimals.
  • Methodology is 1–3 sentences, plain English, cites the rule you applied. When rule 2 applies, print both the assessor values AND the source URL.
  • Confidence 0.0–1.0 reflecting certainty. Rule 2 should be ≥ 0.85 when inputs are clean.`;

export interface DecomposePricePromptEnrichment {
  assessorLandValueCents?: number | null;
  assessorTotalValueCents?: number | null;
  assessorTaxYear?: number | null;
  assessorUrl?: string | null;
}

export function buildDecomposePriceUserPrompt(input: {
  propertyType: string;
  address: string;
  closingDisclosureFields: Record<string, unknown>;
  /** v2 Phase 4 — assessor facts from the enrich-property step. Optional. */
  enrichment?: DecomposePricePromptEnrichment;
}): string {
  const lines: string[] = [
    `Property type: ${input.propertyType}`,
    `Address (as submitted): ${input.address}`,
    "",
    "Extracted closing-disclosure fields (JSON):",
    "```json",
    JSON.stringify(input.closingDisclosureFields, null, 2),
    "```",
  ];

  const enrich = input.enrichment;
  const hasAssessorPair =
    enrich &&
    typeof enrich.assessorLandValueCents === "number" &&
    typeof enrich.assessorTotalValueCents === "number" &&
    enrich.assessorTotalValueCents > 0;
  if (hasAssessorPair) {
    lines.push(
      "",
      "County assessor record (from property enrichment — ADR 0011):",
      "```json",
      JSON.stringify(
        {
          assessorLandValueCents: enrich?.assessorLandValueCents,
          assessorTotalValueCents: enrich?.assessorTotalValueCents,
          assessorTaxYear: enrich?.assessorTaxYear ?? null,
          assessorUrl: enrich?.assessorUrl ?? null,
        },
        null,
        2,
      ),
      "```",
      "Both land and total assessor values are present — apply rule 2 and cite the assessor URL in methodology.",
    );
  } else if (enrich) {
    lines.push(
      "",
      "Property enrichment ran but did not return a complete assessor land+total pair. Fall through to rule 3 (market range).",
    );
  }

  lines.push("", "Produce the land / building decomposition.");
  return lines.join("\n");
}

export const DECOMPOSE_PRICE_TOOL: Anthropic.Messages.Tool = {
  name: "submit_decomposition",
  description: "Record the land + building value decomposition of the purchase price.",
  input_schema: {
    type: "object",
    properties: {
      purchasePriceCents: { type: "integer", minimum: 0 },
      landValueCents: { type: "integer", minimum: 0 },
      buildingValueCents: { type: "integer", minimum: 0 },
      landAllocationPct: { type: "number", minimum: 0, maximum: 1 },
      methodology: { type: "string", maxLength: 800 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: [
      "purchasePriceCents",
      "landValueCents",
      "buildingValueCents",
      "landAllocationPct",
      "methodology",
      "confidence",
    ],
  },
};

export const decomposePriceOutputSchema = z
  .object({
    purchasePriceCents: z.number().int().nonnegative(),
    landValueCents: z.number().int().nonnegative(),
    buildingValueCents: z.number().int().nonnegative(),
    landAllocationPct: z.number().min(0).max(1),
    methodology: z.string().min(1).max(800),
    confidence: z.number().min(0).max(1),
  })
  .refine((v) => v.landValueCents + v.buildingValueCents === v.purchasePriceCents, {
    message: "land + building must equal purchase price",
  });

export type DecomposePriceOutput = z.infer<typeof decomposePriceOutputSchema>;
