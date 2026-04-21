import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * v2 Phase 7b (ADR 0013) — vision-model review of the rendered PDF.
 *
 * The review runs AFTER `renderAiReportPdf` produces the PDF buffer
 * and before `deliverAiReport` uploads/emails. Pages are rasterized
 * to PNGs upstream (slice 2) and handed to this prompt in batches of
 * ~8 at a time so a ~150-page study fits under Claude's context
 * ceiling in ~20 sequential calls.
 *
 * The rubric is VERSIONED next to the template — when
 * `AiReportTemplate.tsx` changes structurally, the reviewer's
 * expectations typically need to change in the same PR.
 */

export const REVIEW_REPORT_PROMPT_VERSION = "review-report@v1";

export const REVIEW_SEVERITY = ["blocker", "warning", "nit"] as const;
export const REVIEW_CATEGORY = ["layout", "content", "typography", "consistency"] as const;

export const REVIEW_REPORT_SYSTEM = `You are a quality-assurance reviewer for a cost-segregation study PDF. You see one or more rendered pages as images and produce a structured rubric of defects.

Severity scale:
  • blocker — MUST NOT ship. Examples: image overlaps body text so caption is unreadable; a line-item card is split in half across a page break; placeholder text like "TBD", "[insert here]", or "Not specified" appears in a delivered section; the disclosure footer ("Planning estimate, not an IRS-defensible study under Pub 5653.") is missing from a page; a section heading is the last line on a page with no body content below it (orphaned heading); an Appendix B line item is missing its photo AND its "Source: receipt" label; table columns are misaligned so totals don't line up; Executive Summary totals do not match Appendix D totals visible on screen.
  • warning — SHOULD fix before shipping but not fatal. Examples: prose reads awkwardly or has repeated phrasing; two consecutive pages are visually near-identical; a photo is very low-resolution and not legibly useful; a paragraph ends with fewer than 3 lines and its continuation starts on the next page.
  • nit — cosmetic. Examples: minor typography inconsistency (e.g. mixed em/en dash usage); inconsistent capitalization of an asset category label; one-off spacing irregularity that doesn't affect comprehension.

Category scale:
  • layout — anything about where things are placed: overlap, split blocks, cut-off text, orphaned heading, misaligned table column, photo sizing.
  • content — placeholder text visible, missing required field, missing disclosure, totals mismatch, factual contradiction.
  • typography — font-related: inconsistent weight, odd letter-spacing, unreadable size.
  • consistency — same concept rendered differently in two places; nomenclature drift.

Hard rules:
  • Output ONLY via the submit_review tool.
  • Every finding carries a page number (1-based, across the whole document as numbered in the page footer if visible, otherwise the 1-based index within THIS batch).
  • The \`suggestedFix\` is one short imperative sentence directed at whichever upstream step produced the defect. Examples: "Wrap the asset-card View in wrap={false} so it can't split." · "Re-run classify-assets-v2 with a priorAttemptError noting item 23 has no photo."
  • If you find zero defects on a page, that's fine — do not fabricate findings to fill the list.
  • Disclosure footer text to look for on every page: "Planning estimate, not an IRS-defensible study under Pub 5653."
  • Do NOT comment on spelling or grammar that would require knowing the study's private data. Focus on what the renderer emitted.`;

export interface ReviewReportUserContext {
  /** Human-readable study address — grounds the model's judgments. */
  address: string;
  /** 1-based page numbers for the images in this batch, in order. */
  pageNumbers: number[];
  /** Total pages across the whole document (so the model knows where it is). */
  totalPages: number;
  /** Optional free-text context (e.g. "v2 schedule with 34 photo-backed items"). */
  context?: string;
}

export function buildReviewReportUserPrompt(ctx: ReviewReportUserContext): string {
  const pageRange =
    ctx.pageNumbers.length === 1
      ? `page ${ctx.pageNumbers[0]}`
      : `pages ${ctx.pageNumbers[0]}–${ctx.pageNumbers[ctx.pageNumbers.length - 1]}`;
  const lines: string[] = [
    `Property: ${ctx.address}`,
    `Reviewing ${pageRange} of ${ctx.totalPages}.`,
  ];
  if (ctx.context) lines.push(`Context: ${ctx.context}`);
  lines.push(
    "",
    "Inspect each attached page image. Emit findings via submit_review. If the batch is clean, return findings=[].",
  );
  return lines.join("\n");
}

export const REVIEW_REPORT_TOOL: Anthropic.Messages.Tool = {
  name: "submit_review",
  description: "Record the layout + content review findings for a batch of PDF page images.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        maxItems: 200,
        items: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, maximum: 10_000 },
            severity: { type: "string", enum: [...REVIEW_SEVERITY] },
            category: { type: "string", enum: [...REVIEW_CATEGORY] },
            message: { type: "string", minLength: 1, maxLength: 600 },
            suggestedFix: { type: "string", minLength: 1, maxLength: 400 },
          },
          required: ["page", "severity", "category", "message", "suggestedFix"],
        },
      },
      /** Short summary — one sentence on overall shape of the batch. */
      summary: { type: "string", maxLength: 400 },
    },
    required: ["findings"],
  },
};

export const reviewFindingSchema = z.object({
  page: z.number().int().min(1).max(10_000),
  severity: z.enum(REVIEW_SEVERITY),
  category: z.enum(REVIEW_CATEGORY),
  message: z.string().min(1).max(600),
  suggestedFix: z.string().min(1).max(400),
});

export const reviewReportOutputSchema = z.object({
  findings: z.array(reviewFindingSchema).max(200),
  summary: z.string().max(400).optional(),
});

export type ReviewSeverity = (typeof REVIEW_SEVERITY)[number];
export type ReviewCategory = (typeof REVIEW_CATEGORY)[number];
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewReportOutput = z.infer<typeof reviewReportOutputSchema>;

/**
 * Convenience: true iff the batch contains any severity=blocker finding.
 * Callers use this to branch on whether to ship or feed back into an
 * upstream step.
 */
export function hasBlockers(output: ReviewReportOutput): boolean {
  return output.findings.some((f) => f.severity === "blocker");
}

/**
 * Convenience: true iff the batch contains at least one blocker whose
 * category indicates the upstream fix lives in the classifier
 * (content mismatch) vs. the template (layout).
 */
export function blockerTargetsClassifier(output: ReviewReportOutput): boolean {
  return output.findings.some((f) => f.severity === "blocker" && f.category === "content");
}
