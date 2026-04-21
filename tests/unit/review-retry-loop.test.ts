import { describe, expect, it, vi } from "vitest";

import type { ReviewFinding } from "@/lib/ai/prompts/review-report";
import { REVIEW_RETRY_CAP } from "@/lib/studies/review-feedback";
import { runRenderReviewLoop } from "@/lib/studies/review-retry-loop";
import type { ReviewGateOutcome } from "@/lib/studies/review-gate";

/**
 * v2 Phase 7 slice 3 — retry loop orchestration tests. All side
 * effects are injected so we exercise the branch logic in isolation.
 */

function okOutcome(findings: ReviewFinding[] = [], warning?: string): ReviewGateOutcome {
  return { kind: "ok", output: { findings, summary: undefined }, batchCount: 1, warning };
}

function blockedOutcome(findings: ReviewFinding[]): ReviewGateOutcome {
  return { kind: "blocked", output: { findings, summary: undefined }, batchCount: 1 };
}

const PDF_ATTEMPT_1 = Buffer.from("pdf-1");
const PDF_ATTEMPT_2 = Buffer.from("pdf-2");
const PDF_ATTEMPT_3 = Buffer.from("pdf-3");

describe("runRenderReviewLoop", () => {
  it("ships on the first iteration when the review returns clean", async () => {
    const renderPdf = vi.fn().mockResolvedValueOnce(PDF_ATTEMPT_1);
    const runReview = vi.fn().mockResolvedValueOnce(okOutcome([]));
    const reclassifyAndPersist = vi.fn();

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(runReview).toHaveBeenCalledTimes(1);
    expect(reclassifyAndPersist).not.toHaveBeenCalled();
    expect(result.pdf).toBe(PDF_ATTEMPT_1);
    expect(result.outcome.kind).toBe("ok");
    expect(result.attempts).toBe(1);
    expect(result.reclassifications).toBe(0);
    expect(result.allFindings).toEqual([]);
  });

  it("ships when findings are warnings-only (no blockers) regardless of enforce", async () => {
    const renderPdf = vi.fn().mockResolvedValueOnce(PDF_ATTEMPT_1);
    const warning: ReviewFinding = {
      page: 3,
      severity: "warning",
      category: "typography",
      message: "minor",
      suggestedFix: "-",
    };
    const runReview = vi.fn().mockResolvedValueOnce(okOutcome([warning]));
    const reclassifyAndPersist = vi.fn();

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(result.outcome.kind).toBe("ok");
    expect(result.allFindings).toEqual([warning]);
    expect(reclassifyAndPersist).not.toHaveBeenCalled();
  });

  it("reruns the classifier exactly once on a single content blocker, then ships if clean", async () => {
    const renderPdf = vi
      .fn()
      .mockResolvedValueOnce(PDF_ATTEMPT_1)
      .mockResolvedValueOnce(PDF_ATTEMPT_2);
    const contentBlocker: ReviewFinding = {
      page: 42,
      severity: "blocker",
      category: "content",
      message: "placeholder visible",
      suggestedFix: "rerun classifier so item 23 has a real description",
    };
    const runReview = vi
      .fn()
      .mockResolvedValueOnce(blockedOutcome([contentBlocker]))
      .mockResolvedValueOnce(okOutcome([]));
    const reclassifyAndPersist = vi.fn().mockResolvedValueOnce({ lineItems: [], totalCents: 42 });

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(renderPdf).toHaveBeenCalledTimes(2);
    expect(runReview).toHaveBeenCalledTimes(2);
    expect(reclassifyAndPersist).toHaveBeenCalledTimes(1);
    const hint = reclassifyAndPersist.mock.calls[0]?.[0] as string;
    expect(hint).toMatch(/placeholder visible/);
    expect(hint).toMatch(/rerun classifier/);
    expect(result.outcome.kind).toBe("ok");
    expect(result.pdf).toBe(PDF_ATTEMPT_2);
    expect(result.attempts).toBe(2);
    expect(result.reclassifications).toBe(1);
    // Both iterations' findings are captured.
    expect(result.allFindings).toHaveLength(1);
  });

  it("returns blocked with no retries when the first iteration is a layout blocker", async () => {
    const renderPdf = vi.fn().mockResolvedValueOnce(PDF_ATTEMPT_1);
    const layoutBlocker: ReviewFinding = {
      page: 13,
      severity: "blocker",
      category: "layout",
      message: "card split",
      suggestedFix: "add wrap={false}",
    };
    const runReview = vi.fn().mockResolvedValueOnce(blockedOutcome([layoutBlocker]));
    const reclassifyAndPersist = vi.fn();

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(reclassifyAndPersist).not.toHaveBeenCalled();
    expect(result.outcome.kind).toBe("blocked");
    expect(result.reclassifications).toBe(0);
    expect(result.attempts).toBe(1);
  });

  it("stops reclassifying after REVIEW_RETRY_CAP attempts even if findings persist", async () => {
    // Attempt 1: blocker → retry-classifier
    // Attempt 2 (reclassifications=1): blocker → retry-classifier
    // Attempt 3 (reclassifications=2 = cap): blocker → ship "retry-cap-reached"
    //   BUT gate still returns "blocked" because enforce. The loop
    //   returns blocked with reclassifications=2 (cap-reached branch).
    const renderPdf = vi
      .fn()
      .mockResolvedValueOnce(PDF_ATTEMPT_1)
      .mockResolvedValueOnce(PDF_ATTEMPT_2)
      .mockResolvedValueOnce(PDF_ATTEMPT_3);
    const blocker: ReviewFinding = {
      page: 1,
      severity: "blocker",
      category: "content",
      message: "still placeholder",
      suggestedFix: "try harder",
    };
    const runReview = vi
      .fn()
      .mockResolvedValueOnce(blockedOutcome([blocker]))
      .mockResolvedValueOnce(blockedOutcome([blocker]))
      .mockResolvedValueOnce(blockedOutcome([blocker]));
    const reclassifyAndPersist = vi.fn().mockResolvedValue({ lineItems: [], totalCents: 0 });

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(reclassifyAndPersist).toHaveBeenCalledTimes(REVIEW_RETRY_CAP);
    expect(result.reclassifications).toBe(REVIEW_RETRY_CAP);
    expect(result.attempts).toBe(REVIEW_RETRY_CAP + 1);
    expect(result.outcome.kind).toBe("blocked");
  });

  it("accumulates findings from every iteration into allFindings", async () => {
    const renderPdf = vi
      .fn()
      .mockResolvedValueOnce(PDF_ATTEMPT_1)
      .mockResolvedValueOnce(PDF_ATTEMPT_2);
    const a: ReviewFinding = {
      page: 1,
      severity: "blocker",
      category: "content",
      message: "a",
      suggestedFix: "fix",
    };
    const b: ReviewFinding = {
      page: 2,
      severity: "nit",
      category: "typography",
      message: "b",
      suggestedFix: "-",
    };
    const runReview = vi
      .fn()
      .mockResolvedValueOnce(blockedOutcome([a]))
      .mockResolvedValueOnce(okOutcome([b]));
    const reclassifyAndPersist = vi.fn().mockResolvedValueOnce({ lineItems: [], totalCents: 0 });

    const result = await runRenderReviewLoop({
      renderPdf,
      runReview,
      reclassifyAndPersist,
    });

    expect(result.allFindings.map((f) => f.message)).toEqual(["a", "b"]);
  });

  it("propagates renderPdf errors immediately (no silent retry)", async () => {
    const boom = new Error("render crashed");
    const renderPdf = vi.fn().mockRejectedValueOnce(boom);
    const runReview = vi.fn();
    const reclassifyAndPersist = vi.fn();

    await expect(
      runRenderReviewLoop({ renderPdf, runReview, reclassifyAndPersist }),
    ).rejects.toThrow(/render crashed/);
    expect(runReview).not.toHaveBeenCalled();
  });
});
