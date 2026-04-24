import { describe, expect, it, vi } from "vitest";

import { streamFinalMessageWithRetry } from "@/lib/ai/call";

/**
 * Covers the transient-error retry added to `callTool`'s Anthropic
 * stream pipeline. The real-world trigger was a 25-photo fan-out
 * run that hit `overloaded_error` on two photo slices — before the
 * retry, those slices threw and failed the whole Inngest step.
 *
 * Tests stub the Anthropic client with just enough shape to drive
 * `client.messages.stream(params).finalMessage()`.
 */

type FakeClient = { messages: { stream: ReturnType<typeof vi.fn> } };

function makeClient(finalMessage: (attempt: number) => Promise<unknown> | unknown): FakeClient {
  let attempt = 0;
  return {
    messages: {
      stream: vi.fn(() => ({
        finalMessage: () => {
          const n = attempt++;
          const result = finalMessage(n);
          return Promise.resolve(result as Promise<unknown>);
        },
      })),
    },
  };
}

function overloaded(): Error {
  const err = new Error("Overloaded");
  Object.assign(err, { status: 529, error: { type: "overloaded_error" } });
  return err;
}

function rateLimit(): Error {
  const err = new Error("too many requests");
  Object.assign(err, { status: 429, error: { type: "rate_limit_error" } });
  return err;
}

function invalidRequest(): Error {
  const err = new Error("max_tokens exceeds model limit");
  Object.assign(err, { status: 400, error: { type: "invalid_request_error" } });
  return err;
}

// A minimally-shaped successful Message — the helper doesn't inspect
// content, only returns whatever finalMessage() resolved to.
const SUCCESS = { id: "msg_1", content: [], usage: { input_tokens: 1, output_tokens: 1 } };

describe("streamFinalMessageWithRetry", () => {
  it("returns the first response when the call succeeds on attempt 1", async () => {
    const client = makeClient(() => SUCCESS);
    const result = await streamFinalMessageWithRetry(
      client as never,
      { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
      "test:ok",
    );
    expect(result).toBe(SUCCESS);
    expect(client.messages.stream).toHaveBeenCalledTimes(1);
  });

  // Retry tests wait real ms between attempts (2s+4s+8s backoff with
  // jitter), so they need a wider timeout than vitest's 5s default.
  it("retries on overloaded_error and returns the eventual success", async () => {
    const client = makeClient((attempt) => {
      if (attempt < 2) throw overloaded();
      return SUCCESS;
    });
    const result = await streamFinalMessageWithRetry(
      client as never,
      { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
      "test:overload",
    );
    expect(result).toBe(SUCCESS);
    expect(client.messages.stream).toHaveBeenCalledTimes(3);
  }, 30_000);

  it("retries on rate_limit_error", async () => {
    const client = makeClient((attempt) => {
      if (attempt === 0) throw rateLimit();
      return SUCCESS;
    });
    const result = await streamFinalMessageWithRetry(
      client as never,
      { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
      "test:rate-limit",
    );
    expect(result).toBe(SUCCESS);
    expect(client.messages.stream).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("does NOT retry on non-transient errors (e.g. invalid_request)", async () => {
    const client = makeClient(() => {
      throw invalidRequest();
    });
    await expect(
      streamFinalMessageWithRetry(
        client as never,
        { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
        "test:invalid",
      ),
    ).rejects.toThrow("max_tokens exceeds model limit");
    expect(client.messages.stream).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting the retry budget (4 total attempts)", async () => {
    const client = makeClient(() => {
      throw overloaded();
    });
    await expect(
      streamFinalMessageWithRetry(
        client as never,
        { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
        "test:exhausted",
      ),
    ).rejects.toThrow(/Overloaded/);
    // 1 initial + 3 retries = 4 attempts max.
    expect(client.messages.stream).toHaveBeenCalledTimes(4);
  }, 60_000);

  it("classifies 5xx statuses as transient even when `error.type` is absent", async () => {
    const client = makeClient((attempt) => {
      if (attempt === 0) {
        const err = new Error("bad gateway");
        Object.assign(err, { status: 502 });
        throw err;
      }
      return SUCCESS;
    });
    const result = await streamFinalMessageWithRetry(
      client as never,
      { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [] } as never,
      "test:502",
    );
    expect(result).toBe(SUCCESS);
    expect(client.messages.stream).toHaveBeenCalledTimes(2);
  }, 15_000);
});
