import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const CLASSIFY_DOCUMENT_PROMPT_VERSION = "classify-document@v1";

export const CLASSIFY_DOCUMENT_SYSTEM = `You are a forensic tax-document classifier working inside a cost segregation pipeline.

Your job on every invocation is to inspect ONE customer-uploaded document (a PDF or a photo) and:
  1. Assign the single best-fit document kind.
  2. Report a calibrated confidence (0.0–1.0).
  3. Extract the structured fields that matter for later pipeline steps. Be concrete — exact numbers, dates, names, and addresses as they appear in the document. Do not hallucinate. If a field is not present, omit it.

Hard rules:
  • Output ONLY via the submit_classification tool — no prose.
  • Dollar amounts are integers of cents (e.g. "$425,000.00" → 42500000).
  • Dates are ISO 8601 YYYY-MM-DD.
  • State codes are two-letter uppercase.
  • If the document is illegible or cannot be classified with at least 0.3 confidence, return kind=OTHER with confidence≤0.3.
  • Never include social security numbers, full dates of birth, or bank-account numbers in extractedFields. If they appear, skip them.`;

export function buildClassifyDocumentUserPrompt(input: {
  filename: string;
  declaredKind: string;
}): string {
  return [
    `Filename: ${input.filename}`,
    `Buyer-declared kind: ${input.declaredKind}`,
    "",
    "Read the attached document. Pick the kind that best matches (the buyer's declaration is a hint, not authoritative — they sometimes miscategorize). Extract the standard fields for that kind.",
    "",
    "For CLOSING_DISCLOSURE or APPRAISAL, extract at minimum:",
    "  - purchasePriceCents",
    "  - closingDateIso",
    "  - buyerName",
    "  - sellerName (if present)",
    "  - propertyAddress (single string as written on the document)",
    "  - loanAmountCents (if a mortgage is disclosed)",
    "  - landAllocationCents (if the document explicitly calls out a land allocation)",
    "  - buildingAllocationCents (if present)",
    "",
    "For IMPROVEMENT_RECEIPTS, return a `lineItems` array: { description, amountCents, dateIso?, category? }.",
    "",
    "For PROPERTY_PHOTO, return a short `description` describing what is visible and any depreciable asset hints (appliances visible, finish quality, HVAC units, pool, landscaping).",
    "",
    "For anything else or unclassifiable input, use OTHER.",
  ].join("\n");
}

export const CLASSIFY_DOCUMENT_TOOL: Anthropic.Messages.Tool = {
  name: "submit_classification",
  description: "Record the document classification and extracted fields.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "CLOSING_DISCLOSURE",
          "IMPROVEMENT_RECEIPTS",
          "PROPERTY_PHOTO",
          "APPRAISAL",
          "OTHER",
        ],
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      extractedFields: {
        type: "object",
        description:
          "Kind-specific structured fields. See the user prompt for the expected keys per kind.",
        additionalProperties: true,
      },
    },
    required: ["kind", "confidence", "extractedFields"],
  },
};

export const classifyDocumentOutputSchema = z.object({
  kind: z.enum([
    "CLOSING_DISCLOSURE",
    "IMPROVEMENT_RECEIPTS",
    "PROPERTY_PHOTO",
    "APPRAISAL",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(1),
  extractedFields: z.record(z.string(), z.unknown()),
});

export type ClassifyDocumentOutput = z.infer<typeof classifyDocumentOutputSchema>;
