import type { AssetLineItem, ClassifyAssetsOutput } from "@/lib/ai/prompts/classify-assets";

/** Maximum acceptable relative difference between schedule total and target. */
export const BALANCE_TOLERANCE = 0.005; // 0.5%

export interface BalanceResult {
  ok: boolean;
  totalCents: number;
  expectedCents: number;
  diffCents: number;
  diffPct: number;
  message?: string;
}

export function totalLineItems(items: AssetLineItem[]): number {
  return items.reduce((acc, x) => acc + x.amountCents, 0);
}

export function checkBalance(schedule: ClassifyAssetsOutput, expectedCents: number): BalanceResult {
  const totalCents = totalLineItems(schedule.lineItems);
  const diffCents = totalCents - expectedCents;
  const diffPct = expectedCents === 0 ? 0 : Math.abs(diffCents) / expectedCents;
  const ok = diffPct <= BALANCE_TOLERANCE;
  return {
    ok,
    totalCents,
    expectedCents,
    diffCents,
    diffPct,
    message: ok
      ? undefined
      : `Line items sum to ${totalCents} cents, but building value is ${expectedCents} cents — off by ${diffCents} cents (${(diffPct * 100).toFixed(2)}%). Redistribute line items so the total equals the building value exactly.`,
  };
}

/**
 * Classify-assets output is structurally valid (schema passed) but may still
 * violate the sum-to-building-value constraint. This helper formats the
 * violation for feedback into a retry prompt.
 */
export function formatBalanceErrorForRetry(result: BalanceResult): string {
  if (result.ok) return "";
  return result.message ?? "Schedule did not balance.";
}
