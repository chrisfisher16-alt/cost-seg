import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepState = "pending" | "current" | "complete" | "error";

export interface Step {
  id: string;
  label: string;
  description?: string;
  state: StepState;
}

export function Stepper({
  steps,
  orientation = "horizontal",
  className,
}: {
  steps: Step[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  if (orientation === "vertical") {
    return (
      <ol className={cn("space-y-6", className)}>
        {steps.map((step, index) => (
          <VerticalStepItem
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
          />
        ))}
      </ol>
    );
  }
  return (
    <ol className={cn("flex items-center gap-2 overflow-x-auto", className)}>
      {steps.map((step, index) => (
        <HorizontalStepItem
          key={step.id}
          step={step}
          index={index}
          isLast={index === steps.length - 1}
        />
      ))}
    </ol>
  );
}

function HorizontalStepItem({
  step,
  index,
  isLast,
}: {
  step: Step;
  index: number;
  isLast: boolean;
}) {
  return (
    <>
      <li className="flex min-w-0 items-center gap-3">
        <StepBubble state={step.state} index={index + 1} />
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm leading-tight font-medium",
              step.state === "complete" && "text-foreground",
              step.state === "current" && "text-foreground",
              step.state === "pending" && "text-muted-foreground",
              step.state === "error" && "text-destructive",
            )}
          >
            {step.label}
          </p>
          {step.description ? (
            <p className="text-muted-foreground truncate text-xs">{step.description}</p>
          ) : null}
        </div>
      </li>
      {!isLast ? (
        <li
          aria-hidden
          className={cn(
            "h-px min-w-8 flex-1",
            step.state === "complete" ? "bg-primary/60" : "bg-border",
          )}
        />
      ) : null}
    </>
  );
}

function VerticalStepItem({ step, index, isLast }: { step: Step; index: number; isLast: boolean }) {
  return (
    <li className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <StepBubble state={step.state} index={index + 1} />
        {!isLast ? (
          <span
            aria-hidden
            className={cn(
              "mt-2 min-h-6 w-px flex-1",
              step.state === "complete" ? "bg-primary/60" : "bg-border",
            )}
          />
        ) : null}
      </div>
      <div className="min-w-0 pb-6">
        <p
          className={cn(
            "text-sm leading-tight font-medium",
            step.state === "complete" && "text-foreground",
            step.state === "current" && "text-foreground",
            step.state === "pending" && "text-muted-foreground",
            step.state === "error" && "text-destructive",
          )}
        >
          {step.label}
        </p>
        {step.description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{step.description}</p>
        ) : null}
      </div>
    </li>
  );
}

function StepBubble({ state, index }: { state: StepState; index: number }) {
  const base =
    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors";
  if (state === "complete") {
    return (
      <span className={cn(base, "bg-primary text-primary-foreground")}>
        <CheckIcon className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className={cn(base, "bg-foreground text-background")} aria-current="step">
        {index}
      </span>
    );
  }
  if (state === "error") {
    return <span className={cn(base, "bg-destructive text-destructive-foreground")}>!</span>;
  }
  return <span className={cn(base, "bg-muted text-muted-foreground")}>{index}</span>;
}
