export const DEPRECIATION_CLASS_LABEL = {
  "5yr": "5-year",
  "7yr": "7-year",
  "15yr": "15-year",
  "27_5yr": "27.5-year",
  "39yr": "39-year",
} as const;

export type DepreciationClassKey = keyof typeof DEPRECIATION_CLASS_LABEL;

export interface AssetGroup {
  category: DepreciationClassKey;
  amountCents: number;
  pctOfBuilding: number;
  lineItemCount: number;
}

export interface YearOneProjection {
  bonusEligibleCents: number; // 5/7/15-yr classes fully deductible under OBBBA
  longLifeBasisCents: number; // 27.5/39-yr classes
  longLifeYear1Cents: number; // first-year MACRS on long-life (mid-month convention)
}
