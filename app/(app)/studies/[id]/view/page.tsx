import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClockIcon, HomeIcon, InfoIcon } from "lucide-react";

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
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { aggregateBasisByClass } from "@/lib/pdf/macrs";
import { DEPRECIATION_CLASS_LABEL, type DepreciationClassKey } from "@/lib/pdf/types";
import { computeYearOneProjection } from "@/lib/pdf/year-one";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { resolveStudyAccess } from "@/lib/studies/access";
import { statusLabel } from "@/lib/studies/status-label";
import { ViewDownloadButton } from "./ViewDownloadButton";

const BRACKET_PCT = Math.round(DEFAULT_BRACKET * 100);

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
        <div className="mt-8 space-y-4">
          <Card className="border-primary/30 ring-primary/20 shadow-lg ring-1">
            <CardContent className="p-7">
              <div className="grid gap-6 sm:grid-cols-3">
                <Kpi
                  label="Year-1 deduction"
                  value={formatCents(year1)}
                  hint={`≈ ${formatCents(Math.round(year1 * DEFAULT_BRACKET))} tax savings @ ${BRACKET_PCT}%`}
                  size="lg"
                  tone="accent"
                />
                <Kpi
                  label="Accelerated property"
                  value={formatCents(accelerated)}
                  hint="5-, 7-, and 15-year combined"
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

          {/* Per-class breakdown — the number a CPA wants to see next. 39-year
              is the long-life residual; shown alongside the three accelerated
              classes for a full view of how basis landed. */}
          <div className="grid gap-3 sm:grid-cols-4">
            <ClassBreakdownTile label="5-year" cents={basis.fiveYrBasisCents} tone="primary" />
            <ClassBreakdownTile label="7-year" cents={basis.sevenYrBasisCents} tone="primary" />
            <ClassBreakdownTile label="15-year" cents={basis.fifteenYrBasisCents} tone="info" />
            <ClassBreakdownTile
              label="27.5/39-year"
              cents={basis.twentySevenHalfCents + basis.thirtyNineCents}
              tone="muted"
            />
          </div>
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
                    <table className="w-full min-w-[560px] text-sm">
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
              <Card className="border-dashed">
                <CardContent className="space-y-3 p-8 text-center">
                  <div className="bg-muted text-muted-foreground mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full">
                    <ClockIcon className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="text-foreground text-sm font-medium">
                    The asset schedule isn&rsquo;t ready yet.
                  </p>
                  <p className="text-muted-foreground mx-auto max-w-sm text-xs leading-relaxed">
                    Come back once the pipeline finishes — it usually takes a few minutes. You can
                    watch progress live from the pipeline page.
                  </p>
                  {access === "owner" ? (
                    <div className="pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/studies/${id}/processing` as Route}>Watch pipeline</Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                    <HomeIcon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight font-medium">Property details</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {study.property.city}, {study.property.state} {study.property.zip}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-xs">
                  <Row label="Type" value={PROPERTY_TYPE_LABELS[study.property.propertyType]} />
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
                <Separator className="my-4" />
                <p className="text-muted-foreground text-xs">
                  Owner:{" "}
                  <span className="text-foreground font-medium">
                    {study.user.name ?? study.user.email}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* When a customer shares a study BEFORE it's delivered, the CPA
                lands here without a PDF yet. Surface the reason so they're
                not left wondering why the download button is missing. */}
            {access === "shared" && !canDownload ? (
              <Card className="bg-muted/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-muted text-muted-foreground mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                      <InfoIcon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm leading-tight font-medium">PDF not ready yet.</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        The study is still in{" "}
                        <span className="text-foreground font-medium">
                          {statusLabel(study.status)}
                        </span>
                        . Once delivered, the owner can re-share and the download will appear here.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {access === "shared" ? (
              <Card className="bg-muted/30">
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm font-medium">Questions?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    You have read-only access. Reach out to {study.user.email} for context or
                    changes. For anything Segra–side, email support@segra.tax.
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

/**
 * Small tile in the per-class breakdown row below the headline KPIs.
 * Zero-basis classes render grayed-out so the eye skips straight to the
 * classes that matter for this property.
 */
function ClassBreakdownTile({
  label,
  cents,
  tone,
}: {
  label: string;
  cents: number;
  tone: "primary" | "info" | "muted";
}) {
  const empty = cents === 0;
  const valueColor = empty
    ? "text-muted-foreground/60"
    : tone === "primary"
      ? "text-primary"
      : tone === "info"
        ? "text-info"
        : "text-foreground";
  return (
    <div className="border-border bg-card rounded-md border p-4">
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
        {label}
      </p>
      <p data-tabular className={`mt-1.5 text-xl font-semibold tracking-tight ${valueColor}`}>
        {empty ? "—" : formatCents(cents)}
      </p>
    </div>
  );
}
