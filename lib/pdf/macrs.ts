import type { DepreciationClassKey } from "./types";

/**
 * Full MACRS schedule computation per IRS Rev. Proc. 87-57.
 *
 * 5-, 7-, 15-year personal/land-improvement property use declining-balance methods
 * with a half-year convention. 27.5- and 39-year real property use straight-line with
 * the mid-month convention.
 *
 * These factors are the IRS-published tables — we hardcode them rather than computing
 * live so the report is reproducible to the penny against the Tables in Pub 946.
 */

// Half-year convention, 200% DB (switches to SL when SL is higher).
// Year 1 is half the full-year rate because the mid-month convention treats all
// property as placed in service at mid-year.
const TABLE_5YR = [0.2, 0.32, 0.192, 0.1152, 0.1152, 0.0576];
const TABLE_7YR = [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446];
// 150% DB half-year (IRS-standard for 15-year land improvements).
const TABLE_15YR = [
  0.05, 0.095, 0.0855, 0.077, 0.0693, 0.0623, 0.059, 0.059, 0.0591, 0.059, 0.0591, 0.059, 0.0591,
  0.059, 0.0591, 0.0295,
];

/**
 * First-year fractions under the mid-month convention for 27.5- and 39-year real
 * property. After year 1, depreciation is a full straight-line fraction (1/27.5
 * or 1/39) until the mid-month of the final year.
 */
const FIRST_YEAR_27_5 = [
  0.03485, 0.03182, 0.02879, 0.02576, 0.02273, 0.0197, 0.01667, 0.01364, 0.01061, 0.00758, 0.00455,
  0.00152,
] as const;
const FIRST_YEAR_39 = [
  0.02461, 0.02247, 0.02033, 0.01819, 0.01605, 0.01391, 0.01177, 0.00963, 0.00749, 0.00535, 0.00321,
  0.00107,
] as const;

export interface MacrsLine {
  /** 'Bonus' for the bonus-depreciation row; otherwise the calendar year. */
  year: number | "Bonus";
  /** Per-class totals (0 if nothing in that class). */
  fiveYrCents: number;
  sevenYrCents: number;
  fifteenYrCents: number;
  thirtyNineYrCents: number;
  /** Sum across classes for this row. */
  totalCents: number;
}

export interface MacrsSchedule {
  lines: MacrsLine[];
  totals: {
    fiveYrCents: number;
    sevenYrCents: number;
    fifteenYrCents: number;
    thirtyNineYrCents: number;
    totalCents: number;
  };
  /** The bonus-eligible basis we pulled to the 'Bonus' row (5/7/15-year). */
  bonusAppliedCents: number;
  /** True if we applied 100% bonus to the 5/7/15 classes. */
  bonusAppliedFully: boolean;
  /** The year each class ran out of basis (for the footnote). */
  classEndYear: Partial<Record<DepreciationClassKey, number>>;
}

export interface ComputeMacrsInput {
  fiveYrBasisCents: number;
  sevenYrBasisCents: number;
  fifteenYrBasisCents: number;
  /** Treat 27.5- and 39-year the same (straight-line mid-month) — we normalize to 39. */
  residualRealCents: number;
  /** Calendar year the property was placed in service. */
  placedInServiceYear: number;
  /** 1–12, calendar month the property was placed in service. */
  placedInServiceMonth: number;
  /**
   * True when the taxpayer qualifies for 100% bonus depreciation on 5/7/15-year
   * property (under OBBBA for post-2025-01-19 property, for example). When true,
   * we pull the 5/7/15 basis into a "Bonus" row and report subsequent years as
   * zero on those classes.
   */
  bonusEligible: boolean;
  /**
   * Which real-property recovery period applies — 27.5 for residential-rental
   * classification (§168(c)), 39 for nonresidential (short-term rentals, commercial).
   */
  realPropertyYears: 27.5 | 39;
}

const round = (n: number) => Math.round(n);

function firstYearFactorRealProperty(years: 27.5 | 39, month: number): number {
  const idx = Math.min(Math.max(month, 1), 12) - 1;
  return years === 27.5 ? FIRST_YEAR_27_5[idx] : FIRST_YEAR_39[idx];
}

/**
 * Straight-line real property depreciation for year N (1-indexed). Year 1 uses
 * the mid-month partial factor; years 2..N-1 get the full 1/years fraction;
 * the final year picks up the remainder so everything reconciles to basis.
 */
function depreciationRealProperty(
  basis: number,
  years: 27.5 | 39,
  yearIndex: number,
  placedInServiceMonth: number,
): number {
  if (yearIndex < 1) return 0;
  const firstYearFrac = firstYearFactorRealProperty(years, placedInServiceMonth);
  const fullYears = Math.ceil(years);
  if (yearIndex === 1) return basis * firstYearFrac;
  if (yearIndex > fullYears) return 0;
  if (yearIndex === fullYears) {
    const remainingAfterFirst = basis - basis * firstYearFrac;
    const midYears = fullYears - 2;
    const takenInMiddle = basis * (1 / years) * midYears;
    return Math.max(0, remainingAfterFirst - takenInMiddle);
  }
  return basis * (1 / years);
}

export function computeMacrsSchedule(input: ComputeMacrsInput): MacrsSchedule {
  const {
    fiveYrBasisCents,
    sevenYrBasisCents,
    fifteenYrBasisCents,
    residualRealCents,
    placedInServiceYear,
    placedInServiceMonth,
    bonusEligible,
    realPropertyYears,
  } = input;

  const bonusApplied =
    bonusEligible && fiveYrBasisCents + sevenYrBasisCents + fifteenYrBasisCents > 0;

  // If bonus applies, zero out the annual schedule for 5/7/15 — those deductions happen on the Bonus row.
  const five = bonusApplied ? 0 : fiveYrBasisCents;
  const seven = bonusApplied ? 0 : sevenYrBasisCents;
  const fifteen = bonusApplied ? 0 : fifteenYrBasisCents;

  // Run at least through the entire real-property life + the realistic life of 15yr = 16 years.
  // So 40-41 lines for 39-year real property; 28-29 lines for 27.5-year residential.
  const realFullYears = Math.ceil(realPropertyYears);
  const totalYears = Math.max(realFullYears + 1, 16, 8);

  const lines: MacrsLine[] = [];

  // Bonus row (always present so the reader knows what applied — $0 when not eligible).
  lines.push({
    year: "Bonus",
    fiveYrCents: bonusApplied ? fiveYrBasisCents : 0,
    sevenYrCents: bonusApplied ? sevenYrBasisCents : 0,
    fifteenYrCents: bonusApplied ? fifteenYrBasisCents : 0,
    thirtyNineYrCents: 0,
    totalCents: bonusApplied ? fiveYrBasisCents + sevenYrBasisCents + fifteenYrBasisCents : 0,
  });

  const classEndYear: MacrsSchedule["classEndYear"] = {};

  for (let i = 1; i <= totalYears; i++) {
    const fiveAmt = five > 0 && TABLE_5YR[i - 1] !== undefined ? round(five * TABLE_5YR[i - 1]) : 0;
    const sevenAmt =
      seven > 0 && TABLE_7YR[i - 1] !== undefined ? round(seven * TABLE_7YR[i - 1]) : 0;
    const fifteenAmt =
      fifteen > 0 && TABLE_15YR[i - 1] !== undefined ? round(fifteen * TABLE_15YR[i - 1]) : 0;
    const realAmt = round(
      depreciationRealProperty(residualRealCents, realPropertyYears, i, placedInServiceMonth),
    );

    const total = fiveAmt + sevenAmt + fifteenAmt + realAmt;
    if (fiveAmt + sevenAmt + fifteenAmt + realAmt === 0 && i > realFullYears) break;

    if (i === TABLE_5YR.length && !classEndYear["5yr"] && five > 0) {
      classEndYear["5yr"] = placedInServiceYear + i - 1;
    }
    if (i === TABLE_7YR.length && !classEndYear["7yr"] && seven > 0) {
      classEndYear["7yr"] = placedInServiceYear + i - 1;
    }
    if (i === TABLE_15YR.length && !classEndYear["15yr"] && fifteen > 0) {
      classEndYear["15yr"] = placedInServiceYear + i - 1;
    }
    if (i === realFullYears && residualRealCents > 0) {
      const key: DepreciationClassKey = realPropertyYears === 27.5 ? "27_5yr" : "39yr";
      classEndYear[key] = placedInServiceYear + i - 1;
    }

    lines.push({
      year: placedInServiceYear + i - 1,
      fiveYrCents: fiveAmt,
      sevenYrCents: sevenAmt,
      fifteenYrCents: fifteenAmt,
      thirtyNineYrCents: realAmt,
      totalCents: total,
    });
  }

  const totals = lines.reduce(
    (acc, line) => ({
      fiveYrCents: acc.fiveYrCents + line.fiveYrCents,
      sevenYrCents: acc.sevenYrCents + line.sevenYrCents,
      fifteenYrCents: acc.fifteenYrCents + line.fifteenYrCents,
      thirtyNineYrCents: acc.thirtyNineYrCents + line.thirtyNineYrCents,
      totalCents: acc.totalCents + line.totalCents,
    }),
    { fiveYrCents: 0, sevenYrCents: 0, fifteenYrCents: 0, thirtyNineYrCents: 0, totalCents: 0 },
  );

  return {
    lines,
    totals,
    bonusAppliedCents: bonusApplied
      ? fiveYrBasisCents + sevenYrBasisCents + fifteenYrBasisCents
      : 0,
    bonusAppliedFully: bonusApplied,
    classEndYear,
  };
}

/**
 * Aggregate basis by class from a flat line-item list.
 * Used by the delivery pipeline to feed `computeMacrsSchedule`.
 */
export function aggregateBasisByClass(
  lineItems: Array<{ category: string; amountCents: number }>,
): {
  fiveYrBasisCents: number;
  sevenYrBasisCents: number;
  fifteenYrBasisCents: number;
  twentySevenHalfCents: number;
  thirtyNineCents: number;
} {
  let five = 0;
  let seven = 0;
  let fifteen = 0;
  let twoSeven = 0;
  let three9 = 0;
  for (const li of lineItems) {
    if (li.category === "5yr") five += li.amountCents;
    else if (li.category === "7yr") seven += li.amountCents;
    else if (li.category === "15yr") fifteen += li.amountCents;
    else if (li.category === "27_5yr") twoSeven += li.amountCents;
    else if (li.category === "39yr") three9 += li.amountCents;
  }
  return {
    fiveYrBasisCents: five,
    sevenYrBasisCents: seven,
    fifteenYrBasisCents: fifteen,
    twentySevenHalfCents: twoSeven,
    thirtyNineCents: three9,
  };
}
