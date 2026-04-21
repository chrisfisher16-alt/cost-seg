import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression for B2-2: scope-disclosure text is a Single Source of Truth —
 * the delivered-artifact version lives in `lib/pdf/disclosure.ts`
 * (`TIER_1_SCOPE_DISCLOSURE`), the pre-purchase / pre-delivery version
 * lives in `lib/pdf/disclosure-short.ts` (`SCOPE_DISCLOSURE_SHORT`), and
 * NO other source file may contain a third paraphrase.
 *
 * The grep pattern catches the load-bearing substring "cost segregation
 * study under" that appears in both canonical texts. A new paraphrase
 * would necessarily include it (or skip the Pub-5653 citation, which is
 * itself a defect). A drift slipping past CI review is exactly the class
 * of bug this test exists to prevent.
 */

const REPO_ROOT = resolve(__dirname, "..", "..");

/**
 * Files allowed to contain the scope-disclosure substring, with the
 * rationale why. Every non-SSOT entry must be explained.
 */
const ALLOWLISTED_FILES: ReadonlyMap<string, string> = new Map([
  // -- The two SSOT modules --
  ["lib/pdf/disclosure.ts", "The PDF-footer SSOT (TIER_1_SCOPE_DISCLOSURE)."],
  ["lib/pdf/disclosure-short.ts", "The pre-purchase / pre-delivery SSOT (SCOPE_DISCLOSURE_SHORT)."],
  // -- Legal pages that reference the full IRS publication name --
  [
    "app/(marketing)/legal/scope-disclosure/page.tsx",
    "The canonical /legal/scope-disclosure policy page quotes the full 'IRS Cost Segregation Audit Techniques Guide' phrase in its three-tier policy text — documentation, not a paraphrase.",
  ],
  [
    "app/(marketing)/legal/methodology/page.tsx",
    "Methodology page cites IRS Pub 5653 as the ATG source; not a scope disclosure.",
  ],
  // -- Tests that assert on the canonical strings --
  [
    "tests/unit/pdf-disclosure.test.ts",
    "Asserts required substrings on both canonical disclosures.",
  ],
  ["tests/unit/scope-disclosure-coverage.test.ts", "This file."],
  [
    "tests/e2e/marketing.spec.ts",
    "E2E assertion that /legal/scope-disclosure renders the IRS Pub 5653 citation.",
  ],
  [
    "tests/e2e/estimator.spec.ts",
    "E2E assertion that the estimator surface renders 'Important scope disclosure.'",
  ],
  [
    "tests/unit/emails.test.ts",
    "Snapshot assertion that the welcome email contains the Pub 5653 citation.",
  ],
]);

// Secondary surfaces where the phrase appears as a rendered PDF component
// (not a paraphrase; the component pulls from TIER_1_SCOPE_DISCLOSURE or
// the /legal/methodology copy). Allowlisted for the same reason legal
// pages are: these files describe methodology, they don't duplicate the
// disclosure.
const ALLOWLISTED_PATTERNS: readonly RegExp[] = [
  /^components\/pdf\/.*/, // PDF templates render TIER_1_SCOPE_DISCLOSURE verbatim
  /^components\/marketing\/ScopeDisclosure\.tsx$/, // The React component renders SCOPE_DISCLOSURE_SHORT
  /^lib\/email\/templates\/.*/, // Email templates render SCOPE_DISCLOSURE_SHORT
  /^docs\/.*/, // Prompts, runbooks, QA register
];

function isDocOrPrompt(path: string): boolean {
  return path.startsWith("docs/") || path === "START_HERE.md" || path === "README.md";
}

describe("scope-disclosure SSOT (B2-2)", () => {
  it("no source file outside the allowlist contains the canonical scope-disclosure phrase", () => {
    // The phrase "cost segregation study under" shows up in both
    // TIER_1_SCOPE_DISCLOSURE and SCOPE_DISCLOSURE_SHORT and would
    // necessarily appear in any drift variant. We grep for it, then
    // subtract the allowlist + test files.
    let output = "";
    try {
      output = execSync(`git grep -I -l "cost segregation study under" -- .`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      if (e.status && e.status !== 1) throw err;
      output = e.stdout ?? "";
    }

    const offenders = output
      .split("\n")
      .filter(Boolean)
      .filter((path) => {
        if (ALLOWLISTED_FILES.has(path)) return false;
        if (ALLOWLISTED_PATTERNS.some((pattern) => pattern.test(path))) return false;
        if (isDocOrPrompt(path)) return false;
        return true;
      });

    expect(
      offenders,
      `Found ${offenders.length} file(s) containing a scope-disclosure paraphrase outside the two SSOT modules. ` +
        `Import TIER_1_SCOPE_DISCLOSURE (for delivered artifacts) or SCOPE_DISCLOSURE_SHORT (for pre-purchase surfaces) instead, ` +
        `or add the file to ALLOWLISTED_FILES / ALLOWLISTED_PATTERNS with a rationale:\n\n` +
        offenders.map((o) => "  " + o).join("\n"),
    ).toEqual([]);
  });
});
