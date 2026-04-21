import "server-only";

import { callTool, type AttachmentInput } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  REVIEW_REPORT_PROMPT_VERSION,
  REVIEW_REPORT_SYSTEM,
  REVIEW_REPORT_TOOL,
  buildReviewReportUserPrompt,
  reviewReportOutputSchema,
  type ReviewFinding,
  type ReviewReportOutput,
} from "@/lib/ai/prompts/review-report";

/**
 * v2 Phase 7b (ADR 0013) — vision-model review of PDF page images.
 *
 * This step is PURE: it accepts already-rasterized PNG buffers and
 * does the vision call. The caller (deliver.ts, slice 2) is
 * responsible for rasterizing the PDF — that decision lives upstream
 * because it needs a native dep (pdf-to-png-converter, @napi-rs/canvas,
 * or pdftoppm) whose choice hasn't been finalized. Keeping this step
 * pure lets us unit-test the vision contract today and plug in the
 * rasterizer later without touching the contract.
 */

/** One page of input to the reviewer — a 1-based page number plus its PNG bytes. */
export interface ReviewPageInput {
  pageNumber: number;
  png: Buffer;
}

export interface ReviewReportInput {
  studyId: string;
  /** Property address for grounding. */
  address: string;
  /** All pages of the document, in order. */
  pages: ReviewPageInput[];
  /** Free-text context (e.g. "v2 schedule with 34 photo-backed items"). */
  context?: string;
  /** Pages per vision call. Default 8; Anthropic's image count per call
   *  is bounded and ~8 keeps each call under the output-tokens budget. */
  batchSize?: number;
}

export interface ReviewReportResult {
  /** Flattened findings across every batch, in page order. */
  findings: ReviewFinding[];
  /** Per-batch summary sentences the model emitted, joined by newlines. */
  summary: string;
  /** Number of separate Anthropic calls this run issued. */
  batchCount: number;
}

export const DEFAULT_REVIEW_BATCH_SIZE = 8;

/**
 * Chunk `pages` into fixed-size batches; each batch becomes one Claude
 * call. Preserves 1-based page numbers across batches.
 */
export function chunkReviewBatches(
  pages: ReviewPageInput[],
  batchSize: number,
): ReviewPageInput[][] {
  if (batchSize <= 0) {
    throw new Error(`chunkReviewBatches: batchSize must be positive, got ${batchSize}`);
  }
  const batches: ReviewPageInput[][] = [];
  for (let i = 0; i < pages.length; i += batchSize) {
    batches.push(pages.slice(i, i + batchSize));
  }
  return batches;
}

export async function reviewReport(input: ReviewReportInput): Promise<ReviewReportResult> {
  const batchSize = input.batchSize ?? DEFAULT_REVIEW_BATCH_SIZE;
  const batches = chunkReviewBatches(input.pages, batchSize);
  const totalPages = input.pages.length;

  const allFindings: ReviewFinding[] = [];
  const summaries: string[] = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx += 1) {
    const batch = batches[batchIdx]!;
    const attachments: AttachmentInput[] = batch.map((page) => ({
      kind: "image" as const,
      mediaType: "image/png" as const,
      base64: page.png.toString("base64"),
      title: `Page ${page.pageNumber}`,
    }));
    const pageNumbers = batch.map((p) => p.pageNumber);

    const { output } = await callTool<ReviewReportOutput>({
      operation: `review-report:${input.studyId}:batch-${batchIdx}`,
      promptVersion: REVIEW_REPORT_PROMPT_VERSION,
      model: MODELS.reviewReport,
      system: REVIEW_REPORT_SYSTEM,
      userMessage: buildReviewReportUserPrompt({
        address: input.address,
        pageNumbers,
        totalPages,
        context: input.context,
      }),
      attachments,
      tool: REVIEW_REPORT_TOOL,
      outputSchema: reviewReportOutputSchema,
      // 8 pages × ~40 findings cap ≈ 320. 4096 tokens is more than
      // enough for the structured output.
      maxTokens: 4096,
      studyId: input.studyId,
      inputDetails: {
        batchIdx,
        batchCount: batches.length,
        pageNumbers,
      },
    });

    for (const finding of output.findings) allFindings.push(finding);
    if (output.summary) summaries.push(output.summary);
  }

  // Findings are already page-scoped within each batch; stable-sort by
  // page so ops reading the flat list sees them in document order.
  allFindings.sort((a, b) => a.page - b.page);

  return {
    findings: allFindings,
    summary: summaries.join("\n"),
    batchCount: batches.length,
  };
}
