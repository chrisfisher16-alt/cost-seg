"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  HelpCircleIcon,
  Loader2Icon,
  MailIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { getDeliverableUrlAction } from "@/app/(app)/dashboard/actions";
import {
  pollProcessingStateAction,
  type PipelineStep,
  type ProcessingStateResult,
} from "@/app/(app)/studies/[id]/processing/actions";
import { CelebrationTrigger } from "@/components/shared/Celebration";
import { ShareStudyDialog } from "@/components/app/ShareStudyDialog";
import { Kpi } from "@/components/shared/Kpi";
import { useCountUp } from "@/components/shared/useCountUp";
import { classifyFailure } from "@/lib/studies/failure-reason";
import { estimatePipelineEta, type EtaStep, type EtaStepId } from "@/lib/studies/pipeline-eta";
import { statusLabel } from "@/lib/studies/status-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Props {
  studyId: string;
  initial: ProcessingStateResult;
  propertyLabel: string;
  tierLabel: string;
}

const POLL_MS = 3500;
const TERMINAL = new Set(["DELIVERED", "FAILED"]);

export function PipelineLive({ studyId, initial, propertyLabel, tierLabel }: Props) {
  const [state, setState] = React.useState<ProcessingStateResult>(initial);
  const startedAtRef = React.useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  // Record start-time after mount (not during render) so it's pure + SSR-safe.
  React.useEffect(() => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    const tick = () => {
      if (startedAtRef.current !== null) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (TERMINAL.has(state.status)) return;
    let cancelled = false;

    const tick = async () => {
      const res = await pollProcessingStateAction(studyId);
      if (cancelled) return;
      if (res.ok) {
        setState(res);
        if (!TERMINAL.has(res.status)) {
          timer = window.setTimeout(tick, POLL_MS);
        }
      } else {
        timer = window.setTimeout(tick, POLL_MS * 2);
      }
    };
    let timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [studyId, state.status]);

  const progress = React.useMemo(() => {
    const done = state.steps.filter((s) => s.state === "done").length;
    return Math.round((done / state.steps.length) * 100);
  }, [state.steps]);

  return (
    <div className="space-y-8">
      <CelebrationTrigger active={state.isDelivered} />

      {state.isDelivered ? (
        <DeliveredPanel state={state} studyId={studyId} propertyLabel={propertyLabel} />
      ) : state.isFailed ? (
        <FailedPanel state={state} studyId={studyId} />
      ) : isQueued(state) ? (
        <QueuedPanel
          state={state}
          elapsedSec={elapsedSec}
          propertyLabel={propertyLabel}
          tierLabel={tierLabel}
        />
      ) : (
        <ProcessingPanel
          state={state}
          progress={progress}
          elapsedSec={elapsedSec}
          propertyLabel={propertyLabel}
          tierLabel={tierLabel}
        />
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Pipeline</h3>
            {!TERMINAL.has(state.status) ? (
              <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                {progress}% complete
              </span>
            ) : null}
          </div>
          <div className="mt-4">
            <Progress value={progress} />
          </div>
          <Separator className="my-6" />
          <ol className="space-y-4">
            {state.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        </CardContent>
      </Card>

      {!TERMINAL.has(state.status) ? (
        <Card className="bg-muted/30">
          <CardContent className="flex items-start gap-3 p-5">
            <HelpCircleIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">You don&rsquo;t have to wait.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                You can close this tab. We&rsquo;ll email you the moment your report is ready. If
                you stay, progress updates live every few seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * True when the pipeline hasn't actually started yet. Two scenarios:
 *   1. Study is AWAITING_DOCUMENTS — ready-check hasn't fired
 *      study.documents.ready yet (docs might still be uploading, or the
 *      emit failed and will retry on the next finalize).
 *   2. Study is PROCESSING but no pipeline.started event has been written —
 *      Inngest emitted but the worker hasn't picked up (common in dev
 *      when inngest-dev is restarting).
 *
 * In both cases showing "Parsing your documents" as active is a lie —
 * the QueuedPanel honestly says "waiting for the worker."
 */
function isQueued(state: ProcessingStateResult): boolean {
  if (state.status === "AWAITING_DOCUMENTS") return true;
  if (state.status === "PROCESSING") {
    const hasPipelineActivity = state.events.some(
      (e) =>
        e.kind === "pipeline.started" ||
        e.kind === "documents.classified" ||
        e.kind === "decomposition.complete" ||
        e.kind === "assets.classified",
    );
    if (!hasPipelineActivity) return true;
  }
  return false;
}

function QueuedPanel({
  state,
  elapsedSec,
  propertyLabel,
  tierLabel,
}: {
  state: ProcessingStateResult;
  elapsedSec: number;
  propertyLabel: string;
  tierLabel: string;
}) {
  // Staleness thresholds in seconds. The 60s mark flips copy to "this is
  // taking longer than usual"; 180s escalates to "something's probably
  // wrong — email support." These are soft signals — the work may still
  // complete successfully, we're just managing expectations.
  const overdue = elapsedSec > 60;
  const stuck = elapsedSec > 180;

  return (
    <Card className="border-primary/30 bg-card relative overflow-hidden">
      <div className="brand-gradient-bg absolute inset-0 -z-10 opacity-40" aria-hidden />
      <CardContent className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="muted" size="sm" dot>
              Queued
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Waiting to start your {tierLabel}.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{propertyLabel}</p>
          </div>
          <div className="bg-muted text-muted-foreground mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:inline-flex">
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
          </div>
        </div>

        <div className="border-border bg-card/70 mt-8 rounded-md border p-4 text-sm shadow-sm">
          {stuck ? (
            <>
              <p className="text-foreground font-medium">Queue is running long.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                It&rsquo;s been more than three minutes and the worker still hasn&rsquo;t picked up
                the job. Email{" "}
                <a
                  href="mailto:support@segra.tax?subject=Segra%20pipeline%20never%20started"
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  support@segra.tax
                </a>{" "}
                and we&rsquo;ll kick it off manually — no charge until delivery.
              </p>
            </>
          ) : overdue ? (
            <>
              <p className="text-foreground font-medium">Taking a bit longer than usual.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Pipelines usually start within ten seconds. Sometimes the queue bunches up. Give it
                another minute — if nothing happens we&rsquo;ll chase it automatically.
              </p>
            </>
          ) : state.status === "AWAITING_DOCUMENTS" ? (
            <>
              <p className="text-foreground font-medium">We have your documents.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                The worker is about to pick up your study — usually within ten seconds. You can
                close this tab; we&rsquo;ll email you the moment the pipeline completes.
              </p>
            </>
          ) : (
            <>
              <p className="text-foreground font-medium">Queued for the worker.</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Inngest dequeues pipelines within a few seconds. The first live step will appear
                below as soon as it starts.
              </p>
            </>
          )}
        </div>

        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <DlItem label="Tier" value={tierLabel} />
          <DlItem label="Elapsed" value={formatElapsed(elapsedSec)} mono />
          <DlItem label="State" value="Waiting for worker" />
        </dl>
      </CardContent>
    </Card>
  );
}

function ProcessingPanel({
  state,
  progress,
  elapsedSec,
  propertyLabel,
  tierLabel,
}: {
  state: ProcessingStateResult;
  progress: number;
  elapsedSec: number;
  propertyLabel: string;
  tierLabel: string;
}) {
  const activeStep = state.steps.find((s) => s.state === "active");

  // Per-step ETA. Pure helper keyed on which step is active — more accurate
  // than a fixed 150s budget, especially near the end when render + deliver
  // are the only thing left (tiny) vs. early when `assets` still has to run
  // (long).
  const etaSteps: EtaStep[] = state.steps.map((s) => ({
    id: s.id as EtaStepId,
    state: s.state,
  }));
  const eta = estimatePipelineEta(etaSteps, elapsedSec);
  const etaLabel = eta.label;

  return (
    <Card className="border-primary/30 bg-card relative overflow-hidden">
      <div className="brand-gradient-bg absolute inset-0 -z-10 opacity-60" aria-hidden />
      <CardContent className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="info" size="sm" dot>
              Processing
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Your {tierLabel} is being built.
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{propertyLabel}</p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              ETA
            </p>
            <p data-tabular className="mt-1 text-xl font-semibold tracking-tight">
              {etaLabel}
            </p>
            {eta.confidence === "low" ? (
              <p className="text-muted-foreground mt-1 text-[10px]">Running long — hang tight.</p>
            ) : eta.confidence === "medium" ? (
              <p className="text-muted-foreground mt-1 text-[10px]">Slightly slower than usual.</p>
            ) : null}
          </div>
        </div>

        <div className="border-primary/30 bg-card/70 mt-8 flex items-center gap-3 rounded-md border p-4 text-sm shadow-sm">
          <div className="bg-primary text-primary-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="leading-tight font-medium">{activeStep?.label ?? "Working…"}</p>
            {activeStep?.description ? (
              <p className="text-muted-foreground mt-0.5 text-xs">{activeStep.description}</p>
            ) : null}
          </div>
          <span
            data-tabular
            className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase"
          >
            {progress}%
          </span>
        </div>

        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <DlItem label="Tier" value={tierLabel} />
          <DlItem label="Elapsed" value={formatElapsed(elapsedSec)} mono />
          <DlItem label="Status" value={statusLabel(state.status)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function DeliveredPanel({
  state,
  studyId,
  propertyLabel,
}: {
  state: ProcessingStateResult;
  studyId: string;
  propertyLabel: string;
}) {
  const year1 = state.summary.year1DeductionCents ?? state.summary.acceleratedCents ?? 0;
  const taxSavings = state.summary.year1TaxSavingsCents ?? 0;
  const basis = state.summary.depreciableBasisCents ?? 0;
  const assetCount = state.summary.totalAssetCount ?? 0;
  // Count-up the headline number — 900ms ease-out cubic. Respects
  // prefers-reduced-motion internally.
  const animatedYear1 = useCountUp(year1 || null);
  const headlineValue = year1 ? formatCents(animatedYear1) : "See report";
  const hintParts: string[] = [];
  if (assetCount) hintParts.push(`${assetCount} classified line items`);
  if (taxSavings) hintParts.push(`≈ ${formatCents(taxSavings)} tax savings at 37% bracket`);
  const hint = hintParts.length ? hintParts.join(" · ") : "Review your full schedule in the PDF.";

  async function downloadReport() {
    const res = await getDeliverableUrlAction(studyId);
    if (res.ok) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card className="border-primary/30 ring-primary/20 relative overflow-hidden shadow-xl ring-1 motion-safe:animate-[slide-in-from-bottom_400ms_cubic-bezier(0.22,1,0.36,1)]">
      <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
      <CardContent className="p-8 sm:p-12">
        <div className="flex items-center justify-between">
          <Badge variant="success" size="sm" dot>
            Delivered
          </Badge>
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
            Ready to file
          </p>
        </div>
        <h2 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Your report is <span className="brand-gradient-text">ready.</span>
        </h2>
        <p className="text-muted-foreground mt-3 text-sm sm:text-base">{propertyLabel}</p>

        <div className="mt-10">
          <Kpi
            label="Year-one deduction identified"
            value={headlineValue}
            hint={hint}
            size="xl"
            tone="accent"
            animate
          />
        </div>

        {basis ? (
          <dl className="mt-8 grid gap-6 sm:grid-cols-4">
            <DlItem label="Depreciable basis" value={formatCents(basis)} mono />
            {state.summary.fiveYearCents ? (
              <DlItem
                label="5-year property"
                value={formatCents(state.summary.fiveYearCents)}
                mono
              />
            ) : null}
            {state.summary.fifteenYearCents ? (
              <DlItem
                label="15-year property"
                value={formatCents(state.summary.fifteenYearCents)}
                mono
              />
            ) : null}
            {state.summary.thirtyNineYearCents ? (
              <DlItem
                label="39-year property"
                value={formatCents(state.summary.thirtyNineYearCents)}
                mono
              />
            ) : null}
          </dl>
        ) : null}

        <Separator className="my-10" />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="xl"
            className="flex-1"
            leadingIcon={<DownloadIcon />}
            onClick={downloadReport}
            disabled={!state.summary.deliverableUrl}
          >
            Download your PDF
          </Button>
          <ShareStudyDialog
            studyId={studyId}
            propertyLabel={propertyLabel}
            triggerLabel="Share with your CPA"
            triggerVariant="outline"
            triggerSize="xl"
          />
          <Button asChild size="xl" variant="ghost" leadingIcon={<MailIcon />}>
            <Link href="/dashboard">View all studies</Link>
          </Button>
        </div>

        <div className="border-border bg-card/60 mt-8 rounded-lg border p-5">
          <p className="text-sm font-medium">What&rsquo;s next</p>
          <ol className="text-muted-foreground mt-3 space-y-2.5 text-sm">
            <li className="flex gap-2">
              <span className="bg-primary/10 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium">
                1
              </span>
              <span>
                <strong className="text-foreground">Send to your CPA.</strong> Share a read-only
                view, or email the PDF directly.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="bg-primary/10 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium">
                2
              </span>
              <span>
                <strong className="text-foreground">Upgrade to Engineer-Reviewed</strong> before you
                file. We reuse every document — one click from your dashboard.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="bg-primary/10 text-primary mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-medium">
                3
              </span>
              <span>
                <strong className="text-foreground">Add audit protection</strong> when the add-on
                launches this quarter. Your study is the first priority on our waitlist.
              </span>
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function FailedPanel({ state, studyId }: { state: ProcessingStateResult; studyId: string }) {
  const failure = classifyFailure(state.failureReason, studyId);
  const mailto = `mailto:support@segra.tax?subject=${encodeURIComponent(failure.supportSubject)}`;

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-7">
        <Alert variant="destructive" className="border-0 bg-transparent p-0">
          <AlertCircleIcon />
          <AlertTitle>{failure.title}</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>{failure.explanation}</p>
            <p>{failure.recovery}</p>
            <p className="text-muted-foreground pt-1 font-mono text-[11px] tracking-wide">
              Study ref {studyId.slice(0, 8)}
            </p>
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="default" trailingIcon={<ArrowRightIcon />}>
            <a href={mailto}>Email support</a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StepRow({ step }: { step: PipelineStep }) {
  return (
    <li className="flex items-start gap-3">
      <StepIcon state={step.state} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm leading-tight",
            step.state === "pending" ? "text-muted-foreground" : "text-foreground font-medium",
          )}
        >
          {step.label}
        </p>
        {step.description ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{step.description}</p>
        ) : null}
        {step.note ? (
          <p className="text-destructive mt-1 text-xs font-medium">{step.note}</p>
        ) : null}
      </div>
    </li>
  );
}

function StepIcon({ state }: { state: PipelineStep["state"] }) {
  // `key` on the state-wrapping span forces React to remount the node on
  // state change, which re-triggers the scale-in animation. The result is a
  // subtle pop as a step flips pending → active → done.
  if (state === "done") {
    return (
      <span
        key="done"
        className="bg-primary text-primary-foreground mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors motion-safe:animate-[scale-in_200ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        key="active"
        className="bg-primary/15 text-primary mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors motion-safe:animate-[scale-in_200ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {/* Keep the spinner always active — it's the functional "processing"
            indicator. Global reduced-motion rules slow it to imperceptible. */}
        <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        key="error"
        className="bg-destructive text-destructive-foreground mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors motion-safe:animate-[scale-in_200ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <AlertCircleIcon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      key="pending"
      className="border-border bg-muted/40 text-muted-foreground mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
    </span>
  );
}

function DlItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-lg font-semibold tracking-tight",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}
