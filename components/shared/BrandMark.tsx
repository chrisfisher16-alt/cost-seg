import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brand mark — a stylized stacked-basis glyph in emerald + cobalt, paired with
 * the Cost Seg wordmark. Tuned for 14–32px heights in nav and 48+px on marketing.
 *
 * `wordmarkClassName` is the knob for headers that need the wordmark to fall
 * away on very narrow viewports. Pass `"hidden min-[420px]:inline"` to keep
 * the icon anchoring the brand while CTAs reclaim the horizontal space.
 *
 * Accessibility: when the wordmark is visible only at certain breakpoints, we
 * still want screen readers to announce "Cost Seg" — so we add an sr-only
 * fallback plus an `aria-label` on the link. The <span> rendering the visible
 * wordmark is aria-hidden for breakpoints where it's hidden (the sr-only
 * duplicate carries the name).
 */
export function BrandMark({
  size = "default",
  showWordmark = true,
  asLink = true,
  className,
  wordmarkClassName,
}: {
  size?: "sm" | "default" | "lg";
  showWordmark?: boolean;
  asLink?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  const iconSize = size === "sm" ? 18 : size === "lg" ? 32 : 22;
  const textCls = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        textCls,
        className,
      )}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="cs-brand-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.508 0.118 165)" />
            <stop offset="100%" stopColor="oklch(0.6 0.14 235)" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="26" height="26" rx="7" fill="url(#cs-brand-g)" />
        <g fill="white" fillOpacity="0.95">
          <rect x="8" y="20" width="16" height="3" rx="1" />
          <rect x="10" y="15" width="12" height="3" rx="1" fillOpacity="0.75" />
          <rect x="12" y="10" width="8" height="3" rx="1" fillOpacity="0.5" />
        </g>
      </svg>
      {showWordmark ? (
        <>
          <span className={wordmarkClassName}>Cost Seg</span>
          {/* When wordmarkClassName hides the visible span at narrow widths,
              the sr-only copy ensures screen readers still announce the name. */}
          {wordmarkClassName ? <span className="sr-only">Cost Seg</span> : null}
        </>
      ) : null}
    </span>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        aria-label="Cost Seg — home"
        className="focus-visible:ring-ring rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
