import { describe, expect, it } from "vitest";

import {
  BALANCE_TOLERANCE,
  checkBalance,
  formatBalanceErrorForRetry,
  totalLineItems,
} from "@/lib/ai/validator";
import type { ClassifyAssetsOutput } from "@/lib/ai/prompts/classify-assets";

function makeSchedule(amounts: number[]): ClassifyAssetsOutput {
  return {
    lineItems: amounts.map((amountCents, i) => ({
      category: "27_5yr" as const,
      name: `Item ${i}`,
      amountCents,
      basis: "percentage_of_building" as const,
      percentOfBuilding: 0.1,
      rationale: "placeholder rationale",
    })),
    assumptions: "",
  };
}

describe("totalLineItems", () => {
  it("sums amountCents", () => {
    expect(totalLineItems(makeSchedule([100, 200, 300]).lineItems)).toBe(600);
  });
});

describe("checkBalance", () => {
  it("accepts exact match", () => {
    const r = checkBalance(makeSchedule([1000, 2000, 7000]), 10000);
    expect(r.ok).toBe(true);
    expect(r.diffCents).toBe(0);
    expect(r.diffPct).toBe(0);
  });

  it("accepts within 0.5% tolerance", () => {
    // expected 200_000; schedule totals 200_900 -> 0.45% off
    const r = checkBalance(makeSchedule([100_000, 100_900]), 200_000);
    expect(r.ok).toBe(true);
    expect(r.diffPct).toBeLessThanOrEqual(BALANCE_TOLERANCE);
  });

  it("rejects outside tolerance with a useful message", () => {
    // 5% off
    const r = checkBalance(makeSchedule([105_000]), 100_000);
    expect(r.ok).toBe(false);
    expect(r.diffPct).toBeGreaterThan(BALANCE_TOLERANCE);
    expect(r.message).toContain("5000 cents");
    expect(r.message?.toLowerCase()).toContain("redistribute");
  });

  it("formats the retry-context error from a failing balance", () => {
    const r = checkBalance(makeSchedule([50_000]), 100_000);
    expect(r.ok).toBe(false);
    const message = formatBalanceErrorForRetry(r);
    expect(message).toBeTruthy();
    expect(message).toContain("off by");
  });

  it("returns empty string when balance is ok", () => {
    const r = checkBalance(makeSchedule([100_000]), 100_000);
    expect(formatBalanceErrorForRetry(r)).toBe("");
  });
});
