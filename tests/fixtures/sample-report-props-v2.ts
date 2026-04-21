import type { AiReportProps } from "@/components/pdf/AiReportTemplate";

// A tiny real PNG (1×1 transparent) — good enough to exercise the
// <Image> path in @react-pdf/renderer without bloating the fixture.
const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const DATA_URI = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;

/**
 * v2 Phase 5 report fixture (ADR 0012). Exercises the new AssetDetailCard
 * branches: embedded photo, paragraph justifications, cost summary, and
 * the residual plug line. Also exercises Property Info enrichment.
 */
export const SAMPLE_REPORT_PROPS_V2: AiReportProps = {
  studyId: "00000000-0000-0000-0000-000000000321",
  generatedAt: new Date("2026-04-20T12:00:00Z"),
  tierLabel: "AI Report",
  property: {
    address: "207 S Edison St",
    city: "Fredericksburg",
    state: "TX",
    zip: "78624",
    propertyTypeLabel: "Single-family rental",
    squareFeet: null, // intentionally null; enrichment fills it
    yearBuilt: null,
    acquiredAtIso: "2022-03-21",
    realPropertyYears: 27.5,
    enrichment: {
      squareFeet: 2197,
      yearBuilt: 1920,
      bedrooms: 3,
      bathrooms: 1,
      constructionType: "wood_frame",
      roofType: "metal",
      lotSizeSqft: 7884,
      assessorUrl: "https://gillespiecad.org/property/R012345",
      listingUrl: "https://www.redfin.com/TX/Fredericksburg/207-S-Edison-St-78624/home/128992219",
    },
  },
  decomposition: {
    purchasePriceCents: 39_350_300,
    landValueCents: 11_385_200,
    buildingValueCents: 27_965_100,
    landAllocationPct: 0.289,
    methodology:
      "Rule 2 (assessor ratio). Gillespie County published $155,080 land / $536,000 total = 28.93% applied to $393,503 purchase price.",
    confidence: 0.92,
  },
  narrative: {
    executiveSummary: "207 S Edison St — v2 pipeline report.",
    propertyDescription:
      "Early-1900s Hill-Country cottage with a detached garage; wood framing and a metal roof.",
    methodology: "v2 pipeline — photo-grounded per-object schedule plus residual plug.",
    assetScheduleExplanation: "Per-asset line items with physical and functional adjustments.",
    scheduleSummaryTable: "| Class | Amount |\n|---|---|\n| 5-yr | $5,348 |",
  },
  schedule: {
    lineItems: [
      {
        category: "5yr",
        name: "Chrome double towel bar above toilet",
        amountCents: 5_348,
        rationale:
          "Photo-observed bathroom fixture in good condition; standard residential-grade pricing.",
        quantity: 1,
        unit: "each",
        unitCostCents: 5_200,
        costSource: "pricesearch",
        physicalMultiplier: 1,
        functionalMultiplier: 1,
        timeMultiplier: 0.9434,
        locationMultiplier: 1.09,
        photoDataUri: DATA_URI,
        comparableDescription: "24-inch residential-grade chrome double towel bar.",
        comparableSourceUrl: "https://www.target.com/p/moen-chrome-double-towel-bar/-/A-12345678",
        physicalJustification:
          "Chrome finish is intact with no visible scratches or water staining.",
        functionalJustification:
          "Timeless fixture; no obsolescence relative to current residential standards.",
        timeBasis: "Building Cost Index 2025 → 2022 (factor 0.9434).",
        locationBasis: "Area Modification Factor for Austin-metro (1.0900).",
      },
      {
        category: "5yr",
        name: "Stainless french-door refrigerator",
        amountCents: 152_250,
        rationale:
          "Kitchen-observed large appliance; good condition; standard 2025 retail pricing.",
        quantity: 1,
        unit: "each",
        unitCostCents: 150_000,
        costSource: "pricesearch",
        physicalMultiplier: 0.8,
        functionalMultiplier: 1,
        timeMultiplier: 0.9434,
        locationMultiplier: 1.09,
        photoDataUri: DATA_URI,
        comparableDescription: "28 cu-ft stainless french-door refrigerator, ENERGY STAR.",
        comparableSourceUrl: "https://www.homedepot.com/p/12345",
        physicalJustification: "Smudges on the stainless finish but no dents; full functionality.",
        functionalJustification: "Modern form factor; no obsolescence vs. current offerings.",
        timeBasis: "Building Cost Index 2025 → 2022 (factor 0.9434).",
        locationBasis: "Area Modification Factor for Austin-metro (1.0900).",
      },
      {
        category: "27_5yr",
        name: "Building structure (residual)",
        amountCents: 27_807_502,
        rationale: "Reconciling residual to hit exact building value.",
        quantity: 1,
        unit: "lot",
        unitCostCents: 27_807_502,
        costSource: "pricesearch",
        physicalMultiplier: 1,
        functionalMultiplier: 1,
        timeMultiplier: 1,
        locationMultiplier: 1,
        isResidual: true,
        comparableDescription:
          "Residual building value — foundation, framing, roof, plumbing rough-in, electrical rough-in, exterior walls, and other fixed structural components not separately itemized above.",
      },
    ],
    groups: [
      { category: "5yr", amountCents: 157_598, pctOfBuilding: 0.0056, lineItemCount: 2 },
      { category: "27_5yr", amountCents: 27_807_502, pctOfBuilding: 0.9944, lineItemCount: 1 },
    ],
    totalCents: 27_965_100,
  },
  projection: {
    bonusEligibleCents: 157_598,
    longLifeBasisCents: 27_807_502,
    longLifeYear1Cents: Math.round(27_807_502 * 0.03485),
  },
  assumedBracket: 0.32,
};
