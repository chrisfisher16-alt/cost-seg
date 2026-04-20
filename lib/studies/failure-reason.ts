/**
 * Classify a free-form `failedReason` string from the pipeline into a
 * customer-facing category. The pipeline writes reasons as English strings
 * ("Step A did not identify a closing disclosure..."); this maps them to
 * three buckets with tailored copy + recovery expectations.
 *
 * If we add new failure modes in inngest/functions/process-study.ts, add
 * a case here and a test. A miss falls through to the generic bucket —
 * the customer still sees the raw reason, we just don't have a tuned
 * recovery story yet.
 */

export type FailureCategory =
  | "missing-document"
  | "unbalanced-schedule"
  | "admin-flagged"
  | "generic";

export interface ClassifiedFailure {
  category: FailureCategory;
  title: string;
  /** Plain-English explanation for the customer. Never exposes internal step names. */
  explanation: string;
  /** What happens next. Sets expectation on timing + who acts. */
  recovery: string;
  /** Prefilled subject line for the "email support" button. */
  supportSubject: string;
}

/**
 * `rawReason` is what's persisted on `study.failedReason`. `studyId` is
 * optional — included in the support subject when present so inbound
 * tickets are triage-ready.
 */
export function classifyFailure(
  rawReason: string | null | undefined,
  studyId?: string,
): ClassifiedFailure {
  const reason = (rawReason ?? "").trim();
  const lower = reason.toLowerCase();
  const shortId = studyId ? studyId.slice(0, 8) : null;

  // Step A: closing disclosure couldn't be identified in uploaded docs.
  // The customer typically uploaded the wrong file or a redacted copy.
  if (
    lower.includes("closing disclosure") &&
    (lower.includes("did not identify") ||
      lower.includes("not found") ||
      lower.includes("no closing_disclosure"))
  ) {
    return {
      category: "missing-document",
      title: "We couldn't find your closing disclosure.",
      explanation:
        "Our AI pipeline looks for a standard HUD-1 or Closing Disclosure among the files you uploaded. None of them read as one — possibly a redacted copy, a loan-estimate instead of the final CD, or a scan with the text flattened into an unreadable image.",
      recovery:
        "We'll reach out within one business day to help you identify the right file from your closing packet. In the meantime, nothing you uploaded has been lost and you haven't been charged.",
      supportSubject: `Cost Seg — closing disclosure not identified${shortId ? ` (study ${shortId})` : ""}`,
    };
  }

  // Step C: asset classification didn't reconcile after retry.
  if (
    lower.includes("balanced schedule") ||
    (lower.includes("balance") && lower.includes("asset"))
  ) {
    return {
      category: "unbalanced-schedule",
      title: "The asset schedule didn't reconcile.",
      explanation:
        "Our AI produces a line-by-line depreciation schedule and then checks that every dollar is accounted for. Two attempts in, the numbers still didn't balance to the penny — usually a sign the property is unusually complex (mixed-use, heavy improvements, or a non-standard purchase structure).",
      recovery:
        "A licensed engineer on our team will review the study manually and rebuild it. Expect an email update within two business days. You haven't been charged, and you can reply to that email with questions.",
      supportSubject: `Cost Seg — unbalanced asset schedule${shortId ? ` (study ${shortId})` : ""}`,
    };
  }

  // admin.marked_failed — the admin panel routes through markStudyFailed too.
  // The reason is whatever the admin typed. Treat it as authoritative but
  // generic — the admin's own words become the explanation.
  if (reason && !lower.startsWith("step ")) {
    return {
      category: "admin-flagged",
      title: "We paused this study.",
      explanation: reason || "Our team flagged this study as something we can't deliver as-is.",
      recovery:
        "We've marked this as un-recoverable on our side. Reply to any prior email, or email support directly — we'll help figure out next steps, including a refund if money changed hands.",
      supportSubject: `Cost Seg — paused study${shortId ? ` (${shortId})` : ""}`,
    };
  }

  // Fallback — show whatever the pipeline wrote, and a generic recovery.
  return {
    category: "generic",
    title: "We couldn't finish your report.",
    explanation: reason || "An unexpected error interrupted the pipeline before it could finish.",
    recovery:
      "Our team has been notified and the job is paused. You haven't been charged — any payment will be refunded if we can't recover. Email support and we'll walk you through what happened.",
    supportSubject: `Cost Seg pipeline failure${shortId ? ` (study ${shortId})` : ""}`,
  };
}
