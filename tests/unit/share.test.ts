import { describe, expect, it } from "vitest";

import { buildShareUrl, isAcceptedEmailMatch, normalizeEmail } from "@/lib/studies/share";

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
