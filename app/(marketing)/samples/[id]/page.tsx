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

type Tier = "AI Report" | "Engineer-Reviewed";

type Sample = {
  id: string;
  address: string;
  ownerLabel: string;
  propertyType: string;
  yearBuilt: number;
  squareFeet: number;
  acquisitionDate: string;
  acquisitionPrice: number;
  landValue: number;
  depreciableBasis: number;
  accelerated: {
    value: number;
    pct: number;
    fiveYear: number;
    sevenYear: number;
    fifteenYear: number;
  };
  year1Deduction: number;
  bonusRate: number;
  tier: Tier;
  turnaround: string;
  assets: Array<{
    category: "5-year" | "7-year" | "15-year" | "39-year";
    name: string;
    quantity: number;
    unitCost: number;
    adjustedCost: number;
    rationale: string;
  }>;
  macrs: Array<{
    year: number | string;
    fiveYr: number;
    fifteenYr: number;
    thirtyNineYr: number;
    total: number;
  }>;
};

const SAMPLES: Record<string, Sample> = {
  "oak-ridge": {
    id: "oak-ridge",
    address: "123 Oak Ridge Drive, Nashville, TN 37215",
    ownerLabel: "Oak Ridge STR, LLC",
    propertyType: "Short-term rental · single-family home",
    yearBuilt: 2004,
    squareFeet: 2840,
    acquisitionDate: "2024-06-14",
    acquisitionPrice: 476_703,
    landValue: 113_852,
    depreciableBasis: 362_851,
    accelerated: { value: 147_200, pct: 29.0, fiveYear: 89_700, sevenYear: 0, fifteenYear: 57_500 },
    year1Deduction: 147_200,
    bonusRate: 100,
    tier: "AI Report",
    turnaround: "Delivered 11 minutes after document upload",
    assets: [
      {
        category: "5-year",
        name: "Appliance package — refrigerator, range, dishwasher",
        quantity: 3,
        unitCost: 1_600,
        adjustedCost: 5_376,
        rationale:
          "Section 1245 personal property. Five-year life under Rev. Proc. 87-56 asset class 57.0.",
      },
      {
        category: "5-year",
        name: "Luxury vinyl plank flooring — bedrooms & living",
        quantity: 1,
        unitCost: 4_200,
        adjustedCost: 4_578,
        rationale:
          "Floating LVP is readily removable without structural damage — Whiteco permanence test fails. 5-year.",
      },
      {
        category: "5-year",
        name: "Decorative lighting — chandeliers, sconces",
        quantity: 6,
        unitCost: 380,
        adjustedCost: 2_500,
        rationale: "Decorative-not-essential (HCA); removable. 5-year personal property.",
      },
      {
        category: "5-year",
        name: "Built-in cabinetry & custom shelving",
        quantity: 1,
        unitCost: 5_400,
        adjustedCost: 5_886,
        rationale: "Serves a decorative/aesthetic purpose; removable without damage. 5-year.",
      },
      {
        category: "5-year",
        name: "Window treatments — curtains, rods",
        quantity: 8,
        unitCost: 145,
        adjustedCost: 1_258,
        rationale: "Decorative removable 5-year under §1245.",
      },
      {
        category: "15-year",
        name: "Landscaping — plantings, mulch, irrigation",
        quantity: 1,
        unitCost: 10_500,
        adjustedCost: 11_445,
        rationale: "Land improvement — 15-year class under Rev. Proc. 87-56.",
      },
      {
        category: "15-year",
        name: "Driveway pavers & walkway",
        quantity: 1,
        unitCost: 8_200,
        adjustedCost: 8_938,
        rationale: "Land improvement — 15-year class, straight-line 150% DB.",
      },
      {
        category: "15-year",
        name: "Exterior lighting, path lights",
        quantity: 14,
        unitCost: 185,
        adjustedCost: 2_822,
        rationale: "Land improvement — accessory to landscaping. 15-year.",
      },
      {
        category: "15-year",
        name: "Wood fencing — perimeter",
        quantity: 1,
        unitCost: 4_600,
        adjustedCost: 5_014,
        rationale: "Land improvement — 15-year straight-line 150%.",
      },
      {
        category: "39-year",
        name: "Building shell, roof, framing, HVAC",
        quantity: 1,
        unitCost: 215_651,
        adjustedCost: 215_651,
        rationale:
          "Residual Section 1250 real property — 27.5/39-year straight-line, mid-month convention.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 89_700, fifteenYr: 57_500, thirtyNineYr: 0, total: 147_200 },
      { year: 2024, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 3_038, total: 3_038 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 5_524, total: 5_524 },
    ],
  },
  "magnolia-duplex": {
    id: "magnolia-duplex",
    address: "412 Magnolia Ave, Austin, TX 78704",
    ownerLabel: "Magnolia Holdings, LLC",
    propertyType: "Small multifamily · duplex",
    yearBuilt: 1998,
    squareFeet: 3620,
    acquisitionDate: "2024-02-03",
    acquisitionPrice: 892_500,
    landValue: 206_000,
    depreciableBasis: 686_500,
    accelerated: {
      value: 238_600,
      pct: 34.8,
      fiveYear: 142_100,
      sevenYear: 0,
      fifteenYear: 96_500,
    },
    year1Deduction: 238_600,
    bonusRate: 100,
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 4",
    assets: [
      {
        category: "5-year",
        name: "Full kitchen replacement — 2 units",
        quantity: 2,
        unitCost: 14_200,
        adjustedCost: 30_992,
        rationale:
          "Complete removable kitchen packages (cabinets, counters, appliances). §1245. 5-year.",
      },
      {
        category: "5-year",
        name: "HVAC ductwork — tenant-specific zoning",
        quantity: 2,
        unitCost: 4_800,
        adjustedCost: 10_464,
        rationale:
          "Secondary HVAC zoning systems serving specific tenants. HCA sole-justification test passes. 5-year.",
      },
      {
        category: "5-year",
        name: "Carpet & padding — bedrooms",
        quantity: 4,
        unitCost: 2_100,
        adjustedCost: 9_156,
        rationale: "Carpet is removable and decorative. 5-year under §1245.",
      },
      {
        category: "15-year",
        name: "Parking lot resurfacing",
        quantity: 1,
        unitCost: 22_000,
        adjustedCost: 23_980,
        rationale: "Land improvement — 15-year 150% DB.",
      },
      {
        category: "15-year",
        name: "Site utilities — water, sewer taps",
        quantity: 1,
        unitCost: 14_500,
        adjustedCost: 15_805,
        rationale: "Land improvement — 15-year.",
      },
      {
        category: "39-year",
        name: "Building structure, core plumbing, electrical",
        quantity: 1,
        unitCost: 448_000,
        adjustedCost: 448_000,
        rationale: "Residual §1250 — 27.5-year residential rental, straight-line mid-month.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 142_100, fifteenYr: 96_500, thirtyNineYr: 0, total: 238_600 },
      { year: 2024, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 15_108, total: 15_108 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 16_290, total: 16_290 },
    ],
  },
  "riverside-commercial": {
    id: "riverside-commercial",
    address: "88 Riverside Blvd, Boise, ID 83702",
    ownerLabel: "Riverside Mixed-Use LP",
    propertyType: "Mixed-use commercial · ground-floor retail + 6 apartments",
    yearBuilt: 2011,
    squareFeet: 9100,
    acquisitionDate: "2025-03-12",
    acquisitionPrice: 1_420_000,
    landValue: 298_000,
    depreciableBasis: 1_122_000,
    accelerated: {
      value: 391_800,
      pct: 34.9,
      fiveYear: 217_200,
      sevenYear: 42_600,
      fifteenYear: 132_000,
    },
    year1Deduction: 391_800,
    bonusRate: 100,
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 6",
    assets: [
      {
        category: "5-year",
        name: "Retail tenant improvements — storefront fixtures",
        quantity: 1,
        unitCost: 38_000,
        adjustedCost: 41_420,
        rationale: "Tenant-specific removable fixtures. §1245. 5-year.",
      },
      {
        category: "7-year",
        name: "Office furniture & fixtures — shared leasing",
        quantity: 1,
        unitCost: 12_500,
        adjustedCost: 13_625,
        rationale: "Class 00.11 office furniture. 7-year.",
      },
      {
        category: "15-year",
        name: "Parking lot & signage",
        quantity: 1,
        unitCost: 42_000,
        adjustedCost: 45_780,
        rationale: "Land improvement — 15-year 150% DB.",
      },
      {
        category: "39-year",
        name: "Commercial building shell + core MEP",
        quantity: 1,
        unitCost: 730_200,
        adjustedCost: 730_200,
        rationale: "Residual §1250 — 39-year nonresidential straight-line.",
      },
    ],
    macrs: [
      { year: "Bonus", fiveYr: 217_200, fifteenYr: 132_000, thirtyNineYr: 0, total: 349_200 },
      { year: 2025, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 14_850, total: 14_850 },
      { year: 2026, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2027, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2028, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
      { year: 2029, fiveYr: 0, fifteenYr: 0, thirtyNineYr: 18_723, total: 18_723 },
    ],
  },
};

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
                  <Link href="/samples#download">Email me the PDF</Link>
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
                  tone="accent"
                  size="xl"
                  animate
                />
                <Kpi label="Depreciable basis" value={fmtUsd(sample.depreciableBasis)} size="lg" />
                <Kpi
                  label={`Accelerated @ ${sample.accelerated.pct.toFixed(1)}%`}
                  value={fmtUsd(sample.accelerated.value)}
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
                <DlRow label="Bonus depreciation" value={`${sample.bonusRate}%`} />
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

function DlRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
        {label}
      </dt>
      <dd data-tabular className="mt-1 text-lg font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}
