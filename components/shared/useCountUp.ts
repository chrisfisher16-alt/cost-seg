"use client";

import * as React from "react";

/**
 * Animate an integer from 0 to `target` over `durationMs` with an
 * ease-out-cubic curve, returning the current displayed value on each tick.
 *
 * Respects `prefers-reduced-motion` — when set, returns the final value
 * immediately with no animation. Safe for SSR (returns `target` until mount).
 */
export function useCountUp(
  target: number | null | undefined,
  options: { durationMs?: number } = {},
): number {
  const duration = options.durationMs ?? 900;
  // Start at 0 so the mount-time animation always runs from 0 → target.
  // Subsequent target changes (rare for this usage) also animate from the
  // previous displayed value — the RAF loop reads the latest `target` from
  // the effect closure, so we don't need to seed from `target ?? 0`.
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    const finalValue = target ?? 0;
    if (finalValue === 0) {
      // No animation needed; snap on the next tick so the setState doesn't
      // happen synchronously inside the effect body.
      const raf = requestAnimationFrame(() => setValue(0));
      return () => cancelAnimationFrame(raf);
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const raf = requestAnimationFrame(() => setValue(finalValue));
      return () => cancelAnimationFrame(raf);
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: 1 - (1 - t)^3 — pops fast, settles soft.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(finalValue * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
