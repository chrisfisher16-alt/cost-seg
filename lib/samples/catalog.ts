import type { PropertyType } from "@prisma/client";

import { BRAND } from "@/lib/brand";

/**
 * Public-facing sample studies. These power the /samples gallery, the
 * /samples/[id] deep-dive, and the /api/samples/[id]/pdf route that renders
 * an actual PDF using the production report template.
 *
 * Every number here is synthetic but realistic. Fictional property addresses,
 * fictional owners, land/building allocations drawn from county-assessor
 * midpoints for the respective property types.
 */

export type SampleTierLabel = "AI Report" | "Engineer-Reviewed";
export type SampleCategory = "5-year" | "7-year" | "15-year" | "39-year";

export interface SampleAsset {
  category: SampleCategory;
  name: string;
  quantity: number;
  unitCost: number;
  adjustedCost: number;
  rationale: string;
}

export interface SampleMacrsRow {
  year: number | "Bonus";
  fiveYr: number;
  fifteenYr: number;
  thirtyNineYr: number;
  total: number;
}

export interface Sample {
  id: string;
  address: string;
  ownerLabel: string;
  propertyType: string;
  /** Resolved to the canonical Prisma PropertyType for the PDF template. */
  propertyTypeKey: PropertyType;
  yearBuilt: number;
  squareFeet: number;
  acquisitionDate: string;
  acquisitionPrice: number;
  landValue: number;
  depreciableBasis: number;
  accelerated: {
    value: number;
    pct: number;
    fiveYear: number;
    sevenYear: number;
    fifteenYear: number;
  };
  year1Deduction: number;
  bonusRate: number;
  tier: SampleTierLabel;
  turnaround: string;
  assets: SampleAsset[];
  macrs: SampleMacrsRow[];
}

export const SAMPLES: Record<string, Sample> = {
  "oak-ridge": {
    id: "oak-ridge",
    address: "123 Oak Ridge Drive, Nashville, TN 37215",
    ownerLabel: "Oak Ridge STR, LLC",
    propertyType: "Short-term rental · single-family home",
    propertyTypeKey: "SHORT_TERM_RENTAL",
    yearBuilt: 2004,
    squareFeet: 2840,
    acquisitionDate: "2024-06-14",
    acquisitionPrice: 476_703,
    landValue: 113_852,
    depreciableBasis: 362_851,
    accelerated: {
      value: 147_200,
      pct: 29.0,
      fiveYear: 89_700,
      sevenYear: 0,
      fifteenYear: 57_500,
    },
    year1Deduction: 147_200,
    bonusRate: 100,
    tier: "AI Report",
    turnaround: "Delivered 11 minutes after document upload",
    assets: [
      {
        category: "5-year",
        name: "Appliance package — refrigerator, range, dishwasher",
        quantity: 3,
        unitCost: 1_600,
        adjustedCost: 5_376,
        rationale:
          "Section 1245 personal property. Five-year life under Rev. Proc. 87-56 asset class 57.0.",
      },
      {
        category: "5-year",
        name: "Luxury vinyl plank flooring — bedrooms & living",
        quantity: 1,
        unitCost: 4_200,
        adjustedCost: 4_578,
        rationale:
          "Floating LVP is readily removable without structural damage — Whiteco permanence test fails. 5-year.",
      },
      {
        category: "5-year",
        name: "Decorative lighting — chandeliers, sconces",
        quantity: 6,
        unitCost: 380,
        adjustedCost: 2_500,
        rationale: "Decorative-not-essential (HCA); removable. 5-year personal property.",
      },
      {
        category: "5-year",
        name: "Built-in cabinetry & custom shelving",
        quantity: 1,
        unitCost: 5_400,
        adjustedCost: 5_886,
        rationale: "Serves a decorative/aesthetic purpose; removable without damage. 5-year.",
      },
      {
        category: "5-year",
        name: "Window treatments — curtains, rods",
        quantity: 8,
        unitCost: 145,
        adjustedCost: 1_258,
        rationale: "Decorative removable 5-year under §1245.",
      },
      {
        category: "15-year",
        name: "Landscaping — plantings, mulch, irrigation",
        quantity: 1,
        unitCost: 10_500,
        adjustedCost: 11_445,
        rationale: "Land improvement — 15-year class under Rev. Proc. 87-56.",
      },
      {
        category: "15-year",
        name: "Driveway pavers & walkway",
        quantity: 1,
        unitCost: 8_200,
        adjustedCost: 8_938,
        rationale: "Land improvement — 15-year class, straight-line 150% DB.",
      },
      {
        category: "15-year",
        name: "Exterior lighting, path lights",
        quantity: 14,
        unitCost: 185,
        adjustedCost: 2_822,
        rationale: "Land improvement — accessory to landscaping. 15-year.",
      },
      {
        category: "15-year",
        name: "Wood fencing — perimeter",
        quantity: 1,
        unitCost: 4_600,
        adjustedCost: 5_014,
        rationale: "Land improvement — 15-year straight-line 150%.",
      },
      {
        category: "39-year",
        name: "Building shell, roof, framing, HVAC",
        quantity: 1,
        unitCost: 215_651,
        adjustedCost: 215_651,
        rationale:
          "Residual Section 1250 real property — 27.5/39-year straight-line, mid-month convention.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 89_700, fifteenYr: 57_500, thirtyNineYr: 0, total: 147_200 },
      { year: 2024, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 3_038, total: 3_038 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
    ],
  },
  "magnolia-duplex": {
    id: "magnolia-duplex",
    address: "412 Magnolia Ave, Austin, TX 78704",
    ownerLabel: "Magnolia Holdings, LLC",
    propertyType: "Small multifamily · duplex",
    propertyTypeKey: "SMALL_MULTIFAMILY",
    yearBuilt: 1998,
    squareFeet: 3620,
    acquisitionDate: "2024-02-03",
    acquisitionPrice: 892_500,
    landValue: 206_000,
    depreciableBasis: 686_500,
    accelerated: {
      value: 238_600,
      pct: 34.8,
      fiveYear: 142_100,
      sevenYear: 0,
      fifteenYear: 96_500,
    },
    year1Deduction: 238_600,
    bonusRate: 100,
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 4",
    assets: [
      {
        category: "5-year",
        name: "Full kitchen replacement — 2 units",
        quantity: 2,
        unitCost: 14_200,
        adjustedCost: 30_992,
        rationale:
          "Complete removable kitchen packages (cabinets, counters, appliances). §1245. 5-year.",
      },
      {
        category: "5-year",
        name: "HVAC ductwork — tenant-specific zoning",
        quantity: 2,
        unitCost: 4_800,
        adjustedCost: 10_464,
        rationale:
          "Secondary HVAC zoning systems serving specific tenants. HCA sole-justification test passes. 5-year.",
      },
      {
        category: "5-year",
        name: "Carpet & padding — bedrooms",
        quantity: 4,
        unitCost: 2_100,
        adjustedCost: 9_156,
        rationale: "Carpet is removable and decorative. 5-year under §1245.",
      },
      {
        category: "15-year",
        name: "Parking lot resurfacing",
        quantity: 1,
        unitCost: 22_000,
        adjustedCost: 23_980,
        rationale: "Land improvement — 15-year 150% DB.",
      },
      {
        category: "15-year",
        name: "Site utilities — water, sewer taps",
        quantity: 1,
        unitCost: 14_500,
        adjustedCost: 15_805,
        rationale: "Land improvement — 15-year.",
      },
      {
        category: "39-year",
        name: "Building structure, core plumbing, electrical",
        quantity: 1,
        unitCost: 448_000,
        adjustedCost: 448_000,
        rationale: "Residual §1250 — 27.5-year residential rental, straight-line mid-month.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 142_100, fifteenYr: 96_500, thirtyNineYr: 0, total: 238_600 },
      { year: 2024, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 15_108, total: 15_108 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
    ],
  },
  "riverside-commercial": {
    id: "riverside-commercial",
    address: "88 Riverside Blvd, Boise, ID 83702",
    ownerLabel: "Riverside Mixed-Use LP",
    propertyType: "Mixed-use commercial · ground-floor retail + 6 apartments",
    propertyTypeKey: "COMMERCIAL",
    yearBuilt: 2011,
    squareFeet: 9100,
    acquisitionDate: "2025-03-12",
    acquisitionPrice: 1_420_000,
    landValue: 298_000,
    depreciableBasis: 1_122_000,
    accelerated: {
      value: 391_800,
      pct: 34.9,
      fiveYear: 217_200,
      sevenYear: 42_600,
      fifteenYear: 132_000,
    },
    year1Deduction: 391_800,
    bonusRate: 100,
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 6",
    assets: [
      {
        category: "5-year",
        name: "Retail tenant improvements — storefront fixtures",
        quantity: 1,
        unitCost: 38_000,
        adjustedCost: 41_420,
        rationale: "Tenant-specific removable fixtures. §1245. 5-year.",
      },
      {
        category: "7-year",
        name: "Office furniture & fixtures — shared leasing",
        quantity: 1,
        unitCost: 12_500,
        adjustedCost: 13_625,
        rationale: "Class 00.11 office furniture. 7-year.",
      },
      {
        category: "15-year",
        name: "Parking lot & signage",
        quantity: 1,
        unitCost: 42_000,
        adjustedCost: 45_780,
        rationale: "Land improvement — 15-year 150% DB.",
      },
      {
        category: "39-year",
        name: "Commercial building shell + core MEP",
        quantity: 1,
        unitCost: 730_200,
        adjustedCost: 730_200,
        rationale: "Residual §1250 — 39-year nonresidential straight-line.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 217_200, fifteenYr: 132_000, thirtyNineYr: 0, total: 349_200 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 14_850, total: 14_850 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2029, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
    ],
  },
};

export const SAMPLE_IDS = Object.keys(SAMPLES);
export const DEFAULT_SAMPLE_ID = "oak-ridge";

/** Look up a sample by id. Returns null for unknown ids — callers should 404. */
export function getSample(id: string): Sample | null {
  return SAMPLES[id] ?? null;
}

/**
 * Filename for a sample-PDF download. Keyed on `BRAND.name` so future
 * rebrands don't leak the old slug into every file visitors save. Mirrors
 * the `portfolioCsvFilename` pattern (see lib/studies/aggregate.ts) —
 * `<brand-slug>-sample-<sample-id>.pdf`.
 */
export function samplePdfFilename(sampleId: string): string {
  const slug = BRAND.name.toLowerCase();
  return `${slug}-sample-${sampleId}.pdf`;
}

const CATEGORY_TO_MACRS: Record<SampleCategory, "5yr" | "7yr" | "15yr" | "39yr"> = {
  "5-year": "5yr",
  "7-year": "7yr",
  "15-year": "15yr",
  "39-year": "39yr",
};

/**
 * Transform a Sample into the StoredSchedule JSON shape `AiReportProps` expects.
 * Used by the `/api/samples/[id]/pdf` route to render a real PDF that mirrors
 * the numbers shown on the /samples/[id] web page.
 */
export function buildSampleSchedule(sample: Sample) {
  const lineItems = sample.assets.map((asset) => ({
    category: CATEGORY_TO_MACRS[asset.category],
    name: asset.name,
    amountCents: Math.round(asset.adjustedCost * 100),
    percentOfBuilding: asset.adjustedCost / sample.depreciableBasis,
    rationale: asset.rationale,
    basis: "sample-manual",
  }));

  const narrativeExec =
    `This sample cost segregation study allocates the depreciable basis of ${sample.address} ` +
    `across MACRS classes. Cost basis ${fmtUsd(sample.acquisitionPrice)}; land value ` +
    `${fmtUsd(sample.landValue)}; depreciable basis ${fmtUsd(sample.depreciableBasis)}. ` +
    `The schedule reclassifies ${sample.accelerated.pct.toFixed(1)}% (${fmtUsd(sample.accelerated.value)}) of building basis into accelerated 5/7/15-year property. ` +
    `At a 37% marginal bracket, the year-one deduction of ${fmtUsd(sample.year1Deduction)} translates to roughly ${fmtUsd(Math.round(sample.year1Deduction * 0.37))} in tax savings.`;

  const narrativePropertyDesc =
    `${sample.address} is a ${sample.squareFeet.toLocaleString()} sqft ${sample.propertyType.toLowerCase()} ` +
    `built in ${sample.yearBuilt} and acquired on ${sample.acquisitionDate}. ` +
    `This sample study is entirely synthetic — the property and owner are fictional, but the allocations, MACRS conventions, and methodology match what Segra produces for real customer studies.`;

  const narrativeMethodology =
    `Sample Cost Segregation Study — the methodology follows IRS Publication 5653 ` +
    `(Cost Segregation Audit Techniques Guide, 2-2025) and Rev. Proc. 87-56. ` +
    `The Residual Estimation Method allocates total basis across components adjusted for time, ` +
    `location, physical depreciation, and functional obsolescence. 5-, 7-, and 15-year classes ` +
    `use the half-year convention; residual real property depreciates straight-line with the ` +
    `mid-month convention.`;

  return {
    decomposition: {
      purchasePriceCents: sample.acquisitionPrice * 100,
      landValueCents: sample.landValue * 100,
      buildingValueCents: sample.depreciableBasis * 100,
      landAllocationPct: sample.landValue / sample.acquisitionPrice,
      methodology: `Sample allocation: land value from ${sample.ownerLabel}'s assessor record (${((sample.landValue / sample.acquisitionPrice) * 100).toFixed(1)}% of cost basis). Depreciable basis of ${fmtUsd(sample.depreciableBasis)} distributed per the asset library and per-asset line items below.`,
      confidence: 0.9,
    },
    schedule: {
      lineItems,
      assumptions:
        "Sample cost segregation study — numbers are synthetic but methodology matches the production pipeline.",
    },
    narrative: {
      executiveSummary: narrativeExec,
      propertyDescription: narrativePropertyDesc,
      methodology: narrativeMethodology,
      assetScheduleExplanation:
        "The schedule reclassifies every component of building basis into one of five MACRS recovery periods. Personal property (Section 1245) carries a 5- or 7-year life. Land improvements carry a 15-year life. Residual Section 1250 real property covers the building shell and its integral components.",
      scheduleSummaryTable:
        "Recovery classes below were produced for this sample to mirror a real Tier-1 study.",
    },
    totalCents: sample.depreciableBasis * 100,
  };
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
