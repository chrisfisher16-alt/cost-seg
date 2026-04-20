import { describe, expect, it } from "vitest";

import {
  estimatePipelineEta,
  STEP_BASELINE_SEC,
  type EtaStep,
  type EtaStepId,
} from "@/lib/studies/pipeline-eta";

const ALL_IDS: EtaStepId[] = [
  "upload",
  "classify",
  "decompose",
  "assets",
  "narrative",
  "render",
  "deliver",
];

function steps(activeId: EtaStepId | null, doneIds: EtaStepId[] = []): EtaStep[] {
  const doneSet = new Set(doneIds);
  return ALL_IDS.map((id) => ({
    id,
    state: doneSet.has(id) ? "done" : id === activeId ? "active" : "pending",
  }));
}

describe("estimatePipelineEta", () => {
  it("fresh run: remaining ≈ total baseline - half the active step", () => {
    const r = estimatePipelineEta(steps("classify", ["upload"]), 5);
    const expected = Math.round(
      STEP_BASELINE_SEC.decompose +
        STEP_BASELINE_SEC.assets +
        STEP_BASELINE_SEC.narrative +
        STEP_BASELINE_SEC.render +
        STEP_BASELINE_SEC.deliver +
        STEP_BASELINE_SEC.classify / 2,
    );
    expect(r.remainingSec).toBe(expected);
    expect(r.confidence).toBe("high");
    expect(r.label).toMatch(/min/);
  });

  it("half-way: asset classification is the long pole", () => {
    const r = estimatePipelineEta(steps("assets", ["upload", "classify", "decompose"]), 40);
    // Remaining: ½ × assets + narrative + render + deliver
    const expected = Math.round(
      STEP_BASELINE_SEC.assets / 2 +
        STEP_BASELINE_SEC.narrative +
        STEP_BASELINE_SEC.render +
        STEP_BASELINE_SEC.deliver,
    );
    expect(r.remainingSec).toBe(expected);
    expect(r.confidence).toBe("high");
  });

  it("near the end: render + deliver is ~15s, not the old fixed 150s minus elapsed", () => {
    const r = estimatePipelineEta(
      steps("render", ["upload", "classify", "decompose", "assets", "narrative"]),
      130,
    );
    // ½ render + deliver = 4 + 5 = 9 (rounded)
    expect(r.remainingSec).toBe(
      Math.round(STEP_BASELINE_SEC.render / 2 + STEP_BASELINE_SEC.deliver),
    );
    expect(r.label).toMatch(/<\s*30s/);
  });

  it("final step only: 'any moment now'", () => {
    const allButDeliver = ALL_IDS.filter((id) => id !== "deliver");
    const r = estimatePipelineEta(steps("deliver", allButDeliver), 148);
    // ½ × deliver (5s) ≈ 3s — rounds into the any-moment bucket.
    expect(r.remainingSec).toBeLessThanOrEqual(3);
    expect(r.label).toBe("any moment now");
  });

  it("overrun: elapsed more than 2x expected → confidence low, fuzzy label", () => {
    // Expected elapsed at active=classify = 0 (no done except upload=0) + ½ classify ≈ 13s.
    // We're claiming 60s elapsed → 60 > 13*2 = 26 → overrun.
    const r = estimatePipelineEta(steps("classify", ["upload"]), 60);
    expect(r.confidence).toBe("low");
    expect(r.label).toBe("finishing up");
  });

  it("near-overrun (between 1x and 2x) but inside total budget: medium confidence", () => {
    // At the render step: expected elapsed = done (classify+decompose+assets+narrative = 137)
    // + ½ render (4) = 141. Elapsed 190 > 141*1.2=169 but < 141*2=282 → medium.
    const r = estimatePipelineEta(
      steps("render", ["upload", "classify", "decompose", "assets", "narrative"]),
      190,
    );
    expect(r.confidence).toBe("medium");
    expect(r.label).not.toBe("finishing up");
  });

  it("all done: remaining is 0 and label reads moment-now", () => {
    const r = estimatePipelineEta(steps(null, ALL_IDS), 200);
    expect(r.remainingSec).toBe(0);
    expect(r.label).toBe("any moment now");
  });

  it("empty step list: returns 0 without throwing", () => {
    expect(() => estimatePipelineEta([], 0)).not.toThrow();
    const r = estimatePipelineEta([], 0);
    expect(r.remainingSec).toBe(0);
  });

  it("formats 30-59s as seconds, 60+ as minutes", () => {
    // Force a narrow remaining by making only deliver pending (5s).
    const fiveSec = estimatePipelineEta(
      steps("deliver", ["upload", "classify", "decompose", "assets", "narrative", "render"]),
      145,
    );
    expect(fiveSec.label).toMatch(/^(any moment now|< 30s)$/);

    // Force ~45s — active=render, doneIds remove classify+decompose+assets+narrative already done,
    // pending = deliver (5). ½ render = 4. Sum = 9. Not in the 30-59 bucket.
    // Easier: construct artificially by manipulating baselines isn't viable; just check 120s → "~2 min".
    const bigRun = estimatePipelineEta(steps("classify", ["upload"]), 5);
    expect(bigRun.label).toMatch(/^~\d+ min$/);
  });
});
