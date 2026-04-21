import { describe, expect, it } from "vitest";

import {
  REVIEW_CATEGORY,
  REVIEW_REPORT_PROMPT_VERSION,
  REVIEW_REPORT_SYSTEM,
  REVIEW_REPORT_TOOL,
  REVIEW_SEVERITY,
  blockerTargetsClassifier,
  buildReviewReportUserPrompt,
  hasBlockers,
  reviewReportOutputSchema,
} from "@/lib/ai/prompts/review-report";

describe("review-report prompt (v2 Phase 7b)", () => {
  it("stamps a stable prompt version", () => {
    expect(REVIEW_REPORT_PROMPT_VERSION).toBe("review-report@v1");
  });

  it("system prompt encodes the severity scale + forced tool-use path", () => {
    expect(REVIEW_REPORT_SYSTEM).toMatch(/severity scale/i);
    expect(REVIEW_REPORT_SYSTEM).toMatch(/blocker/);
    expect(REVIEW_REPORT_SYSTEM).toMatch(/warning/);
    expect(REVIEW_REPORT_SYSTEM).toMatch(/nit/);
    expect(REVIEW_REPORT_SYSTEM).toMatch(/submit_review/);
    // Disclosure-footer text must be explicitly quoted so the reviewer
    // looks for the exact string we render.
    expect(REVIEW_REPORT_SYSTEM).toMatch(/Planning estimate, not an IRS-defensible/);
  });

  it("vocabularies are deduplicated and non-empty", () => {
    expect(new Set(REVIEW_SEVERITY).size).toBe(REVIEW_SEVERITY.length);
    expect(new Set(REVIEW_CATEGORY).size).toBe(REVIEW_CATEGORY.length);
    expect(REVIEW_CATEGORY).toContain("layout");
    expect(REVIEW_CATEGORY).toContain("content");
  });

  it("tool schema requires every finding to carry page+severity+category+message+fix", () => {
    const toolSchema = REVIEW_REPORT_TOOL.input_schema as {
      properties: {
        findings: { items: { required: string[] } };
      };
    };
    expect(toolSchema.properties.findings.items.required).toEqual(
      expect.arrayContaining(["page", "severity", "category", "message", "suggestedFix"]),
    );
  });

  it("Zod schema accepts an empty findings list (clean batch)", () => {
    const ok = reviewReportOutputSchema.safeParse({ findings: [] });
    expect(ok.success).toBe(true);
  });

  it("Zod schema rejects an unknown severity", () => {
    const bad = reviewReportOutputSchema.safeParse({
      findings: [
        {
          page: 1,
          severity: "catastrophic", // not in enum
          category: "layout",
          message: "...",
          suggestedFix: "...",
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it("user prompt names a single page when only one image is in the batch", () => {
    const text = buildReviewReportUserPrompt({
      address: "207 S Edison St",
      pageNumbers: [12],
      totalPages: 150,
    });
    expect(text).toContain("page 12");
    expect(text).toContain("of 150");
    expect(text).toContain("207 S Edison St");
  });

  it("user prompt names a page range when multiple pages are batched", () => {
    const text = buildReviewReportUserPrompt({
      address: "A",
      pageNumbers: [12, 13, 14, 15],
      totalPages: 150,
      context: "v2 schedule with 34 photo-backed items",
    });
    expect(text).toContain("pages 12–15");
    expect(text).toContain("v2 schedule with 34 photo-backed items");
  });

  it("hasBlockers returns true iff any finding is severity=blocker", () => {
    expect(hasBlockers({ findings: [] })).toBe(false);
    expect(
      hasBlockers({
        findings: [
          { page: 1, severity: "nit", category: "typography", message: "m", suggestedFix: "f" },
        ],
      }),
    ).toBe(false);
    expect(
      hasBlockers({
        findings: [
          {
            page: 1,
            severity: "blocker",
            category: "content",
            message: "missing disclosure",
            suggestedFix: "add PageFooter to CoverPage",
          },
        ],
      }),
    ).toBe(true);
  });

  it("blockerTargetsClassifier returns true only for content blockers", () => {
    expect(
      blockerTargetsClassifier({
        findings: [
          {
            page: 1,
            severity: "blocker",
            category: "layout",
            message: "card split",
            suggestedFix: "wrap=false",
          },
        ],
      }),
    ).toBe(false);
    expect(
      blockerTargetsClassifier({
        findings: [
          {
            page: 10,
            severity: "blocker",
            category: "content",
            message: "placeholder visible",
            suggestedFix: "re-run classify-assets-v2",
          },
        ],
      }),
    ).toBe(true);
  });
});
