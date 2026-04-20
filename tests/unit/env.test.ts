import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards around the zod schemas in `lib/env.ts`.
 *
 * The module caches the parsed env in a closure. We `vi.resetModules()` and
 * rewrite `process.env` in a fresh mutable snapshot so each test exercises a
 * clean parse. `env()` is lazy — parse-time errors surface when the function
 * is called, not at import.
 */

const baseValidEnv = {
  NODE_ENV: "test",
  APP_ENV: "development",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(32),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(32),
  DATABASE_URL: "postgres://user:pass@host:5432/db",
  DIRECT_URL: "postgres://user:pass@host:5432/db",
  ANTHROPIC_API_KEY: "sk-ant-0123456789abcdef",
  // AWS Textract keys are declared required in lib/env.ts today (see ADR 0006
  // for the planned removal) — include placeholders so the schema parses.
  AWS_ACCESS_KEY_ID: "AKIA0123456789",
  AWS_SECRET_ACCESS_KEY: "secret-0123456789",
  AWS_REGION: "us-east-1",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  STRIPE_PRICE_ID_DIY: "price_diy",
  STRIPE_PRICE_ID_TIER_1: "price_t1",
  STRIPE_PRICE_ID_TIER_2: "price_t2",
  RESEND_API_KEY: "re_abc",
  RESEND_FROM_EMAIL: "Segra <noreply@segra.tax>",
  INNGEST_EVENT_KEY: "ik-0123456789",
  INNGEST_SIGNING_KEY: "sk-0123456789",
} as const;

describe("env()", () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = saved;
  });

  it("parses a minimal valid env with DIY price id present", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, baseValidEnv);

    const { env } = await import("@/lib/env");
    const parsed = env();
    expect(parsed.STRIPE_PRICE_ID_DIY).toBe("price_diy");
    expect(parsed.STRIPE_PRICE_ID_TIER_1).toBe("price_t1");
    expect(parsed.STRIPE_PRICE_ID_TIER_2).toBe("price_t2");
  });

  it("throws a helpful error when STRIPE_PRICE_ID_DIY is missing", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    const { STRIPE_PRICE_ID_DIY: _omit, ...rest } = baseValidEnv;
    Object.assign(process.env, rest);

    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/STRIPE_PRICE_ID_DIY/);
  });

  it("throws when STRIPE_PRICE_ID_DIY has the wrong prefix (not price_…)", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, { ...baseValidEnv, STRIPE_PRICE_ID_DIY: "prod_diy" });

    const { env } = await import("@/lib/env");
    expect(() => env()).toThrow(/STRIPE_PRICE_ID_DIY/);
  });

  it("accepts an optional NEXT_PUBLIC_SENTRY_DSN when set", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, {
      ...baseValidEnv,
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o123.ingest.sentry.io/456",
    });

    const { env } = await import("@/lib/env");
    const parsed = env();
    expect(parsed.NEXT_PUBLIC_SENTRY_DSN).toBe("https://abc@o123.ingest.sentry.io/456");
  });

  it("tolerates a missing NEXT_PUBLIC_SENTRY_DSN — it's optional", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, baseValidEnv);

    const { env } = await import("@/lib/env");
    const parsed = env();
    expect(parsed.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });
});

describe("clientEnv()", () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = saved;
  });

  it("returns the NEXT_PUBLIC_SENTRY_DSN key when set", async () => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(32),
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o123.ingest.sentry.io/456",
    });

    const { clientEnv } = await import("@/lib/env");
    const parsed = clientEnv();
    expect(parsed.NEXT_PUBLIC_SENTRY_DSN).toBe("https://abc@o123.ingest.sentry.io/456");
  });
});
