import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/lib/env";

let instance: PostHog | null = null;

/**
 * Server-side PostHog client. Returns null if not configured — call sites
 * should tolerate a noop in local dev / tests.
 */
export function posthog(): PostHog | null {
  if (instance !== null) return instance;
  const { POSTHOG_API_KEY, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST } = env();
  const key = POSTHOG_API_KEY ?? NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  instance = new PostHog(key, {
    host: NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return instance;
}

export async function captureServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = posthog();
  if (!client) return;
  client.capture({ distinctId, event, properties });
  await client.flush();
}
