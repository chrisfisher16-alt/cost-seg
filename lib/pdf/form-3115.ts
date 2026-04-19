import { computeMacrsSchedule } from "./macrs";
import type { DepreciationClassKey } from "./types";

/**
 * Pure computation for the CPA Filing Worksheet (Appendix E of every study).
 *
 * Translates the cost-seg asset schedule into the numerical inputs a CPA needs
 * to file either Form 3115 (change of accounting method, if the property was
 * placed in service in a prior tax year) or Form 4562 (depreciation, for the
 * year of acquisition).
 *
 * The worksheet is decision-support — we do not produce Form 3115 itself, we
 * surface the §481(a) adjustment math and flag which form the CPA should file.
 */

export interface Form3115Input {
  /** Basis going to 5-year personal property (cents). */
  fiveYrBasisCents: number;
  /** Basis going to 7-year personal property (cents). */
  sevenYrBasisCents: number;
  /** Basis going to 15-year land improvements (cents). */
  fifteenYrBasisCents: number;
  /** Residual real-property basis (27.5- or 39-year), cents. */
  residualRealCents: number;
  /** Calendar year the property was placed in service. */
  placedInServiceYear: number;
  /** 1–12, calendar month the property was placed in service. */
  placedInServiceMonth: number;
  /** The tax year the CPA will file this worksheet against (year of change). */
  taxYear: number;
  /**
   * Bonus depreciation eligibility — derived from acquisition date against
   * TCJA (2017-09-28) and OBBBA (2025-01-19) cutoffs. See lib/studies/deliver.ts.
   */
  bonusEligible: boolean;
  /** 27.5-year residential rental, or 39-year nonresidential. */
  realPropertyYears: 27.5 | 39;
}

export interface Form3115Worksheet {
  /**
   * True when the property was placed in service in a prior tax year and the
   * taxpayer has been depreciating it under a non-cost-seg method. Form 3115
   * (§481(a) adjustment) is the vehicle for catching up.
   * False for year-of-acquisition studies — use Form 4562 directly.
   */
  form3115Applies: boolean;

  /** Which form the CPA should file on behalf of the taxpayer. */
  recommendedForm: "Form 4562" | "Form 3115";

  /**
   * Designated Change Number for Form 3115. 7 is the automatic-consent number
   * for depreciation method changes (Rev. Proc. 2015-13 / subsequent updates).
   * Returned only when form3115Applies is true.
   */
  designatedChangeNumber: number | null;

  /**
   * Net §481(a) adjustment in cents — the "catch-up" deduction the taxpayer
   * takes in the year of change. Positive = additional deduction; negative =
   * income pickup (rare for cost seg). Zero when form3115Applies is false.
   */
  section481AdjustmentCents: number;

  /**
   * Per-year breakdown of prior depreciation under both methods, so the CPA
   * can sanity-check the §481(a) figure.
   */
  priorYearBreakdown: Array<{
    year: number;
    oldMethodCents: number;
    newMethodCents: number;
    deltaCents: number;
  }>;

  /** Cumulative through the year before `taxYear` (both methods). */
  priorYearTotals: {
    oldMethodCents: number;
    newMethodCents: number;
  };

  /** Form 4562 / 3115 line pre-fills — per-class totals. */
  classSummary: Array<{
    category: DepreciationClassKey;
    label: string;
    basisCents: number;
    recoveryPeriod: string;
    convention: string;
    method: string;
  }>;

  /** The depreciation the taxpayer claims on the filed return for `taxYear`. */
  yearOfChangeDepreciationCents: number;

  /** Plain-language summary a CPA can drop into workpapers. */
  summaryParagraph: string;
}

function fmtCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function classSummaryFor(input: Form3115Input): Form3115Worksheet["classSummary"] {
  const rows: Form3115Worksheet["classSummary"] = [];
  if (input.fiveYrBasisCents > 0) {
    rows.push({
      category: "5yr",
      label: "5-year personal property (§1245)",
      basisCents: input.fiveYrBasisCents,
      recoveryPeriod: "5 years",
      convention: "Half-year",
      method: "200% DB (switching to SL)",
    });
  }
  if (input.sevenYrBasisCents > 0) {
    rows.push({
      category: "7yr",
      label: "7-year personal property (§1245)",
      basisCents: input.sevenYrBasisCents,
      recoveryPeriod: "7 years",
      convention: "Half-year",
      method: "200% DB (switching to SL)",
    });
  }
  if (input.fifteenYrBasisCents > 0) {
    rows.push({
      category: "15yr",
      label: "15-year land improvements (§1245)",
      basisCents: input.fifteenYrBasisCents,
      recoveryPeriod: "15 years",
      convention: "Half-year",
      method: "150% DB (switching to SL)",
    });
  }
  if (input.residualRealCents > 0) {
    const is27 = input.realPropertyYears === 27.5;
    rows.push({
      category: is27 ? "27_5yr" : "39yr",
      label: is27
        ? "27.5-year residential rental (§1250)"
        : "39-year nonresidential real property (§1250)",
      basisCents: input.residualRealCents,
      recoveryPeriod: `${input.realPropertyYears} years`,
      convention: "Mid-month",
      method: "Straight-line",
    });
  }
  return rows;
}

/**
 * Compute the old-method depreciation the taxpayer has been taking before the
 * cost-seg study: straight-line on the full depreciable basis over the real-
 * property recovery period with mid-month convention. No bonus, no acceleration.
 */
function computeOldMethodSchedule(input: Form3115Input): Array<{ year: number; cents: number }> {
  const fullBasis =
    input.fiveYrBasisCents +
    input.sevenYrBasisCents +
    input.fifteenYrBasisCents +
    input.residualRealCents;

  const schedule = computeMacrsSchedule({
    fiveYrBasisCents: 0,
    sevenYrBasisCents: 0,
    fifteenYrBasisCents: 0,
    residualRealCents: fullBasis,
    placedInServiceYear: input.placedInServiceYear,
    placedInServiceMonth: input.placedInServiceMonth,
    bonusEligible: false, // old method — no cost-seg, no accelerated, no bonus
    realPropertyYears: input.realPropertyYears,
  });

  return schedule.lines
    .filter((line) => line.year !== "Bonus")
    .map((line) => ({
      year: line.year as number,
      cents: line.totalCents,
    }));
}

export function computeForm3115Worksheet(input: Form3115Input): Form3115Worksheet {
  const {
    fiveYrBasisCents,
    sevenYrBasisCents,
    fifteenYrBasisCents,
    residualRealCents,
    placedInServiceYear,
    placedInServiceMonth,
    taxYear,
    bonusEligible,
    realPropertyYears,
  } = input;

  // Year of acquisition = taxYear → no prior-year depreciation to adjust → use Form 4562 directly.
  const form3115Applies = taxYear > placedInServiceYear;
  const recommendedForm: "Form 4562" | "Form 3115" = form3115Applies ? "Form 3115" : "Form 4562";
  const designatedChangeNumber = form3115Applies ? 7 : null;
  const classSummary = classSummaryFor(input);

  // Run both schedules (new cost-seg method + old straight-line method).
  const newSchedule = computeMacrsSchedule({
    fiveYrBasisCents,
    sevenYrBasisCents,
    fifteenYrBasisCents,
    residualRealCents,
    placedInServiceYear,
    placedInServiceMonth,
    bonusEligible,
    realPropertyYears,
  });

  const oldSchedule = computeOldMethodSchedule(input);

  // Map years → cents for easy subtraction.
  const oldByYear = new Map<number, number>(oldSchedule.map((r) => [r.year, r.cents]));
  const newByYear = new Map<number, number>();
  let bonusAppliedToYear1 = 0;
  for (const line of newSchedule.lines) {
    if (line.year === "Bonus") {
      // Bonus depreciation is deducted in the placed-in-service year under the new method.
      bonusAppliedToYear1 += line.totalCents;
    } else {
      newByYear.set(line.year as number, line.totalCents);
    }
  }
  if (bonusAppliedToYear1 > 0) {
    newByYear.set(
      placedInServiceYear,
      (newByYear.get(placedInServiceYear) ?? 0) + bonusAppliedToYear1,
    );
  }

  const priorYearBreakdown: Form3115Worksheet["priorYearBreakdown"] = [];
  for (let y = placedInServiceYear; y < taxYear; y++) {
    const oldCents = oldByYear.get(y) ?? 0;
    const newCents = newByYear.get(y) ?? 0;
    priorYearBreakdown.push({
      year: y,
      oldMethodCents: oldCents,
      newMethodCents: newCents,
      deltaCents: newCents - oldCents,
    });
  }
  const priorTotalOld = priorYearBreakdown.reduce((s, r) => s + r.oldMethodCents, 0);
  const priorTotalNew = priorYearBreakdown.reduce((s, r) => s + r.newMethodCents, 0);
  const section481AdjustmentCents = form3115Applies ? priorTotalNew - priorTotalOld : 0;

  const yearOfChangeDepreciationCents = newByYear.get(taxYear) ?? 0;

  const summaryParagraph = form3115Applies
    ? `The taxpayer placed this property in service in ${placedInServiceYear} and has been depreciating it under the default ${realPropertyYears}-year straight-line method. The cost segregation study reclassifies basis into shorter recovery classes, and an automatic method change (DCN 7) catches the taxpayer up for prior years via a §481(a) adjustment of ${fmtCents(section481AdjustmentCents)} taken entirely in tax year ${taxYear}. On top of that, normal ${taxYear} depreciation under the new method is ${fmtCents(yearOfChangeDepreciationCents)}, so the taxpayer's total ${taxYear} depreciation deduction is ${fmtCents(section481AdjustmentCents + yearOfChangeDepreciationCents)}.`
    : `The property was placed in service in ${placedInServiceYear} — the same as the tax year of change (${taxYear}). No Form 3115 is required; the taxpayer claims the accelerated classifications directly on Form 4562. Total ${taxYear} depreciation under the cost-seg method is ${fmtCents(yearOfChangeDepreciationCents)}, including any bonus depreciation on 5/7/15-year property.`;

  return {
    form3115Applies,
    recommendedForm,
    designatedChangeNumber,
    section481AdjustmentCents,
    priorYearBreakdown,
    priorYearTotals: {
      oldMethodCents: priorTotalOld,
      newMethodCents: priorTotalNew,
    },
    classSummary,
    yearOfChangeDepreciationCents,
    summaryParagraph,
  };
}

/**
 * Convenience adapter: aggregate a flat asset-schedule line-item list into the
 * Form3115Input shape. Saves the caller from re-implementing the aggregation
 * (same one the MACRS schedule uses).
 */
export function form3115InputFromLineItems(
  lineItems: Array<{ category: string; amountCents: number }>,
  options: {
    placedInServiceYear: number;
    placedInServiceMonth: number;
    taxYear: number;
    bonusEligible: boolean;
    realPropertyYears: 27.5 | 39;
  },
): Form3115Input {
  let five = 0;
  let seven = 0;
  let fifteen = 0;
  let real = 0;
  for (const li of lineItems) {
    if (li.category === "5yr") five += li.amountCents;
    else if (li.category === "7yr") seven += li.amountCents;
    else if (li.category === "15yr") fifteen += li.amountCents;
    else if (li.category === "27_5yr" || li.category === "39yr") real += li.amountCents;
  }
  return {
    fiveYrBasisCents: five,
    sevenYrBasisCents: seven,
    fifteenYrBasisCents: fifteen,
    residualRealCents: real,
    placedInServiceYear: options.placedInServiceYear,
    placedInServiceMonth: options.placedInServiceMonth,
    taxYear: options.taxYear,
    bonusEligible: options.bonusEligible,
    realPropertyYears: options.realPropertyYears,
  };
}
