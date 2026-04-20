import { describe, expect, it } from "vitest";

import { classifyFailure } from "@/lib/studies/failure-reason";

describe("classifyFailure", () => {
  it("Step A CD-not-found → missing-document with guided copy", () => {
    const r = classifyFailure(
      "Step A did not identify a closing disclosure among the uploaded documents.",
      "abc12345-6789-...",
    );
    expect(r.category).toBe("missing-document");
    expect(r.title).toMatch(/couldn't find your closing disclosure/i);
    expect(r.explanation).toMatch(/redacted/i);
    expect(r.recovery).toMatch(/one business day/i);
    expect(r.recovery).toMatch(/haven't been charged/i);
    expect(r.supportSubject).toContain("abc12345");
  });

  it("Step C unbalanced schedule → unbalanced-schedule with engineer-review copy", () => {
    const r = classifyFailure(
      "Step C could not produce a balanced schedule after 2 attempts: totals drift by $47",
    );
    expect(r.category).toBe("unbalanced-schedule");
    expect(r.title).toMatch(/didn't reconcile/i);
    expect(r.recovery).toMatch(/engineer/i);
    expect(r.recovery).toMatch(/two business days/i);
  });

  it("admin-typed reason (not 'Step ...') → admin-flagged, surfaces the reason verbatim", () => {
    const r = classifyFailure(
      "Closing disclosure appears redacted; unable to classify basis.",
      "xyz00000-1111",
    );
    expect(r.category).toBe("admin-flagged");
    expect(r.explanation).toContain("redacted");
    expect(r.recovery).toMatch(/refund/i);
    expect(r.supportSubject).toContain("xyz00000");
  });

  it("empty / null / undefined reason → generic with safe fallback copy", () => {
    for (const input of [null, undefined, "", "   "]) {
      const r = classifyFailure(input);
      expect(r.category).toBe("generic");
      expect(r.title).toMatch(/couldn't finish your report/i);
      expect(r.explanation).toBeTruthy();
      expect(r.recovery).toMatch(/refunded/i);
    }
  });

  it("unknown Step X reason → generic, carries the reason into the explanation", () => {
    const r = classifyFailure("Step X hit a novel explosion we haven't seen yet.");
    expect(r.category).toBe("generic");
    expect(r.explanation).toContain("novel explosion");
  });

  it("support subject includes only the short id prefix (no full UUID)", () => {
    const r = classifyFailure(
      "Step A did not identify a closing disclosure.",
      "abcdef12-3456-7890-abcd-ef1234567890",
    );
    expect(r.supportSubject).toContain("abcdef12");
    expect(r.supportSubject).not.toContain("ef1234567890");
  });

  it("no studyId → subject omits the id portion entirely", () => {
    const r = classifyFailure("Step C asset balance drift");
    expect(r.supportSubject).toBe("Cost Seg — unbalanced asset schedule");
  });
});
