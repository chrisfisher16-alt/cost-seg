import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      {backHref ? (
        <Link
          href={backHref as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
              {description}
            </p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-3 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
