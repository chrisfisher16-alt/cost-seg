import { beforeEach, describe, expect, it, vi } from "vitest";

import { chunkReviewBatches, DEFAULT_REVIEW_BATCH_SIZE } from "@/lib/ai/steps/review-report";

/**
 * Tests for the review-report step. The actual Anthropic call is mocked
 * via `callTool` since the step's contract is "chunk → call → flatten".
 */

const callToolMock = vi.fn();
vi.mock("@/lib/ai/call", () => ({
  callTool: (args: unknown) => callToolMock(args),
}));

beforeEach(() => {
  callToolMock.mockReset();
  vi.resetModules();
});

function mkPage(n: number): { pageNumber: number; png: Buffer } {
  return { pageNumber: n, png: Buffer.from([0x89, 0x50, 0x4e, 0x47, n & 0xff]) };
}

describe("chunkReviewBatches", () => {
  it("exposes a sensible default batch size", () => {
    expect(DEFAULT_REVIEW_BATCH_SIZE).toBe(8);
  });

  it("groups into fixed-size batches and preserves page order", () => {
    const pages = Array.from({ length: 9 }, (_, i) => mkPage(i + 1));
    const batches = chunkReviewBatches(pages, 4);
    expect(batches).toHaveLength(3);
    expect(batches[0]?.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4]);
    expect(batches[1]?.map((p) => p.pageNumber)).toEqual([5, 6, 7, 8]);
    expect(batches[2]?.map((p) => p.pageNumber)).toEqual([9]);
  });

  it("returns an empty array for no pages", () => {
    expect(chunkReviewBatches([], 4)).toEqual([]);
  });

  it("throws on a non-positive batch size", () => {
    expect(() => chunkReviewBatches([mkPage(1)], 0)).toThrow(/positive/i);
    expect(() => chunkReviewBatches([mkPage(1)], -1)).toThrow(/positive/i);
  });
});

describe("reviewReport", () => {
  it("issues one Claude call per batch and flattens findings in page order", async () => {
    // First batch: pages 1–2, one blocker on page 1.
    callToolMock.mockResolvedValueOnce({
      output: {
        findings: [
          {
            page: 1,
            severity: "blocker",
            category: "layout",
            message: "asset card split",
            suggestedFix: "wrap=false",
          },
        ],
        summary: "batch 0 ok except page 1",
      },
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.01,
      cached: false,
      webSearchRequests: 0,
    });
    // Second batch: pages 3–4, clean.
    callToolMock.mockResolvedValueOnce({
      output: { findings: [], summary: "clean" },
      tokensIn: 100,
      tokensOut: 10,
      costUsd: 0.005,
      cached: false,
      webSearchRequests: 0,
    });

    const { reviewReport } = await import("@/lib/ai/steps/review-report");
    const result = await reviewReport({
      studyId: "s1",
      address: "207 S Edison",
      pages: [mkPage(1), mkPage(2), mkPage(3), mkPage(4)],
      batchSize: 2,
    });

    expect(callToolMock).toHaveBeenCalledTimes(2);
    expect(result.batchCount).toBe(2);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.page).toBe(1);
    expect(result.summary).toMatch(/batch 0 ok/);
    expect(result.summary).toMatch(/clean/);
  });

  it("attaches each page's PNG bytes as image attachments, one per page", async () => {
    callToolMock.mockResolvedValueOnce({
      output: { findings: [] },
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0,
      cached: false,
      webSearchRequests: 0,
    });
    const { reviewReport } = await import("@/lib/ai/steps/review-report");
    await reviewReport({
      studyId: "s1",
      address: "A",
      pages: [mkPage(10), mkPage(11)],
      batchSize: 8,
    });
    const call = callToolMock.mock.calls[0]?.[0] as {
      attachments: Array<{ kind: string; mediaType: string; base64: string; title?: string }>;
    };
    expect(call.attachments).toHaveLength(2);
    expect(call.attachments[0]?.kind).toBe("image");
    expect(call.attachments[0]?.mediaType).toBe("image/png");
    expect(call.attachments[0]?.title).toBe("Page 10");
    expect(call.attachments[1]?.title).toBe("Page 11");
  });

  it("sorts findings across batches into global page order", async () => {
    // Batch 1 (pages 1–2): finding on page 2.
    callToolMock.mockResolvedValueOnce({
      output: {
        findings: [
          {
            page: 2,
            severity: "warning",
            category: "layout",
            message: "tight",
            suggestedFix: "add breathing room",
          },
        ],
      },
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0,
      cached: false,
      webSearchRequests: 0,
    });
    // Batch 2 (pages 3–4): finding on page 3.
    callToolMock.mockResolvedValueOnce({
      output: {
        findings: [
          {
            page: 3,
            severity: "blocker",
            category: "content",
            message: "placeholder",
            suggestedFix: "re-run classifier",
          },
        ],
      },
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0,
      cached: false,
      webSearchRequests: 0,
    });

    const { reviewReport } = await import("@/lib/ai/steps/review-report");
    const result = await reviewReport({
      studyId: "s1",
      address: "A",
      pages: [mkPage(1), mkPage(2), mkPage(3), mkPage(4)],
      batchSize: 2,
    });

    expect(result.findings.map((f) => f.page)).toEqual([2, 3]);
  });

  it("returns zero findings on an empty input (0 batches, 0 calls)", async () => {
    const { reviewReport } = await import("@/lib/ai/steps/review-report");
    const result = await reviewReport({
      studyId: "s1",
      address: "A",
      pages: [],
    });
    expect(result.findings).toEqual([]);
    expect(result.batchCount).toBe(0);
    expect(callToolMock).not.toHaveBeenCalled();
  });
});
