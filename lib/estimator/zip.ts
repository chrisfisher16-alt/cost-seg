/**
 * US ZIP code validation, shared by the property + DIY intake forms.
 *
 * Accepts either 5-digit ("12345") or ZIP+4 ("12345-6789") formats. The form
 * calls `zipHint()` for inline feedback as the user types — it distinguishes
 * "empty" from "still typing" from "malformed" so we don't flash errors on
 * every keystroke.
 *
 * Pure. No throws.
 */

export type ZipHintKind = "empty" | "partial" | "valid" | "invalid";

export interface ZipHint {
  kind: ZipHintKind;
  /**
   * When `kind === "invalid"` this is a one-line explanation safe to render
   * in the Field's error slot. `null` otherwise.
   */
  message: string | null;
}

const ZIP_STRICT = /^\d{5}(-\d{4})?$/;
const ZIP_DIGIT_ONLY = /^\d+$/;
const ZIP_WITH_DASH = /^\d{5}-$/;
const ZIP_PARTIAL_FOUR = /^\d{5}-\d{1,3}$/;

/**
 * Live hint as the user types. Key policy decision: we suppress "invalid"
 * feedback until the user has entered enough characters that the input
 * clearly isn't a valid prefix of a ZIP — otherwise typing "1" would
 * immediately paint the field red.
 */
export function zipHint(raw: string): ZipHint {
  const s = raw.trim();

  if (s.length === 0) {
    return { kind: "empty", message: null };
  }

  if (ZIP_STRICT.test(s)) {
    return { kind: "valid", message: null };
  }

  // Still a reasonable prefix of a valid ZIP — hold fire.
  if (
    (ZIP_DIGIT_ONLY.test(s) && s.length < 5) ||
    ZIP_WITH_DASH.test(s) ||
    ZIP_PARTIAL_FOUR.test(s)
  ) {
    return { kind: "partial", message: null };
  }

  // Common failure modes get specific copy; everything else gets the generic.
  if (/[a-z]/i.test(s)) {
    return {
      kind: "invalid",
      message: "ZIP codes are digits only (e.g. 94110 or 94110-1234).",
    };
  }

  if (ZIP_DIGIT_ONLY.test(s) && s.length > 5) {
    return {
      kind: "invalid",
      message: `That's ${s.length} digits — use 5 digits or the ZIP+4 format 94110-1234.`,
    };
  }

  return {
    kind: "invalid",
    message: "Use 5 digits (94110) or the ZIP+4 format (94110-1234).",
  };
}

/**
 * Strict validity check for submission / persistence paths. Unlike
 * `zipHint`, this returns `false` for partial inputs — use it when you
 * need a yes/no answer.
 */
export function isValidZip(raw: string): boolean {
  return ZIP_STRICT.test(raw.trim());
}
