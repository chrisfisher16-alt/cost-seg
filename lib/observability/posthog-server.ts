import "server-only";

import { PostHog } from "posthog-node";

let instance: PostHog | null = null;

/**
 * Server-side PostHog client. Returns null if not configured — call sites
 * should tolerate a noop in local dev / tests.
 */
export function posthog(): PostHog | null {
  if (instance !== null) return instance;
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  instance = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
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
