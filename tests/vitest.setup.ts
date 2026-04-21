import { afterEach, beforeEach } from "vitest";

import "@testing-library/jest-dom/vitest";

/**
 * Every test runs with a populated env suitable for `lib/env.ts`'s
 * `env()` validator. Without these, any test that imports server code
 * calling env() (stripe client, db client, etc.) would fail zod
 * validation on the first call.
 *
 * Individual tests can override by setting `process.env.FOO = ...`
 * directly — the beforeEach invalidates the env() cache so the next
 * call re-parses.
 */
const REQUIRED_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "test",
  APP_ENV: "development",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(32),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(32),
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  DIRECT_URL: "postgres://test:test@localhost:5432/test",
  ANTHROPIC_API_KEY: "sk-ant-0123456789abcdef",
};

function seedRequiredEnv() {
  for (const [key, value] of Object.entries(REQUIRED_ENV_DEFAULTS)) {
    // Treat both undefined and empty-string as "unset" — some shells
    // export vars like `ANTHROPIC_API_KEY=""` which would pass an
    // `undefined` check but fail zod's `.min(20)`.
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Seed at file-load + at the start of each test. Tests that wholesale
// clear `process.env` need the defaults re-populated or env() will fail
// on the next cached-miss.
seedRequiredEnv();

beforeEach(async () => {
  seedRequiredEnv();
  // The env() cache is per-module-load. Tests that mutate process.env
  // need the cache invalidated to see their mutation; we do it eagerly
  // here so test bodies can stay focused on the specific env var they
  // care about.
  try {
    const mod = await import("@/lib/env");
    mod.__resetEnvCacheForTests();
  } catch {
    // `@/lib/env` might not be importable in some test contexts (e.g.
    // a pure client-component test that never touches server code).
    // Swallow — no env() to invalidate means no damage done.
  }
});

afterEach(async () => {
  try {
    const mod = await import("@/lib/env");
    mod.__resetEnvCacheForTests();
  } catch {
    // See note above.
  }
});
