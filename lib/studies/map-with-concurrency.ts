/**
 * Run `fn` over each item of `items` with at most `limit` calls in flight
 * at a time. Order of returned results matches input order.
 *
 * Used to throttle per-document AI calls so a 14-document study does not
 * fire 14 classifier calls at once and blow past the Anthropic 30k
 * input-TPM rate limit on sonnet-4-6. A small number (2–4) is enough to
 * keep the pipeline durable without serializing it.
 */
export async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`mapWithConcurrency: limit must be a positive integer, got ${limit}`);
  }
  if (items.length === 0) return [];

  const results = new Array<TOut>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!, idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Concurrency cap for per-document AI calls (classify-document,
 * describe-photos). Override via `AI_DOC_CONCURRENCY` for canary testing
 * or investigating rate-limit headroom. Defaults to 3.
 *
 * Bracket access is deliberate: this is a runtime tuning knob, not a
 * boot-required secret, so it intentionally lives outside the `env()`
 * schema (same pattern as `lib/features/v2-report.ts`).
 */
export function aiDocumentConcurrency(): number {
  const raw = process.env["AI_DOC_CONCURRENCY"];
  if (!raw) return 3;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return n;
}
