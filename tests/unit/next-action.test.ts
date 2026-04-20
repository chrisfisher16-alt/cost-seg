import { describe, expect, it } from "vitest";

import {
  computeNextAction,
  formatRelativeAge,
  STUCK_AWAITING_DOCS_HOURS,
  STUCK_AWAITING_ENGINEER_HOURS,
} from "@/lib/studies/next-action";

const NOW = Date.UTC(2026, 3, 19, 12, 0, 0); // fixed clock for every case
const hoursAgo = (h: number) => NOW - h * 3_600_000;

describe("computeNextAction", () => {
  it("tells pending-payment customers to complete checkout", () => {
    const result = computeNextAction({
      status: "PENDING_PAYMENT",
      tier: "AI_REPORT",
      updatedAtMs: hoursAgo(1),
      nowMs: NOW,
    });
    expect(result.tone).toBe("primary");
    expect(result.userOwned).toBe(true);
    expect(result.hint).toMatch(/checkout/i);
  });

  it("AWAITING_DOCUMENTS fresh: friendly primary-toned prompt", () => {
    const result = computeNextAction({
      status: "AWAITING_DOCUMENTS",
      tier: "AI_REPORT",
      updatedAtMs: hoursAgo(12),
      nowMs: NOW,
      missingRequiredDocs: 2,
    });
    expect(result.tone).toBe("primary");
    expect(result.hint).toMatch(/2 required/i);
    expect(result.hint).not.toMatch(/waiting|ping/i);
  });

  it("AWAITING_DOCUMENTS past the stuck threshold: warning tone + days", () => {
    const result = computeNextAction({
      status: "AWAITING_DOCUMENTS",
      tier: "AI_REPORT",
      updatedAtMs: hoursAgo(STUCK_AWAITING_DOCS_HOURS + 24),
      nowMs: NOW,
      missingRequiredDocs: 1,
    });
    expect(result.tone).toBe("warning");
    expect(result.hint).toMatch(/Waiting 4d/i);
  });

  it("AWAITING_DOCUMENTS on DIY tier: guides on basis entry, not uploads", () => {
    const fresh = computeNextAction({
      status: "AWAITING_DOCUMENTS",
      tier: "DIY",
      updatedAtMs: hoursAgo(1),
      nowMs: NOW,
    });
    expect(fresh.hint).toMatch(/basis/i);
    expect(fresh.hint).not.toMatch(/upload/i);
    expect(fresh.tone).toBe("primary");

    const stuck = computeNextAction({
      status: "AWAITING_DOCUMENTS",
      tier: "DIY",
      updatedAtMs: hoursAgo(STUCK_AWAITING_DOCS_HOURS + 1),
      nowMs: NOW,
    });
    expect(stuck.tone).toBe("warning");
  });

  it("PROCESSING: muted, not user-owned", () => {
    const result = computeNextAction({
      status: "PROCESSING",
      tier: "AI_REPORT",
      updatedAtMs: hoursAgo(0.2),
      nowMs: NOW,
    });
    expect(result.tone).toBe("muted");
    expect(result.userOwned).toBe(false);
  });

  it("AWAITING_ENGINEER inside the 7-day window: muted 'awaiting PE' copy", () => {
    const result = computeNextAction({
      status: "AWAITING_ENGINEER",
      tier: "ENGINEER_REVIEWED",
      updatedAtMs: hoursAgo(72),
      nowMs: NOW,
    });
    expect(result.tone).toBe("muted");
    expect(result.hint).toMatch(/3–7 business days/);
  });

  it("AWAITING_ENGINEER past 7 days: warning + 'running long'", () => {
    const result = computeNextAction({
      status: "AWAITING_ENGINEER",
      tier: "ENGINEER_REVIEWED",
      updatedAtMs: hoursAgo(STUCK_AWAITING_ENGINEER_HOURS + 12),
      nowMs: NOW,
    });
    expect(result.tone).toBe("warning");
    expect(result.hint).toMatch(/running long/i);
  });

  it("DELIVERED formats the age: today / yesterday / N days ago", () => {
    expect(
      computeNextAction({
        status: "DELIVERED",
        tier: "AI_REPORT",
        updatedAtMs: hoursAgo(2),
        nowMs: NOW,
      }).hint,
    ).toMatch(/today/i);

    expect(
      computeNextAction({
        status: "DELIVERED",
        tier: "AI_REPORT",
        updatedAtMs: hoursAgo(26),
        nowMs: NOW,
      }).hint,
    ).toMatch(/yesterday/i);

    expect(
      computeNextAction({
        status: "DELIVERED",
        tier: "AI_REPORT",
        updatedAtMs: hoursAgo(24 * 5),
        nowMs: NOW,
      }).hint,
    ).toMatch(/5 days ago/i);
  });

  it("FAILED surfaces destructive tone", () => {
    const result = computeNextAction({
      status: "FAILED",
      tier: "AI_REPORT",
      updatedAtMs: hoursAgo(1),
      nowMs: NOW,
    });
    expect(result.tone).toBe("destructive");
  });
});

describe("formatRelativeAge", () => {
  it("covers seconds through months", () => {
    expect(formatRelativeAge(NOW - 30_000, NOW)).toBe("just now");
    expect(formatRelativeAge(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(formatRelativeAge(NOW - 60 * 60_000, NOW)).toBe("1 hour ago");
    expect(formatRelativeAge(NOW - 4 * 60 * 60_000, NOW)).toBe("4 hours ago");
    expect(formatRelativeAge(NOW - 24 * 60 * 60_000, NOW)).toBe("1 day ago");
    expect(formatRelativeAge(NOW - 5 * 24 * 60 * 60_000, NOW)).toBe("5 days ago");
    expect(formatRelativeAge(NOW - 60 * 24 * 60 * 60_000, NOW)).toBe("2 months ago");
  });

  it("never renders negative ages for clock skew", () => {
    expect(formatRelativeAge(NOW + 1000, NOW)).toBe("just now");
  });

  it("switches to absolute month+year past 12 months", () => {
    // NOW is pinned in the test file; walk back ~15 months from NOW and
    // assert the helper falls back to "<Mon> <YYYY>" format.
    const fifteenMonthsAgoMs = NOW - 15 * 30 * 24 * 60 * 60 * 1000;
    const formatted = formatRelativeAge(fifteenMonthsAgoMs, NOW);
    // Matches e.g. "Jan 2025" / "Feb 2025" — three-letter month + year.
    expect(formatted).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    expect(formatted).not.toMatch(/months ago/);
  });

  it("still uses relative phrasing at exactly 11 months", () => {
    const elevenMonthsAgoMs = NOW - 11 * 30 * 24 * 60 * 60 * 1000;
    expect(formatRelativeAge(elevenMonthsAgoMs, NOW)).toBe("11 months ago");
  });

  it("switches to absolute right at the 12-month boundary", () => {
    const twelveMonthsAgoMs = NOW - 12 * 30 * 24 * 60 * 60 * 1000;
    const formatted = formatRelativeAge(twelveMonthsAgoMs, NOW);
    expect(formatted).not.toMatch(/months ago/);
    expect(formatted).toMatch(/\d{4}$/);
  });
});
