import { describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the `deliverAiReport` Inngest function config.
 * The v2 Phase 7 review retry loop makes each delivery run
 * potentially 30–90s longer; adding the concurrency key prevents a
 * retry event from kicking off a second run while the first is
 * mid-loop (which would double-spend on render + review).
 */

vi.mock("../../inngest/client", () => ({
  inngest: {
    createFunction: (config: Record<string, unknown>, _trigger: unknown, handler: unknown) => ({
      config,
      handler,
    }),
  },
}));

describe("deliverAiReport Inngest function config", () => {
  it("serializes delivery per study via a concurrency key on event.data.studyId", async () => {
    const { deliverAiReport } = await import("@/inngest/functions/deliver-ai-report");
    const fn = deliverAiReport as unknown as { config: Record<string, unknown> };
    expect(fn.config.concurrency).toEqual({ key: "event.data.studyId", limit: 1 });
  });

  it("retries 3 times — matches pre-fix behavior for transient network/storage errors", async () => {
    const { deliverAiReport } = await import("@/inngest/functions/deliver-ai-report");
    const fn = deliverAiReport as unknown as { config: Record<string, unknown> };
    expect(fn.config.retries).toBe(3);
  });
});
