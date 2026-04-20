import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guard around `getStripe()` — confirms the SDK is constructed with the
 * Segra brand name in `appInfo`, not the legacy "cost-seg" npm slug.
 * `appInfo.name` is visible in Stripe's dashboard event log and billing
 * reports, so drift here shows up every time the operator reviews Stripe.
 *
 * Uses vi.mock to capture the Stripe constructor call without actually
 * instantiating an SDK client (Stripe tries network work eagerly).
 */

const stripeCtorSpy = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      constructor(key: string, config: { appInfo?: { name: string; version: string } }) {
        stripeCtorSpy(key, config);
      }
    },
  };
});

describe("getStripe()", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.STRIPE_SECRET_KEY;
    stripeCtorSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
  });

  it("passes BRAND.name (not 'cost-seg') as the Stripe appInfo name", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fakevalue";
    const { getStripe } = await import("@/lib/stripe/client");
    const { BRAND } = await import("@/lib/brand");
    getStripe();
    expect(stripeCtorSpy).toHaveBeenCalledOnce();
    const [key, config] = stripeCtorSpy.mock.calls[0] ?? [];
    expect(key).toBe("sk_test_fakevalue");
    expect(config.appInfo?.name).toBe(BRAND.name);
    expect(config.appInfo?.name).not.toBe("cost-seg");
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("@/lib/stripe/client");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});

describe("isStripeConfigured()", () => {
  const PRICE_KEYS = [
    "STRIPE_PRICE_ID_DIY",
    "STRIPE_PRICE_ID_TIER_1",
    "STRIPE_PRICE_ID_TIER_2",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.key = process.env.STRIPE_SECRET_KEY;
    for (const k of PRICE_KEYS) saved[k] = process.env[k];
    vi.resetModules();
  });

  afterEach(() => {
    if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved.key;
    for (const k of PRICE_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function setAll() {
    process.env.STRIPE_SECRET_KEY = "sk_test_ok";
    process.env.STRIPE_PRICE_ID_DIY = "price_diy";
    process.env.STRIPE_PRICE_ID_TIER_1 = "price_t1";
    process.env.STRIPE_PRICE_ID_TIER_2 = "price_t2";
  }

  it("is true when STRIPE_SECRET_KEY and every tier price id are set", async () => {
    setAll();
    const { isStripeConfigured } = await import("@/lib/stripe/client");
    expect(isStripeConfigured()).toBe(true);
  });

  it("is false when STRIPE_SECRET_KEY is missing", async () => {
    setAll();
    delete process.env.STRIPE_SECRET_KEY;
    const { isStripeConfigured } = await import("@/lib/stripe/client");
    expect(isStripeConfigured()).toBe(false);
  });

  it("is false when STRIPE_PRICE_ID_DIY is missing (regression: B3-1)", async () => {
    // Before this fix, isStripeConfigured only checked TIER_1/TIER_2, so a
    // deployment with DIY price unset passed the check, rendered the DIY
    // form, and failed at createCheckoutSession with a vague 500.
    setAll();
    delete process.env.STRIPE_PRICE_ID_DIY;
    const { isStripeConfigured } = await import("@/lib/stripe/client");
    expect(isStripeConfigured()).toBe(false);
  });

  it("is false when STRIPE_PRICE_ID_TIER_1 is missing", async () => {
    setAll();
    delete process.env.STRIPE_PRICE_ID_TIER_1;
    const { isStripeConfigured } = await import("@/lib/stripe/client");
    expect(isStripeConfigured()).toBe(false);
  });

  it("is false when STRIPE_PRICE_ID_TIER_2 is missing", async () => {
    setAll();
    delete process.env.STRIPE_PRICE_ID_TIER_2;
    const { isStripeConfigured } = await import("@/lib/stripe/client");
    expect(isStripeConfigured()).toBe(false);
  });
});
