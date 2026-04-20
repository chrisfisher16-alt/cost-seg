import { describe, expect, it } from "vitest";

import { formatAgeSla, formatAgeTerse, hoursBetween } from "@/lib/studies/admin-age";

const NOW = new Date("2026-04-20T12:00:00Z").getTime();
const sec = (n: number) => NOW - n * 1000;
const min = (n: number) => NOW - n * 60 * 1000;
const hrs = (n: number) => NOW - n * 3600 * 1000;
const days = (n: number) => NOW - n * 86400 * 1000;

describe("formatAgeTerse", () => {
  it("seconds within the first minute", () => {
    expect(formatAgeTerse(sec(0), NOW)).toBe("0s");
    expect(formatAgeTerse(sec(5), NOW)).toBe("5s");
    expect(formatAgeTerse(sec(59), NOW)).toBe("59s");
  });

  it("minutes within the first hour", () => {
    expect(formatAgeTerse(min(1), NOW)).toBe("1m");
    expect(formatAgeTerse(min(5), NOW)).toBe("5m");
    expect(formatAgeTerse(min(59), NOW)).toBe("59m");
  });

  it("hours within the first day", () => {
    expect(formatAgeTerse(hrs(1), NOW)).toBe("1h");
    expect(formatAgeTerse(hrs(12), NOW)).toBe("12h");
    expect(formatAgeTerse(hrs(23), NOW)).toBe("23h");
  });

  it("whole-number days past 24h (no decimals)", () => {
    expect(formatAgeTerse(days(1), NOW)).toBe("1d");
    expect(formatAgeTerse(days(3), NOW)).toBe("3d");
    expect(formatAgeTerse(days(30), NOW)).toBe("30d");
  });

  it("clamps negative deltas (clock skew) to 0s", () => {
    expect(formatAgeTerse(NOW + 5000, NOW)).toBe("0s");
  });
});

describe("formatAgeSla", () => {
  it("drops seconds — rounds to nearest minute (Math.round semantics)", () => {
    expect(formatAgeSla(sec(29), NOW)).toBe("0m"); // 0.483m → 0
    expect(formatAgeSla(sec(30), NOW)).toBe("1m"); // 0.5m → 1 (half-up)
    expect(formatAgeSla(sec(59), NOW)).toBe("1m"); // 0.98m → 1
  });

  it("minutes within the first hour", () => {
    expect(formatAgeSla(min(15), NOW)).toBe("15m");
    expect(formatAgeSla(min(59), NOW)).toBe("59m");
  });

  it("hours within the first day", () => {
    expect(formatAgeSla(hrs(1), NOW)).toBe("1h");
    expect(formatAgeSla(hrs(23), NOW)).toBe("23h");
  });

  it("decimal days below 10 (SLA granularity matters at bucket boundary)", () => {
    // 3.2d and 3.8d are both in the "aging" bucket (3-5d), but the decimal
    // helps the admin see the first is closer to fresh, second closer to overdue.
    expect(formatAgeSla(hrs(3 * 24 + 5), NOW)).toBe("3.2d"); // 3.208d → 3.2d
    expect(formatAgeSla(hrs(3 * 24 + 19), NOW)).toBe("3.8d"); // 3.79d → 3.8d
  });

  it("whole-number days at 10+ (no decimals once past the bucket threshold)", () => {
    expect(formatAgeSla(days(10), NOW)).toBe("10d");
    expect(formatAgeSla(days(25), NOW)).toBe("25d");
  });

  it("clamps negative deltas (clock skew) to 0m", () => {
    expect(formatAgeSla(NOW + 5000, NOW)).toBe("0m");
  });
});

describe("hoursBetween", () => {
  it("returns non-negative hours as a float", () => {
    expect(hoursBetween(hrs(3), NOW)).toBe(3);
    expect(hoursBetween(min(90), NOW)).toBeCloseTo(1.5, 5);
  });

  it("clamps negative to 0", () => {
    expect(hoursBetween(NOW + 5000, NOW)).toBe(0);
  });
});
