import type { PropertyType } from "@prisma/client";

import { getAssetLibrary } from "@/lib/ai/asset-library";
import type { DepreciationClass } from "@/lib/ai/asset-library/types";
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";

/**
 * Shape matches the existing StoredSchedule in lib/studies/deliver.ts so the
 * DIY pipeline produces the same `Study.assetSchedule` JSON the AI pipeline does.
 * That lets the downstream PDF render and delivery email reuse every bit of code.
 */
export interface DiyScheduleInput {
  propertyType: PropertyType;
  /** Address used in the narrative. */
  propertyAddress: string;
  city: string;
  state: string;
  /** Acquisition date YYYY-MM-DD for the narrative. */
  acquiredAtIso: string;
  purchasePriceCents: number;
  /** User-declared land value. Must be ≥ 0 and < purchasePrice. */
  landValueCents: number;
}

export interface DiyLineItem {
  category: DepreciationClass;
  name: string;
  amountCents: number;
  percentOfBuilding: number;
  rationale: string;
  basis: string;
}

export interface DiyStoredSchedule {
  decomposition: {
    purchasePriceCents: number;
    landValueCents: number;
    buildingValueCents: number;
    landAllocationPct: number;
    methodology: string;
    confidence: number;
  };
  schedule: {
    lineItems: DiyLineItem[];
    assumptions: string;
  };
  narrative: {
    executiveSummary: string;
    propertyDescription: string;
    methodology: string;
    assetScheduleExplanation: string;
    scheduleSummaryTable: string;
  };
  totalCents: number;
}

/**
 * Build a DIY asset schedule from user-declared numbers + property-type-default
 * percentages. Pure function — no network, no DB, no AI.
 *
 * Invariants:
 *   • sum of lineItems.amountCents === buildingValueCents (to the penny)
 *   • every lineItem carries a category + name + rationale the PDF can surface
 */
export function buildDiySchedule(input: DiyScheduleInput): DiyStoredSchedule {
  const buildingValueCents = input.purchasePriceCents - input.landValueCents;
  if (buildingValueCents <= 0) {
    throw new Error("Land value must be less than purchase price.");
  }

  const library = getAssetLibrary(input.propertyType);

  // Step 1 — compute raw amounts using the midpoint of each category's typical band.
  const raw = library.map((cat) => ({
    cat,
    midPct: (cat.typicalPctLow + cat.typicalPctHigh) / 2,
  }));
  const rawTotalPct = raw.reduce((s, r) => s + r.midPct, 0);

  // Step 2 — normalize so midpoints sum to 100% of building (not the library total).
  const normalizeFactor = rawTotalPct > 0 ? 1 / rawTotalPct : 0;
  const preliminary = raw.map((r) => ({
    cat: r.cat,
    pct: r.midPct * normalizeFactor,
    amountCents: Math.round(
      r.cat.typicalPctLow === 0 && r.midPct === 0
        ? 0
        : buildingValueCents * r.midPct * normalizeFactor,
    ),
  }));

  // Step 3 — reconcile rounding into the largest bucket so the total is exact.
  const summed = preliminary.reduce((s, p) => s + p.amountCents, 0);
  const delta = buildingValueCents - summed;
  if (delta !== 0 && preliminary.length > 0) {
    // Nudge the bucket with the largest amount (usually the building structure).
    let biggestIdx = 0;
    for (let i = 1; i < preliminary.length; i++) {
      if (preliminary[i].amountCents > preliminary[biggestIdx].amountCents) biggestIdx = i;
    }
    preliminary[biggestIdx].amountCents += delta;
  }

  const lineItems: DiyLineItem[] = preliminary.map((p) => ({
    category: p.cat.depreciationClass,
    name: p.cat.name,
    amountCents: p.amountCents,
    percentOfBuilding: p.amountCents / buildingValueCents,
    rationale: `${p.cat.examples} Allocated at the midpoint of the ${formatPct(p.cat.typicalPctLow)}–${formatPct(p.cat.typicalPctHigh)} typical band for ${PROPERTY_TYPE_LABELS[input.propertyType]} property.`,
    basis: "property-type-default",
  }));

  const landAllocationPct = input.landValueCents / input.purchasePriceCents;
  const typeLabel = PROPERTY_TYPE_LABELS[input.propertyType];

  const decomposition = {
    purchasePriceCents: input.purchasePriceCents,
    landValueCents: input.landValueCents,
    buildingValueCents,
    landAllocationPct,
    methodology: `DIY Self-Serve allocation. You declared a land value of ${fmtUsd(input.landValueCents)} (${(landAllocationPct * 100).toFixed(1)}% of the ${fmtUsd(input.purchasePriceCents)} cost basis). The depreciable basis of ${fmtUsd(buildingValueCents)} is distributed across MACRS classes using the midpoint of each category's typical band in Cost Seg's ${typeLabel} asset library.`,
    confidence: 0.55,
  };

  const narrative = {
    executiveSummary:
      `This Tier-1 DIY Self-Serve cost segregation study allocates the depreciable basis of ${input.propertyAddress}` +
      `, ${input.city}, ${input.state} across MACRS classes using Cost Seg's ${typeLabel.toLowerCase()} asset library.` +
      `\n\n` +
      `You declared a purchase price of ${fmtUsd(input.purchasePriceCents)} and a land value of ${fmtUsd(input.landValueCents)}, leaving a depreciable basis of ${fmtUsd(buildingValueCents)}. ` +
      `The schedule reclassifies approximately ${(acceleratedPct(lineItems) * 100).toFixed(1)}% of building basis into 5/7/15-year accelerated property.`,
    propertyDescription: `${input.propertyAddress}, ${input.city}, ${input.state} is a ${typeLabel.toLowerCase()} acquired on ${input.acquiredAtIso}. This DIY Self-Serve study relies on the numbers you provided — no document parsing was performed. Upgrade to AI Report or Engineer-Reviewed for a schedule built from your closing disclosure, improvement receipts, and photographs.`,
    methodology: `The Residual Estimation Method endorsed in Chapter 3, Section C.4 of the IRS Cost Segregation Audit Techniques Guide allocates total basis across components adjusted for time, location, physical depreciation, and functional obsolescence. The DIY Self-Serve tier uses the midpoint of each category's typical allocation band for your property type — a conservative, defensible starting point that your CPA (or an engineer if you upgrade to Tier-2) can refine with site-specific data. 5-, 7-, and 15-year classes use the half-year convention; 27.5- or 39-year real property uses the straight-line mid-month convention.`,
    assetScheduleExplanation: `The schedule reclassifies every component of building basis into one of five MACRS recovery periods. Personal property (Section 1245) — appliances, furnishings, removable fixtures — carries a 5-year life. Office-type property (rarely applicable to residential rentals) carries a 7-year life. Land improvements carry a 15-year life. Residual Section 1250 real property covers the building shell and its integral components (HVAC, core plumbing, electrical rough-in, structural finishes).`,
    scheduleSummaryTable: `Recovery classes below use Cost Seg's ${typeLabel} library midpoints. Upgrade to AI Report or Engineer-Reviewed for a study built from your specific documents.`,
  };

  return {
    decomposition,
    schedule: {
      lineItems,
      assumptions: `DIY Self-Serve — user-declared basis + property-type-default allocation. Sum of all line items equals the depreciable basis exactly. Upgrade to Tier-2 for a PE-signed study.`,
    },
    narrative,
    totalCents: buildingValueCents,
  };
}

function acceleratedPct(lineItems: DiyLineItem[]): number {
  const total = lineItems.reduce((s, li) => s + li.amountCents, 0);
  const accel = lineItems
    .filter((li) => li.category === "5yr" || li.category === "7yr" || li.category === "15yr")
    .reduce((s, li) => s + li.amountCents, 0);
  return total > 0 ? accel / total : 0;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Suggested default land-allocation percentage by property type. Used in the
 * DIY intake form as a "What if you don't know?" hint. These match the low-end
 * of typical assessor-ratio ranges; users can override.
 */
export const DEFAULT_LAND_PCT: Record<PropertyType, number> = {
  SINGLE_FAMILY_RENTAL: 0.2,
  SHORT_TERM_RENTAL: 0.2,
  SMALL_MULTIFAMILY: 0.18,
  MID_MULTIFAMILY: 0.15,
  COMMERCIAL: 0.15,
};
