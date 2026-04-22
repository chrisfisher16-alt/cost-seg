import { CheckIcon, Loader2Icon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Kpi } from "@/components/shared/Kpi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const PIPELINE_STEPS = [
  { label: "Parsing closing disclosure", status: "done" as const, note: "3 fields extracted" },
  {
    label: "Decomposing basis (land vs. building)",
    status: "done" as const,
    note: "Assessor ratio: 29.1%",
  },
  {
    label: "Classifying 47 assets into MACRS classes",
    status: "active" as const,
    note: "38 of 47 complete",
  },
  { label: "Drafting methodology narrative", status: "pending" as const },
  { label: "Rendering PDF report", status: "pending" as const },
];

export function PlatformPreview() {
  return (
    <Section tone="muted">
      <Container size="xl">
        <SectionHeader
          eyebrow="The Pipeline, live"
          title="Every step in view. Nothing behind a loading spinner."
          description="See the parsing, the land-value split, and the per-asset classification as they happen. Every decision is logged with an IRS citation, so there are no black-box numbers to defend later."
        />

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <MockPipelinePanel />
          <div className="space-y-6">
            <Kpi
              label="What you see when your report completes"
              value="$184,300"
              hint="reclassified into 5-, 7-, 15-year property. Year-one deduction at 37% marginal."
              size="xl"
              tone="accent"
            />
            <ul className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <li className="flex gap-3">
                <CheckIcon className="text-primary mt-[3px] h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong className="text-foreground">Real-time progress.</strong> A streaming step
                  list with ETA, so you always know what&rsquo;s happening.
                </span>
              </li>
              <li className="flex gap-3">
                <CheckIcon className="text-primary mt-[3px] h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong className="text-foreground">Per-asset rationale.</strong> Every line in
                  your report shows the comparable, the adjustments, and the IRS citation behind the
                  classification. Appendix B ships with every study.
                </span>
              </li>
              <li className="flex gap-3">
                <CheckIcon className="text-primary mt-[3px] h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong className="text-foreground">Share with your CPA.</strong> One click to
                  send a read-only view. They see the same schedule and methodology you do, no
                  account required on their end.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function MockPipelinePanel() {
  return (
    <Card className="bg-card ring-border/60 overflow-hidden shadow-xl ring-1">
      <div className="border-border bg-muted/40 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-destructive/70 h-2.5 w-2.5 rounded-full" />
          <span className="bg-warning/70 h-2.5 w-2.5 rounded-full" />
          <span className="bg-success/70 h-2.5 w-2.5 rounded-full" />
          <p className="text-muted-foreground ml-3 font-mono text-xs tracking-wide">
            segra.tax/studies/207-s-edison/processing
          </p>
        </div>
      </div>
      <CardContent className="p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
              Live pipeline
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              207 S Edison St, Fredericksburg, TX
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Started 2:14pm · ETA 2 minutes remaining
            </p>
          </div>
          <Badge variant="info" dot>
            Processing
          </Badge>
        </div>

        <ol className="mt-6 space-y-3.5">
          {PIPELINE_STEPS.map((step) => (
            <li key={step.label} className="flex items-start gap-3">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={
                    step.status === "pending"
                      ? "text-muted-foreground text-sm"
                      : "text-foreground text-sm font-medium"
                  }
                >
                  {step.label}
                </p>
                {step.note ? <p className="text-muted-foreground text-xs">{step.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="bg-muted mt-6 h-1.5 w-full overflow-hidden rounded-full">
          <div className="bg-primary h-full w-2/3 rounded-full transition-[width]" />
        </div>
      </CardContent>
    </Card>
  );
}

function StepIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done")
    return (
      <span className="bg-primary text-primary-foreground mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  if (status === "active")
    return (
      <span className="bg-primary/15 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
        <Loader2Icon className="h-3 w-3 animate-spin" />
      </span>
    );
  return (
    <span className="bg-muted text-muted-foreground mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
    </span>
  );
}
