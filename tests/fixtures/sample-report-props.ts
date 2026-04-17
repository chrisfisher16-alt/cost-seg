import type { AiReportProps } from "@/components/pdf/AiReportTemplate";

/**
 * A realistic report input for smoke-testing the PDF template. Mirrors the
 * shape `lib/studies/deliver.ts` hands to the renderer.
 */
export const SAMPLE_REPORT_PROPS: AiReportProps = {
  studyId: "00000000-0000-0000-0000-000000000123",
  generatedAt: new Date("2026-04-17T12:00:00Z"),
  tierLabel: "AI Report",
  property: {
    address: "123 Lake View Drive",
    city: "Asheville",
    state: "NC",
    zip: "28801",
    propertyTypeLabel: "Short-term rental",
    squareFeet: 2400,
    yearBuilt: 2004,
    acquiredAtIso: "2026-02-01",
  },
  decomposition: {
    purchasePriceCents: 62_500_000,
    landValueCents: 15_625_000,
    buildingValueCents: 46_875_000,
    landAllocationPct: 0.25,
    methodology:
      "Regional heuristic — Asheville resort STR market. Land allocation set at 25%, consistent with Buncombe County assessor ratios for comparable short-term rental properties.",
    confidence: 0.7,
  },
  narrative: {
    executiveSummary:
      "This modeling report segregates the $625,000 acquisition into land and building basis and reclassifies qualifying short-lived property to 5 and 15-year MACRS classes.",
    propertyDescription:
      "A 2,400 sqft single-family home in Asheville, NC, acquired 2026-02-01 and placed in service as a short-term rental.",
    methodology:
      "We segment the building basis using property-type-specific percentages anchored to IRS ATG industry norms and adjust for receipts where provided.",
    assetScheduleExplanation:
      "5-year property captures appliances, furnishings, and consumer electronics. 15-year captures site work and landscaping. The remainder is 27.5-year residential building.",
    scheduleSummaryTable:
      "| Class | Amount |\n|---|---|\n| 5-yr | $75,000 |\n| 15-yr | $37,500 |\n| 27.5-yr | $356,250 |",
  },
  schedule: {
    lineItems: [
      {
        category: "5yr",
        name: "Appliances and small kitchen equipment",
        amountCents: 1_875_000,
        percentOfBuilding: 0.04,
        rationale:
          "Refrigerator, range, dishwasher, washer, dryer, small kitchen equipment. Typical 2–4% of building for STR.",
      },
      {
        category: "5yr",
        name: "Furniture and furnishings",
        amountCents: 2_812_500,
        percentOfBuilding: 0.06,
        rationale:
          "Beds, sofas, dining, decor, art, rugs. STRs carry higher removable personal property than long-term rentals.",
      },
      {
        category: "15yr",
        name: "Site work and landscaping",
        amountCents: 1_406_250,
        percentOfBuilding: 0.03,
        rationale: "Driveway, walkways, site lighting, landscaping. 15-year land improvements.",
      },
      {
        category: "27_5yr",
        name: "Building structure, systems, and finishes",
        amountCents: 40_781_250,
        percentOfBuilding: 0.87,
        rationale:
          "Foundation, framing, roof, HVAC, plumbing, electrical, attached cabinetry, flooring.",
      },
    ],
    groups: [
      { category: "5yr", amountCents: 4_687_500, pctOfBuilding: 0.1, lineItemCount: 2 },
      { category: "15yr", amountCents: 1_406_250, pctOfBuilding: 0.03, lineItemCount: 1 },
      { category: "27_5yr", amountCents: 40_781_250, pctOfBuilding: 0.87, lineItemCount: 1 },
    ],
    totalCents: 46_875_000,
  },
  projection: {
    bonusEligibleCents: 4_687_500 + 1_406_250,
    longLifeBasisCents: 40_781_250,
    longLifeYear1Cents: Math.round(40_781_250 * 0.03485),
  },
  assumedBracket: 0.32,
};
