import { describe, expect, it } from "vitest";

import { buildDiySchedule, DEFAULT_LAND_PCT } from "@/lib/studies/diy-pipeline";

describe("buildDiySchedule", () => {
  const base = {
    propertyType: "SHORT_TERM_RENTAL" as const,
    propertyAddress: "123 Oak Ridge Dr",
    city: "Nashville",
    state: "TN",
    acquiredAtIso: "2025-06-14",
    purchasePriceCents: 500_000_00,
    landValueCents: 100_000_00,
  };

  it("reconciles line-item totals to building basis exactly", () => {
    const result = buildDiySchedule(base);
    const sum = result.schedule.lineItems.reduce((s, li) => s + li.amountCents, 0);
    expect(sum).toBe(result.totalCents);
    expect(result.totalCents).toBe(base.purchasePriceCents - base.landValueCents);
  });

  it("populates decomposition with the user-declared numbers", () => {
    const result = buildDiySchedule(base);
    expect(result.decomposition.purchasePriceCents).toBe(base.purchasePriceCents);
    expect(result.decomposition.landValueCents).toBe(base.landValueCents);
    expect(result.decomposition.buildingValueCents).toBe(
      base.purchasePriceCents - base.landValueCents,
    );
    expect(result.decomposition.landAllocationPct).toBeCloseTo(0.2, 3);
  });

  it("produces at least one line item from each depreciation class present in the library", () => {
    const result = buildDiySchedule(base);
    const classes = new Set(result.schedule.lineItems.map((li) => li.category));
    // The short-term-rental library contains 5-, 15-, and 27.5-year classes.
    expect(classes.has("5yr")).toBe(true);
    expect(classes.has("15yr")).toBe(true);
    expect(classes.has("27_5yr")).toBe(true);
  });

  it("rejects inputs where land value equals or exceeds the purchase price", () => {
    expect(() => buildDiySchedule({ ...base, landValueCents: base.purchasePriceCents })).toThrow();
    expect(() =>
      buildDiySchedule({ ...base, landValueCents: base.purchasePriceCents + 1 }),
    ).toThrow();
  });

  it("allocates a meaningful percentage to accelerated property for STRs", () => {
    const result = buildDiySchedule(base);
    const accel = result.schedule.lineItems
      .filter((li) => li.category === "5yr" || li.category === "15yr")
      .reduce((s, li) => s + li.amountCents, 0);
    const pct = accel / result.totalCents;
    // STR typical accelerated allocation is in the 20-40% range.
    expect(pct).toBeGreaterThan(0.15);
    expect(pct).toBeLessThan(0.45);
  });

  it("exposes sane default land percentages for every property type", () => {
    const types = Object.keys(DEFAULT_LAND_PCT) as Array<keyof typeof DEFAULT_LAND_PCT>;
    for (const t of types) {
      expect(DEFAULT_LAND_PCT[t]).toBeGreaterThan(0);
      expect(DEFAULT_LAND_PCT[t]).toBeLessThan(0.5);
    }
  });
});
