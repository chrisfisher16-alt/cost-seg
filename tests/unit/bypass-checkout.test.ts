import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { promoBypassEnabled, promoCodeMatches } from "@/lib/studies/bypass-checkout";

/**
 * Guards for the `FISHER_PROMO_CODE` envelope around the Stripe-bypass path.
 *
 * The bypass lets the founder spin up studies without touching Stripe; it must
 * be DISABLED by default (env unset) and a supplied code must match
 * byte-for-byte modulo trim + lowercase. Compare is done via
 * `crypto.timingSafeEqual` so a byte-by-byte `===` can't leak the secret's
 * prefix under timing analysis. See ADR 0002 + master-prompt §5.1.
 */

describe("promoBypassEnabled", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.FISHER_PROMO_CODE;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.FISHER_PROMO_CODE;
    else process.env.FISHER_PROMO_CODE = saved;
  });

  it("is false when the env var is unset", () => {
    delete process.env.FISHER_PROMO_CODE;
    expect(promoBypassEnabled()).toBe(false);
  });

  it("is false when the env var is empty string", () => {
    process.env.FISHER_PROMO_CODE = "";
    expect(promoBypassEnabled()).toBe(false);
  });

  it("is false when the env var is only whitespace", () => {
    process.env.FISHER_PROMO_CODE = "   ";
    expect(promoBypassEnabled()).toBe(false);
  });

  it("is true when a non-empty value is set", () => {
    process.env.FISHER_PROMO_CODE = "letmein";
    expect(promoBypassEnabled()).toBe(true);
  });
});

describe("promoCodeMatches", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.FISHER_PROMO_CODE;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.FISHER_PROMO_CODE;
    else process.env.FISHER_PROMO_CODE = saved;
  });

  it("never matches when FISHER_PROMO_CODE is unset, even if user sends the empty string", () => {
    delete process.env.FISHER_PROMO_CODE;
    expect(promoCodeMatches("")).toBe(false);
    expect(promoCodeMatches("anything")).toBe(false);
  });

  it("matches the expected code exactly", () => {
    process.env.FISHER_PROMO_CODE = "CorrectHorseBatteryStaple";
    expect(promoCodeMatches("CorrectHorseBatteryStaple")).toBe(true);
  });

  it("is case-insensitive and trim-safe", () => {
    process.env.FISHER_PROMO_CODE = "LetMeIn";
    expect(promoCodeMatches("letmein")).toBe(true);
    expect(promoCodeMatches("  LETMEIN  ")).toBe(true);
  });

  it("rejects a near-miss (one byte off)", () => {
    process.env.FISHER_PROMO_CODE = "letmein";
    expect(promoCodeMatches("letmeix")).toBe(false);
  });

  it("rejects length mismatches without throwing (timingSafeEqual would otherwise throw)", () => {
    process.env.FISHER_PROMO_CODE = "letmein";
    expect(() => promoCodeMatches("letme")).not.toThrow();
    expect(promoCodeMatches("letme")).toBe(false);
    expect(promoCodeMatches("letmein-extra")).toBe(false);
  });

  it("rejects the empty string even if the env var is set", () => {
    process.env.FISHER_PROMO_CODE = "letmein";
    expect(promoCodeMatches("")).toBe(false);
    expect(promoCodeMatches("   ")).toBe(false);
  });
});
