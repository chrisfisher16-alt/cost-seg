import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET, RECLASSIFICATION_RANGES, computeEstimate } from "@/lib/estimator/compute";
import { formatUsd, formatUsdRange, parseUsdInputToCents } from "@/lib/estimator/format";
import { estimatorInputSchema, PROPERTY_TYPES } from "@/lib/estimator/types";

describe("computeEstimate", () => {
  it("computes a 500k STR at the default bracket", () => {
    const result = computeEstimate({
      propertyType: "SHORT_TERM_RENTAL",
      purchasePriceCents: 50_000_000,
    });
    // STR range is 22–30%. 500_000 * 0.22 = 110_000, * 0.30 = 150_000.
    expect(result.reclassifiedLowCents).toBe(11_000_000);
    expect(result.reclassifiedHighCents).toBe(15_000_000);
    // at 32% bracket: 35_200 – 48_000
    expect(result.savingsLowCents).toBe(3_520_000);
    expect(result.savingsHighCents).toBe(4_800_000);
    expect(result.assumedBracket).toBe(DEFAULT_BRACKET);
  });

  it("applies a custom tax bracket", () => {
    const result = computeEstimate({
      propertyType: "COMMERCIAL",
      purchasePriceCents: 100_000_000, // $1M
      taxBracket: 0.37,
    });
    // COMMERCIAL 25–35% of $1M → $250k–$350k; at 37% → $92.5k–$129.5k
    expect(result.savingsLowCents).toBe(9_250_000);
    expect(result.savingsHighCents).toBe(12_950_000);
    expect(result.assumedBracket).toBe(0.37);
  });

  it("covers every property type with sane ranges", () => {
    for (const propertyType of PROPERTY_TYPES) {
      const r = computeEstimate({ propertyType, purchasePriceCents: 10_000_000 });
      expect(r.reclassifiedLowCents).toBeGreaterThan(0);
      expect(r.reclassifiedHighCents).toBeGreaterThan(r.reclassifiedLowCents);
      expect(r.savingsHighCents).toBeGreaterThan(r.savingsLowCents);
      const { low, high } = RECLASSIFICATION_RANGES[propertyType];
      expect(r.lowPct).toBe(low);
      expect(r.highPct).toBe(high);
    }
  });

  it("never produces a high below the low", () => {
    for (const propertyType of PROPERTY_TYPES) {
      const { low, high } = RECLASSIFICATION_RANGES[propertyType];
      expect(high).toBeGreaterThan(low);
    }
  });
});

describe("estimatorInputSchema", () => {
  it("rejects non-positive purchase price", () => {
    const result = estimatorInputSchema.safeParse({
      propertyType: "SINGLE_FAMILY_RENTAL",
      purchasePriceCents: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects purchase price over $1B", () => {
    const result = estimatorInputSchema.safeParse({
      propertyType: "SINGLE_FAMILY_RENTAL",
      purchasePriceCents: 200_000_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown property type", () => {
    const result = estimatorInputSchema.safeParse({
      propertyType: "YACHT",
      purchasePriceCents: 10_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects implausible tax bracket", () => {
    const result = estimatorInputSchema.safeParse({
      propertyType: "COMMERCIAL",
      purchasePriceCents: 10_000_000,
      taxBracket: 0.9,
    });
    expect(result.success).toBe(false);
  });
});

describe("format helpers", () => {
  it("formats cents to a whole-dollar USD string", () => {
    expect(formatUsd(29_500)).toBe("$295");
    expect(formatUsd(149_500)).toBe("$1,495");
  });

  it("formats a range", () => {
    expect(formatUsdRange(3_520_000, 4_800_000)).toBe("$35,200–$48,000");
  });

  it("parses free-form USD input", () => {
    expect(parseUsdInputToCents("500,000")).toBe(50_000_000);
    expect(parseUsdInputToCents("$1,250,000.50")).toBe(125_000_050);
    expect(parseUsdInputToCents("abc")).toBeNull();
    expect(parseUsdInputToCents("-200")).toBe(20_000);
  });
});
