import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression test for the DIY promo bypass "Supabase service role key and
 * DB both need to be reachable" error surfaced on the beta.
 *
 * The real failure wasn't DB connectivity — it was that
 * `generateIntakeMagicLink` ran OUTSIDE the try-catch that wraps the
 * welcome email, so a Supabase redirect-URL allowlist rejection
 * (Supabase project's Redirect URLs didn't include the Vercel origin)
 * threw all the way up, rolling the promo action into the generic
 * "bypass failed" catch. Meanwhile the Study row had already been
 * committed inside the transaction — the customer's state was
 * inconsistent with what the error message implied.
 *
 * Fix: the magic-link generation is best-effort, same as the email
 * send. Failures there log and continue; the Study is still created.
 * The customer can always reach their study via /sign-in → /dashboard
 * even if the welcome email never arrives.
 */

const CREATE_FROM_CHECKOUT_PATH = resolve(
  __dirname,
  "..",
  "..",
  "lib",
  "studies",
  "create-from-checkout.ts",
);

describe("promo bypass resilience", () => {
  const src = readFileSync(CREATE_FROM_CHECKOUT_PATH, "utf8");

  it("generateIntakeMagicLink is inside a try-catch with sendWelcomeEmail", () => {
    // Find the try block that contains both calls. The block must include
    // generateIntakeMagicLink BEFORE sendWelcomeEmail — tying them together
    // under a single catch so a magic-link failure falls through to the
    // same error path as an email failure.
    const tryBlock = src.match(/try\s*\{[\s\S]*?\}\s*catch[\s\S]*?\}/);
    expect(tryBlock, "a try-catch block should exist").toBeTruthy();

    const body = tryBlock![0];
    const magicIdx = body.indexOf("generateIntakeMagicLink");
    const emailIdx = body.indexOf("sendWelcomeEmail");
    expect(magicIdx, "generateIntakeMagicLink must be inside the try-catch").toBeGreaterThan(-1);
    expect(emailIdx, "sendWelcomeEmail must be inside the try-catch").toBeGreaterThan(-1);
    expect(magicIdx).toBeLessThan(emailIdx);
  });

  it("does NOT call generateIntakeMagicLink outside a try-catch", () => {
    // Cheap structural guard: if a future refactor moves the call back
    // outside, the re-introduced failure mode comes back. Walk every
    // occurrence of generateIntakeMagicLink and confirm each is preceded
    // by a `try {` before any intervening `}` closes a scope.
    let index = 0;
    const occurrences: number[] = [];
    while ((index = src.indexOf("generateIntakeMagicLink", index)) !== -1) {
      // Ignore the function declaration itself (starts with "async function").
      const before = src.slice(Math.max(0, index - 40), index);
      if (!before.includes("async function")) occurrences.push(index);
      index += "generateIntakeMagicLink".length;
    }
    expect(occurrences.length, "at least one call site").toBeGreaterThan(0);

    for (const occurrence of occurrences) {
      const snippet = src.slice(Math.max(0, occurrence - 300), occurrence);
      const tryIdx = snippet.lastIndexOf("try {");
      const closeIdx = snippet.lastIndexOf("}");
      expect(
        tryIdx,
        `generateIntakeMagicLink at index ${occurrence} should be inside a try block`,
      ).toBeGreaterThan(-1);
      // The `try {` should come after the most recent closing `}`, meaning
      // we're inside that try block.
      expect(tryIdx).toBeGreaterThan(closeIdx);
    }
  });
});
