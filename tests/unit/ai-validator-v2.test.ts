import { describe, expect, it } from "vitest";

import type { ClassifyAssetsV2Output } from "@/lib/ai/prompts/classify-assets-v2";
import {
  ARITHMETIC_TOLERANCE_CENTS,
  applyResidualPlug,
  totalAdjustedCostCents,
  validateClassifyAssetsV2,
} from "@/lib/ai/validator-v2";

/**
 * Exercise the v2 validator + residual plug. The invariants, per ADR 0009:
 *   • Exactly one line is isResidual=true.
 *   • Non-residual adjustedCostCents matches qty × unit × multipliers ±5¢.
 *   • Σ non-residual ≤ building value.
 *   • Receipt source → all multipliers == 1.
 *   • craftsman/rsmeans sources are policy-forbidden.
 */

function mkLine(overrides: Partial<ClassifyAssetsV2Output["lineItems"][number]> = {}) {
  return {
    category: "5yr" as const,
    name: "Test item",
    quantity: 1,
    unit: "each",
    source: "pricesearch" as const,
    comparable: { description: "test comparable", unitCostCents: 10_000 },
    physicalMultiplier: 1,
    physicalJustification: "new condition",
    functionalMultiplier: 1,
    functionalJustification: "no obsolescence",
    timeMultiplier: 1,
    timeBasis: "ident",
    locationMultiplier: 1,
    locationBasis: "ident",
    adjustedCostCents: 10_000,
    rationale: "r",
    ...overrides,
  };
}

function mkResidual(overrides: Partial<ClassifyAssetsV2Output["lineItems"][number]> = {}) {
  return mkLine({
    category: "27_5yr",
    name: "Building structure (residual)",
    unit: "lot",
    comparable: { description: "residual", unitCostCents: 0 },
    adjustedCostCents: 0,
    isResidual: true,
    ...overrides,
  });
}

describe("validateClassifyAssetsV2", () => {
  it("passes a well-formed schedule", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkLine({ adjustedCostCents: 10_000 }), mkResidual()],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.residualCents).toBe(90_000);
  });

  it("fails when no residual line is marked", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkLine(), mkLine({ name: "Second item" })],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/Missing residual/i);
  });

  it("fails when multiple residuals are marked", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkResidual(), mkResidual({ name: "Second residual" })],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/Too many residual/i);
  });

  it("fails when non-residual sum exceeds building value", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkLine({ quantity: 100, adjustedCostCents: 1_000_000 }), mkResidual()],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/exceeds the building value/i);
  });

  it("fails arithmetic check when adjustedCostCents ≠ qty × unit × multipliers", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          quantity: 3,
          comparable: { description: "d", unitCostCents: 10_000 },
          // Expected: 3 × 10000 × 1 × 1 × 1 × 1 = 30000. Reporting 25000
          // (off by 5000¢) should fail.
          adjustedCostCents: 25_000,
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/adjustedCostCents/);
  });

  it("passes arithmetic check within ±5-cent tolerance", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          quantity: 3,
          comparable: { description: "d", unitCostCents: 10_001 },
          // Expected: 3 × 10001 = 30003. Allow up to ±5¢ slop.
          adjustedCostCents: 30_005,
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(true);
  });

  it("passes with real per-item multipliers (no rounding drama)", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          quantity: 1,
          comparable: { description: "towel bar", unitCostCents: 5_214 },
          physicalMultiplier: 1,
          functionalMultiplier: 1,
          timeMultiplier: 0.9434,
          locationMultiplier: 1.09,
          // 5214 × 0.9434 × 1.09 = 5362.03… → round to 5362.
          adjustedCostCents: 5_362,
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(true);
  });

  it("fails when receipt line has non-unity multipliers", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          source: "receipt",
          physicalMultiplier: 0.8, // forbidden for receipts
          adjustedCostCents: 8_000,
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/all six multipliers to equal 1/i);
  });

  it("fails when line uses craftsman source (policy-forbidden)", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkLine({ source: "craftsman" }), mkResidual()],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/source="craftsman" is not allowed/i);
  });

  it("accepts a sourceUrl on a pricesearch line", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          comparable: {
            description: "24-inch chrome double towel bar",
            unitCostCents: 10_000,
            sourceUrl: "https://www.target.com/p/item/-/A-12345",
          },
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(true);
  });

  it("fails when a receipt line carries a sourceUrl", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({
          source: "receipt",
          adjustedCostCents: 10_000,
          comparable: {
            description: "HVAC replacement from receipt",
            unitCostCents: 10_000,
            sourceUrl: "https://www.target.com/p/item",
          },
        }),
        mkResidual(),
      ],
      assumptions: "",
    };
    const result = validateClassifyAssetsV2(schedule, 100_000);
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/must not include comparable.sourceUrl/i);
  });
});

describe("applyResidualPlug", () => {
  it("overwrites residual to fill the gap to building value", () => {
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [
        mkLine({ adjustedCostCents: 50_000 }),
        mkLine({ name: "Second", adjustedCostCents: 20_000 }),
        mkResidual({ adjustedCostCents: 0, comparable: { description: "r", unitCostCents: 0 } }),
      ],
      assumptions: "",
    };
    const plugged = applyResidualPlug(schedule, 300_000);
    expect(totalAdjustedCostCents(plugged)).toBe(300_000);
    const residual = plugged.lineItems.find((li) => li.isResidual === true);
    expect(residual?.adjustedCostCents).toBe(230_000);
    expect(residual?.comparable.unitCostCents).toBe(230_000);
  });

  it("does not mutate the input schedule", () => {
    const residualLine = mkResidual();
    const schedule: ClassifyAssetsV2Output = {
      lineItems: [mkLine(), residualLine],
      assumptions: "",
    };
    applyResidualPlug(schedule, 100_000);
    expect(residualLine.adjustedCostCents).toBe(0);
  });
});

describe("ARITHMETIC_TOLERANCE_CENTS", () => {
  it("is a small nickel-level tolerance", () => {
    expect(ARITHMETIC_TOLERANCE_CENTS).toBeLessThan(10);
    expect(ARITHMETIC_TOLERANCE_CENTS).toBeGreaterThan(0);
  });
});
