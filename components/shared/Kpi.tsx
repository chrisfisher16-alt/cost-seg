"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<Size, { label: string; value: string; hint: string }> = {
  sm: {
    label: "text-[10px] tracking-[0.2em]",
    value: "text-lg font-semibold",
    hint: "text-xs",
  },
  md: {
    label: "text-[11px] tracking-[0.2em]",
    value: "text-2xl font-semibold",
    hint: "text-xs",
  },
  lg: {
    label: "text-xs tracking-[0.22em]",
    value: "text-4xl font-semibold",
    hint: "text-sm",
  },
  xl: {
    label: "text-xs tracking-[0.22em]",
    value: "text-5xl sm:text-6xl font-semibold",
    hint: "text-sm",
  },
};

export function Kpi({
  label,
  value,
  hint,
  size = "md",
  tone,
  className,
  animate = false,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  size?: Size;
  tone?: "default" | "primary" | "accent" | "muted";
  className?: string;
  animate?: boolean;
}) {
  const cls = sizeClasses[size];
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "accent"
        ? "brand-gradient-text"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <p className={cn("text-muted-foreground font-mono uppercase", cls.label)}>{label}</p>
      ) : null}
      <p
        data-tabular
        className={cn(
          "leading-none tracking-tight",
          cls.value,
          toneCls,
          animate && "animate-[kpi-count_800ms_cubic-bezier(0.22,1,0.36,1)]",
        )}
      >
        {value}
      </p>
      {hint ? <p className={cn("text-muted-foreground", cls.hint)}>{hint}</p> : null}
    </div>
  );
}
