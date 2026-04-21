import { describe, expect, it } from "vitest";

import { getAssetLibrary } from "@/lib/ai/asset-library";
import {
  CLASSIFY_ASSETS_V2_PROMPT_VERSION,
  CLASSIFY_ASSETS_V2_SYSTEM,
  CLASSIFY_ASSETS_V2_TOOL,
  buildClassifyAssetsV2UserPrompt,
  classifyAssetsV2OutputSchema,
} from "@/lib/ai/prompts/classify-assets-v2";

describe("classify-assets-v2 prompt", () => {
  it("stamps a stable prompt version", () => {
    expect(CLASSIFY_ASSETS_V2_PROMPT_VERSION).toBe("classify-assets-v2@v1");
  });

  it("system prompt enforces non-negotiables", () => {
    // Residual plug invariant.
    expect(CLASSIFY_ASSETS_V2_SYSTEM).toMatch(/isResidual=true/);
    // No-fabrication rule for URLs / brands.
    expect(CLASSIFY_ASSETS_V2_SYSTEM).toMatch(/do not invent/i);
    // Craftsman / RSMeans disallowed.
    expect(CLASSIFY_ASSETS_V2_SYSTEM).toMatch(/do not license/i);
    // Specificity rule.
    expect(CLASSIFY_ASSETS_V2_SYSTEM).toMatch(/specificity is the product/i);
    // Forced tool-use path.
    expect(CLASSIFY_ASSETS_V2_SYSTEM).toMatch(/submit_schedule/);
  });

  it("tool schema requires the six adjustment fields on every line item", () => {
    const toolSchema = CLASSIFY_ASSETS_V2_TOOL.input_schema as {
      properties: {
        lineItems: { items: { required: string[] }; maxItems: number; minItems: number };
      };
    };
    const itemRequired = toolSchema.properties.lineItems.items.required;
    for (const key of [
      "physicalMultiplier",
      "physicalJustification",
      "functionalMultiplier",
      "functionalJustification",
      "timeMultiplier",
      "timeBasis",
      "locationMultiplier",
      "locationBasis",
      "adjustedCostCents",
      "quantity",
      "unit",
      "source",
      "comparable",
    ]) {
      expect(itemRequired).toContain(key);
    }
    const li = toolSchema.properties.lineItems;
    // maxItems raised to 300 so real per-object density fits.
    expect(li.maxItems).toBe(300);
    // minItems 2 enforces "at least one detected item + residual".
    expect(li.minItems).toBe(2);
  });

  it("Zod schema accepts a minimal valid line item", () => {
    const ok = classifyAssetsV2OutputSchema.safeParse({
      lineItems: [
        {
          category: "5yr",
          name: "Chrome double towel bar above toilet",
          quantity: 1,
          unit: "each",
          source: "pricesearch",
          comparable: {
            description: "24-inch residential-grade chrome double towel bar",
            unitCostCents: 5200,
          },
          physicalMultiplier: 1.0,
          physicalJustification: "Finish intact, no visible scratches.",
          functionalMultiplier: 1.0,
          functionalJustification: "Timeless fixture; no functional obsolescence.",
          timeMultiplier: 0.9434,
          timeBasis: "Building Cost Index 2025 → 2022",
          locationMultiplier: 1.09,
          locationBasis: "Austin TX Area Modification Factor 1.09",
          adjustedCostCents: 5348,
          rationale: "Photo-observed fixture; standard residential pricing.",
        },
        {
          category: "27_5yr",
          name: "Building structure (residual)",
          quantity: 1,
          unit: "lot",
          source: "pricesearch",
          comparable: {
            description: "Residual building value placeholder",
            unitCostCents: 0,
          },
          physicalMultiplier: 1,
          physicalJustification: "Reconciling residual; no adjustments applied.",
          functionalMultiplier: 1,
          functionalJustification: "Reconciling residual; no adjustments applied.",
          timeMultiplier: 1,
          timeBasis: "Reconciling residual; no adjustments applied.",
          locationMultiplier: 1,
          locationBasis: "Reconciling residual; no adjustments applied.",
          adjustedCostCents: 0,
          isResidual: true,
          rationale: "Reconciling residual to hit exact building value.",
        },
      ],
      assumptions: "assumed Austin-metro AMF",
    });
    expect(ok.success).toBe(true);
  });

  it("Zod schema rejects invalid cost source", () => {
    const bad = classifyAssetsV2OutputSchema.safeParse({
      lineItems: [
        {
          category: "5yr",
          name: "x",
          quantity: 1,
          unit: "each",
          source: "fabricated",
          comparable: { description: "d", unitCostCents: 0 },
          physicalMultiplier: 1,
          physicalJustification: "j",
          functionalMultiplier: 1,
          functionalJustification: "j",
          timeMultiplier: 1,
          timeBasis: "b",
          locationMultiplier: 1,
          locationBasis: "b",
          adjustedCostCents: 0,
          rationale: "r",
        },
      ],
      assumptions: "",
    });
    expect(bad.success).toBe(false);
  });

  it("Zod schema bounds multiplier ranges", () => {
    const overPhysical = classifyAssetsV2OutputSchema.safeParse({
      lineItems: [
        {
          category: "5yr",
          name: "x",
          quantity: 1,
          unit: "each",
          source: "pricesearch",
          comparable: { description: "d", unitCostCents: 100 },
          physicalMultiplier: 1.5, // out of range
          physicalJustification: "j",
          functionalMultiplier: 1,
          functionalJustification: "j",
          timeMultiplier: 1,
          timeBasis: "b",
          locationMultiplier: 1,
          locationBasis: "b",
          adjustedCostCents: 150,
          rationale: "r",
        },
      ],
      assumptions: "",
    });
    expect(overPhysical.success).toBe(false);
  });

  it("user prompt builder threads photo inputs into the prompt JSON", () => {
    const library = getAssetLibrary("SHORT_TERM_RENTAL");
    const text = buildClassifyAssetsV2UserPrompt({
      propertyType: "SHORT_TERM_RENTAL",
      address: "207 S Edison",
      squareFeet: 2197,
      yearBuilt: 1920,
      acquiredAtIso: "2022-03-21",
      buildingValueCents: 36_285_100,
      residualClass: "39yr",
      library,
      photos: [
        {
          documentId: "p1",
          filename: "bath.jpg",
          analysis: {
            caption: "Primary bath",
            roomType: "primary_bath",
            roomConfidence: 0.95,
            detectedObjects: [
              {
                name: "chrome double towel bar",
                category: "fixture",
                quantity: 1,
                condition: "excellent",
                conditionJustification: "finish intact",
              },
            ],
          },
        },
      ],
      improvementLineItems: [{ description: "HVAC replacement", amountCents: 12_500_00 }],
    });
    expect(text).toContain("207 S Edison");
    expect(text).toContain("Building value (cents): 36285100");
    expect(text).toContain("39yr");
    expect(text).toMatch(/Per-photo detected objects/);
    expect(text).toContain("chrome double towel bar");
    expect(text).toMatch(/improvement receipts/i);
    expect(text).toContain("HVAC replacement");
  });

  it("user prompt builder handles the no-photos case gracefully", () => {
    const library = getAssetLibrary("SHORT_TERM_RENTAL");
    const text = buildClassifyAssetsV2UserPrompt({
      propertyType: "SHORT_TERM_RENTAL",
      address: "1 test",
      squareFeet: 1000,
      yearBuilt: 2000,
      acquiredAtIso: "2020-01-01",
      buildingValueCents: 1_000_000,
      residualClass: "39yr",
      library,
      photos: [],
      improvementLineItems: [],
    });
    expect(text).toMatch(/No per-photo detected-object data is available/);
  });

  it("user prompt builder appends prior-attempt error on retry", () => {
    const library = getAssetLibrary("SHORT_TERM_RENTAL");
    const text = buildClassifyAssetsV2UserPrompt({
      propertyType: "SHORT_TERM_RENTAL",
      address: "1 test",
      squareFeet: 1000,
      yearBuilt: 2000,
      acquiredAtIso: "2020-01-01",
      buildingValueCents: 1_000_000,
      residualClass: "39yr",
      library,
      photos: [],
      improvementLineItems: [],
      priorAttemptError: "Missing residual line",
    });
    expect(text).toContain("Missing residual line");
    expect(text).toMatch(/previous attempt failed/i);
  });

  it("user prompt omits the web-search block by default", () => {
    const library = getAssetLibrary("SHORT_TERM_RENTAL");
    const text = buildClassifyAssetsV2UserPrompt({
      propertyType: "SHORT_TERM_RENTAL",
      address: "1 test",
      squareFeet: 1000,
      yearBuilt: 2000,
      acquiredAtIso: "2020-01-01",
      buildingValueCents: 1_000_000,
      residualClass: "39yr",
      library,
      photos: [],
      improvementLineItems: [],
    });
    expect(text).not.toMatch(/web_search tool is authorized/i);
  });

  it("user prompt appends the web-search instruction when enabled", () => {
    const library = getAssetLibrary("SHORT_TERM_RENTAL");
    const text = buildClassifyAssetsV2UserPrompt({
      propertyType: "SHORT_TERM_RENTAL",
      address: "1 test",
      squareFeet: 1000,
      yearBuilt: 2000,
      acquiredAtIso: "2020-01-01",
      buildingValueCents: 1_000_000,
      residualClass: "39yr",
      library,
      photos: [],
      improvementLineItems: [],
      webSearchEnabled: true,
    });
    expect(text).toMatch(/web_search tool is authorized/i);
    expect(text).toMatch(/target\.com/);
    expect(text).toMatch(/never fabricate/i);
  });

  it("Zod schema accepts comparable.sourceUrl when present and URL-shaped", () => {
    const ok = classifyAssetsV2OutputSchema.safeParse({
      lineItems: [
        {
          category: "5yr",
          name: "fridge",
          quantity: 1,
          unit: "each",
          source: "pricesearch",
          comparable: {
            description: "stainless french-door refrigerator",
            unitCostCents: 150_000,
            sourceUrl: "https://www.wayfair.com/appliances/pdp/w12345.html",
          },
          physicalMultiplier: 1,
          physicalJustification: "new",
          functionalMultiplier: 1,
          functionalJustification: "modern",
          timeMultiplier: 1,
          timeBasis: "b",
          locationMultiplier: 1,
          locationBasis: "b",
          adjustedCostCents: 150_000,
          rationale: "r",
        },
        {
          category: "27_5yr",
          name: "residual",
          quantity: 1,
          unit: "lot",
          source: "pricesearch",
          comparable: { description: "r", unitCostCents: 0 },
          physicalMultiplier: 1,
          physicalJustification: "r",
          functionalMultiplier: 1,
          functionalJustification: "r",
          timeMultiplier: 1,
          timeBasis: "r",
          locationMultiplier: 1,
          locationBasis: "r",
          adjustedCostCents: 0,
          isResidual: true,
          rationale: "r",
        },
      ],
      assumptions: "",
    });
    expect(ok.success).toBe(true);
  });

  it("Zod schema rejects malformed sourceUrl", () => {
    const bad = classifyAssetsV2OutputSchema.safeParse({
      lineItems: [
        {
          category: "5yr",
          name: "x",
          quantity: 1,
          unit: "each",
          source: "pricesearch",
          comparable: { description: "d", unitCostCents: 1_000, sourceUrl: "not a url" },
          physicalMultiplier: 1,
          physicalJustification: "j",
          functionalMultiplier: 1,
          functionalJustification: "j",
          timeMultiplier: 1,
          timeBasis: "b",
          locationMultiplier: 1,
          locationBasis: "b",
          adjustedCostCents: 1_000,
          rationale: "r",
        },
      ],
      assumptions: "",
    });
    expect(bad.success).toBe(false);
  });
});
