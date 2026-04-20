import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, FileTextIcon, HomeIcon } from "lucide-react";

import { FinalCta } from "@/components/marketing/FinalCta";
import { SampleDownloadForm } from "@/components/marketing/SampleDownloadForm";
import { Container } from "@/components/shared/Container";
import { Kpi } from "@/components/shared/Kpi";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SAMPLES } from "@/lib/samples/catalog";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const fmtUsd2 = (n: number) => (n === 0 ? "—" : fmtUsd(n));

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sample = SAMPLES[id];
  if (!sample) return { title: "Sample" };
  return {
    title: `Sample — ${sample.address}`,
    description: `Sample ${sample.tier} cost segregation study for ${sample.address}. Fictional property, realistic numbers.`,
  };
}

export default async function SampleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = SAMPLES[id];
  if (!sample) notFound();

  return (
    <>
      <section className="relative overflow-hidden pt-16 pb-8">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="xl">
          <PageHeader
            backHref="/samples"
            backLabel="All samples"
            title={
              <>
                <span className="brand-gradient-text">Sample report.</span>{" "}
                <span className="text-muted-foreground">Fictional data.</span>
              </>
            }
            description={`${sample.propertyType} · ${sample.squareFeet.toLocaleString()} sqft · Built ${sample.yearBuilt} · Acquired ${sample.acquisitionDate}`}
            meta={
              <>
                <Badge
                  variant={sample.tier === "Engineer-Reviewed" ? "success" : "default"}
                  size="sm"
                >
                  {sample.tier}
                </Badge>
                <Badge variant="muted" size="sm">
                  {sample.turnaround}
                </Badge>
              </>
            }
            actions={
              <>
                <Button asChild variant="outline" leadingIcon={<DownloadIcon />}>
                  <a href={`/api/samples/${sample.id}/pdf`} download>
                    Download PDF
                  </a>
                </Button>
                <Button asChild trailingIcon={<ArrowRightIcon />}>
                  <Link href="/#estimator">Run your own</Link>
                </Button>
              </>
            }
          />
        </Container>
      </section>

      <Section divider={false} className="pt-8">
        <Container size="xl">
          <Card>
            <CardContent className="p-8 sm:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
                    Property
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{sample.address}</p>
                  <p className="text-muted-foreground text-sm">Prepared for {sample.ownerLabel}</p>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <HomeIcon className="h-4 w-4" aria-hidden />
                  <span className="text-sm">{sample.propertyType}</span>
                </div>
              </div>

              <Separator className="my-8" />

              <div className="grid gap-6 sm:grid-cols-3">
                <Kpi
                  label="Year-1 deduction"
                  value={fmtUsd(sample.year1Deduction)}
                  hint={`≈ ${fmtUsd(Math.round(sample.year1Deduction * 0.37))} tax savings at 37% bracket`}
                  tone="accent"
                  size="xl"
                  animate
                />
                <Kpi
                  label="Depreciable basis"
                  value={fmtUsd(sample.depreciableBasis)}
                  hint={`Net of ${fmtUsd(sample.landValue)} land value`}
                  size="lg"
                />
                <Kpi
                  label={`Accelerated @ ${sample.accelerated.pct.toFixed(1)}%`}
                  value={fmtUsd(sample.accelerated.value)}
                  hint="5-, 7-, and 15-year property combined"
                  size="lg"
                  tone="primary"
                />
              </div>

              <Separator className="my-8" />

              <dl className="grid gap-6 sm:grid-cols-4">
                <DlRow label="Cost basis" value={fmtUsd(sample.acquisitionPrice)} />
                <DlRow label="Land value" value={fmtUsd(sample.landValue)} />
                <DlRow label="5-year property" value={fmtUsd(sample.accelerated.fiveYear)} />
                <DlRow label="15-year property" value={fmtUsd(sample.accelerated.fifteenYear)} />
                {sample.accelerated.sevenYear > 0 ? (
                  <DlRow label="7-year property" value={fmtUsd(sample.accelerated.sevenYear)} />
                ) : null}
                <DlRow
                  label="Bonus depreciation"
                  value={`${sample.bonusRate}%`}
                  hint={sample.bonusRate === 100 ? "OBBBA window" : "TCJA phase-down"}
                />
              </dl>
            </CardContent>
          </Card>
        </Container>
      </Section>

      <Section>
        <Container size="xl">
          <SectionHeader
            eyebrow="Asset schedule — preview"
            title="Every line item, with its rationale."
            description="The full report includes 40+ line items. Here are the ten most significant — showing the exact structure you'll see in your own report."
            align="left"
          />
          <Card className="mt-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-border bg-muted/40 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Class</th>
                    <th className="px-5 py-3 text-left font-medium">Asset</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Unit cost</th>
                    <th className="px-5 py-3 text-right font-medium">Adjusted total</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.assets.map((asset, idx) => (
                    <tr
                      key={`${asset.name}-${idx}`}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}
                    >
                      <td className="px-5 py-4 align-top">
                        <Badge
                          variant={
                            asset.category === "5-year" || asset.category === "7-year"
                              ? "default"
                              : asset.category === "15-year"
                                ? "info"
                                : "muted"
                          }
                          size="sm"
                        >
                          {asset.category}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-muted-foreground mt-1 max-w-md text-xs leading-relaxed">
                          {asset.rationale}
                        </p>
                      </td>
                      <td data-tabular className="px-5 py-4 text-right align-top">
                        {asset.quantity}
                      </td>
                      <td data-tabular className="px-5 py-4 text-right align-top">
                        {fmtUsd(asset.unitCost)}
                      </td>
                      <td data-tabular className="px-5 py-4 text-right align-top font-medium">
                        {fmtUsd(asset.adjustedCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Container>
      </Section>

      <Section tone="muted">
        <Container size="xl">
          <SectionHeader
            eyebrow="MACRS schedule — first 5 years"
            title="Year-by-year depreciation, reconciled to the penny."
            description="Half-year convention on 5- and 15-year property; mid-month on real property. Full schedule runs 40 rows."
            align="left"
          />
          <Card className="mt-8 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-border bg-muted/40 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Year</th>
                    <th className="px-5 py-3 text-right font-medium">5-year</th>
                    <th className="px-5 py-3 text-right font-medium">15-year</th>
                    <th className="px-5 py-3 text-right font-medium">39-year</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.macrs.map((row, idx) => (
                    <tr
                      key={String(row.year)}
                      className={
                        idx === 0
                          ? "bg-accent/20 font-semibold"
                          : idx % 2 === 0
                            ? "bg-card"
                            : "bg-muted/20"
                      }
                    >
                      <td className="px-5 py-3 font-medium">{row.year}</td>
                      <td data-tabular className="px-5 py-3 text-right">
                        {fmtUsd2(row.fiveYr)}
                      </td>
                      <td data-tabular className="px-5 py-3 text-right">
                        {fmtUsd2(row.fifteenYr)}
                      </td>
                      <td data-tabular className="px-5 py-3 text-right">
                        {fmtUsd2(row.thirtyNineYr)}
                      </td>
                      <td data-tabular className="px-5 py-3 text-right font-semibold">
                        {fmtUsd(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Container>
      </Section>

      <Section>
        <Container size="md">
          <Card className="border-primary/20 ring-primary/10 ring-1">
            <CardContent className="space-y-6 p-8 text-center">
              <FileTextIcon className="text-primary mx-auto h-10 w-10" aria-hidden />
              <div>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Want the full 214-page-class PDF?
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  We&rsquo;ll email you the complete anonymized report — cover page, executive
                  summary, methodology appendix, per-asset pages with photos + rationale, source
                  documents.
                </p>
              </div>
              <SampleDownloadForm />
            </CardContent>
          </Card>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

function DlRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
        {label}
      </dt>
      <dd data-tabular className="mt-1 text-lg font-semibold tracking-tight">
        {value}
      </dd>
      {hint ? <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p> : null}
    </div>
  );
}
