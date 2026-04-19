import { describe, expect, it } from "vitest";

import { aggregateBasisByClass, computeMacrsSchedule } from "@/lib/pdf/macrs";

describe("aggregateBasisByClass", () => {
  it("sums by category and ignores unknowns", () => {
    const result = aggregateBasisByClass([
      { category: "5yr", amountCents: 1_000_00 },
      { category: "5yr", amountCents: 500_00 },
      { category: "7yr", amountCents: 200_00 },
      { category: "15yr", amountCents: 300_00 },
      { category: "27_5yr", amountCents: 400_00 },
      { category: "39yr", amountCents: 700_00 },
      { category: "bogus", amountCents: 99_00 },
    ]);
    expect(result).toEqual({
      fiveYrBasisCents: 1_500_00,
      sevenYrBasisCents: 200_00,
      fifteenYrBasisCents: 300_00,
      twentySevenHalfCents: 400_00,
      thirtyNineCents: 700_00,
    });
  });
});

describe("computeMacrsSchedule", () => {
  it("applies 100% bonus on 5/7/15 when eligible and zeroes subsequent rows", () => {
    const schedule = computeMacrsSchedule({
      fiveYrBasisCents: 100_000_00,
      sevenYrBasisCents: 0,
      fifteenYrBasisCents: 50_000_00,
      residualRealCents: 500_000_00,
      placedInServiceYear: 2025,
      placedInServiceMonth: 6, // June — mid-year factor for 39yr real property
      bonusEligible: true,
      realPropertyYears: 39,
    });
    expect(schedule.bonusAppliedFully).toBe(true);
    expect(schedule.bonusAppliedCents).toBe(150_000_00);
    const bonus = schedule.lines[0];
    expect(bonus.year).toBe("Bonus");
    expect(bonus.fiveYrCents).toBe(100_000_00);
    expect(bonus.fifteenYrCents).toBe(50_000_00);
    // After the bonus row, the 5yr and 15yr columns should be zero for every year.
    const afterBonus = schedule.lines.slice(1);
    for (const line of afterBonus) {
      expect(line.fiveYrCents).toBe(0);
      expect(line.fifteenYrCents).toBe(0);
    }
  });

  it("runs the full MACRS tables when bonus is not eligible", () => {
    const schedule = computeMacrsSchedule({
      fiveYrBasisCents: 100_000_00,
      sevenYrBasisCents: 0,
      fifteenYrBasisCents: 0,
      residualRealCents: 0,
      placedInServiceYear: 2017,
      placedInServiceMonth: 9,
      bonusEligible: false,
      realPropertyYears: 39,
    });
    expect(schedule.bonusAppliedFully).toBe(false);
    expect(schedule.lines[0].year).toBe("Bonus");
    expect(schedule.lines[0].totalCents).toBe(0);
    // Year 1 for 5yr half-year (200% DB) is 20% of basis.
    expect(schedule.lines[1].fiveYrCents).toBe(20_000_00);
    // Year 2: 32% of basis.
    expect(schedule.lines[2].fiveYrCents).toBe(32_000_00);
  });

  it("reconciles total depreciation to the depreciable basis (±rounding)", () => {
    const fiveBasis = 12_345_67;
    const fifteenBasis = 22_222_22;
    const realBasis = 333_333_33;
    const schedule = computeMacrsSchedule({
      fiveYrBasisCents: fiveBasis,
      sevenYrBasisCents: 0,
      fifteenYrBasisCents: fifteenBasis,
      residualRealCents: realBasis,
      placedInServiceYear: 2025,
      placedInServiceMonth: 1,
      bonusEligible: true,
      realPropertyYears: 39,
    });
    const total = schedule.lines.reduce((sum, line) => sum + line.totalCents, 0);
    // Allow ±$1 rounding across all 40 rows (we round each cell to whole cents).
    expect(Math.abs(total - (fiveBasis + fifteenBasis + realBasis))).toBeLessThan(100);
  });

  it("uses 27.5-year residential life when specified", () => {
    const schedule = computeMacrsSchedule({
      fiveYrBasisCents: 0,
      sevenYrBasisCents: 0,
      fifteenYrBasisCents: 0,
      residualRealCents: 100_000_00,
      placedInServiceYear: 2025,
      placedInServiceMonth: 1,
      bonusEligible: false,
      realPropertyYears: 27.5,
    });
    // January placed-in-service mid-month factor for 27.5-year: 3.485%.
    expect(schedule.lines[1].thirtyNineYrCents).toBe(Math.round(100_000_00 * 0.03485));
  });
});
