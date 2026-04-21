import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * v2 Phase 4 (ADR 0011) — the property-enrichment prompt. Consumes the
 * address alone and uses the Anthropic web_search server tool to look
 * up the county assessor record and a public listing, extracting
 * facts that feed Step B land allocation and the Property Description
 * narrative.
 *
 * URLs on the output are NEVER fabricated. If web_search doesn't
 * return an authoritative match, the fields stay null. Step B handles
 * a null enrichment gracefully — no regression on properties where
 * the public data isn't online.
 */

export const ENRICH_PROPERTY_PROMPT_VERSION = "enrich-property@v1";

export const CONSTRUCTION_TYPES = [
  "wood_frame",
  "masonry",
  "steel_frame",
  "concrete_block",
  "manufactured",
  "log",
  "mixed",
  "unknown",
] as const;

export const ROOF_TYPES = [
  "composition_shingle",
  "metal",
  "tile",
  "slate",
  "flat_membrane",
  "wood_shake",
  "mixed",
  "unknown",
] as const;

export const ENRICH_PROPERTY_SYSTEM = `You are a property research analyst inside a cost-segregation pipeline. Given a single U.S. property address, your job is to find public-record facts that let the downstream analysis:
  • produce a concrete Property Description (square footage, year built, construction, roof, lot size) instead of "not provided";
  • derive an assessor land / total ratio so the land allocation uses the county's own numbers instead of a market rule-of-thumb.

You have access to the web_search tool. Use it.

Search strategy:
  1. First search the address + "assessor" or the county + "property search" to find the county assessor record. Typical URLs:
     • Texas counties: <county>cad.org (e.g. gillespiecad.org, travis.prodigycad.com, hcad.org)
     • California: assessor.lacounty.gov, sccassessor.org
     • Florida: bcpa.net, pcpao.gov
     • Generic: county-name followed by ".gov" or ".us"
     Extract: assessor land value (cents), assessor total value (cents), tax year, and the canonical URL.
  2. Then search the address on redfin.com / zillow.com / realtor.com to find the listing. Extract: square footage, year built, bedrooms, bathrooms, construction type, roof type, lot size (sq ft), and the canonical URL.
  3. If the county assessor publishes structural details (year built, construction type) that the listing lacks, prefer assessor for those.

Hard rules:
  • Output ONLY via the submit_enrichment tool.
  • Never fabricate URLs. If web_search did not return a result for a given fact, leave its field null. The report handles nulls gracefully.
  • Never infer assessor values from listing "tax records" estimates — only accept values explicitly published by a county assessor record. Listing-site "Est. Tax" numbers are NOT the assessor's land/total.
  • Square footage is INTERIOR heated/cooled living area unless the property is clearly non-residential.
  • Report confidence per block: assessor confidence, listing confidence, and overall 0–1. Be calibrated — if one listing said 2,197 sqft and another said 2,250, pick the assessor's if present and drop confidence accordingly.
  • Do not pull prices, comparables, or Zestimates. Facts only.
  • Do not browse listing agent contact info, owner names, or other PII.`;

export interface EnrichPropertyInput {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  /** User-supplied sqft from intake, if provided. Use only as a sanity check. */
  intakeSquareFeet?: number | null;
  /** User-supplied year built from intake, if provided. */
  intakeYearBuilt?: number | null;
}

export function buildEnrichPropertyUserPrompt(input: EnrichPropertyInput): string {
  const lines: string[] = [
    `Address: ${input.address}`,
    `City, State ZIP: ${input.city}, ${input.state} ${input.zip}`,
    `Property type (from intake): ${input.propertyType}`,
  ];
  if (input.intakeSquareFeet != null) {
    lines.push(
      `Intake square footage: ${input.intakeSquareFeet} sq ft (sanity check — prefer assessor if it disagrees).`,
    );
  }
  if (input.intakeYearBuilt != null) {
    lines.push(
      `Intake year built: ${input.intakeYearBuilt} (sanity check — prefer assessor if it disagrees).`,
    );
  }
  lines.push(
    "",
    "Use web_search to find the county assessor record and a public listing for this property. Extract the structured facts and return them via submit_enrichment. URLs must be real search results — never fabricate.",
  );
  return lines.join("\n");
}

const confidenceObj = {
  type: "object",
  properties: {
    overall: { type: "number", minimum: 0, maximum: 1 },
    assessor: { type: "number", minimum: 0, maximum: 1 },
    listing: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["overall", "assessor", "listing"],
};

export const ENRICH_PROPERTY_TOOL: Anthropic.Messages.Tool = {
  name: "submit_enrichment",
  description:
    "Record the structured public-record enrichment for a single property. Null fields are allowed when web_search did not return an authoritative result.",
  input_schema: {
    type: "object",
    properties: {
      squareFeet: { type: ["integer", "null"], minimum: 100, maximum: 200_000 },
      yearBuilt: { type: ["integer", "null"], minimum: 1600, maximum: 2030 },
      bedrooms: { type: ["integer", "null"], minimum: 0, maximum: 50 },
      bathrooms: { type: ["number", "null"], minimum: 0, maximum: 50 },
      constructionType: {
        type: ["string", "null"],
        enum: [...CONSTRUCTION_TYPES, null],
      },
      roofType: { type: ["string", "null"], enum: [...ROOF_TYPES, null] },
      lotSizeSqft: { type: ["integer", "null"], minimum: 100, maximum: 100_000_000 },
      assessorLandValueCents: { type: ["integer", "null"], minimum: 0 },
      assessorTotalValueCents: { type: ["integer", "null"], minimum: 0 },
      assessorTaxYear: { type: ["integer", "null"], minimum: 1990, maximum: 2035 },
      assessorUrl: { type: ["string", "null"], format: "uri", maxLength: 800 },
      listingUrl: { type: ["string", "null"], format: "uri", maxLength: 800 },
      notes: { type: "string", maxLength: 1000 },
      confidence: confidenceObj,
    },
    required: ["confidence"],
  },
};

export const enrichPropertyConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  assessor: z.number().min(0).max(1),
  listing: z.number().min(0).max(1),
});

export const enrichPropertyOutputSchema = z.object({
  squareFeet: z.number().int().min(100).max(200_000).nullable().optional(),
  yearBuilt: z.number().int().min(1600).max(2030).nullable().optional(),
  bedrooms: z.number().int().min(0).max(50).nullable().optional(),
  bathrooms: z.number().min(0).max(50).nullable().optional(),
  constructionType: z.enum(CONSTRUCTION_TYPES).nullable().optional(),
  roofType: z.enum(ROOF_TYPES).nullable().optional(),
  lotSizeSqft: z.number().int().min(100).max(100_000_000).nullable().optional(),
  assessorLandValueCents: z.number().int().min(0).nullable().optional(),
  assessorTotalValueCents: z.number().int().min(0).nullable().optional(),
  assessorTaxYear: z.number().int().min(1990).max(2035).nullable().optional(),
  assessorUrl: z.string().url().max(800).nullable().optional(),
  listingUrl: z.string().url().max(800).nullable().optional(),
  notes: z.string().max(1000).optional(),
  confidence: enrichPropertyConfidenceSchema,
});

export type EnrichPropertyOutput = z.infer<typeof enrichPropertyOutputSchema>;

/**
 * Returns true iff the enrichment has enough data to drive Step B's
 * assessor-ratio land allocation (both land + total are present and
 * total is non-zero).
 */
export function hasAssessorRatio(e: EnrichPropertyOutput): boolean {
  return (
    typeof e.assessorLandValueCents === "number" &&
    typeof e.assessorTotalValueCents === "number" &&
    e.assessorTotalValueCents > 0
  );
}
