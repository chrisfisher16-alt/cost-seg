import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Kpi } from "@/components/shared/Kpi";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, SectionHeader } from "@/components/shared/Section";
import { StudyStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { DEFAULT_BRACKET } from "@/lib/estimator/compute";
import { aggregateBasisByClass } from "@/lib/pdf/macrs";
import { DEPRECIATION_CLASS_LABEL, type DepreciationClassKey } from "@/lib/pdf/types";
import { computeYearOneProjection } from "@/lib/pdf/year-one";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { resolveStudyAccess } from "@/lib/studies/access";
import { ViewDownloadButton } from "./ViewDownloadButton";

export const metadata = { title: "Study view" };

type Props = { params: Promise<{ id: string }> };

async function loadStudy(studyId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        userId: true,
        tier: true,
        status: true,
        createdAt: true,
        deliverableUrl: true,
        assetSchedule: true,
        user: { select: { name: true, email: true } },
        property: {
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
            purchasePrice: true,
            acquiredAt: true,
            propertyType: true,
            squareFeet: true,
            yearBuilt: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function StudyViewPage({ params }: Props) {
  const { id } = await params;
  const { user } = await requireAuth(`/studies/${id}/view`);

  const access = await resolveStudyAccess(user, id);
  if (!access) notFound();

  const study = await loadStudy(id);
  if (!study) notFound();

  const entry = CATALOG[study.tier];
  const tierEmerald = study.tier === "ENGINEER_REVIEWED" ? "success" : "default";

  const stored = (study.assetSchedule ?? {}) as {
    decomposition?: {
      purchasePriceCents?: number;
      landValueCents?: number;
      buildingValueCents?: number;
      landAllocationPct?: number;
    };
    schedule?: {
      lineItems?: Array<{
        category: string;
        name: string;
        amountCents: number;
        rationale?: string;
      }>;
    };
  };
  const lineItems = stored.schedule?.lineItems ?? [];
  const basis = aggregateBasisByClass(lineItems);
  const projection = lineItems.length > 0 ? computeYearOneProjection(lineItems) : null;
  const year1 = projection ? projection.bonusEligibleCents + projection.longLifeYear1Cents : 0;
  const accelerated = basis.fiveYrBasisCents + basis.sevenYrBasisCents + basis.fifteenYrBasisCents;
  const building = stored.decomposition?.buildingValueCents ?? 0;

  const canDownload = study.status === "DELIVERED" && Boolean(study.deliverableUrl);

  return (
    <Container size="xl" className="py-10 sm:py-14">
      <PageHeader
        backHref={user.role === "CPA" ? "/dashboard" : `/studies/${id}/processing`}
        backLabel={user.role === "CPA" ? "CPA dashboard" : "Pipeline view"}
        title={`${study.property.address}, ${study.property.city}, ${study.property.state}`}
        description={
          access === "shared"
            ? `Shared with you by ${study.user.name ?? study.user.email} · Read-only`
            : `Your ${entry.label.toLowerCase()} study · Read-only view`
        }
        meta={
          <>
            <Badge variant={tierEmerald} size="sm">
              {entry.label}
            </Badge>
            <StudyStatusBadge status={study.status} size="sm" />
            <span className="text-muted-foreground text-xs">
              Started {study.createdAt.toLocaleDateString()}
            </span>
          </>
        }
        actions={canDownload ? <ViewDownloadButton studyId={id} /> : null}
      />

      {year1 > 0 ? (
        <div className="mt-8">
          <Card className="border-primary/30 ring-primary/20 shadow-lg ring-1">
            <CardContent className="p-7">
              <div className="grid gap-6 sm:grid-cols-3">
                <Kpi
                  label="Year-1 deduction"
                  value={formatCents(year1)}
                  hint={`≈ ${formatCents(Math.round(year1 * DEFAULT_BRACKET))} tax savings @ 37%`}
                  size="lg"
                  tone="accent"
                />
                <Kpi
                  label="Accelerated property"
                  value={formatCents(accelerated)}
                  hint="5/7/15-year classes"
                  size="lg"
                  tone="primary"
                />
                <Kpi
                  label="Depreciable basis"
                  value={formatCents(building)}
                  hint={`${lineItems.length} classified line items`}
                  size="lg"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Section>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <SectionHeader
              eyebrow="Asset schedule"
              title="How the basis breaks down"
              description="Read-only summary. Download the full PDF for the complete methodology, MACRS schedule, and per-asset rationale."
              align="left"
            />
            {lineItems.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-border bg-muted/40 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Class</th>
                          <th className="px-4 py-3 text-left font-medium">Asset</th>
                          <th className="px-4 py-3 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((li, idx) => (
                          <tr
                            key={`${li.category}-${li.name}-${idx}`}
                            className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                          >
                            <td className="px-4 py-3 align-top">
                              <Badge
                                variant={
                                  li.category === "5yr" || li.category === "7yr"
                                    ? "default"
                                    : li.category === "15yr"
                                      ? "info"
                                      : "muted"
                                }
                                size="sm"
                              >
                                {DEPRECIATION_CLASS_LABEL[li.category as DepreciationClassKey] ??
                                  li.category}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{li.name}</p>
                              {li.rationale ? (
                                <p className="text-muted-foreground mt-1 max-w-md text-xs">
                                  {li.rationale}
                                </p>
                              ) : null}
                            </td>
                            <td data-tabular className="px-4 py-3 text-right font-medium">
                              {formatCents(li.amountCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-muted-foreground p-10 text-center text-sm">
                  The asset schedule isn&rsquo;t ready yet — come back once the pipeline finishes.
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="space-y-3 p-5">
                <HomeIcon className="text-primary h-4 w-4" aria-hidden />
                <p className="text-sm font-medium">Property details</p>
                <dl className="space-y-2 text-xs">
                  <Row
                    label="Type"
                    value={study.property.propertyType.replace(/_/g, " ").toLowerCase()}
                  />
                  <Row
                    label="Acquired"
                    value={study.property.acquiredAt.toISOString().slice(0, 10)}
                  />
                  <Row
                    label="Purchase price"
                    value={formatCents(Number(study.property.purchasePrice) * 100)}
                    mono
                  />
                  {study.property.squareFeet ? (
                    <Row
                      label="Square footage"
                      value={`${study.property.squareFeet.toLocaleString()} sq ft`}
                    />
                  ) : null}
                  {study.property.yearBuilt ? (
                    <Row label="Year built" value={String(study.property.yearBuilt)} />
                  ) : null}
                </dl>
                <Separator />
                <p className="text-muted-foreground text-xs">
                  Owner:{" "}
                  <span className="text-foreground font-medium">
                    {study.user.name ?? study.user.email}
                  </span>
                </p>
              </CardContent>
            </Card>

            {access === "shared" ? (
              <Card className="bg-muted/30">
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm font-medium">Questions?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    You have read-only access. Reach out to {study.user.email} for context or
                    changes. For anything Cost Seg–side, email support@costseg.app.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {access === "owner" ? (
              <Card className="bg-muted/30">
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm font-medium">This is what your CPA sees.</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    A read-only mirror of your study. Revoke their access anytime from the pipeline
                    page.
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/studies/${id}/processing` as Route}>Back to pipeline view</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </Section>
    </Container>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono font-medium tabular-nums" : "font-medium"}>{value}</dd>
    </div>
  );
}
