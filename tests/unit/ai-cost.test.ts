import { describe, expect, it } from "vitest";

import { WEB_SEARCH_USD_PER_REQUEST, computeCostUsd, MODEL_RATES } from "@/lib/ai/cost";

describe("computeCostUsd", () => {
  it("prices an Opus 4.7 call correctly", () => {
    // 10_000 input @ $15/1M + 2_000 output @ $75/1M
    //  = 0.15 + 0.15 = 0.30
    expect(computeCostUsd("claude-opus-4-7", 10_000, 2_000)).toBeCloseTo(0.3, 6);
  });

  it("prices a Sonnet 4.6 call correctly", () => {
    // 50k in @ $3/1M + 5k out @ $15/1M = 0.15 + 0.075 = 0.225
    expect(computeCostUsd("claude-sonnet-4-6", 50_000, 5_000)).toBeCloseTo(0.225, 6);
  });

  it("returns 0 for unknown models (fail safe, not silent lie)", () => {
    expect(computeCostUsd("claude-unknown", 1000, 1000)).toBe(0);
  });

  it("exposes rates for every model we use in pipeline steps", () => {
    const expected = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
    for (const m of expected) {
      expect(MODEL_RATES[m]).toBeDefined();
      expect(MODEL_RATES[m].inputUsdPerMillion).toBeGreaterThan(0);
      expect(MODEL_RATES[m].outputUsdPerMillion).toBeGreaterThan(0);
    }
  });

  it("adds web_search billing when server-tool usage is reported", () => {
    // Opus 4.7 × 10k in / 2k out = $0.30 token cost; 50 searches × $0.01 = $0.50.
    expect(computeCostUsd("claude-opus-4-7", 10_000, 2_000, { webSearchRequests: 50 })).toBeCloseTo(
      0.3 + 0.5,
      6,
    );
  });

  it("falls back to zero extra cost when server-tool usage is absent", () => {
    expect(computeCostUsd("claude-opus-4-7", 10_000, 2_000)).toBeCloseTo(
      computeCostUsd("claude-opus-4-7", 10_000, 2_000, {}),
      6,
    );
  });

  it("bills web_search even when the model is unknown", () => {
    // Token cost = 0 (unknown model), but search cost still applies.
    expect(computeCostUsd("unknown", 99, 99, { webSearchRequests: 3 })).toBeCloseTo(
      3 * WEB_SEARCH_USD_PER_REQUEST,
      6,
    );
  });
});
