import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, FileTextIcon, HomeIcon } from "lucide-react";

import { FinalCta } from "@/components/marketing/FinalCta";
import { SampleDownloadForm } from "@/components/marketing/SampleDownloadForm";
import { Container } from "@/components/shared/Container";
import { Kpi } from "@/components/shared/Kpi";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Sample reports",
  description:
    "Real AI-generated cost segregation reports — anonymized, clickable, and fully representative of what you get.",
};

type Sample = {
  id: string;
  propertyLabel: string;
  propertyType: string;
  basis: string;
  tier: "AI Report" | "Engineer-Reviewed";
  turnaround: string;
  headlineKpi: { label: string; value: string; hint: string };
  accent: string;
  gradient: string;
};

const SAMPLES: Sample[] = [
  {
    id: "oak-ridge",
    propertyLabel: "123 Oak Ridge Dr · Nashville, TN",
    propertyType: "Short-term rental (single-family)",
    basis: "$476,703",
    tier: "AI Report",
    turnaround: "Delivered in 11 minutes",
    headlineKpi: {
      label: "Year-1 deduction",
      value: "$147,200",
      hint: "at 37% marginal bracket",
    },
    accent: "text-primary",
    gradient: "from-primary/15 via-info/10 to-accent/20",
  },
  {
    id: "magnolia-duplex",
    propertyLabel: "412 Magnolia Ave · Austin, TX",
    propertyType: "Small multifamily (duplex)",
    basis: "$892,500",
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 4",
    headlineKpi: {
      label: "Year-1 deduction",
      value: "$238,600",
      hint: "PE-reviewed, ATG checklist complete",
    },
    accent: "text-info",
    gradient: "from-info/15 via-primary/10 to-primary/15",
  },
  {
    id: "riverside-commercial",
    propertyLabel: "88 Riverside Blvd · Boise, ID",
    propertyType: "Commercial (mixed-use retail)",
    basis: "$1,420,000",
    tier: "Engineer-Reviewed",
    turnaround: "Engineer-signed, day 6",
    headlineKpi: {
      label: "Year-1 deduction",
      value: "$391,800",
      hint: "bonus depreciation applied under OBBBA",
    },
    accent: "text-accent-foreground",
    gradient: "from-accent/30 via-primary/10 to-info/10",
  },
];

export default function SamplesPage() {
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
            Sample reports
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Exactly what you&rsquo;ll get.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Three anonymized reports spanning a single-family STR, a small multifamily, and a
            mixed-use commercial property. Open any of them — every number is traceable.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">
            Fictional properties and buyers. Numbers are realistic but synthetic.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="xl">
          <div className="grid gap-8 md:grid-cols-3">
            {SAMPLES.map((sample) => (
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
            description="Drop your email and we&rsquo;ll send you our latest anonymized AI Report template within one business day."
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
  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`aspect-[4/3] bg-gradient-to-br ${sample.gradient} relative`}>
        <div className="absolute inset-0 flex items-center justify-center opacity-60 transition-opacity group-hover:opacity-100">
          <HomeIcon className="text-foreground/30 h-16 w-16" />
        </div>
        <div className="absolute top-5 left-5">
          <Badge variant={sample.tier === "Engineer-Reviewed" ? "success" : "default"} size="sm">
            {sample.tier}
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
            {sample.propertyType}
          </p>
          <h3 className="mt-1.5 text-base leading-tight font-semibold">{sample.propertyLabel}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Basis{" "}
            <span data-tabular className="text-foreground font-medium">
              {sample.basis}
            </span>{" "}
            · {sample.turnaround}
          </p>
        </div>
        <Separator />
        <Kpi
          label={sample.headlineKpi.label}
          value={sample.headlineKpi.value}
          hint={sample.headlineKpi.hint}
          size="lg"
          tone="primary"
        />
        <Button asChild variant="outline" className="w-full" leadingIcon={<FileTextIcon />}>
          <Link href={`/samples/${sample.id}` as never}>View sample</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
