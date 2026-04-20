"use client";

import { CelebrationTrigger } from "@/components/shared/Celebration";

/**
 * Fires the brand confetti burst once when the success page mounts.
 * Small, client-only — keeps the page shell server-rendered so the
 * rest of the copy is crawlable + static-cache friendly.
 *
 * Respects prefers-reduced-motion internally (CelebrationTrigger →
 * useConfetti short-circuits when the media query is set).
 */
export function CheckoutSuccessClient() {
  return <CelebrationTrigger active />;
}
