"use client";

import * as React from "react";

/**
 * Brand palette for confetti — hex values that approximate our OKLCH tokens.
 * canvas-confetti renders via canvas fillStyle which has spotty OKLCH support;
 * hex is the compatible and predictable path.
 *
 * Corresponds to: primary emerald (light + dark tints), info cobalt, accent
 * amber. Four colors keeps bursts visually rich without looking chaotic.
 */
const CONFETTI_COLORS = [
  "#047857", // emerald 700 — primary
  "#10b981", // emerald 500 — primary tint
  "#3b82f6", // blue 500 — info
  "#fcd34d", // amber 300 — accent
];

/**
 * Fires a subtle, three-burst confetti sequence from the hero area. Respects
 * `prefers-reduced-motion`. Lazy-loads canvas-confetti so it only ships to
 * clients that actually need it.
 */
export function useConfetti() {
  return React.useCallback(async () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const mod = await import("canvas-confetti");
      const confetti = mod.default;

      // Center burst — the headline pop.
      confetti({
        particleCount: 90,
        spread: 72,
        startVelocity: 38,
        origin: { y: 0.32 },
        colors: CONFETTI_COLORS,
        ticks: 200,
        scalar: 0.95,
        gravity: 0.9,
      });

      // Left side — 160ms staggered.
      window.setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 60,
          spread: 70,
          startVelocity: 35,
          origin: { x: 0.1, y: 0.5 },
          colors: CONFETTI_COLORS,
          ticks: 180,
          scalar: 0.85,
          gravity: 0.95,
        });
      }, 160);

      // Right side — 320ms staggered.
      window.setTimeout(() => {
        confetti({
          particleCount: 55,
          angle: 120,
          spread: 70,
          startVelocity: 35,
          origin: { x: 0.9, y: 0.5 },
          colors: CONFETTI_COLORS,
          ticks: 180,
          scalar: 0.85,
          gravity: 0.95,
        });
      }, 320);
    } catch (err) {
      console.warn("confetti unavailable", err);
    }
  }, []);
}

/**
 * Fires confetti once when `active` transitions to true. Idempotent across re-renders.
 */
export function CelebrationTrigger({ active }: { active: boolean }) {
  const fire = useConfetti();
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (active && !fired.current) {
      fired.current = true;
      void fire();
    }
  }, [active, fire]);

  return null;
}
