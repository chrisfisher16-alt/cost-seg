import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression for F3: every `process.env.XYZ` read across the tracked source
 * tree must either (a) be covered by the `env()` schema in `lib/env.ts`, or
 * (b) live in a known-allowlisted file that reads process.env directly at
 * module load / for existence-probing (explained in the allowlist below).
 *
 * Catches the class of defect where a developer adds
 * `process.env.NEW_SECRET` in a server file without registering it in the
 * schema — env() drifts silently from the set of vars the code actually
 * uses, and prod deploys missing the new var crash with a vague downstream
 * error instead of a clear "invalid environment" at boot.
 */

const REPO_ROOT = resolve(__dirname, "..", "..");

/**
 * Files allowed to read `process.env` directly, with the rationale why.
 * When adding an entry here, document *why* in the comment — "env() would
 * force the whole schema to parse" / "existence-probe for feature flag" /
 * "runs before env() is imported."
 */
const ALLOWLISTED_FILES: ReadonlyMap<string, string> = new Map([
  // -- bootstrap / runtime configs that run before env() is available --
  ["next.config.ts", "Build-time config; runs before the Node process can import server-only."],
  ["instrumentation.ts", "Next.js runtime dispatcher; selects sentry.{runtime}.config.ts."],
  ["instrumentation-client.ts", "Sentry client init runs before the bundle imports lib/env."],
  ["sentry.server.config.ts", "Sentry init at boot; env() not yet parseable."],
  ["sentry.edge.config.ts", "Sentry edge init; env() can't import from edge runtime."],
  ["playwright.config.ts", "Test-runner config."],
  ["prisma.config.ts", "Prisma CLI config."],
  ["proxy.ts", "Next.js middleware (runs earliest in a request) — ADR 0002 allows."],
  ["lib/env.ts", "The validator itself — cannot validate via itself."],
  // -- existence-check / feature-flag probes --
  [
    "lib/stripe/client.ts",
    "`isStripeConfigured()` probes existence without throwing — env() would throw on missing required vars.",
  ],
  [
    "lib/supabase/server.ts",
    "`isSupabaseConfigured()` probes existence for feature-flag UI gating.",
  ],
  [
    "app/api/stripe/webhook/route.ts",
    "503-when-unconfigured probe — explicit check keeps the `feature-off` behavior separate from env() validation.",
  ],
  [
    "inngest/client.ts",
    "Module-load construct; eventKey is read synchronously. Inngest tolerates undefined — env() would force full-schema parse at every import.",
  ],
  // -- layout / SEO / metadata routes run at build or request time --
  [
    "app/layout.tsx",
    "metadataBase runs during static metadata resolution; env() forces full-schema parse.",
  ],
  ["app/robots.ts", "Dynamic robots.txt; NEXT_PUBLIC_APP_URL already-required check."],
  ["app/sitemap.ts", "Dynamic sitemap.xml; same rationale."],
  // -- client components read NEXT_PUBLIC_* direct (Next.js inlines at build) --
  [
    "components/marketing/AddressInput.tsx",
    "Client component; Next.js inlines NEXT_PUBLIC_* at build time.",
  ],
  ["lib/supabase/browser.ts", "Client Supabase helper; reads NEXT_PUBLIC_* inlined at build."],
  [
    "lib/observability/posthog-client.ts",
    "Client PostHog init; reads NEXT_PUBLIC_* inlined at build.",
  ],
]);

function isTestFile(path: string): boolean {
  return path.startsWith("tests/") || path.endsWith(".test.ts") || path.endsWith(".test.tsx");
}

function isDocOrPromptFile(path: string): boolean {
  return path.startsWith("docs/") || path === "START_HERE.md" || path === "README.md";
}

describe("env schema coverage (F3)", () => {
  it("no source file outside the allowlist reads process.env directly", () => {
    // git grep for `process.env.SOMETHING` across tracked files; returns
    // `path:line:...` lines.
    let output = "";
    try {
      output = execSync(`git grep -I -n "process\\.env\\.[A-Z_][A-Z0-9_]*" -- .`, {
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
      .map((line) => {
        const path = line.split(":")[0] ?? "";
        return { line, path };
      })
      .filter(({ path }) => {
        if (ALLOWLISTED_FILES.has(path)) return false;
        if (isTestFile(path)) return false;
        if (isDocOrPromptFile(path)) return false;
        return true;
      });

    expect(
      offenders,
      `Found ${offenders.length} file(s) reading process.env.* outside the allowlist. ` +
        `Route each through \`env()\` (server) or \`clientEnv()\` / Next.js build-time ` +
        `inlining (client), OR add the file to ALLOWLISTED_FILES with a rationale:\n\n` +
        offenders.map((o) => "  " + o.line).join("\n"),
    ).toEqual([]);
  });
});
