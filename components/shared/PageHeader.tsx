import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared page hero used across the app + admin + intake + study-view. Keeps
 * the `<h1>`, subtitle, chip row, and action buttons on one consistent rhythm
 * so no page re-invents header geometry.
 *
 * Slot semantics — pick the right one for each piece of content:
 *   - `title`      — the `<h1>`. Short noun phrase. String or JSX.
 *   - `description`— optional prose paragraph under the h1. Wraps to 2xl width.
 *                    Use for "Your dashboard" / "Every study across every
 *                    customer" — descriptive, not action-oriented.
 *   - `meta`       — optional chip row under the description. Inline badges,
 *                    status pills, timestamps, counts. Pieces separate
 *                    themselves visually via the container's gap-3. Pass
 *                    a fragment when you need multiple chips.
 *   - `actions`    — optional right-aligned button cluster. Primary + ghost
 *                    CTAs. Wraps below the title on narrow viewports.
 *   - `backHref`   — renders an "← Back" link above the title. Pair with
 *                    `backLabel` to override the default "Back" text.
 *
 * Examples (see callers for live shapes):
 *
 * ```tsx
 * // Admin study inspector (components/admin pages)
 * <PageHeader
 *   title={study.property.address}
 *   backHref="/admin"
 *   meta={
 *     <>
 *       <Badge variant="default" size="sm">{entry.label}</Badge>
 *       <StudyStatusBadge status={study.status} />
 *     </>
 *   }
 *   actions={<AdminActionsPanel studyId={study.id} />}
 * />
 *
 * // Customer dashboard — no meta, just title + description + actions
 * <PageHeader
 *   title="Welcome back."
 *   description="All of your properties and studies in one place."
 *   actions={<Button>Start a new study</Button>}
 * />
 * ```
 *
 * If you find yourself wanting a FIFTH slot, consider whether the page
 * deserves a dedicated layout instead of bending PageHeader.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  meta,
  actions,
  className,
}: {
  /** The `<h1>` — short noun phrase, string or JSX. */
  title: React.ReactNode;
  /** Optional prose under the h1. Wraps to max-w-2xl. */
  description?: React.ReactNode;
  /** Optional "← Back" href above the title. */
  backHref?: string;
  /** Label for the back link. Defaults to "Back". */
  backLabel?: string;
  /** Optional chip row (badges, timestamps, counts). Pass a fragment for multiples. */
  meta?: React.ReactNode;
  /** Optional right-aligned action cluster. */
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
