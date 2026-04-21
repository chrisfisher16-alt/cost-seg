import { describe, expect, it, vi } from "vitest";

/**
 * Regression guards for the "stuck in PROCESSING after a crashed
 * run" bug. Two layers ship in this fix:
 *
 *   1. The Inngest function config declares `concurrency: { key:
 *      "event.data.studyId", limit: 1 }` so two concurrent runs on
 *      the same study can't race on the status transition.
 *   2. `onFailure` is wired to flip the study to FAILED when all
 *      retries exhaust, so the next retry starts from a legal
 *      entry state.
 *
 * These tests assert the WIRING — that the config surface the
 * Inngest runtime reads carries the right options. The transition-
 * recovery branch inside `mark-processing` itself is exercised via
 * the full-path integration test (gated on Supabase + Inngest +
 * Anthropic, not unit-testable here without mocking the Inngest
 * runtime wholesale).
 */

// The Inngest client module tries to read the real signing key at
// import time; stub it with a minimal shape that satisfies
// `createFunction`.
vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (config: Record<string, unknown>, _trigger: unknown, handler: unknown) => ({
      config,
      handler,
    }),
  },
}));

describe("processStudy Inngest function config", () => {
  it("serializes runs per study via concurrency key on event.data.studyId", async () => {
    const { processStudy } = await import("@/inngest/functions/process-study");
    const fn = processStudy as unknown as { config: Record<string, unknown> };
    expect(fn.config.concurrency).toEqual({ key: "event.data.studyId", limit: 1 });
  });

  it("declares an onFailure handler so exhausted retries reset status to FAILED", async () => {
    const { processStudy } = await import("@/inngest/functions/process-study");
    const fn = processStudy as unknown as { config: Record<string, unknown> };
    expect(typeof fn.config.onFailure).toBe("function");
  });

  it("onFailure calls markStudyFailed with the studyId and error message", async () => {
    const markStudyFailedMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/studies/pipeline", () => ({
      markStudyFailed: markStudyFailedMock,
    }));
    vi.resetModules();
    const { processStudy } = await import("@/inngest/functions/process-study");
    const fn = processStudy as unknown as {
      config: { onFailure: (args: unknown) => Promise<void> };
    };
    await fn.config.onFailure({
      event: {
        data: {
          event: { data: { studyId: "s1", tier: "AI_REPORT" } },
        },
      },
      error: new Error("kaboom"),
    });
    expect(markStudyFailedMock).toHaveBeenCalledTimes(1);
    const [studyId, reason] = markStudyFailedMock.mock.calls[0] as [string, string];
    expect(studyId).toBe("s1");
    expect(reason).toMatch(/exhausted retries/i);
    expect(reason).toMatch(/kaboom/);
    vi.doUnmock("@/lib/studies/pipeline");
    vi.resetModules();
  });

  it("onFailure swallows markStudyFailed errors so Inngest doesn't loop on terminal studies", async () => {
    const markStudyFailedMock = vi.fn().mockRejectedValue(new Error("already DELIVERED"));
    vi.doMock("@/lib/studies/pipeline", () => ({
      markStudyFailed: markStudyFailedMock,
    }));
    vi.resetModules();
    const { processStudy } = await import("@/inngest/functions/process-study");
    const fn = processStudy as unknown as {
      config: { onFailure: (args: unknown) => Promise<void> };
    };
    await expect(
      fn.config.onFailure({
        event: {
          data: {
            event: { data: { studyId: "s1", tier: "AI_REPORT" } },
          },
        },
        error: new Error("original failure"),
      }),
    ).resolves.toBeUndefined();
    vi.doUnmock("@/lib/studies/pipeline");
    vi.resetModules();
  });

  it("onFailure no-ops gracefully when event payload is missing studyId", async () => {
    const markStudyFailedMock = vi.fn();
    vi.doMock("@/lib/studies/pipeline", () => ({
      markStudyFailed: markStudyFailedMock,
    }));
    vi.resetModules();
    const { processStudy } = await import("@/inngest/functions/process-study");
    const fn = processStudy as unknown as {
      config: { onFailure: (args: unknown) => Promise<void> };
    };
    await fn.config.onFailure({
      event: { data: { event: { data: {} } } },
      error: new Error("boom"),
    });
    expect(markStudyFailedMock).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/studies/pipeline");
    vi.resetModules();
  });
});
