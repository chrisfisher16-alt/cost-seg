import { describe, expect, it } from "vitest";

import {
  buildShareUrl,
  formatShareCooldown,
  isAcceptedEmailMatch,
  normalizeEmail,
} from "@/lib/studies/share";

describe("buildShareUrl", () => {
  it("concatenates the token onto the app origin", () => {
    expect(buildShareUrl("abc123", "https://segra.tax")).toBe("https://segra.tax/share/abc123");
  });

  it("strips a trailing slash from the app URL to avoid double slashes", () => {
    expect(buildShareUrl("abc123", "https://segra.tax/")).toBe("https://segra.tax/share/abc123");
  });

  it("handles localhost in dev", () => {
    expect(buildShareUrl("tok", "http://localhost:3000")).toBe("http://localhost:3000/share/tok");
  });
});

describe("normalizeEmail", () => {
  it("lowercases + trims", () => {
    expect(normalizeEmail("  CPA@Firm.COM  ")).toBe("cpa@firm.com");
  });

  it("is a no-op on already-canonical input", () => {
    expect(normalizeEmail("cpa@firm.com")).toBe("cpa@firm.com");
  });
});

describe("isAcceptedEmailMatch", () => {
  // Regression for B4-1: `acceptShareByToken` previously computed the
  // match inside an empty `if` block so the result was discarded.
  // We now audit the flag on the `share.accepted` StudyEvent payload; the
  // helper must be symmetric + case/whitespace insensitive.

  it("matches exact canonical emails", () => {
    expect(isAcceptedEmailMatch("cpa@firm.com", "cpa@firm.com")).toBe(true);
  });

  it("matches across whitespace and case drift", () => {
    expect(isAcceptedEmailMatch("CPA@Firm.com", "  cpa@firm.com  ")).toBe(true);
    expect(isAcceptedEmailMatch("  cpa@firm.com  ", "CPA@FIRM.COM")).toBe(true);
  });

  it("returns false for different addresses", () => {
    expect(isAcceptedEmailMatch("invited@firm.com", "other@firm.com")).toBe(false);
  });

  it("returns false when invitedEmail is null/undefined (cannot match)", () => {
    expect(isAcceptedEmailMatch(null, "cpa@firm.com")).toBe(false);
    expect(isAcceptedEmailMatch(undefined, "cpa@firm.com")).toBe(false);
  });

  it("rejects near-misses that might otherwise slip past a loose compare", () => {
    // Same local-part, different domain.
    expect(isAcceptedEmailMatch("cpa@firm.com", "cpa@firm.co")).toBe(false);
    // Prefix match only.
    expect(isAcceptedEmailMatch("cpa@firm.com", "cpa-extra@firm.com")).toBe(false);
  });
});

describe("formatShareCooldown", () => {
  // Regression for B4-2: the prior label computed `Math.ceil(sec/60) + "m"`
  // unconditionally. For a 30-second cooldown it read "Try again in 1m" but
  // re-enabled the button after 30s — the label and the actual wait never
  // matched within the same minute.

  it("shows raw seconds under 60s", () => {
    expect(formatShareCooldown(1)).toBe("1s");
    expect(formatShareCooldown(30)).toBe("30s");
    expect(formatShareCooldown(59)).toBe("59s");
  });

  it("switches to minutes at 60s and rounds UP (never under-promises)", () => {
    expect(formatShareCooldown(60)).toBe("1m");
    expect(formatShareCooldown(61)).toBe("2m"); // 1:01 → 2m, not 1m
    expect(formatShareCooldown(120)).toBe("2m");
    expect(formatShareCooldown(121)).toBe("3m");
    expect(formatShareCooldown(3600)).toBe("60m");
  });

  it("clamps zero and negative inputs to '0s'", () => {
    expect(formatShareCooldown(0)).toBe("0s");
    expect(formatShareCooldown(-5)).toBe("0s");
  });

  it("ceils fractional seconds (matches the one-second tick)", () => {
    // The state is ticked once per second, but the rate-limit resetAt can
    // produce fractional deltas when first computed — ceil keeps the label
    // honest.
    expect(formatShareCooldown(0.1)).toBe("1s");
    expect(formatShareCooldown(59.9)).toBe("1m"); // 60 → minute branch
  });
});
