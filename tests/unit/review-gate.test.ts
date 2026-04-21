import { describe, expect, it, vi } from "vitest";

import { runReviewGate } from "@/lib/studies/review-gate";

/**
 * Tests for the review gate composition — rasterize + review + enforce
 * policy. The gate is a pure function with injection seams for the two
 * side-effecting helpers, so we can exercise every branch without
 * mounting the real rasterizer or Anthropic client.
 */

const FAKE_PDF = Buffer.from("%PDF-fake");

function mkPng(pageNumber: number) {
  return { pageNumber, png: Buffer.from([0x89, 0x50, 0x4e, 0x47, pageNumber & 0xff]) };
}

describe("runReviewGate", () => {
  it("returns ok with review output when pages rasterize + review cleanly", async () => {
    const rasterize = vi.fn().mockResolvedValue([mkPng(1), mkPng(2)]);
    const review = vi.fn().mockResolvedValue({
      findings: [
        {
          page: 1,
          severity: "nit",
          category: "typography",
          message: "m",
          suggestedFix: "f",
        },
      ],
      summary: "clean",
      batchCount: 1,
    });

    const outcome = await runReviewGate({
      studyId: "s1",
      address: "A",
      pdf: FAKE_PDF,
      enforce: true,
      rasterize,
      review,
    });

    expect(outcome.kind).toBe("ok");
    expect(rasterize).toHaveBeenCalledOnce();
    expect(review).toHaveBeenCalledOnce();
    const reviewCall = review.mock.calls[0]?.[0] as { pages: unknown[] };
    expect(reviewCall.pages).toHaveLength(2);
    if (outcome.kind === "ok") {
      expect(outcome.output?.findings).toHaveLength(1);
      expect(outcome.warning).toBeUndefined();
    }
  });

  it("blocks delivery when enforce=on and findings include a blocker", async () => {
    const rasterize = vi.fn().mockResolvedValue([mkPng(1)]);
    const review = vi.fn().mockResolvedValue({
      findings: [
        {
          page: 1,
          severity: "blocker",
          category: "content",
          message: "placeholder visible",
          suggestedFix: "re-run classifier",
        },
      ],
      summary: "",
      batchCount: 1,
    });

    const outcome = await runReviewGate({
      studyId: "s1",
      address: "A",
      pdf: FAKE_PDF,
      enforce: true,
      rasterize,
      review,
    });

    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") {
      expect(outcome.output.findings).toHaveLength(1);
    }
  });

  it("proceeds (kind=ok) when a blocker is present but enforce=off", async () => {
    const rasterize = vi.fn().mockResolvedValue([mkPng(1)]);
    const review = vi.fn().mockResolvedValue({
      findings: [
        {
          page: 1,
          severity: "blocker",
          category: "layout",
          message: "split card",
          suggestedFix: "wrap=false",
        },
      ],
      summary: "",
      batchCount: 1,
    });

    const outcome = await runReviewGate({
      studyId: "s1",
      address: "A",
      pdf: FAKE_PDF,
      enforce: false,
      rasterize,
      review,
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.output?.findings[0]?.severity).toBe("blocker");
    }
  });

  it("degrades to ok+warning when the rasterizer dep is missing (even with enforce=on)", async () => {
    const rasterize = vi
      .fn()
      .mockRejectedValue(new Error("pdf-to-png-converter is not installed. Install it..."));
    const review = vi.fn();

    const outcome = await runReviewGate({
      studyId: "s1",
      address: "A",
      pdf: FAKE_PDF,
      enforce: true,
      rasterize,
      review,
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.warning).toMatch(/rasterization failed/i);
      expect(outcome.warning).toMatch(/not installed/i);
    }
    // Review must NOT be called when rasterization failed.
    expect(review).not.toHaveBeenCalled();
  });

  it("degrades to ok+warning when the rasterizer returns zero pages", async () => {
    const rasterize = vi.fn().mockResolvedValue([]);
    const review = vi.fn();

    const outcome = await runReviewGate({
      studyId: "s1",
      address: "A",
      pdf: FAKE_PDF,
      enforce: true,
      rasterize,
      review,
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.warning).toMatch(/zero pages/i);
    }
    expect(review).not.toHaveBeenCalled();
  });
});
