import { requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { renderPortfolioCsv, type PortfolioStudyInput } from "@/lib/studies/aggregate";

/**
 * GET /api/dashboard/portfolio.csv
 *
 * Streams the signed-in user's portfolio as a CSV. One row per study, columns:
 * id, tier, status, address, property type, acquired, purchase price, land,
 * depreciable basis, accelerated, year-1 deduction, year-1 tax savings,
 * line items, created, delivered.
 *
 * Ownership gate: only the caller's own studies. CPAs see shared studies on
 * the dashboard UI but the CSV intentionally scopes to owned — the
 * legal/accounting ownership for tax filings is the property owner.
 */
export async function GET() {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const rows = await prisma.study.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      tier: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      assetSchedule: true,
      property: {
        select: {
          address: true,
          city: true,
          state: true,
          zip: true,
          propertyType: true,
          purchasePrice: true,
          acquiredAt: true,
        },
      },
    },
  });

  const portfolio: PortfolioStudyInput[] = rows.map((r) => ({
    id: r.id,
    tier: r.tier,
    status: r.status,
    createdAt: r.createdAt,
    deliveredAt: r.deliveredAt,
    property: {
      address: r.property.address,
      city: r.property.city,
      state: r.property.state,
      zip: r.property.zip,
      propertyType: r.property.propertyType,
      purchasePriceCents: Math.round(Number(r.property.purchasePrice) * 100),
      acquiredAt: r.property.acquiredAt,
    },
    assetSchedule: (r.assetSchedule as PortfolioStudyInput["assetSchedule"]) ?? null,
  }));

  const csv = renderPortfolioCsv(portfolio);
  const filename = `cost-seg-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
