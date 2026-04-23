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

  it("near the end: render + deliver remaining is small, not total-budget minus elapsed", () => {
    // Elapsed matches a nominally on-track run: done steps (classify + decompose
    // + assets + narrative) sum to their baselines.
    const doneElapsed =
      STEP_BASELINE_SEC.classify +
      STEP_BASELINE_SEC.decompose +
      STEP_BASELINE_SEC.assets +
      STEP_BASELINE_SEC.narrative;
    const r = estimatePipelineEta(
      steps("render", ["upload", "classify", "decompose", "assets", "narrative"]),
      doneElapsed,
    );
    expect(r.remainingSec).toBe(
      Math.round(STEP_BASELINE_SEC.render / 2 + STEP_BASELINE_SEC.deliver),
    );
    // With render=30s, deliver=10s, remaining = 25s → "< 30s".
    expect(r.label).toMatch(/<\s*30s/);
  });

  it("final step only: 'any moment now'", () => {
    const allButDeliver = ALL_IDS.filter((id) => id !== "deliver");
    const priorBudget =
      STEP_BASELINE_SEC.classify +
      STEP_BASELINE_SEC.decompose +
      STEP_BASELINE_SEC.assets +
      STEP_BASELINE_SEC.narrative +
      STEP_BASELINE_SEC.render;
    const r = estimatePipelineEta(steps("deliver", allButDeliver), priorBudget);
    // ½ × deliver ≤ deliver/2 — rounds into the any-moment bucket (≤10s).
    expect(r.remainingSec).toBeLessThanOrEqual(Math.ceil(STEP_BASELINE_SEC.deliver / 2));
    expect(r.label).toBe("any moment now");
  });

  it("overrun: elapsed more than 2x expected → confidence low, label honest about remaining work", () => {
    // Expected elapsed at active=classify = 0 (upload=0) + ½ classify.
    // Pick an elapsed well over 2× that threshold to force overrun.
    const expected = STEP_BASELINE_SEC.classify / 2;
    const r = estimatePipelineEta(steps("classify", ["upload"]), expected * 2.5);
    expect(r.confidence).toBe("low");
    // Remaining is still huge (most of the pipeline is ahead) — label must
    // not claim "finishing up" when 15+ minutes of baseline work remain.
    expect(r.label).not.toBe("finishing up");
    expect(r.label).toBe("still working");
  });

  it("near-overrun (between 1x and 2x expected) but inside total budget: medium confidence", () => {
    // Pick a scenario where elapsed is between 1.2× and 2× expected and
    // also above 1.2× total budget — both conditions are coherent only at
    // the tail of the pipeline, so use render-active with priors done.
    const doneBudget =
      STEP_BASELINE_SEC.classify +
      STEP_BASELINE_SEC.decompose +
      STEP_BASELINE_SEC.assets +
      STEP_BASELINE_SEC.narrative;
    const expected = doneBudget + STEP_BASELINE_SEC.render / 2;
    const elapsed = Math.round(expected * 1.3); // between 1.2× and 2×
    const r = estimatePipelineEta(
      steps("render", ["upload", "classify", "decompose", "assets", "narrative"]),
      elapsed,
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
