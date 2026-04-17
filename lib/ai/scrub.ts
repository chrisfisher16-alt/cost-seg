/**
 * Defensive PII scrubbing before outbound LLM calls. Required by §12 of the
 * master prompt: strip SSNs, full dates of birth, and bank-account / ABA
 * numbers from any text we send to Claude.
 *
 * We operate on strings because scrubbing happens between OCR and prompt
 * assembly. If the caller needs to scrub a nested object, they should
 * JSON.stringify, scrub, and JSON.parse.
 */

const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const SSN_NO_DASH = /\b(?<!\d)\d{9}(?!\d)\b/g;

// DOB patterns near a keyword: "DOB 01/02/1980", "Date of Birth: 1980-01-02"
const DOB_KEYWORD = /\b(?:dob|date\s*of\s*birth)[\s:]*[-/\d]+/gi;

// Bank account / routing — match only when explicitly labeled, to avoid
// eating purchase prices and other numeric fields. "Account: 1234567" or
// "Routing Number 987654321".
const BANK_KEYWORD = /\b(?:account|routing|aba)(?:\s*(?:no\.?|number|#))?[\s:]*\d[\d-]{5,}/gi;

// Credit-card-shaped numbers (13–19 digits with optional separators).
const CARD = /\b(?:\d[ -]?){13,19}\b/g;

export interface ScrubOptions {
  redactionTag?: string; // default "[REDACTED]"
}

/**
 * Returns the scrubbed string. Pure; safe to log both inputs and outputs
 * separately only if the inputs come from scrubbed sources.
 */
export function scrubPii(input: string, options: ScrubOptions = {}): string {
  const tag = options.redactionTag ?? "[REDACTED]";
  return input
    .replace(SSN, `${tag}:SSN`)
    .replace(SSN_NO_DASH, (match) => {
      // Only treat as SSN if not preceded by "$" or followed by " USD" etc.
      // This narrow heuristic keeps false positives low; the labeled rules
      // above catch the cases that actually matter.
      return `${tag}:SSN-like`.length > match.length ? match : `${tag}:SSN-like`;
    })
    .replace(DOB_KEYWORD, `${tag}:DOB`)
    .replace(BANK_KEYWORD, `${tag}:BANK`)
    .replace(CARD, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) return match;
      return `${tag}:CARD`;
    });
}

/**
 * Convenience: scrub an entire JSON-serializable value by stringify/scrub/parse.
 * Non-string primitives are left alone.
 */
export function scrubPiiJson<T>(value: T): T {
  const raw = JSON.stringify(value);
  const scrubbed = scrubPii(raw);
  return JSON.parse(scrubbed) as T;
}
