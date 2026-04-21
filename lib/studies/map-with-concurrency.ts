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

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * Concurrency cap for classify-document (sonnet-4-6, short outputs).
 * Override via `AI_DOC_CONCURRENCY`. Defaults to 3 — classify-document
 * outputs are typically <500 tokens so 3 parallel calls stay well under
 * the sonnet 8k output-TPM ceiling.
 *
 * Bracket env access is deliberate: these are runtime tuning knobs, not
 * boot-required secrets, so they intentionally live outside the `env()`
 * schema (same pattern as `lib/features/v2-report.ts`).
 */
export function aiDocumentConcurrency(): number {
  return readPositiveIntEnv("AI_DOC_CONCURRENCY", 3);
}

/**
 * Concurrency cap for describe-photos (sonnet-4-6, structured vision
 * output of ~1.5–2.5k tokens per photo). Override via
 * `AI_PHOTO_CONCURRENCY`. Defaults to 2 — three parallel photo descriptions
 * empirically burst past the 8k output-TPM ceiling and trip rate_limit_error.
 */
export function aiPhotoConcurrency(): number {
  return readPositiveIntEnv("AI_PHOTO_CONCURRENCY", 2);
}
