import "server-only";

import { reviewReport } from "@/lib/ai/steps/review-report";
import { hasBlockers, type ReviewReportOutput } from "@/lib/ai/prompts/review-report";
import { rasterizePdfToPngs } from "@/lib/pdf/rasterize";

/**
 * v2 Phase 7b (ADR 0013) — rasterize-and-review gate used by
 * `deliverAiReport`. Pulled out of deliver.ts so the branching logic
 * (run / skip, enforce / telemetry-only, dep-missing fallback) can be
 * unit-tested without mounting the full delivery pipeline and its
 * Supabase admin client.
 */

export interface ReviewGateInput {
  studyId: string;
  address: string;
  /** Rendered PDF bytes — the caller already invoked renderAiReportPdf. */
  pdf: Buffer;
  /** Free-text context threaded into the review prompt (e.g. schedule shape). */
  context?: string;
  /** Whether a blocker should stop delivery. From V2_REPORT_REVIEW_ENFORCE. */
  enforce: boolean;
  /**
   * Injection seams for tests. In production, both resolve to the real
   * helpers.
   */
  rasterize?: typeof rasterizePdfToPngs;
  review?: typeof reviewReport;
}

export type ReviewGateOutcome =
  /** Review completed cleanly (no blockers OR enforce=off). Proceed with upload/email. */
  | {
      kind: "ok";
      output: ReviewReportOutput | null;
      batchCount: number;
      /** Non-fatal reason — e.g. rasterizer dep missing — surfaced for StudyEvent payload. */
      warning?: string;
    }
  /** enforce=on and the review returned at least one blocker. Do NOT deliver. */
  | {
      kind: "blocked";
      output: ReviewReportOutput;
      batchCount: number;
    };

/**
 * Run the rasterize + review sequence. Failure modes:
 *   • Rasterizer dep missing (pdf-to-png-converter not installed) →
 *     returns `{ kind: "ok", warning: "..." }` regardless of enforce
 *     mode. A review we can't run is not a blocker — log and ship.
 *   • Rasterizer throws mid-render → same: treat as non-blocking,
 *     surface warning.
 *   • Review call fails upstream → bubbles. The caller decides
 *     whether to retry the whole delivery or treat as transient.
 */
export async function runReviewGate(input: ReviewGateInput): Promise<ReviewGateOutcome> {
  const rasterize = input.rasterize ?? rasterizePdfToPngs;
  const review = input.review ?? reviewReport;

  let pages;
  try {
    pages = await rasterize(input.pdf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: "ok",
      output: null,
      batchCount: 0,
      warning: `review skipped — rasterization failed: ${msg}`,
    };
  }

  if (pages.length === 0) {
    return {
      kind: "ok",
      output: null,
      batchCount: 0,
      warning: "review skipped — rasterizer produced zero pages",
    };
  }

  const result = await review({
    studyId: input.studyId,
    address: input.address,
    pages: pages.map((p) => ({ pageNumber: p.pageNumber, png: p.png })),
    context: input.context,
  });

  const output: ReviewReportOutput = {
    findings: result.findings,
    summary: result.summary || undefined,
  };

  if (input.enforce && hasBlockers(output)) {
    return { kind: "blocked", output, batchCount: result.batchCount };
  }

  return { kind: "ok", output, batchCount: result.batchCount };
}
