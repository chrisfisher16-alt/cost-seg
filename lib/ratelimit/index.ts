import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface Limiter {
  check(key: string): Promise<RateLimitResult>;
}

class MemoryLimiter implements Limiter {
  private store = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || now > existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { ok: true, remaining: this.limit - 1, resetAt };
    }
    existing.count += 1;
    return {
      ok: existing.count <= this.limit,
      remaining: Math.max(0, this.limit - existing.count),
      resetAt: existing.resetAt,
    };
  }
}

function buildLimiter(name: string, limit: number, window: `${number} s`): Limiter {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  if (!url || !token) {
    const seconds = Number.parseInt(window, 10);
    return new MemoryLimiter(limit, seconds * 1000);
  }
  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix: `ratelimit:${name}`,
  });
  return {
    async check(key: string) {
      const r = await rl.limit(key);
      return { ok: r.success, remaining: r.remaining, resetAt: r.reset };
    },
  };
}

const instances = new Map<string, Limiter>();

function getLimiter(name: string, limit: number, window: `${number} s`): Limiter {
  const cached = instances.get(name);
  if (cached) return cached;
  const fresh = buildLimiter(name, limit, window);
  instances.set(name, fresh);
  return fresh;
}

/** 5 estimator submissions per minute per IP. See master prompt §12. */
export function estimatorLimiter(): Limiter {
  return getLimiter("estimator", 5, "60 s");
}

/** 3 lead-capture submissions per minute per IP. */
export function leadCaptureLimiter(): Limiter {
  return getLimiter("lead-capture", 3, "60 s");
}

/**
 * 10 sample-PDF downloads per minute per IP. Prevents anyone from hammering
 * the render route — rendering a PDF is CPU-bound and blocks the server
 * process for a few hundred ms each call.
 */
export function samplePdfLimiter(): Limiter {
  return getLimiter("sample-pdf", 10, "60 s");
}

/**
 * 5 magic-link requests per 5-minute window per IP. Supabase already
 * throttles by email (the classifyMagicLinkError path surfaces that cooldown
 * to the user), but a bot could rotate emails from a single IP to bypass
 * per-email limits. 5 per 5m is generous for a real user with typos and
 * tight enough that a scraper can't burn Resend/Supabase quota.
 */
export function magicLinkLimiter(): Limiter {
  return getLimiter("magic-link", 5, "300 s");
}

/**
 * 8 Stripe-Checkout-session creations per 5-minute window per IP. Each call
 * hits Stripe's API (billable in volume + quota'd at 100/s per account).
 * The human flow is: (maybe refresh once) → fill form → submit. 8/5min
 * covers legitimate form re-submits from a single household NAT while
 * stopping a bot from spinning up hundreds of zombie checkout sessions.
 */
export function startCheckoutLimiter(): Limiter {
  return getLimiter("start-checkout", 8, "300 s");
}

/**
 * 5 CPA-invite sends per hour. Keyed per {studyId, ownerId} pair — an owner
 * can invite across multiple studies without hitting the limit, and a
 * single study can't get flooded even from multiple admin accounts.
 *
 * Why per-study? Each send fires a Resend email (billable) + creates a
 * StudyEvent row. 5/h covers "I typed the wrong email, then re-sent to the
 * right one, then re-invited after the CPA lost the email in their filter"
 * while stopping a malicious or sloppy owner from burning 1,000 emails.
 */
export function shareInviteLimiter(): Limiter {
  return getLimiter("share-invite", 5, "3600 s");
}
