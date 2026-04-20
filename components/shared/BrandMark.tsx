import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Brand mark — the Segra icon (ascending bars + velocity curve on a navy
 * ground) paired with the Segra wordmark. Tuned for 14–32px heights in nav and
 * 48+px on marketing.
 *
 * `wordmarkClassName` is the knob for headers that need the wordmark to fall
 * away on very narrow viewports. Pass `"hidden min-[420px]:inline"` to keep
 * the icon anchoring the brand while CTAs reclaim the horizontal space.
 *
 * Accessibility: when the wordmark is visible only at certain breakpoints, we
 * still want screen readers to announce the brand name — so we add an sr-only
 * fallback plus an `aria-label` on the link.
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
      <Image
        src={BRAND.assets.iconSvg}
        alt=""
        width={iconSize}
        height={iconSize}
        className="shrink-0"
        priority
      />
      {showWordmark ? (
        <>
          <span className={wordmarkClassName}>{BRAND.name}</span>
          {/* When wordmarkClassName hides the visible span at narrow widths,
              the sr-only copy ensures screen readers still announce the name. */}
          {wordmarkClassName ? <span className="sr-only">{BRAND.name}</span> : null}
        </>
      ) : null}
    </span>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        aria-label={`${BRAND.name} — home`}
        className="focus-visible:ring-ring rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
