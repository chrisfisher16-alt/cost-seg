import type { ReviewFinding } from "@/lib/ai/prompts/review-report";

/**
 * v2 Phase 7 slice 3 (ADR 0013) — contract for the review → upstream
 * feedback loop. Slice 2 BLOCKS delivery when blockers are present;
 * slice 3 will auto-retry by threading these formatted hints back
 * into the upstream step that most likely produced each defect.
 *
 * This module is the pure formatter. The loop orchestrator (not
 * landed yet — will live in `deliver-ai-report` Inngest fn or a new
 * `rerun-on-review-failure` fn) consumes these strings via
 * `classify-assets-v2`'s `priorAttemptError` and a to-be-added
 * template-hint prop.
 *
 * Separating the contract from the orchestration lets slice 3 land
 * without re-reading the review prompt or re-inventing the severity
 * taxonomy; if a future Phase changes the finding shape, this is
 * the single place to update the feedback.
 */

/**
 * Partition findings into the two upstream owners. Layout blockers
 * are the template's problem (wrap, minPresenceAhead, image sizing);
 * content blockers are the classifier's problem (placeholder text,
 * missing photo, totals mismatch).
 *
 * Non-layout/content categories (typography, consistency) stay
 * unassigned — they rarely escalate to blockers, and a fix for them
 * is usually manual.
 */
export interface PartitionedFindings {
  layoutBlockers: ReviewFinding[];
  contentBlockers: ReviewFinding[];
  warnings: ReviewFinding[];
  nits: ReviewFinding[];
  /** Blockers whose category is neither layout nor content. */
  otherBlockers: ReviewFinding[];
}

export function partitionFindings(findings: ReviewFinding[]): PartitionedFindings {
  const partitioned: PartitionedFindings = {
    layoutBlockers: [],
    contentBlockers: [],
    warnings: [],
    nits: [],
    otherBlockers: [],
  };
  for (const f of findings) {
    if (f.severity === "warning") {
      partitioned.warnings.push(f);
      continue;
    }
    if (f.severity === "nit") {
      partitioned.nits.push(f);
      continue;
    }
    // severity === "blocker"
    if (f.category === "layout") {
      partitioned.layoutBlockers.push(f);
    } else if (f.category === "content") {
      partitioned.contentBlockers.push(f);
    } else {
      partitioned.otherBlockers.push(f);
    }
  }
  return partitioned;
}

/**
 * Format content blockers as a prose paragraph suitable for
 * classify-assets-v2's `priorAttemptError` field. The prompt is
 * instructed to "fix the specific issues cited and re-emit the full
 * schedule" — this text is what it reads.
 *
 * Returns an empty string when there are no content blockers, so
 * callers can use it as a falsy test.
 */
export function formatFindingsAsClassifierHint(findings: ReviewFinding[]): string {
  const { contentBlockers } = partitionFindings(findings);
  if (contentBlockers.length === 0) return "";
  const lines: string[] = [
    `The previously-generated asset schedule was reviewed by an automated QA pass and ${contentBlockers.length === 1 ? "one blocker was" : `${contentBlockers.length} blockers were`} found that require re-classification. Address each by adjusting the line items, not by suppressing the review.`,
    "",
  ];
  for (const f of contentBlockers) {
    lines.push(`• Page ${f.page}: ${f.message} — ${f.suggestedFix}`);
  }
  return lines.join("\n");
}

/**
 * Format layout blockers as a list of rendering hints the PDF
 * template consumes via an optional `reviewHints` prop (slice 3
 * template plumbing). Slice 2 doesn't yet read this; the string is
 * also safe to stash in an AiAuditLog input for debugging.
 */
export function formatFindingsAsLayoutHint(findings: ReviewFinding[]): string {
  const { layoutBlockers } = partitionFindings(findings);
  if (layoutBlockers.length === 0) return "";
  const lines: string[] = [
    `PDF render review found ${layoutBlockers.length === 1 ? "a layout blocker" : `${layoutBlockers.length} layout blockers`} on the previous attempt. Tighten the template before re-rendering:`,
    "",
  ];
  for (const f of layoutBlockers) {
    lines.push(`• Page ${f.page}: ${f.message} — ${f.suggestedFix}`);
  }
  return lines.join("\n");
}

/**
 * Retry cap — matches the master prompt's "retry cap of 2". Exposed
 * as a constant so the orchestrator and its tests agree on the same
 * ceiling.
 */
export const REVIEW_RETRY_CAP = 2;

/**
 * Given the current attempt counter and a set of findings, decide
 * what the orchestrator should do next. Pure — orchestrator applies
 * the side effects.
 */
export type NextAction =
  /** Ship the PDF (findings are fine or exhausted). */
  | { kind: "ship"; reason: "clean" | "warnings-only" | "retry-cap-reached" }
  /** Re-run classify-assets-v2 with the formatted hint. */
  | { kind: "retry-classifier"; priorAttemptError: string; attempt: number }
  /** Re-render the template with the formatted hint. */
  | { kind: "retry-render"; reviewHints: string; attempt: number };

export function decideNextAction(findings: ReviewFinding[], currentAttempt: number): NextAction {
  const partitioned = partitionFindings(findings);
  const hasBlocker =
    partitioned.layoutBlockers.length > 0 ||
    partitioned.contentBlockers.length > 0 ||
    partitioned.otherBlockers.length > 0;

  if (!hasBlocker) {
    return {
      kind: "ship",
      reason: findings.length > 0 ? "warnings-only" : "clean",
    };
  }

  if (currentAttempt >= REVIEW_RETRY_CAP) {
    return { kind: "ship", reason: "retry-cap-reached" };
  }

  // Content blockers take priority over layout — a correct schedule
  // laid out badly is a smaller problem than a wrong schedule.
  if (partitioned.contentBlockers.length > 0) {
    return {
      kind: "retry-classifier",
      priorAttemptError: formatFindingsAsClassifierHint(findings),
      attempt: currentAttempt + 1,
    };
  }
  return {
    kind: "retry-render",
    reviewHints: formatFindingsAsLayoutHint(findings),
    attempt: currentAttempt + 1,
  };
}
