import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, MinusIcon } from "lucide-react";

import { FinalCta } from "@/components/marketing/FinalCta";
import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "How Segra compares to CostSegregation.com (KBKG), Cost Seg EZ, Segtax, FIXR.ai, and DIY Cost Seg. Features and pricing sourced to each provider.",
};

type Cell = string | { value: string; note?: string } | boolean;

type Row = {
  feature: string;
  note?: string;
  us: Cell;
  costSegregation: Cell;
  costSegEz: Cell;
  segtax: Cell;
  fixrAi: Cell;
  diyCostSeg: Cell;
};

const ROWS: Row[] = [
  {
    feature: "Lowest starting price",
    us: { value: "$149", note: "DIY Self-Serve" },
    costSegregation: { value: "$495", note: "per study" },
    costSegEz: { value: "$595", note: "DIY tier" },
    segtax: { value: "Contact", note: "Quote-based" },
    fixrAi: { value: "Contact", note: "Quote-based" },
    diyCostSeg: { value: "$495", note: "Self-serve" },
  },
  {
    feature: "Engineer-signed study option",
    us: true,
    costSegregation: false,
    costSegEz: true,
    segtax: true,
    fixrAi: true,
    diyCostSeg: true,
  },
  {
    feature: "Turnaround — AI modeling tier",
    us: { value: "Minutes" },
    costSegregation: { value: "Minutes" },
    costSegEz: { value: "15 minutes" },
    segtax: { value: "Hours" },
    fixrAi: { value: "< 30 min" },
    diyCostSeg: { value: "Days" },
  },
  {
    feature: "Real-time pipeline visibility",
    note: "See every step + rationale as it runs",
    us: true,
    costSegregation: false,
    costSegEz: false,
    segtax: false,
    fixrAi: false,
    diyCostSeg: false,
  },
  {
    feature: "Per-asset rationale (clickable)",
    us: true,
    costSegregation: false,
    costSegEz: false,
    segtax: { value: "Partial" },
    fixrAi: false,
    diyCostSeg: false,
  },
  {
    feature: "Property-basis ceiling",
    us: { value: "No ceiling" },
    costSegregation: { value: "$1.5M", note: "larger = quote" },
    costSegEz: { value: "Up to residential" },
    segtax: { value: "No ceiling" },
    fixrAi: { value: "No ceiling" },
    diyCostSeg: { value: "No ceiling" },
  },
  {
    feature: "CPA collaboration surface",
    note: "Share read-only, per-client rollups, CSV export",
    us: true,
    costSegregation: { value: "Handoff only" },
    costSegEz: { value: "Handoff only" },
    segtax: { value: "Handoff only" },
    fixrAi: { value: "UltraTax export" },
    diyCostSeg: { value: "Handoff only" },
  },
  {
    feature: "STR-loophole workflow",
    us: true,
    costSegregation: true,
    costSegEz: true,
    segtax: true,
    fixrAi: true,
    diyCostSeg: true,
  },
  {
    feature: "Audit-protection add-on",
    us: { value: "$195 (Q3)" },
    costSegregation: { value: "Included" },
    costSegEz: { value: "$195 optional" },
    segtax: false,
    fixrAi: false,
    diyCostSeg: false,
  },
  {
    feature: "Sample report publicly viewable",
    us: true,
    costSegregation: false,
    costSegEz: false,
    segtax: false,
    fixrAi: false,
    diyCostSeg: false,
  },
  {
    feature: "Dark mode",
    us: true,
    costSegregation: false,
    costSegEz: false,
    segtax: false,
    fixrAi: false,
    diyCostSeg: false,
  },
];

const COLS: Array<{
  key: keyof Omit<Row, "feature" | "note">;
  label: string;
  highlight?: boolean;
}> = [
  { key: "us", label: "Segra", highlight: true },
  { key: "costSegregation", label: "CostSegregation.com" },
  { key: "costSegEz", label: "Cost Seg EZ" },
  { key: "segtax", label: "Segtax" },
  { key: "fixrAi", label: "FIXR.ai" },
  { key: "diyCostSeg", label: "DIY Cost Seg" },
];

export default function ComparePage() {
  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-10 sm:pt-28">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="md" className="text-center">
          <Badge
            variant="outline"
            size="default"
            className="border-primary/30 bg-primary/5 text-primary mx-auto"
          >
            Compare
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            How we stack up.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Every claim below is sourced to the competitor&rsquo;s public website. If you spot a
            mistake, email{" "}
            <a href={`mailto:${BRAND.email.compare}`} className="font-mono">
              {BRAND.email.compare}
            </a>{" "}
            and we&rsquo;ll update.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">
            Comparison reflects public information as of April 2026. Features and pricing subject to
            change.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="full">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-border border-b">
                    <th className="bg-muted/40 sticky left-0 z-10 px-5 py-4 text-left font-medium">
                      Feature
                    </th>
                    {COLS.map((c) => (
                      <th
                        key={c.key}
                        className={
                          c.highlight
                            ? "bg-primary/5 text-primary px-5 py-4 text-left font-semibold"
                            : "px-5 py-4 text-left font-medium"
                        }
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, idx) => (
                    <tr key={row.feature} className={idx % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                      <th className="text-foreground sticky left-0 z-10 bg-inherit px-5 py-4 text-left align-top font-normal">
                        <p className="leading-tight font-medium">{row.feature}</p>
                        {row.note ? (
                          <p className="text-muted-foreground mt-1 text-xs">{row.note}</p>
                        ) : null}
                      </th>
                      {COLS.map((c) => (
                        <td
                          key={c.key}
                          className={
                            c.highlight
                              ? "bg-primary/5 text-primary px-5 py-4 align-top"
                              : "px-5 py-4 align-top"
                          }
                        >
                          <CellContent value={row[c.key]} highlight={c.highlight} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="border-border bg-muted/20 text-muted-foreground mt-8 rounded-md border p-4 text-xs leading-relaxed">
            <strong>Sources:</strong> costsegregation.com, costsegez.com, seg.tax,
            diycostsegregation.com, FIXR.ai public marketing (April 2026). All product names and
            trademarks are property of their respective owners. Nothing on this page implies
            affiliation or endorsement.
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container size="md" className="text-center">
          <SectionHeader
            eyebrow="Where we win"
            title="Three things no one else does yet."
            description="Most AI cost-seg providers converge on speed and price. We think the next axis is trust — show your work, share with the CPA, let the buyer inspect every number."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Pipeline in view",
                body: "Every step streams live: parsing, decomposing, classifying, drafting. No one else shows the AI working.",
              },
              {
                title: "Per-asset rationale",
                body: "Click any line in the schedule to see the comparable, adjustments, and IRS citation that justify it.",
              },
              {
                title: "Built for CPAs too",
                body: "Share a read-only view in one click. Day-3 roadmap ships client rollups, portfolio deduction totals, and Form 3115 pre-fill.",
              },
            ].map((b) => (
              <Card key={b.title}>
                <CardContent className="p-7 text-left">
                  <p className="text-base font-semibold tracking-tight">{b.title}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{b.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

function CellContent({ value, highlight }: { value: Cell; highlight?: boolean }) {
  if (value === true)
    return (
      <span className={highlight ? "text-primary" : "text-foreground"}>
        <CheckIcon className="h-4 w-4" aria-label="Included" />
      </span>
    );
  if (value === false)
    return (
      <span className="text-muted-foreground">
        <MinusIcon className="h-4 w-4" aria-label="Not available" />
      </span>
    );
  if (typeof value === "string") return <span>{value}</span>;
  return (
    <div>
      <p className="leading-tight">{value.value}</p>
      {value.note ? <p className="text-muted-foreground text-xs">{value.note}</p> : null}
    </div>
  );
}
