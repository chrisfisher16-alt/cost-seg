import "server-only";

import type { ReviewFinding } from "@/lib/ai/prompts/review-report";
import {
  REVIEW_RETRY_CAP,
  decideNextAction,
  formatFindingsAsClassifierHint,
} from "@/lib/studies/review-feedback";
import type { ReviewGateOutcome } from "@/lib/studies/review-gate";

/**
 * v2 Phase 7 slice 3 (ADR 0013) — the review retry orchestrator.
 *
 * Pulled out of `deliverAiReport` so the branch logic is pure and
 * unit-testable. All side-effecting collaborators (render PDF, run
 * review gate, re-invoke classifier, persist updated schedule) are
 * injected — the loop itself only decides WHAT to do based on
 * findings + attempt counter.
 *
 * Scope cuts (explicit in ADR 0013):
 *   • retry-render is not implemented — the template isn't
 *     data-parameterized for layout in a way runtime hints can fix.
 *     Layout blockers still fall through to "ship with blocker event"
 *     (enforce mode surfaces the issue to ops; no email goes out).
 *   • retry-classifier reruns `classifyAssetsV2` with a
 *     `priorAttemptError` built from the review findings. Cap of 2
 *     attempts total (initial + 1 retry by default — the spec says
 *     cap=2, matching REVIEW_RETRY_CAP).
 */

/** Shape the loop expects the classifier rerun to produce. */
export interface ReclassifyResult {
  /** Freshly classified v2 line items that the new PDF should render. */
  lineItems: unknown[];
  /** Total adjusted cost across the new schedule (drives Form 3115 math). */
  totalCents: number;
}

export interface RenderReviewLoopDeps {
  /** Render the PDF with the current schedule + props. */
  renderPdf: () => Promise<Buffer>;
  /** Run the rasterize + review gate against the rendered buffer. */
  runReview: (pdf: Buffer) => Promise<ReviewGateOutcome>;
  /**
   * Re-run the v2 classifier with the given `priorAttemptError`,
   * persist the resulting schedule to `Study.assetSchedule`, and
   * update the in-memory props the next render pass will use. The
   * loop itself doesn't touch Prisma.
   */
  reclassifyAndPersist: (priorAttemptError: string) => Promise<ReclassifyResult>;
}

export interface RenderReviewLoopResult {
  pdf: Buffer;
  /** Final review outcome — `"ok"` (may carry non-blocker findings) or `"blocked"`. */
  outcome: ReviewGateOutcome;
  /** Findings from every iteration, flattened for downstream persistence. */
  allFindings: ReviewFinding[];
  /** 1-based count of render+review iterations performed. */
  attempts: number;
  /** Number of classifier reruns issued (0..REVIEW_RETRY_CAP). */
  reclassifications: number;
}

/**
 * Run the render → review → (retry | ship) loop. Returns the final
 * PDF bytes and the outcome so the caller decides upload vs.
 * short-circuit.
 *
 * Invariants:
 *   • `renderPdf` is called at least once.
 *   • `reclassifyAndPersist` is called at most `REVIEW_RETRY_CAP`
 *     times.
 *   • Returns `outcome.kind === "blocked"` iff the final iteration
 *     returned blocker findings AND the review gate was in enforce
 *     mode. Telemetry-only mode always returns "ok".
 */
export async function runRenderReviewLoop(
  deps: RenderReviewLoopDeps,
): Promise<RenderReviewLoopResult> {
  const allFindings: ReviewFinding[] = [];
  let attempts = 0;
  let reclassifications = 0;

  // We need to keep the latest rendered buffer + outcome visible after
  // the loop for the caller. Initialized on the first iteration.
  let pdf: Buffer | null = null;
  let outcome: ReviewGateOutcome | null = null;

  while (attempts <= REVIEW_RETRY_CAP) {
    pdf = await deps.renderPdf();
    outcome = await deps.runReview(pdf);
    attempts += 1;

    if (outcome.output) {
      for (const f of outcome.output.findings) allFindings.push(f);
    }

    // Enforce mode returned `blocked`. Can't ship. If the blocker is
    // content and we have retry budget, loop; otherwise exit blocked.
    if (outcome.kind === "blocked") {
      const action = decideNextAction(
        outcome.output.findings,
        reclassifications, // retry cap applies to classifier reruns, not total iterations
      );
      if (action.kind === "retry-classifier") {
        await deps.reclassifyAndPersist(action.priorAttemptError);
        reclassifications += 1;
        continue; // loop will render + review again with the new schedule
      }
      // retry-render is a no-op in slice 3 orchestration; layout
      // blockers and cap-reached both fall through and return blocked.
      break;
    }

    // outcome.kind === "ok" — findings may include warnings/nits but
    // the gate decided not to block. Ship.
    break;
  }

  return { pdf: pdf!, outcome: outcome!, allFindings, attempts, reclassifications };
}

/**
 * Convenience: turn the loop's findings list into the priorAttemptError
 * prose that will be passed to the NEXT classifier retry. Exposed so
 * callers can log the exact string that's being fed back, and so the
 * retry-loop test can assert the right content was threaded through.
 */
export function buildClassifierHintFromFindings(findings: ReviewFinding[]): string {
  return formatFindingsAsClassifierHint(findings);
}
