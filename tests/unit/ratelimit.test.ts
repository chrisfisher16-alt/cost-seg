import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The limiter module caches limiter instances in a module-scoped Map keyed
 * by name. We need to reset module state between tests so each test gets
 * a fresh MemoryLimiter instance (otherwise test order affects counts).
 *
 * We also explicitly unset Upstash env vars so every test runs through the
 * in-memory fallback — deterministic and no network.
 */

describe("rate limiters (memory fallback)", () => {
  let originalUrl: string | undefined;
  let originalToken: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("estimatorLimiter: 5th ok, 6th blocked within the same minute", async () => {
    const { estimatorLimiter } = await import("@/lib/ratelimit");
    const limiter = estimatorLimiter();
    const key = "ip-estimator-1";
    for (let i = 0; i < 5; i++) {
      const r = await limiter.check(key);
      expect(r.ok, `call ${i + 1} should be allowed`).toBe(true);
    }
    const blocked = await limiter.check(key);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("different keys don't share counters", async () => {
    const { estimatorLimiter } = await import("@/lib/ratelimit");
    const limiter = estimatorLimiter();
    for (let i = 0; i < 5; i++) {
      await limiter.check("key-a");
    }
    const freshKey = await limiter.check("key-b");
    expect(freshKey.ok).toBe(true);
    expect(freshKey.remaining).toBe(4);
  });

  it("magicLinkLimiter: 5 per 300s window (more generous than 1 per email)", async () => {
    const { magicLinkLimiter } = await import("@/lib/ratelimit");
    const limiter = magicLinkLimiter();
    const key = "ip-magic";
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check(key)).ok, `call ${i + 1}`).toBe(true);
    }
    expect((await limiter.check(key)).ok).toBe(false);
  });

  it("startCheckoutLimiter: 8 per 300s — survives household-NAT re-submits", async () => {
    const { startCheckoutLimiter } = await import("@/lib/ratelimit");
    const limiter = startCheckoutLimiter();
    const key = "ip-checkout";
    for (let i = 0; i < 8; i++) {
      expect((await limiter.check(key)).ok, `call ${i + 1}`).toBe(true);
    }
    expect((await limiter.check(key)).ok).toBe(false);
  });

  it("samplePdfLimiter: 10 per minute", async () => {
    const { samplePdfLimiter } = await import("@/lib/ratelimit");
    const limiter = samplePdfLimiter();
    const key = "ip-pdf";
    for (let i = 0; i < 10; i++) {
      expect((await limiter.check(key)).ok).toBe(true);
    }
    expect((await limiter.check(key)).ok).toBe(false);
  });

  it("resetAt is in the future and within the configured window", async () => {
    const { estimatorLimiter } = await import("@/lib/ratelimit");
    const limiter = estimatorLimiter();
    const before = Date.now();
    const r = await limiter.check("key-reset-test");
    const after = Date.now();
    // Window is 60s; resetAt should be between now and now+60000 (inclusive-ish).
    expect(r.resetAt).toBeGreaterThanOrEqual(before);
    expect(r.resetAt).toBeLessThanOrEqual(after + 60_000);
  });

  it("blocked responses still report remaining=0 (never negative)", async () => {
    const { leadCaptureLimiter } = await import("@/lib/ratelimit");
    const limiter = leadCaptureLimiter();
    const key = "ip-negative-check";
    // Lead capture limit is 3 — blow past it.
    for (let i = 0; i < 10; i++) await limiter.check(key);
    const r = await limiter.check(key);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.remaining).not.toBeLessThan(0);
  });
});
