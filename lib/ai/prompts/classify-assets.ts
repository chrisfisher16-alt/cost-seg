import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { AssetCategory } from "@/lib/ai/asset-library";

export const CLASSIFY_ASSETS_PROMPT_VERSION = "classify-assets@v1";

export const DEPRECIATION_CLASSES = ["5yr", "7yr", "15yr", "27_5yr", "39yr"] as const;

export const CLASSIFY_ASSETS_SYSTEM = `You are a cost-segregation senior engineer assembling the asset schedule for a property.

This is the core intellectual work of the study. A licensed Professional Engineer will review your schedule before it's delivered to an audit-defensible tier; optimize for their ability to sign it off in under 45 minutes.

You will be given:
  • The property's metadata (type, address, sqft, year built).
  • The BUILDING value in cents (land is already separated out — your schedule must cover building value only).
  • Optional itemized improvement receipts the owner uploaded.
  • A property-type-specific asset library with typical % ranges per category.

Your job:
  1. For every asset category that applies, return a line item with:
     • a short, specific name,
     • its MACRS depreciation class (5yr / 7yr / 15yr / 27_5yr / 39yr),
     • a cents amount,
     • the basis flag (percentage_of_building, itemized_receipt, or comparable_study),
     • percentOfBuilding (0–1, rounded to 4 decimals) when basis is percentage_of_building,
     • a one-sentence rationale a reviewing engineer would accept.
  2. Prefer itemized_receipt over percentage_of_building when receipts are available.
  3. The sum of amountCents across ALL line items MUST equal the buildingValueCents exactly (±$0.50 is NOT acceptable — aim for exact).

The 13 elements of the IRS Cost Segregation ATG (Pub 5653) require: preparer credentials, methodology, site visit notes, quality of data, primary sources, reconciliation, cost reporting, scope, assumptions, contingencies, explanation of depreciation, cost of each asset, and sources consulted. Your schedule feeds items 7–12. Be specific and defensible.

Hard rules:
  • Output ONLY via the submit_schedule tool.
  • No land items (land was separated out upstream).
  • Every amountCents is a positive integer.
  • Do not invent receipts that were not provided.`;

export interface ClassifyAssetsInput {
  propertyType: string;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  buildingValueCents: number;
  library: AssetCategory[];
  improvementLineItems: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }>;
  /** When present, appended to the user prompt so the model can correct a validator miss. */
  priorAttemptError?: string;
}

export function buildClassifyAssetsUserPrompt(input: ClassifyAssetsInput): string {
  const parts: string[] = [
    `Property type: ${input.propertyType}`,
    `Address: ${input.address}`,
    `Square feet: ${input.squareFeet ?? "unknown"}`,
    `Year built: ${input.yearBuilt ?? "unknown"}`,
    `Building value (cents): ${input.buildingValueCents}`,
    "",
    "Asset library (typical % ranges are of BUILDING value, not purchase price):",
    "```json",
    JSON.stringify(input.library, null, 2),
    "```",
    "",
  ];

  if (input.improvementLineItems.length) {
    parts.push(
      "Itemized improvements from uploaded receipts:",
      "```json",
      JSON.stringify(input.improvementLineItems, null, 2),
      "```",
      "",
      "Use these as itemized_receipt basis where applicable; cover the remaining building value with percentage_of_building line items.",
      "",
    );
  } else {
    parts.push(
      "No itemized receipts were provided. Use percentage_of_building basis throughout, anchored to the library ranges.",
      "",
    );
  }

  if (input.priorAttemptError) {
    parts.push(
      "Your previous attempt did not balance. Error:",
      "```",
      input.priorAttemptError,
      "```",
      "Recalculate so the line items sum EXACTLY to the building value in cents.",
      "",
    );
  }

  parts.push("Produce the asset schedule.");
  return parts.join("\n");
}

export const CLASSIFY_ASSETS_TOOL: Anthropic.Messages.Tool = {
  name: "submit_schedule",
  description: "Record the cost-segregation asset schedule for the study.",
  input_schema: {
    type: "object",
    properties: {
      lineItems: {
        type: "array",
        minItems: 1,
        maxItems: 40,
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: [...DEPRECIATION_CLASSES] },
            name: { type: "string", minLength: 1, maxLength: 120 },
            amountCents: { type: "integer", minimum: 1 },
            basis: {
              type: "string",
              enum: ["percentage_of_building", "itemized_receipt", "comparable_study"],
            },
            percentOfBuilding: { type: "number", minimum: 0, maximum: 1 },
            rationale: { type: "string", minLength: 1, maxLength: 400 },
          },
          required: ["category", "name", "amountCents", "basis", "rationale"],
        },
      },
      assumptions: {
        type: "string",
        description: "Short free-text list of assumptions you made.",
        maxLength: 1200,
      },
    },
    required: ["lineItems", "assumptions"],
  },
};

export const assetLineItemSchema = z.object({
  category: z.enum(DEPRECIATION_CLASSES),
  name: z.string().min(1).max(120),
  amountCents: z.number().int().positive(),
  basis: z.enum(["percentage_of_building", "itemized_receipt", "comparable_study"]),
  percentOfBuilding: z.number().min(0).max(1).optional(),
  rationale: z.string().min(1).max(400),
});

export const classifyAssetsOutputSchema = z.object({
  lineItems: z.array(assetLineItemSchema).min(1).max(40),
  assumptions: z.string().max(1200),
});

export type AssetLineItem = z.infer<typeof assetLineItemSchema>;
export type ClassifyAssetsOutput = z.infer<typeof classifyAssetsOutputSchema>;
