/**
 * ETA estimator for the live pipeline view. Per-step baselines instead of a
 * single fixed total, so a study that's 6/7 done doesn't report "30s" when
 * the remaining step ("deliver") typically takes 3s.
 *
 * Baselines are anchored on observed medians from internal runs — see the
 * unit tests for the scenarios they were calibrated against. Tune them
 * here, not in the UI.
 */

/**
 * Step ids must match STEP_ORDER in processing/actions.ts. Kept as a
 * dependency-free string union so this file can be imported from tests,
 * server components, and the client UI without pulling in Prisma types.
 */
export type EtaStepId =
  | "upload"
  | "classify"
  | "decompose"
  | "assets"
  | "narrative"
  | "render"
  | "deliver";

export type EtaStepState = "pending" | "active" | "done" | "error";

export interface EtaStep {
  id: EtaStepId;
  state: EtaStepState;
}

/**
 * Baseline duration per step in seconds. Calibrated against observed
 * real-world runs with ~10 photos + transaction report + closing disclosure,
 * which typically complete in ~18–20 minutes end to end. `assets` dominates
 * because every photo/receipt is classified individually by Claude.
 */
export const STEP_BASELINE_SEC: Record<EtaStepId, number> = {
  upload: 0,
  classify: 120,
  decompose: 45,
  assets: 720,
  narrative: 180,
  render: 30,
  deliver: 10,
};

export type EtaConfidence = "high" | "medium" | "low";

export interface EtaEstimate {
  /** Seconds of expected work still to do. Never negative. */
  remainingSec: number;
  /** Short human-readable label for the hero card ("~2 min", "< 1 min", "shortly"). */
  label: string;
  /** How much to trust the estimate. Downgraded when elapsed has blown past budget. */
  confidence: EtaConfidence;
}

/**
 * Compute an ETA from the current step list + elapsed seconds. Pure.
 *
 * Algorithm:
 *   remaining = Σ baseline(pending) + ½ × baseline(active)
 *   If elapsedSec > 2 × expected_budget_for_progress_so_far, degrade
 *   confidence and return a fuzzy "shortly" label — the per-step medians
 *   have clearly missed for this run and pretending otherwise misleads.
 */
export function estimatePipelineEta(steps: EtaStep[], elapsedSec: number): EtaEstimate {
  const totalBudget = steps.reduce((sum, s) => sum + STEP_BASELINE_SEC[s.id], 0);

  let pendingBudget = 0;
  let activeBudget = 0;
  let doneBudget = 0;
  for (const s of steps) {
    const b = STEP_BASELINE_SEC[s.id];
    if (s.state === "pending") pendingBudget += b;
    else if (s.state === "active") activeBudget += b;
    else if (s.state === "done") doneBudget += b;
  }

  // ½ × active is the simplest midpoint heuristic. If the active step just
  // started we overshoot by ~half a step; if it's almost done we undershoot
  // the same. Over the aggregate it's closer than pretending the whole
  // active step is still ahead.
  const rawRemaining = Math.max(0, Math.round(pendingBudget + activeBudget / 2));

  // Expected elapsed at this progress checkpoint = doneBudget + ½ active.
  // If we've already burned more than 2× that, the run is genuinely slow —
  // the per-step medians can't stretch that far without lying.
  const expectedElapsed = doneBudget + activeBudget / 2;
  const overrun = expectedElapsed > 0 && elapsedSec > expectedElapsed * 2;

  let confidence: EtaConfidence = "high";
  if (overrun) confidence = "low";
  else if (elapsedSec > totalBudget * 1.2) confidence = "medium";

  return {
    remainingSec: rawRemaining,
    label: formatEtaLabel(rawRemaining, confidence),
    confidence,
  };
}

function formatEtaLabel(remainingSec: number, confidence: EtaConfidence): string {
  if (confidence === "low") {
    // "Low" means we've already blown past the per-step baselines, so a
    // precise seconds countdown would be lying. But "finishing up" is also
    // a lie when 15 minutes of baseline work are still ahead — the word
    // implies imminent completion. Key off remainingSec so the label
    // scales with how much work is left, not just how slow we are.
    if (remainingSec <= 15) return "finishing up";
    if (remainingSec < 120) return "a bit longer";
    return "still working";
  }
  // Anything at or under the deliver-step baseline (10s) is functionally
  // "done" to a human watching the pipeline — waiting on email + dashboard
  // refresh, no point showing a single-digit countdown.
  if (remainingSec <= 10) return "any moment now";
  if (remainingSec < 30) return "< 30s";
  if (remainingSec < 60) return `~${remainingSec}s`;
  const mins = Math.round(remainingSec / 60);
  return mins === 1 ? "~1 min" : `~${mins} min`;
}
