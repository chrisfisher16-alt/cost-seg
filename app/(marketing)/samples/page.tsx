import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, HomeIcon } from "lucide-react";

import { FinalCta } from "@/components/marketing/FinalCta";
import { SampleDownloadForm } from "@/components/marketing/SampleDownloadForm";
import { Container } from "@/components/shared/Container";
import { Kpi } from "@/components/shared/Kpi";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SAMPLES, SAMPLE_IDS, type Sample } from "@/lib/samples/catalog";

export const metadata: Metadata = {
  title: "Sample reports",
  description:
    "Real AI-generated cost segregation reports — anonymized, clickable, and fully representative of what you get.",
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Gradient background per sample. Keyed on sample.id so a future catalog
 * entry without an explicit gradient falls back to the brand default.
 */
const GRADIENTS: Record<string, string> = {
  "oak-ridge": "from-primary/15 via-info/10 to-accent/20",
  "magnolia-duplex": "from-info/15 via-primary/10 to-primary/15",
  "riverside-commercial": "from-accent/30 via-primary/10 to-info/10",
};

export default function SamplesPage() {
  const samples = SAMPLE_IDS.map((id) => SAMPLES[id]);

  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-6 sm:pt-28">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="md" className="text-center">
          <Badge
            variant="outline"
            size="default"
            className="border-primary/30 bg-primary/5 text-primary mx-auto"
          >
            Sample reports · fictional data
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Exactly what you&rsquo;ll get.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Three anonymized reports spanning a single-family STR, a small multifamily, and a
            mixed-use commercial property. Open any of them — every number is traceable to a source
            document and a rationale.
          </p>
          <div className="border-warning/40 bg-warning/5 text-warning-foreground mx-auto mt-8 max-w-xl rounded-md border px-4 py-3 text-xs leading-relaxed">
            <strong>Fictional properties and owners.</strong> Addresses, LLC names, and buyers are
            made up. The dollar amounts, MACRS math, and classification rationales are all real —
            drawn from the same pipeline that generates customer reports.
          </div>
        </Container>
      </section>

      <Section>
        <Container size="xl">
          {/* role="list" makes the three cards announce as a group to screen
              readers even though we're using divs — the semantic intent is
              "a list of sample reports," and our card grid expresses that
              without a bullet list's visual baggage. */}
          <div role="list" className="grid gap-8 md:grid-cols-3">
            {samples.map((sample) => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="muted" id="download">
        <Container size="md" className="text-center">
          <SectionHeader
            eyebrow="Download"
            title="Want the full PDF?"
            description="Drop your email and we’ll send you our latest anonymized AI Report template within one business day."
          />
          <div className="mt-8">
            <SampleDownloadForm />
          </div>
        </Container>
      </Section>

      <Section>
        <Container size="md">
          <Card className="border-primary/20 bg-card ring-primary/10 shadow-lg ring-1">
            <CardContent className="p-8 sm:p-10">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Ready to run yours?</h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Three inputs for a free estimate. Pay only if you start a real study.
                  </p>
                </div>
                <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
                  <Link href="/#estimator">Run the free estimator</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}

function SampleCard({ sample }: { sample: Sample }) {
  const gradient = GRADIENTS[sample.id] ?? "from-primary/15 via-info/10 to-accent/20";
  const taxSavings = Math.round(sample.year1Deduction * 0.37);
  // Stable id so the <article> can be aria-labelledby the heading — screen
  // readers then announce each card as e.g. "article, 1842 Oak Ridge Lane".
  const headingId = `sample-${sample.id}-title`;
  const pdfHref = `/api/samples/${sample.id}/pdf`;
  const viewHref = `/samples/${sample.id}` as Route;

  return (
    <Card className="group focus-within:ring-ring relative flex flex-col overflow-hidden transition focus-within:ring-2 focus-within:ring-offset-2 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Semantic article — each card is a self-contained unit with its
          address heading as the accessible name. */}
      <article aria-labelledby={headingId} role="listitem" className="flex flex-1 flex-col">
        <div
          className={`relative aspect-[4/3] bg-gradient-to-br ${gradient}`}
          role="img"
          aria-label={`${sample.propertyType} illustration`}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-60 transition-opacity group-hover:opacity-100">
            <HomeIcon className="text-foreground/30 h-16 w-16" aria-hidden />
          </div>
          <div className="absolute top-5 left-5">
            <Badge variant={sample.tier === "Engineer-Reviewed" ? "success" : "default"} size="sm">
              {sample.tier}
            </Badge>
          </div>
          <div className="absolute right-5 bottom-5 left-5 flex justify-between text-xs">
            <span className="bg-background/80 text-foreground/80 rounded-full px-2.5 py-0.5 font-mono tracking-wide backdrop-blur">
              {sample.squareFeet.toLocaleString()} sqft
            </span>
            <span className="bg-background/80 text-foreground/80 rounded-full px-2.5 py-0.5 font-mono tracking-wide backdrop-blur">
              Built {sample.yearBuilt}
            </span>
          </div>
        </div>
        <CardContent className="flex flex-1 flex-col gap-5 p-6">
          <div>
            <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
              {sample.propertyType}
            </p>
            {/* The heading IS the primary link. Screen reader users can
                navigate between cards by heading (H key in many tools) and
                land on the clickable target directly. The ::after overlay
                extends the hit area to the entire card without nesting
                anchors, so the PDF button below still gets clicks. */}
            <h3 id={headingId} className="mt-1.5 text-base leading-tight font-semibold">
              <Link
                href={viewHref}
                className="hover:text-primary after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none"
              >
                {sample.address}
              </Link>
            </h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Basis{" "}
              <span data-tabular className="text-foreground font-medium">
                {fmtUsd(sample.acquisitionPrice)}
              </span>{" "}
              · {sample.turnaround}
            </p>
          </div>

          <Separator />

          <Kpi
            label="Year-1 deduction"
            value={fmtUsd(sample.year1Deduction)}
            hint={`≈ ${fmtUsd(taxSavings)} tax savings at 37% bracket`}
            size="lg"
            tone="primary"
          />

          <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-md p-3 text-center">
            <MiniStat label="5-year" value={fmtUsd(sample.accelerated.fiveYear)} />
            <MiniStat label="15-year" value={fmtUsd(sample.accelerated.fifteenYear)} />
            <MiniStat label="Accelerated" value={`${sample.accelerated.pct.toFixed(1)}%`} accent />
          </div>

          <div className="mt-auto">
            {/* relative + z-10 keeps the PDF download clickable above the
                ::after overlay coming from the heading link. */}
            <Button
              asChild
              variant="secondary"
              className="relative z-10 w-full"
              leadingIcon={<DownloadIcon />}
            >
              <a
                href={pdfHref}
                target="_blank"
                rel="noopener noreferrer"
                download
                aria-label={`Download PDF for ${sample.address}`}
              >
                Download PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </article>
    </Card>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground font-mono text-[9px] tracking-[0.15em] uppercase">
        {label}
      </p>
      <p
        data-tabular
        className={`mt-0.5 text-xs font-semibold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
