import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND } from "@/lib/brand";

/**
 * SSOT guard for BRAND.email.* — every rendered reference to a
 * `<something>@segra.tax` address must come from the BRAND constant, not a
 * hardcoded string. A rebrand-safe codebase has ONE line to update.
 *
 * We use `git grep -E` (fast, respects .gitignore, skips node_modules) to
 * enumerate every tracked occurrence of `<word>@segra.tax`, then subtract the
 * allowlist of files where the literal is the source-of-truth (brand module
 * itself, env.example docs, tests that snapshot the literal, the raw docs).
 */

const REPO_ROOT = resolve(__dirname, "..", "..");

const EMAIL_PATTERN = "[a-zA-Z0-9._+-]+@segra\\.tax";

const ALLOWED_PATHS = new Set([
  "lib/brand.ts", // the SSOT itself
  ".env.example", // .env.example shows the literal as an example
  "tests/unit/brand-emails.test.ts", // this file
  "tests/unit/env.test.ts", // env test fixture includes RESEND_FROM_EMAIL
  "tests/unit/share-error.test.ts", // snapshot asserts support@segra.tax in hint
  "tests/unit/magic-link-error.test.ts", // snapshot asserts support@segra.tax
]);

function isAllowlistedDocOrPrompt(path: string): boolean {
  // Marketing/master prompts and ADRs are historical artifacts — not code.
  return path.startsWith("docs/") || path === "START_HERE.md" || path === "README.md";
}

describe("BRAND.email SSOT", () => {
  it("no source file hardcodes a @segra.tax email outside the allowlist", () => {
    let output = "";
    try {
      output = execSync(`git grep -E -I -n "${EMAIL_PATTERN}" -- .`, {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
    } catch (err) {
      // Exit code 1 = no matches (fine). Re-throw anything else.
      const e = err as { status?: number; stdout?: string };
      if (e.status && e.status !== 1) throw err;
      output = e.stdout ?? "";
    }
    const offenders = output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [path] = line.split(":");
        return { line, path: path ?? "" };
      })
      .filter(({ path }) => !ALLOWED_PATHS.has(path) && !isAllowlistedDocOrPrompt(path));

    expect(
      offenders,
      `Found ${offenders.length} hardcoded @segra.tax emails outside BRAND.email. Add to BRAND.email and route the callsite through it, or allowlist the file in tests/unit/brand-emails.test.ts if it's genuinely a source-of-truth site:\n\n${offenders
        .map((o) => "  " + o.line)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("every BRAND.email value is a well-formed email string", () => {
    for (const [key, value] of Object.entries(BRAND.email)) {
      if (key === "from") {
        // `from` is the full sender header, e.g. `Segra <noreply@segra.tax>`.
        expect(value, `BRAND.email.${key}`).toMatch(/<[^<>@]+@[^<>@]+>$/);
      } else if (key === "domain") {
        // `domain` is the plain domain string.
        expect(value, `BRAND.email.${key}`).toMatch(/^[a-z0-9.-]+$/);
      } else {
        expect(value, `BRAND.email.${key}`).toMatch(/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+$/);
      }
    }
  });
});
