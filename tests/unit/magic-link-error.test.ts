import { describe, expect, it } from "vitest";

import { classifyMagicLinkError } from "@/lib/auth/magic-link-error";

describe("classifyMagicLinkError", () => {
  it("parses the exact Supabase throttle payload (code + message)", () => {
    const r = classifyMagicLinkError({
      status: 429,
      code: "over_email_send_rate_limit",
      message: "For security purposes, you can only request this after 48 seconds.",
    });
    expect(r.kind).toBe("rate-limited");
    expect(r.retryAfterSec).toBe(48);
    expect(r.message).toContain("48 seconds");
  });

  it("handles older SDKs that only set status (no code)", () => {
    const r = classifyMagicLinkError({
      status: 429,
      message: "Rate limit exceeded",
    });
    expect(r.kind).toBe("rate-limited");
    // No seconds parsed from this message — we still surface a retry hint.
    expect(r.retryAfterSec).toBe(60);
  });

  it("handles singular-second grammar ('after 1 second')", () => {
    const r = classifyMagicLinkError({
      status: 429,
      code: "email_send_rate_limit",
      message: "For security purposes, you can only request this after 1 second.",
    });
    expect(r.retryAfterSec).toBe(1);
    expect(r.message).toContain("1 second");
    expect(r.message).not.toContain("1 seconds");
  });

  it("classifies email-provider-disabled projects", () => {
    const r = classifyMagicLinkError({
      status: 422,
      code: "email_provider_disabled",
      message: "Email provider is not enabled for this project.",
    });
    expect(r.kind).toBe("disabled");
    expect(r.retryAfterSec).toBeNull();
    expect(r.message).toContain("support@costseg.app");
  });

  it("classifies invalid-email shape", () => {
    const r = classifyMagicLinkError({
      status: 400,
      code: "validation_failed",
      message: "Invalid email address",
    });
    expect(r.kind).toBe("invalid-email");
    expect(r.retryAfterSec).toBeNull();
  });

  it("classifies transport failures (fetch failed, 502/503/504)", () => {
    expect(classifyMagicLinkError({ message: "fetch failed" }).kind).toBe("transport");
    expect(classifyMagicLinkError({ status: 502, message: "Bad Gateway" }).kind).toBe("transport");
    expect(classifyMagicLinkError({ status: 503, message: "" }).kind).toBe("transport");
    expect(classifyMagicLinkError({ message: "ECONNREFUSED 127.0.0.1:54321" }).kind).toBe(
      "transport",
    );
  });

  it("falls back to generic for unknown shapes", () => {
    expect(classifyMagicLinkError({ status: 418, message: "teapot" }).kind).toBe("generic");
    expect(classifyMagicLinkError(null).kind).toBe("generic");
    expect(classifyMagicLinkError(undefined).kind).toBe("generic");
    expect(classifyMagicLinkError("string error").kind).toBe("generic");
  });

  it("ignores negative or junk seconds in the retry-after parse", () => {
    const r = classifyMagicLinkError({
      status: 429,
      message: "after 0 seconds",
    });
    // Parsed 0 is treated as "no specific cooldown known" → defaults to 60s.
    expect(r.kind).toBe("rate-limited");
    expect(r.retryAfterSec).toBe(60);
  });

  it("prefers code match when message is uninformative", () => {
    const r = classifyMagicLinkError({
      status: 200, // lies
      code: "over_email_send_rate_limit",
      message: "",
    });
    expect(r.kind).toBe("rate-limited");
  });

  // ---- edges that aren't Supabase's official contract but show up in the wild ----

  it("survives non-string message types without crashing", () => {
    // Old SDKs + transport layers sometimes serialize message as a number
    // or object. The function must treat those as "no message" rather than
    // throw on a .match / .test call.
    expect(() => classifyMagicLinkError({ message: 429 })).not.toThrow();
    expect(() => classifyMagicLinkError({ message: null })).not.toThrow();
    expect(() => classifyMagicLinkError({ message: {} })).not.toThrow();
    expect(() => classifyMagicLinkError({ message: ["not a string"] })).not.toThrow();
    // All of these collapse to generic since there's no signal.
    expect(classifyMagicLinkError({ message: 429 }).kind).toBe("generic");
    expect(classifyMagicLinkError({ message: {} }).kind).toBe("generic");
  });

  it("treats status as number-only — string '429' does not count", () => {
    // Some fetch-based error wrappers stringify the status code. We
    // don't match those because we'd also match random strings like
    // '429' in a message body. Caller should convert before passing.
    const r = classifyMagicLinkError({ status: "429", message: "" });
    expect(r.kind).toBe("generic");
  });

  it("handles whitespace between 'after' and seconds", () => {
    // Supabase's exact phrasing has a single space, but we shouldn't
    // care about Unicode spacing or extra whitespace.
    const r = classifyMagicLinkError({
      status: 429,
      message: "For security purposes, you can only request this after 30 seconds.",
    });
    expect(r.retryAfterSec).toBe(30);
  });

  it("clamps nothing — a 10-minute cooldown surfaces verbatim", () => {
    // If Supabase ever extends the throttle (e.g. for repeated abuse),
    // we want the full number in the copy — not clamped to 60.
    const r = classifyMagicLinkError({
      status: 429,
      code: "over_email_send_rate_limit",
      message: "For security purposes, you can only request this after 600 seconds.",
    });
    expect(r.retryAfterSec).toBe(600);
    expect(r.message).toContain("600 seconds");
  });

  it("picks the first 'after N seconds' when the message has multiple", () => {
    // Pathological but plausible if Supabase ever templates two limits
    // in one message. First match wins by regex semantics.
    const r = classifyMagicLinkError({
      status: 429,
      message: "Retry after 12 seconds. If that fails, wait after 300 seconds.",
    });
    expect(r.retryAfterSec).toBe(12);
  });

  it("matches 'rate limit' prose even without the exact code", () => {
    // Safety net for message-body variations we haven't seen yet.
    expect(classifyMagicLinkError({ message: "You've hit the rate limit." }).kind).toBe(
      "rate-limited",
    );
    expect(classifyMagicLinkError({ message: "Request throttled by the rate limiter." }).kind).toBe(
      "rate-limited",
    );
  });

  it("treats a bare empty object as generic without NaN or undefined leaking through", () => {
    const r = classifyMagicLinkError({});
    expect(r.kind).toBe("generic");
    expect(r.retryAfterSec).toBeNull();
    expect(r.message).not.toContain("undefined");
    expect(r.message).not.toContain("NaN");
  });

  it("detects invalid email via 'invalid email' phrase without the code", () => {
    // Supabase sometimes returns the phrase in the message while leaving
    // `code` unset — e.g. from the older `gotrue-js` layer.
    const r = classifyMagicLinkError({
      status: 400,
      message: "The provided Invalid Email address was rejected.",
    });
    expect(r.kind).toBe("invalid-email");
  });
});
