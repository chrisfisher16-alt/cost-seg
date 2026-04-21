import { describe, expect, it } from "vitest";

import {
  CONSTRUCTION_TYPES,
  ENRICH_PROPERTY_PROMPT_VERSION,
  ENRICH_PROPERTY_SYSTEM,
  ENRICH_PROPERTY_TOOL,
  ROOF_TYPES,
  buildEnrichPropertyUserPrompt,
  enrichPropertyOutputSchema,
  hasAssessorRatio,
} from "@/lib/ai/prompts/enrich-property";

describe("enrich-property prompt", () => {
  it("stamps a stable prompt version", () => {
    expect(ENRICH_PROPERTY_PROMPT_VERSION).toBe("enrich-property@v1");
  });

  it("system prompt holds the non-negotiables", () => {
    // Never fabricate URLs — the core of ADR 0011's honesty compromise.
    expect(ENRICH_PROPERTY_SYSTEM).toMatch(/never fabricate urls/i);
    // Must actually use web_search to ground its facts.
    expect(ENRICH_PROPERTY_SYSTEM).toMatch(/you have access to the web_search tool/i);
    // Forced tool-use path.
    expect(ENRICH_PROPERTY_SYSTEM).toMatch(/submit_enrichment/);
    // Listing "Est. Tax" is not the assessor's land/total.
    expect(ENRICH_PROPERTY_SYSTEM).toMatch(/Est\. Tax/);
  });

  it("exposes non-empty construction + roof vocabularies", () => {
    expect(CONSTRUCTION_TYPES.length).toBeGreaterThan(3);
    expect(ROOF_TYPES).toContain("metal");
    expect(ROOF_TYPES).toContain("composition_shingle");
  });

  it("Zod schema accepts a minimal output (confidence only)", () => {
    const ok = enrichPropertyOutputSchema.safeParse({
      confidence: { overall: 0.1, assessor: 0, listing: 0 },
    });
    expect(ok.success).toBe(true);
  });

  it("Zod schema accepts the full Edison-Street shape", () => {
    const ok = enrichPropertyOutputSchema.safeParse({
      squareFeet: 2197,
      yearBuilt: 1920,
      bedrooms: 3,
      bathrooms: 1,
      constructionType: "wood_frame",
      roofType: "metal",
      lotSizeSqft: 7884,
      assessorLandValueCents: 15_508_000,
      assessorTotalValueCents: 53_600_000,
      assessorTaxYear: 2022,
      assessorUrl: "https://gillespiecad.org/property/R012345",
      listingUrl: "https://www.redfin.com/TX/Fredericksburg/207-S-Edison-St-78624/home/128992219",
      confidence: { overall: 0.92, assessor: 0.95, listing: 0.85 },
    });
    expect(ok.success).toBe(true);
  });

  it("Zod schema rejects malformed URLs", () => {
    const bad = enrichPropertyOutputSchema.safeParse({
      assessorUrl: "not a url",
      confidence: { overall: 0.5, assessor: 0.5, listing: 0.5 },
    });
    expect(bad.success).toBe(false);
  });

  it("Zod schema rejects out-of-range square footage", () => {
    const bad = enrichPropertyOutputSchema.safeParse({
      squareFeet: 50, // too small
      confidence: { overall: 0.5, assessor: 0.5, listing: 0.5 },
    });
    expect(bad.success).toBe(false);
  });

  it("hasAssessorRatio returns true only when both land and total are present and non-zero", () => {
    const base = { confidence: { overall: 0.5, assessor: 0.5, listing: 0.5 } };
    expect(hasAssessorRatio({ ...base })).toBe(false);
    expect(
      hasAssessorRatio({ ...base, assessorLandValueCents: 100_000, assessorTotalValueCents: 0 }),
    ).toBe(false);
    expect(hasAssessorRatio({ ...base, assessorLandValueCents: 100_000 })).toBe(false);
    expect(
      hasAssessorRatio({
        ...base,
        assessorLandValueCents: 100_000,
        assessorTotalValueCents: 500_000,
      }),
    ).toBe(true);
  });

  it("user prompt includes intake sqft + year-built hints when provided", () => {
    const text = buildEnrichPropertyUserPrompt({
      propertyId: "p1",
      address: "207 S Edison",
      city: "Fredericksburg",
      state: "TX",
      zip: "78624",
      propertyType: "SHORT_TERM_RENTAL",
      intakeSquareFeet: 2197,
      intakeYearBuilt: 1920,
    });
    expect(text).toContain("207 S Edison");
    expect(text).toContain("Fredericksburg, TX 78624");
    expect(text).toContain("2197 sq ft");
    expect(text).toMatch(/intake year built: 1920/i);
    expect(text).toMatch(/use web_search/i);
  });

  it("user prompt omits intake lines when values are null", () => {
    const text = buildEnrichPropertyUserPrompt({
      propertyId: "p1",
      address: "1 Foo",
      city: "Austin",
      state: "TX",
      zip: "78701",
      propertyType: "COMMERCIAL",
      intakeSquareFeet: null,
      intakeYearBuilt: null,
    });
    expect(text).not.toMatch(/intake square footage/i);
    expect(text).not.toMatch(/intake year built/i);
  });

  it("tool schema allows explicit null on every public-record field", () => {
    const schema = ENRICH_PROPERTY_TOOL.input_schema as {
      required: string[];
      properties: Record<string, { type?: string | string[] }>;
    };
    // Only confidence is required. Everything else must be nullable so
    // a search that came up dry can still emit a valid submission.
    expect(schema.required).toEqual(["confidence"]);
    for (const key of [
      "squareFeet",
      "yearBuilt",
      "assessorLandValueCents",
      "assessorTotalValueCents",
      "assessorUrl",
      "listingUrl",
    ]) {
      const prop = schema.properties[key];
      expect(Array.isArray(prop?.type) && prop.type.includes("null")).toBe(true);
    }
  });
});
