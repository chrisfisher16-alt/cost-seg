/**
 * Heuristic hint for the intake "Acquired date" field. The tax-filing path
 * diverges meaningfully when the property was placed in service in a prior
 * year (Form 3115 method-change with §481(a) catch-up) vs this year
 * (Form 4562, no catch-up). See lib/pdf/form-3115.ts for the actual math
 * that ends up in Appendix E of the delivered PDF.
 *
 * Surfacing this at intake is a courtesy for the CPA in the loop — it
 * tells them up-front whether a 3115 filing is coming, so they can plan
 * timing around it. Also catches the common "I typed a future date by
 * accident" mistake.
 */

export type AcquiredHintKind = "future" | "prior-year" | "current-year" | "empty";

export interface AcquiredHint {
  kind: AcquiredHintKind;
  title: string | null;
  message: string | null;
}

/**
 * Parse an ISO date-only string ("YYYY-MM-DD") without the Date-constructor
 * timezone footgun. Returns null on unparseable input.
 */
function parseIsoDateOnly(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 3000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Construct UTC so comparison against a UTC-derived "now" year is stable
  // across time zones.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Pure. `nowMs` is passed explicitly so tests don't depend on the system
 * clock and server components can pin the "today" reference.
 */
export function acquiredDateHint(acquiredAtIso: string, nowMs: number): AcquiredHint {
  if (!acquiredAtIso) {
    return { kind: "empty", title: null, message: null };
  }
  const date = parseIsoDateOnly(acquiredAtIso);
  if (!date) {
    return { kind: "empty", title: null, message: null };
  }

  const now = new Date(nowMs);
  const currentYear = now.getUTCFullYear();
  const acquiredYear = date.getUTCFullYear();

  if (acquiredYear > currentYear || date.getTime() > now.getTime()) {
    return {
      kind: "future",
      title: "Acquired date is in the future.",
      message:
        "Usually a typo. If the property is genuinely pre-closing, wait until the recorded deed date to start the study.",
    };
  }

  if (acquiredYear < currentYear) {
    const priorYears = currentYear - acquiredYear;
    const yearsPhrase = priorYears === 1 ? "last year" : `${priorYears} tax years ago`;
    return {
      kind: "prior-year",
      title: `Placed in service ${yearsPhrase} — Form 3115 territory.`,
      message:
        "Your CPA will file Form 3115 (DCN 7, automatic consent) with a §481(a) catch-up adjustment that claims the missed depreciation in the current tax year. Every Engineer-Reviewed report ships with an Appendix E worksheet that computes the catch-up and pre-fills the form.",
    };
  }

  return { kind: "current-year", title: null, message: null };
}
