import { describe, expect, it } from "vitest";

import { computeYearOneProjection, groupByDepreciationClass } from "@/lib/pdf/year-one";

const items = [
  { category: "5yr", amountCents: 10_000 }, // bonus
  { category: "15yr", amountCents: 20_000 }, // bonus
  { category: "27_5yr", amountCents: 70_000 }, // residential long life
];

describe("computeYearOneProjection", () => {
  it("sums 5/7/15-year to bonus and applies mid-month MACRS to 27.5-year", () => {
    const p = computeYearOneProjection(items);
    expect(p.bonusEligibleCents).toBe(30_000);
    expect(p.longLifeBasisCents).toBe(70_000);
    // 27.5yr rate is ~3.485% for first year (mid-month, Jan place-in-service)
    expect(p.longLifeYear1Cents).toBe(Math.round(70_000 * 0.03485));
  });

  it("uses 39-year rate for commercial", () => {
    const p = computeYearOneProjection([
      { category: "5yr", amountCents: 5_000 },
      { category: "39yr", amountCents: 95_000 },
    ]);
    expect(p.bonusEligibleCents).toBe(5_000);
    expect(p.longLifeYear1Cents).toBe(Math.round(95_000 * 0.02461));
  });

  it("handles empty input", () => {
    const p = computeYearOneProjection([]);
    expect(p.bonusEligibleCents).toBe(0);
    expect(p.longLifeBasisCents).toBe(0);
    expect(p.longLifeYear1Cents).toBe(0);
  });
});

describe("groupByDepreciationClass", () => {
  it("groups by class and computes percent of building", () => {
    const groups = groupByDepreciationClass(items, 100_000);
    expect(groups).toHaveLength(3);
    const fiveYr = groups.find((g) => g.category === "5yr");
    expect(fiveYr?.amountCents).toBe(10_000);
    expect(fiveYr?.pctOfBuilding).toBe(0.1);
    expect(fiveYr?.lineItemCount).toBe(1);
  });

  it("sorts in canonical depreciation-class order", () => {
    const groups = groupByDepreciationClass(
      [
        { category: "27_5yr", amountCents: 1 },
        { category: "5yr", amountCents: 1 },
        { category: "15yr", amountCents: 1 },
      ],
      3,
    );
    expect(groups.map((g) => g.category)).toEqual(["5yr", "15yr", "27_5yr"]);
  });

  it("ignores unknown classes quietly", () => {
    const groups = groupByDepreciationClass(
      [
        { category: "5yr", amountCents: 1 },
        { category: "bogus", amountCents: 999 },
      ],
      1,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe("5yr");
  });
});
