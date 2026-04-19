"use client";

import * as React from "react";

/**
 * Fires a subtle, one-shot confetti burst. Respects `prefers-reduced-motion`.
 * Lazy-loads canvas-confetti so it only ships to clients that actually need it.
 */
export function useConfetti() {
  return React.useCallback(async () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const mod = await import("canvas-confetti");
      const confetti = mod.default;
      const colors = [
        "oklch(0.508 0.118 165)",
        "oklch(0.65 0.14 165)",
        "oklch(0.6 0.14 235)",
        "oklch(0.91 0.08 85)",
      ];
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.3 },
        colors,
        ticks: 180,
        scalar: 0.9,
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { x: 0.2, y: 0.4 },
          colors,
          ticks: 160,
          scalar: 0.8,
        });
      }, 180);
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { x: 0.8, y: 0.4 },
          colors,
          ticks: 160,
          scalar: 0.8,
        });
      }, 360);
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
