import type { EstimatorInput, EstimatorResult, PropertyType } from "./types";

/**
 * Default marginal rate used when the visitor hasn't disclosed theirs.
 * 32% bracket — middle of the married-filing-jointly high-income bands.
 * Per master prompt §6.1.
 */
export const DEFAULT_BRACKET = 0.32;

/**
 * Share of purchase price that typically reclassifies to 5/7/15-year property
 * for each property class. Directional only — real studies refine via
 * closing disclosure + on-site component schedule.
 *
 * Sources: IRS ATG (Pub 5653) industry ranges, internal CostSeg benchmarks.
 */
export const RECLASSIFICATION_RANGES: Record<PropertyType, { low: number; high: number }> = {
  SINGLE_FAMILY_RENTAL: { low: 0.18, high: 0.25 },
  SHORT_TERM_RENTAL: { low: 0.22, high: 0.3 },
  SMALL_MULTIFAMILY: { low: 0.2, high: 0.27 },
  MID_MULTIFAMILY: { low: 0.22, high: 0.28 },
  COMMERCIAL: { low: 0.25, high: 0.35 },
};

/**
 * Compute the estimator range. Pure function — all randomness/IO excluded.
 * Under OBBBA (2025), 100% bonus depreciation applies to reclassified
 * property acquired after 2025-01-19, so the full reclassified basis flows
 * to year-one deduction.
 */
export function computeEstimate(input: EstimatorInput): EstimatorResult {
  const { propertyType, purchasePriceCents, taxBracket = DEFAULT_BRACKET } = input;
  const { low, high } = RECLASSIFICATION_RANGES[propertyType];

  const reclassifiedLowCents = Math.round(purchasePriceCents * low);
  const reclassifiedHighCents = Math.round(purchasePriceCents * high);

  return {
    reclassifiedLowCents,
    reclassifiedHighCents,
    savingsLowCents: Math.round(reclassifiedLowCents * taxBracket),
    savingsHighCents: Math.round(reclassifiedHighCents * taxBracket),
    lowPct: low,
    highPct: high,
    assumedBracket: taxBracket,
  };
}
