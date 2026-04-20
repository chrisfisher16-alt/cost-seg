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
