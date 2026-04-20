import "server-only";

import type { Inngest } from "inngest";

/**
 * Wrap an Inngest emit so a transport failure (ECONNREFUSED when the dev
 * server is down, 5xx from Inngest cloud, etc.) doesn't take down whatever
 * caller triggered it.
 *
 * Why a shared helper: we have three user-action entry points that each
 * want the same three things on failure — a specific log line naming the
 * event + studyId for debugging, no thrown exception, and a structured
 * result so the caller decides whether to retry, surface an error, or
 * continue.
 *
 * Callers that run INSIDE an Inngest function (e.g. lib/studies/pipeline.ts
 * emitting study.ai.complete mid-pipeline) should NOT use this — a thrown
 * error is correct there, because Inngest's durable retry machinery picks
 * the function back up.
 */
export type SafeSendResult = { ok: true } | { ok: false; error: string };

type EventPayload = Parameters<Inngest["send"]>[0];

export async function safeInngestSend(
  event: EventPayload,
  logContext: Record<string, unknown> = {},
): Promise<SafeSendResult> {
  const { inngest } = await import("@/inngest/client");
  try {
    await inngest.send(event);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Single structured log line so sentry / tail-based monitoring can
    // alert on the string "[inngest.send failed]" regardless of which
    // caller emitted.
    console.error("[inngest.send failed]", {
      event: Array.isArray(event) ? "<batch>" : (event as { name?: string }).name,
      message,
      ...logContext,
    });
    return { ok: false, error: message };
  }
}
