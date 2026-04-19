import { describe, expect, it } from "vitest";

import { computeForm3115Worksheet, form3115InputFromLineItems } from "@/lib/pdf/form-3115";

describe("computeForm3115Worksheet", () => {
  const base = {
    fiveYrBasisCents: 100_000_00,
    sevenYrBasisCents: 0,
    fifteenYrBasisCents: 50_000_00,
    residualRealCents: 350_000_00,
    placedInServiceYear: 2022,
    placedInServiceMonth: 3,
    bonusEligible: true,
    realPropertyYears: 27.5 as const,
  };

  it("recommends Form 4562 when the study is filed in the placed-in-service year", () => {
    const w = computeForm3115Worksheet({ ...base, taxYear: 2022 });
    expect(w.form3115Applies).toBe(false);
    expect(w.recommendedForm).toBe("Form 4562");
    expect(w.designatedChangeNumber).toBeNull();
    expect(w.section481AdjustmentCents).toBe(0);
    expect(w.priorYearBreakdown).toHaveLength(0);
  });

  it("recommends Form 3115 with DCN 7 when the property was placed in a prior year", () => {
    const w = computeForm3115Worksheet({ ...base, taxYear: 2025 });
    expect(w.form3115Applies).toBe(true);
    expect(w.recommendedForm).toBe("Form 3115");
    expect(w.designatedChangeNumber).toBe(7);
    expect(w.priorYearBreakdown).toHaveLength(3); // 2022, 2023, 2024
  });

  it("produces a positive §481(a) adjustment when the new method would have deducted more", () => {
    const w = computeForm3115Worksheet({ ...base, taxYear: 2025 });
    // With 100% bonus on $150k of 5/7/15-year property in year 1, the new method
    // front-loads a huge chunk of basis; the old method only took SL for 3 years.
    expect(w.section481AdjustmentCents).toBeGreaterThan(0);
    expect(w.priorYearTotals.newMethodCents).toBeGreaterThan(w.priorYearTotals.oldMethodCents);
  });

  it("emits a non-empty class summary covering every populated class", () => {
    const w = computeForm3115Worksheet({ ...base, taxYear: 2025 });
    const categories = w.classSummary.map((r) => r.category);
    expect(categories).toContain("5yr");
    expect(categories).toContain("15yr");
    expect(categories).toContain("27_5yr");
    expect(categories).not.toContain("7yr"); // base has 0 basis there
  });

  it("keeps §481(a) at zero when no prior years have elapsed", () => {
    const w = computeForm3115Worksheet({ ...base, taxYear: 2022 });
    expect(w.section481AdjustmentCents).toBe(0);
  });

  it("builds the correct input shape from a flat line-item list", () => {
    const input = form3115InputFromLineItems(
      [
        { category: "5yr", amountCents: 80_000_00 },
        { category: "5yr", amountCents: 20_000_00 },
        { category: "15yr", amountCents: 50_000_00 },
        { category: "27_5yr", amountCents: 200_000_00 },
        { category: "39yr", amountCents: 150_000_00 },
      ],
      {
        placedInServiceYear: 2023,
        placedInServiceMonth: 6,
        taxYear: 2025,
        bonusEligible: true,
        realPropertyYears: 39,
      },
    );
    expect(input.fiveYrBasisCents).toBe(100_000_00);
    expect(input.fifteenYrBasisCents).toBe(50_000_00);
    // 27.5 and 39 collapse into residualRealCents — the schedule doesn't care.
    expect(input.residualRealCents).toBe(350_000_00);
  });
});
