import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
