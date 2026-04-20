import { BRAND } from "@/lib/brand";
import { aggregateBasisByClass } from "@/lib/pdf/macrs";
import { computeYearOneProjection } from "@/lib/pdf/year-one";

/**
 * Minimum fields we need to aggregate a single study into a portfolio row.
 * Shape aligns with the StoredSchedule JSON we persist on Study.assetSchedule
 * — see lib/studies/deliver.ts.
 */
export interface PortfolioStudyInput {
  id: string;
  tier: "DIY" | "AI_REPORT" | "ENGINEER_REVIEWED";
  status: string;
  createdAt: Date;
  deliveredAt: Date | null;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyType: string;
    purchasePriceCents: number;
    acquiredAt: Date;
  };
  /** StoredSchedule JSON — null while pending. */
  assetSchedule: {
    decomposition?: { buildingValueCents?: number; landValueCents?: number };
    schedule?: {
      lineItems?: Array<{ category: string; amountCents: number }>;
    };
    totalCents?: number;
  } | null;
}

export interface PortfolioRow {
  id: string;
  tierLabel: string;
  status: string;
  propertyAddress: string;
  propertyType: string;
  purchasePriceCents: number;
  depreciableBasisCents: number;
  landValueCents: number;
  acceleratedCents: number;
  year1DeductionCents: number;
  year1TaxSavingsCents: number;
  lineItemCount: number;
  createdAtIso: string;
  deliveredAtIso: string | null;
  hasSchedule: boolean;
}

export interface PortfolioTotals {
  /** Number of input studies (all statuses). */
  studyCount: number;
  /** Count of delivered studies (the only ones with real numbers). */
  deliveredCount: number;
  /** Sum of purchase prices across every study. */
  totalPurchasePriceCents: number;
  /** Sum of depreciable basis (purchase price − land). */
  totalDepreciableBasisCents: number;
  /** Sum of accelerated 5/7/15-year property across delivered studies. */
  totalAcceleratedCents: number;
  /** Sum of year-one deductions across delivered studies. */
  totalYear1DeductionCents: number;
  /** Estimated tax savings at the assumed bracket (default 37%). */
  totalYear1TaxSavingsCents: number;
  /** Average accelerated % across delivered studies. */
  averageAcceleratedPct: number;
}

const DEFAULT_BRACKET = 0.37;

const TIER_LABEL: Record<PortfolioStudyInput["tier"], string> = {
  DIY: "DIY Self-Serve",
  AI_REPORT: "AI Report",
  ENGINEER_REVIEWED: "Engineer-Reviewed Study",
};

/** Transform a single Prisma-shaped study into a portfolio row. Pure. */
export function studyToPortfolioRow(
  study: PortfolioStudyInput,
  bracket: number = DEFAULT_BRACKET,
): PortfolioRow {
  const lineItems = study.assetSchedule?.schedule?.lineItems ?? [];
  const basis = aggregateBasisByClass(lineItems);
  const accelerated = basis.fiveYrBasisCents + basis.sevenYrBasisCents + basis.fifteenYrBasisCents;
  const projection = lineItems.length > 0 ? computeYearOneProjection(lineItems) : null;
  const year1 = projection ? projection.bonusEligibleCents + projection.longLifeYear1Cents : 0;

  return {
    id: study.id,
    tierLabel: TIER_LABEL[study.tier],
    status: study.status,
    propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state} ${study.property.zip}`,
    propertyType: study.property.propertyType,
    purchasePriceCents: study.property.purchasePriceCents,
    depreciableBasisCents: study.assetSchedule?.decomposition?.buildingValueCents ?? 0,
    landValueCents: study.assetSchedule?.decomposition?.landValueCents ?? 0,
    acceleratedCents: accelerated,
    year1DeductionCents: year1,
    year1TaxSavingsCents: Math.round(year1 * bracket),
    lineItemCount: lineItems.length,
    createdAtIso: study.createdAt.toISOString(),
    deliveredAtIso: study.deliveredAt?.toISOString() ?? null,
    hasSchedule: lineItems.length > 0,
  };
}

/** Aggregate a list of studies into portfolio-level totals. Pure. */
export function buildPortfolioTotals(
  studies: PortfolioStudyInput[],
  bracket: number = DEFAULT_BRACKET,
): PortfolioTotals {
  let deliveredCount = 0;
  let totalPurchase = 0;
  let totalBasis = 0;
  let totalAccelerated = 0;
  let totalYear1 = 0;
  let acceleratedPctSum = 0;
  let acceleratedPctCount = 0;

  for (const s of studies) {
    totalPurchase += s.property.purchasePriceCents;

    if (s.status !== "DELIVERED") continue;
    deliveredCount += 1;

    const row = studyToPortfolioRow(s, bracket);
    totalBasis += row.depreciableBasisCents;
    totalAccelerated += row.acceleratedCents;
    totalYear1 += row.year1DeductionCents;
    if (row.depreciableBasisCents > 0) {
      acceleratedPctSum += row.acceleratedCents / row.depreciableBasisCents;
      acceleratedPctCount += 1;
    }
  }

  const averageAcceleratedPct =
    acceleratedPctCount > 0 ? acceleratedPctSum / acceleratedPctCount : 0;

  return {
    studyCount: studies.length,
    deliveredCount,
    totalPurchasePriceCents: totalPurchase,
    totalDepreciableBasisCents: totalBasis,
    totalAcceleratedCents: totalAccelerated,
    totalYear1DeductionCents: totalYear1,
    totalYear1TaxSavingsCents: Math.round(totalYear1 * bracket),
    averageAcceleratedPct,
  };
}

/**
 * Render the portfolio as CSV. Columns chosen so the file imports cleanly into
 * Excel / Google Sheets with no extra massaging.
 */
export function renderPortfolioCsv(
  studies: PortfolioStudyInput[],
  bracket: number = DEFAULT_BRACKET,
): string {
  const header = [
    "Study ID",
    "Tier",
    "Status",
    "Property address",
    "Property type",
    "Acquired",
    "Purchase price",
    "Land value",
    "Depreciable basis",
    "Accelerated (5/7/15-year)",
    "Year-1 deduction",
    `Year-1 tax savings @ ${(bracket * 100).toFixed(0)}%`,
    "Line items",
    "Created",
    "Delivered",
  ];

  const escape = (value: string) => {
    if (value.includes('"') || value.includes(",") || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const dollars = (cents: number) => (cents / 100).toFixed(2);

  const rows = studies.map((study) => {
    const row = studyToPortfolioRow(study, bracket);
    return [
      study.id,
      row.tierLabel,
      row.status,
      row.propertyAddress,
      row.propertyType,
      study.property.acquiredAt.toISOString().slice(0, 10),
      dollars(row.purchasePriceCents),
      dollars(row.landValueCents),
      dollars(row.depreciableBasisCents),
      dollars(row.acceleratedCents),
      dollars(row.year1DeductionCents),
      dollars(row.year1TaxSavingsCents),
      row.lineItemCount.toString(),
      row.createdAtIso,
      row.deliveredAtIso ?? "",
    ]
      .map(escape)
      .join(",");
  });

  return [header.join(","), ...rows].join("\n") + "\n";
}

/**
 * Filename for the portfolio CSV download, scoped by BRAND.name rather than
 * a hardcoded slug. Future rebrands only need lib/brand.ts to update.
 *
 * Shape: `<brand-slug>-portfolio-YYYY-MM-DD.csv`. The date is the UTC calendar
 * day the export was generated; same-day re-exports reuse the filename (some
 * browsers auto-suffix `(1)` on duplicates — that's fine).
 */
export function portfolioCsvFilename(now: Date = new Date()): string {
  const slug = BRAND.name.toLowerCase();
  const date = now.toISOString().slice(0, 10);
  return `${slug}-portfolio-${date}.csv`;
}
