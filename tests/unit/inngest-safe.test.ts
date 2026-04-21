import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for `lib/studies/inngest-safe.ts`.
 *
 * The module is intentionally small — it wraps `inngest.send()` so a
 * transport failure (ECONNREFUSED in local dev, 5xx from Inngest cloud)
 * doesn't take down whatever caller triggered it. The contract matters
 * because user-action entry points (DIY form submit, admin rerun) call
 * this; a swallowed error path that actually threw would send a 500 to
 * the customer for an outage they can't act on.
 */

// Capture the inngest.send calls so we can control success / failure per-test.
const sendMock = vi.fn();

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (event: unknown) => sendMock(event),
  },
}));

describe("safeInngestSend", () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok:true when inngest.send resolves", async () => {
    sendMock.mockResolvedValue(undefined);
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    const result = await safeInngestSend(
      { name: "study.ai.complete", data: { studyId: "s1", tier: "DIY" } },
      { caller: "test" },
    );
    expect(result).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns ok:false with the error message when inngest.send rejects", async () => {
    sendMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    const result = await safeInngestSend(
      { name: "study.documents.ready", data: { studyId: "s1", tier: "AI_REPORT" } },
      { caller: "ready-check", studyId: "s1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ECONNREFUSED/);
  });

  it("coerces non-Error rejections (string / object) into a string error", async () => {
    sendMock.mockRejectedValue("boom");
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    const result = await safeInngestSend(
      { name: "study.ai.complete", data: { studyId: "s1", tier: "DIY" } },
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("boom");
  });

  it("never throws even when the logContext contains circular refs", async () => {
    // The helper serializes logContext into console.error — a circular
    // object used to be the one way to break the wrapper. Defensive check
    // that we don't regress on it.
    sendMock.mockRejectedValue(new Error("cloud 503"));
    const circular: Record<string, unknown> = { name: "self" };
    circular.self = circular;
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    await expect(
      safeInngestSend(
        { name: "study.ai.complete", data: { studyId: "s1", tier: "DIY" } },
        {
          studyId: "s1",
          extra: circular,
        },
      ),
    ).resolves.toMatchObject({ ok: false });
  });

  it("logs a single '[inngest.send failed]' line on failure (monitoring hook)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMock.mockRejectedValue(new Error("quota exceeded"));
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    await safeInngestSend(
      { name: "study.ai.complete", data: { studyId: "s1", tier: "DIY" } },
      { caller: "diy.actions", studyId: "s1" },
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [tag, payload] = errorSpy.mock.calls[0] ?? [];
    expect(tag).toBe("[inngest.send failed]");
    expect(payload).toMatchObject({
      event: "study.ai.complete",
      caller: "diy.actions",
      studyId: "s1",
      message: "quota exceeded",
    });
  });

  it("tags a batch send as '<batch>' in the log", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMock.mockRejectedValue(new Error("fail"));
    const { safeInngestSend } = await import("@/lib/studies/inngest-safe");
    await safeInngestSend(
      [
        { name: "study.ai.complete", data: { studyId: "s1", tier: "DIY" } },
        { name: "study.ai.complete", data: { studyId: "s2", tier: "AI_REPORT" } },
      ] as unknown as Parameters<typeof import("@/lib/studies/inngest-safe").safeInngestSend>[0],
      {},
    );
    const [, payload] = errorSpy.mock.calls[0] ?? [];
    expect((payload as { event: string }).event).toBe("<batch>");
  });
});
