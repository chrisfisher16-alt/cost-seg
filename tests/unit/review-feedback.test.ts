import { describe, expect, it } from "vitest";

import type { ReviewFinding } from "@/lib/ai/prompts/review-report";
import {
  REVIEW_RETRY_CAP,
  decideNextAction,
  formatFindingsAsClassifierHint,
  formatFindingsAsLayoutHint,
  partitionFindings,
} from "@/lib/studies/review-feedback";

function mk(
  overrides: Partial<ReviewFinding> & Pick<ReviewFinding, "severity" | "category">,
): ReviewFinding {
  return {
    page: 1,
    message: "m",
    suggestedFix: "f",
    ...overrides,
  };
}

describe("partitionFindings", () => {
  it("splits by severity and, within blockers, by layout vs. content", () => {
    const findings: ReviewFinding[] = [
      mk({ severity: "blocker", category: "layout", page: 3 }),
      mk({ severity: "blocker", category: "content", page: 5 }),
      mk({ severity: "blocker", category: "typography", page: 7 }),
      mk({ severity: "warning", category: "layout", page: 9 }),
      mk({ severity: "nit", category: "consistency", page: 11 }),
    ];
    const p = partitionFindings(findings);
    expect(p.layoutBlockers.map((f) => f.page)).toEqual([3]);
    expect(p.contentBlockers.map((f) => f.page)).toEqual([5]);
    expect(p.otherBlockers.map((f) => f.page)).toEqual([7]);
    expect(p.warnings.map((f) => f.page)).toEqual([9]);
    expect(p.nits.map((f) => f.page)).toEqual([11]);
  });

  it("returns five empty arrays for no findings", () => {
    const p = partitionFindings([]);
    expect(p.layoutBlockers).toEqual([]);
    expect(p.contentBlockers).toEqual([]);
    expect(p.otherBlockers).toEqual([]);
    expect(p.warnings).toEqual([]);
    expect(p.nits).toEqual([]);
  });
});

describe("formatFindingsAsClassifierHint", () => {
  it("returns empty string when no content blockers are present", () => {
    expect(formatFindingsAsClassifierHint([])).toBe("");
    expect(formatFindingsAsClassifierHint([mk({ severity: "blocker", category: "layout" })])).toBe(
      "",
    );
    expect(formatFindingsAsClassifierHint([mk({ severity: "warning", category: "content" })])).toBe(
      "",
    );
  });

  it("formats each content blocker with page + message + suggestedFix", () => {
    const hint = formatFindingsAsClassifierHint([
      mk({
        severity: "blocker",
        category: "content",
        page: 42,
        message: "placeholder 'TBD' visible",
        suggestedFix: "re-run classify-assets-v2 so item 23 has a real description",
      }),
    ]);
    expect(hint).toMatch(/Page 42: placeholder 'TBD' visible/);
    expect(hint).toMatch(/re-run classify-assets-v2/);
    expect(hint).toMatch(/automated QA pass/);
  });

  it("switches between singular and plural phrasing in the preamble", () => {
    const one = formatFindingsAsClassifierHint([mk({ severity: "blocker", category: "content" })]);
    expect(one).toMatch(/one blocker was/);

    const many = formatFindingsAsClassifierHint([
      mk({ severity: "blocker", category: "content", page: 1 }),
      mk({ severity: "blocker", category: "content", page: 2 }),
    ]);
    expect(many).toMatch(/2 blockers were/);
  });
});

describe("formatFindingsAsLayoutHint", () => {
  it("returns empty string when no layout blockers are present", () => {
    expect(formatFindingsAsLayoutHint([])).toBe("");
    expect(formatFindingsAsLayoutHint([mk({ severity: "blocker", category: "content" })])).toBe("");
  });

  it("formats each layout blocker with page + message + suggestedFix", () => {
    const hint = formatFindingsAsLayoutHint([
      mk({
        severity: "blocker",
        category: "layout",
        page: 13,
        message: "asset card split across page break",
        suggestedFix: "wrap={false} on AssetDetailCard root View",
      }),
    ]);
    expect(hint).toMatch(/Page 13: asset card split/);
    expect(hint).toMatch(/wrap=\{false\}/);
    expect(hint).toMatch(/before re-rendering/);
  });
});

describe("decideNextAction", () => {
  it("ships clean when findings is empty", () => {
    const action = decideNextAction([], 0);
    expect(action.kind).toBe("ship");
    if (action.kind === "ship") expect(action.reason).toBe("clean");
  });

  it("ships with warnings-only reason when no blockers but some warnings", () => {
    const action = decideNextAction([mk({ severity: "warning", category: "typography" })], 0);
    expect(action.kind).toBe("ship");
    if (action.kind === "ship") expect(action.reason).toBe("warnings-only");
  });

  it("prefers retry-classifier when any blocker is content (content beats layout)", () => {
    const findings: ReviewFinding[] = [
      mk({
        severity: "blocker",
        category: "layout",
        page: 1,
        message: "split card",
        suggestedFix: "wrap=false",
      }),
      mk({
        severity: "blocker",
        category: "content",
        page: 2,
        message: "placeholder",
        suggestedFix: "re-run classifier",
      }),
    ];
    const action = decideNextAction(findings, 0);
    expect(action.kind).toBe("retry-classifier");
    if (action.kind === "retry-classifier") {
      expect(action.attempt).toBe(1);
      expect(action.priorAttemptError).toMatch(/placeholder/);
    }
  });

  it("uses retry-render when only layout blockers are present", () => {
    const findings: ReviewFinding[] = [
      mk({
        severity: "blocker",
        category: "layout",
        page: 3,
        message: "orphan heading",
        suggestedFix: "add minPresenceAhead",
      }),
    ];
    const action = decideNextAction(findings, 1);
    expect(action.kind).toBe("retry-render");
    if (action.kind === "retry-render") {
      expect(action.attempt).toBe(2);
      expect(action.reviewHints).toMatch(/orphan heading/);
    }
  });

  it("ships with retry-cap-reached when blockers are present but attempts are exhausted", () => {
    const findings: ReviewFinding[] = [mk({ severity: "blocker", category: "content", page: 1 })];
    const action = decideNextAction(findings, REVIEW_RETRY_CAP);
    expect(action.kind).toBe("ship");
    if (action.kind === "ship") expect(action.reason).toBe("retry-cap-reached");
  });

  it("exposes the retry cap from the spec (2)", () => {
    expect(REVIEW_RETRY_CAP).toBe(2);
  });
});
