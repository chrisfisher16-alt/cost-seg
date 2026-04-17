import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const DECOMPOSE_PRICE_PROMPT_VERSION = "decompose-price@v1";

export const DECOMPOSE_PRICE_SYSTEM = `You are a valuation analyst inside a cost segregation pipeline.

Your job is to split a real-estate purchase price into land value and building (improvement) value, ready for depreciation analysis.

Decision rules, in order:
  1. If the closing disclosure explicitly allocates land vs. building (uncommon on residential), use those numbers verbatim.
  2. If a county assessor ratio is cited in the input, use it.
  3. Otherwise, reason about the property's address, property type, and context to pick a defensible land allocation. Be explicit about your methodology and cite comparable practice.

Residential land-allocation ranges to anchor to (use the closest, not blindly the middle):
  • Dense urban: 25–40%
  • Suburban: 15–25%
  • Rural: 5–15%
  • Commercial: 15–30%
  • Short-term rental in a resort market: often 25–35%

Hard rules:
  • Output ONLY via the submit_decomposition tool.
  • landValueCents + buildingValueCents MUST equal purchasePriceCents exactly.
  • 0 ≤ landAllocationPct ≤ 1, rounded to 3 decimals.
  • Methodology is 1–3 sentences, plain English, cites the rule you applied.
  • Confidence 0.0–1.0 reflecting certainty.`;

export function buildDecomposePriceUserPrompt(input: {
  propertyType: string;
  address: string;
  closingDisclosureFields: Record<string, unknown>;
}): string {
  return [
    `Property type: ${input.propertyType}`,
    `Address (as submitted): ${input.address}`,
    "",
    "Extracted closing-disclosure fields (JSON):",
    "```json",
    JSON.stringify(input.closingDisclosureFields, null, 2),
    "```",
    "",
    "Produce the land / building decomposition.",
  ].join("\n");
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
