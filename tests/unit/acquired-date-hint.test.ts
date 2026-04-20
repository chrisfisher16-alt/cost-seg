import { describe, expect, it } from "vitest";

import { acquiredDateHint } from "@/lib/studies/acquired-date-hint";

// Fixed clock: April 20, 2026. All tests run against this reference.
const NOW = Date.UTC(2026, 3, 20);

describe("acquiredDateHint", () => {
  it("empty string → empty", () => {
    const r = acquiredDateHint("", NOW);
    expect(r.kind).toBe("empty");
    expect(r.message).toBeNull();
  });

  it("garbage input → empty (no crash)", () => {
    expect(acquiredDateHint("not-a-date", NOW).kind).toBe("empty");
    expect(acquiredDateHint("2026/04/20", NOW).kind).toBe("empty");
    expect(acquiredDateHint("2026-13-01", NOW).kind).toBe("empty");
  });

  it("today → current-year, no message", () => {
    const r = acquiredDateHint("2026-04-20", NOW);
    expect(r.kind).toBe("current-year");
    expect(r.title).toBeNull();
    expect(r.message).toBeNull();
  });

  it("earlier this year → current-year, no warning", () => {
    const r = acquiredDateHint("2026-01-15", NOW);
    expect(r.kind).toBe("current-year");
  });

  it("last year → prior-year, singular 'last year' wording", () => {
    const r = acquiredDateHint("2025-06-10", NOW);
    expect(r.kind).toBe("prior-year");
    expect(r.title).toMatch(/last year/i);
    expect(r.message).toMatch(/form 3115/i);
    expect(r.message).toMatch(/§481\(a\)/);
    expect(r.message).toMatch(/appendix e/i);
  });

  it("three years ago → prior-year, pluralized count", () => {
    const r = acquiredDateHint("2023-03-15", NOW);
    expect(r.kind).toBe("prior-year");
    expect(r.title).toMatch(/3 tax years ago/);
  });

  it("future date → future, typo warning", () => {
    const r = acquiredDateHint("2027-01-15", NOW);
    expect(r.kind).toBe("future");
    expect(r.title).toMatch(/future/i);
    expect(r.message).toMatch(/typo/i);
  });

  it("future within same year → future (strict comparison, not year-only)", () => {
    // April 20 "now" — a December 2026 date is still in the future for today's view.
    const r = acquiredDateHint("2026-12-15", NOW);
    expect(r.kind).toBe("future");
  });

  it("December 31 prior year vs January 1 current year — boundary stays tight", () => {
    expect(acquiredDateHint("2025-12-31", NOW).kind).toBe("prior-year");
    expect(acquiredDateHint("2026-01-01", NOW).kind).toBe("current-year");
  });
});
