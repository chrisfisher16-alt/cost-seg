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
    expect(r.message).toContain("support@segra.tax");
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
});
