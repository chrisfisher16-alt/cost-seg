import Link from "next/link";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SampleReportPreview() {
  return (
    <Section>
      <Container size="xl">
        <SectionHeader
          eyebrow="What you actually get"
          title="A 214-page-class report. Every number traceable."
          description="Cover page with your property, executive summary, full MACRS schedule, per-asset rationale with photos, methodology appendix, source documentation. Built to hold up next to anything a $700 engineer produces."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <Card className="border-border/80 bg-card relative overflow-hidden p-0 shadow-xl">
            <MockCoverPage />
          </Card>
          <div className="space-y-5">
            <ul className="space-y-3 text-sm leading-relaxed">
              <SampleBullet>
                Cover page with property hero photo and prepared-for block
              </SampleBullet>
              <SampleBullet>
                Executive summary with the five headline numbers upfront — cost basis, land value,
                depreciable basis, accelerated property $, and class breakdown
              </SampleBullet>
              <SampleBullet>
                Full 40-row MACRS schedule with half-year / mid-month conventions explained
              </SampleBullet>
              <SampleBullet>
                Per-asset pages: photo, classification, Section 1245 / 1250 rationale, physical +
                functional obsolescence multipliers, time + location adjustments, fully-adjusted
                cost
              </SampleBullet>
              <SampleBullet>
                Appendix with methodology deep-dive (Whiteco factors, HCA tests, Rev. Proc. 87-56)
              </SampleBullet>
              <SampleBullet>
                Appendix with source docs: ALTA settlement statement, aerial, improvements ledger
              </SampleBullet>
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
                <Link href="/samples">Browse sample reports</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/samples#download">Download a PDF sample</Link>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Samples use a fictional property and fictional buyer. Numbers are realistic but
              synthetic.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function SampleBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-primary mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full" />
      <span>{children}</span>
    </li>
  );
}

function MockCoverPage() {
  return (
    <div className="from-background to-muted/40 aspect-[8.5/11] w-full bg-gradient-to-br p-8 sm:p-10">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden>
            <defs>
              <linearGradient id="sample-brand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="oklch(0.508 0.118 165)" />
                <stop offset="100%" stopColor="oklch(0.6 0.14 235)" />
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="26" height="26" rx="7" fill="url(#sample-brand)" />
            <g fill="white" fillOpacity="0.95">
              <rect x="8" y="20" width="16" height="3" rx="1" />
              <rect x="10" y="15" width="12" height="3" rx="1" fillOpacity="0.75" />
              <rect x="12" y="10" width="8" height="3" rx="1" fillOpacity="0.5" />
            </g>
          </svg>
          <span className="font-semibold tracking-tight">Cost Seg</span>
        </div>

        <div className="from-primary/15 via-info/10 to-accent/20 ring-border mt-6 aspect-[4/3] w-full overflow-hidden rounded-md bg-gradient-to-br ring-1">
          <div className="flex h-full items-center justify-center">
            <FileTextIcon className="text-primary/40 h-14 w-14" />
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-2xl font-semibold tracking-tight">Cost Segregation Study</h4>
          <p className="text-muted-foreground mt-2 text-sm">
            123 Oak Ridge Drive, Nashville, TN 37215
          </p>
          <p className="text-muted-foreground text-sm">
            Prepared for Sample LLC on {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="border-border/60 mt-auto grid grid-cols-2 gap-4 border-t pt-5 text-[11px]">
          <div>
            <p className="text-muted-foreground font-mono tracking-[0.18em] uppercase">
              Prepared by
            </p>
            <p className="mt-1 font-medium">Cost Seg · AI Modeling</p>
            <p className="text-muted-foreground">support@costseg.app</p>
          </div>
          <div>
            <p className="text-muted-foreground font-mono tracking-[0.18em] uppercase">Tax year</p>
            <p className="mt-1 font-medium">2025</p>
            <p className="text-muted-foreground">Report {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
