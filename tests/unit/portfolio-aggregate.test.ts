import { describe, expect, it } from "vitest";

import {
  buildPortfolioTotals,
  portfolioCsvFilename,
  renderPortfolioCsv,
  studyToPortfolioRow,
  type PortfolioStudyInput,
} from "@/lib/studies/aggregate";

function makeStudy(overrides: Partial<PortfolioStudyInput> = {}): PortfolioStudyInput {
  const defaultLineItems = [
    { category: "5yr", amountCents: 100_000_00 },
    { category: "15yr", amountCents: 50_000_00 },
    { category: "27_5yr", amountCents: 250_000_00 },
  ];
  const defaults: PortfolioStudyInput = {
    id: "study-1",
    tier: "AI_REPORT",
    status: "DELIVERED",
    createdAt: new Date("2025-06-01T12:00:00Z"),
    deliveredAt: new Date("2025-06-01T14:00:00Z"),
    property: {
      address: "123 Oak Ridge Dr",
      city: "Nashville",
      state: "TN",
      zip: "37215",
      propertyType: "SHORT_TERM_RENTAL",
      purchasePriceCents: 500_000_00,
      acquiredAt: new Date("2024-06-14"),
    },
    assetSchedule: {
      decomposition: {
        buildingValueCents: 400_000_00,
        landValueCents: 100_000_00,
      },
      schedule: { lineItems: defaultLineItems },
      totalCents: 400_000_00,
    },
  };
  // Spread, then re-apply any explicit `null` (nullish-coalescing would clobber it).
  return { ...defaults, ...overrides };
}

describe("studyToPortfolioRow", () => {
  it("aggregates accelerated basis from line items", () => {
    const row = studyToPortfolioRow(makeStudy());
    expect(row.acceleratedCents).toBe(150_000_00); // 5yr + 15yr
    expect(row.depreciableBasisCents).toBe(400_000_00);
    expect(row.hasSchedule).toBe(true);
  });

  it("computes year-1 tax savings at the given bracket", () => {
    const row = studyToPortfolioRow(makeStudy(), 0.32);
    expect(row.year1TaxSavingsCents).toBe(Math.round(row.year1DeductionCents * 0.32));
  });

  it("gracefully handles a study without an assetSchedule", () => {
    const row = studyToPortfolioRow(
      makeStudy({ status: "AWAITING_DOCUMENTS", assetSchedule: null }),
    );
    expect(row.acceleratedCents).toBe(0);
    expect(row.year1DeductionCents).toBe(0);
    expect(row.hasSchedule).toBe(false);
    expect(row.lineItemCount).toBe(0);
  });

  it("maps the tier enum to its display label", () => {
    expect(studyToPortfolioRow(makeStudy({ tier: "DIY" })).tierLabel).toBe("DIY Self-Serve");
    expect(studyToPortfolioRow(makeStudy({ tier: "AI_REPORT" })).tierLabel).toBe("AI Report");
    expect(studyToPortfolioRow(makeStudy({ tier: "ENGINEER_REVIEWED" })).tierLabel).toBe(
      "Engineer-Reviewed Study",
    );
  });
});

describe("buildPortfolioTotals", () => {
  it("sums across delivered studies and ignores pending ones", () => {
    const totals = buildPortfolioTotals([
      makeStudy({ id: "a" }),
      makeStudy({ id: "b", property: { ...makeStudy().property, purchasePriceCents: 800_000_00 } }),
      makeStudy({ id: "c", status: "AWAITING_DOCUMENTS", assetSchedule: null }),
    ]);
    expect(totals.studyCount).toBe(3);
    expect(totals.deliveredCount).toBe(2);
    // Pending studies still contribute to purchase-price rollup (it's from the property record)
    // but not to basis / accelerated (those come from the asset schedule).
    expect(totals.totalPurchasePriceCents).toBe(500_000_00 + 800_000_00 + 500_000_00);
    expect(totals.totalDepreciableBasisCents).toBe(800_000_00); // 2 delivered × 400k
    expect(totals.totalAcceleratedCents).toBe(300_000_00); // 2 × 150k
  });

  it("computes averageAcceleratedPct only across delivered studies with basis", () => {
    const totals = buildPortfolioTotals([makeStudy(), makeStudy({ id: "b" })]);
    expect(totals.averageAcceleratedPct).toBeGreaterThan(0.3);
    expect(totals.averageAcceleratedPct).toBeLessThan(0.4);
  });

  it("returns zeros for an empty portfolio", () => {
    const totals = buildPortfolioTotals([]);
    expect(totals.studyCount).toBe(0);
    expect(totals.deliveredCount).toBe(0);
    expect(totals.totalPurchasePriceCents).toBe(0);
    expect(totals.averageAcceleratedPct).toBe(0);
  });
});

describe("renderPortfolioCsv", () => {
  it("emits a header row plus one row per study", () => {
    const csv = renderPortfolioCsv([makeStudy({ id: "a" }), makeStudy({ id: "b" })]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toContain("Study ID");
    expect(lines[0]).toContain("Year-1 deduction");
  });

  it("escapes values that contain commas or quotes", () => {
    const study = makeStudy({
      property: {
        address: 'A "tricky" address, with commas',
        city: "Austin",
        state: "TX",
        zip: "78704",
        propertyType: "SHORT_TERM_RENTAL",
        purchasePriceCents: 500_000_00,
        acquiredAt: new Date("2024-06-14"),
      },
    });
    const csv = renderPortfolioCsv([study]);
    // The address cell must be wrapped in quotes and interior quotes doubled.
    expect(csv).toContain('"A ""tricky"" address, with commas, Austin, TX 78704"');
  });

  it("uses the requested bracket in the header label", () => {
    const csv = renderPortfolioCsv([makeStudy()], 0.24);
    expect(csv.split("\n")[0]).toContain("24%");
  });
});

describe("portfolioCsvFilename", () => {
  it("uses the BRAND.name slug, not the legacy 'cost-seg' prefix", () => {
    const filename = portfolioCsvFilename(new Date("2026-04-20T12:34:56Z"));
    expect(filename).toBe("segra-portfolio-2026-04-20.csv");
    expect(filename.startsWith("cost-seg-")).toBe(false);
  });

  it("formats the date as UTC YYYY-MM-DD (no locale drift)", () => {
    // Midnight-UTC boundary — would slip to 2026-04-19 in most west-of-UTC
    // locales if we used `toLocaleDateString` instead of `toISOString`.
    const filename = portfolioCsvFilename(new Date("2026-04-20T00:00:00Z"));
    expect(filename).toBe("segra-portfolio-2026-04-20.csv");
  });

  it("ends with .csv", () => {
    expect(portfolioCsvFilename()).toMatch(/\.csv$/);
  });
});
