/**
 * Age formatters used by the admin surfaces.
 *
 * Two variants because the two surfaces care about different resolutions:
 *
 * - `formatAgeTerse` — for the main admin pipeline list. Counts seconds
 *   within the first minute so "Updated 3s ago" surfaces a freshly-landed
 *   event at a glance. Whole-number days once past 24h.
 *
 * - `formatAgeSla` — for the engineer queue. Drops seconds (nothing
 *   actionable there), shows decimals under 10 days so "3.2d" vs "3.8d"
 *   reads differently when the SLA bucket boundary is 3.0d.
 *
 * Both take `fromMs`/`nowMs` as numbers — same pure-helper pattern as
 * lib/studies/next-action.ts `formatRelativeAge`. Takes `Date.getTime()`
 * at the call site so the helper is deterministic + testable without
 * a clock mock.
 *
 * Clock skew: both helpers clamp negative deltas to 0 so a future
 * `fromMs` renders as "0s" / "0m" rather than a nonsense negative age.
 */

/** Admin pipeline list — seconds-resolution at the fresh end, integer days beyond. */
export function formatAgeTerse(fromMs: number, nowMs: number): string {
  const delta = Math.max(0, (nowMs - fromMs) / 1000);
  if (delta < 60) return `${Math.round(delta)}s`;
  if (delta < 3600) return `${Math.round(delta / 60)}m`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h`;
  return `${Math.round(delta / 86400)}d`;
}

/** Engineer queue — minute-resolution at the fresh end, decimal days <10d. */
export function formatAgeSla(fromMs: number, nowMs: number): string {
  const hours = Math.max(0, (nowMs - fromMs) / 3_600_000);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

/** Raw hours-between (non-negative). Used by engineer-queue bucketAge. */
export function hoursBetween(fromMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - fromMs) / 3_600_000);
}
