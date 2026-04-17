import type { DepreciationClassKey, YearOneProjection, AssetGroup } from "./types";

/**
 * First-year MACRS rates for long-life property under the mid-month convention,
 * placed in service in the first month (the conservative / generic estimate).
 * Real IRS tables vary by month — good enough for a planning projection, and
 * the report states so explicitly.
 */
const LONG_LIFE_FIRST_YEAR_RATE = {
  "27_5yr": 0.03485, // ~1/27.5 with mid-month, Jan placed-in-service
  "39yr": 0.02461, // ~1/39 with mid-month, Jan placed-in-service
} as const;

interface Line {
  category: string;
  amountCents: number;
}

export function computeYearOneProjection(lineItems: Line[]): YearOneProjection {
  let bonus = 0;
  let residential = 0;
  let commercial = 0;
  for (const li of lineItems) {
    switch (li.category) {
      case "5yr":
      case "7yr":
      case "15yr":
        bonus += li.amountCents;
        break;
      case "27_5yr":
        residential += li.amountCents;
        break;
      case "39yr":
        commercial += li.amountCents;
        break;
    }
  }
  const longLifeYear1 =
    Math.round(residential * LONG_LIFE_FIRST_YEAR_RATE["27_5yr"]) +
    Math.round(commercial * LONG_LIFE_FIRST_YEAR_RATE["39yr"]);
  return {
    bonusEligibleCents: bonus,
    longLifeBasisCents: residential + commercial,
    longLifeYear1Cents: longLifeYear1,
  };
}

/** Group schedule line items by depreciation class for the summary table. */
export function groupByDepreciationClass(
  lineItems: Line[],
  buildingValueCents: number,
): AssetGroup[] {
  const buckets = new Map<DepreciationClassKey, { amountCents: number; count: number }>();
  for (const li of lineItems) {
    if (!isKnownClass(li.category)) continue;
    const b = buckets.get(li.category) ?? { amountCents: 0, count: 0 };
    b.amountCents += li.amountCents;
    b.count += 1;
    buckets.set(li.category, b);
  }
  const order: DepreciationClassKey[] = ["5yr", "7yr", "15yr", "27_5yr", "39yr"];
  return order
    .filter((c) => buckets.has(c))
    .map<AssetGroup>((c) => {
      const b = buckets.get(c)!;
      return {
        category: c,
        amountCents: b.amountCents,
        lineItemCount: b.count,
        pctOfBuilding: buildingValueCents === 0 ? 0 : b.amountCents / buildingValueCents,
      };
    });
}

function isKnownClass(value: string): value is DepreciationClassKey {
  return (
    value === "5yr" || value === "7yr" || value === "15yr" || value === "27_5yr" || value === "39yr"
  );
}
