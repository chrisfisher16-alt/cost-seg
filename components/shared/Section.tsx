import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "muted" | "contrast" | "gradient";

const toneClasses: Record<Tone, string> = {
  default: "",
  muted: "bg-muted/30",
  contrast: "bg-foreground text-background",
  gradient: "brand-gradient-bg",
};

export function Section({
  tone = "default",
  id,
  className,
  children,
  divider = true,
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-16 sm:py-24",
        divider && tone !== "contrast" ? "border-border/60 border-t" : "",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl space-y-3",
        align === "center" ? "mx-auto text-center" : "",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-primary font-mono text-xs tracking-[0.2em] uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description ? (
        <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
