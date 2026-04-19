import { CheckCircle2Icon, Loader2Icon, SparklesIcon } from "lucide-react";
import type { DocumentKind } from "@prisma/client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Stepper, type Step } from "@/components/shared/Stepper";

import { DOCUMENT_KIND_META } from "./meta";

interface Props {
  propertyReady: boolean;
  missingKinds: DocumentKind[];
  complete: boolean;
  processing: boolean;
  /** How many required document kinds exist in this intake (for progress math). */
  totalRequired?: number;
  /** How many of those kinds are already satisfied. */
  satisfied?: number;
}

export function IntakeProgress({
  propertyReady,
  missingKinds,
  complete,
  processing,
  totalRequired,
  satisfied,
}: Props) {
  if (processing) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="bg-primary text-primary-foreground mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full">
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
          </div>
          <div>
            <p className="text-foreground font-semibold">Processing has started.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              The pipeline is running. You can watch it live on the next page or wait for the email
              when your report is ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (complete) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="bg-success text-success-foreground mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full">
            <SparklesIcon className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="font-semibold">All set — processing is queued.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              We have everything we need. Your pipeline will kick off within a minute. We&rsquo;ll
              email you the moment the PDF is ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const steps: Step[] = [
    {
      id: "property",
      label: "Property details",
      state: propertyReady ? "complete" : "current",
      description: propertyReady ? "Saved" : "Confirm address, purchase price, and type",
    },
    {
      id: "documents",
      label: "Upload documents",
      state:
        propertyReady && missingKinds.length === 0
          ? "complete"
          : propertyReady
            ? "current"
            : "pending",
      description:
        missingKinds.length === 0
          ? "All required docs uploaded"
          : `${missingKinds.length} required left`,
    },
    {
      id: "processing",
      label: "Start processing",
      state: "pending",
      description: "We queue the pipeline automatically",
    },
  ];

  const totalReqShown = totalRequired ?? Math.max(1, missingKinds.length + (satisfied ?? 0));
  const sat = satisfied ?? Math.max(0, totalReqShown - missingKinds.length);
  const value = Math.round((((propertyReady ? 1 : 0) + sat) / (1 + totalReqShown)) * 100);

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">What&rsquo;s left</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Complete these steps and we kick off your pipeline automatically.
            </p>
          </div>
          <p data-tabular className="text-muted-foreground font-mono text-xs tracking-wide">
            {value}% complete
          </p>
        </div>
        <Progress value={value} />
        <Stepper steps={steps} orientation="vertical" />
        {missingKinds.length > 0 ? (
          <div className="border-border bg-muted/30 rounded-md border p-4">
            <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
              Documents still needed
            </p>
            <ul className="mt-2 space-y-1.5">
              {missingKinds.map((k) => (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <CheckCircle2Icon className="text-muted-foreground/50 h-3.5 w-3.5" aria-hidden />
                  <span>{DOCUMENT_KIND_META[k].label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
