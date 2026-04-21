import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  aiDocumentConcurrency,
  aiPhotoConcurrency,
  mapWithConcurrency,
} from "@/lib/studies/map-with-concurrency";

/**
 * The concurrency cap exists to prevent the Anthropic 30k input-TPM rate
 * limit from blowing up multi-document studies. The tests lock in:
 *   • Order-preservation (pipeline downstream depends on index alignment)
 *   • Actual throttling (at most `limit` in flight at any time)
 *   • Error propagation (a failing worker surfaces + stops the batch)
 *   • Edge cases (empty input, bad limit, env-var override)
 */

function defer<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      // Smaller numbers take longer — reverse the natural completion order.
      await new Promise((r) => setTimeout(r, (6 - n) * 5));
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it("returns an empty array for empty input", async () => {
    const called: number[] = [];
    const result = await mapWithConcurrency([], 4, async (n: number) => {
      called.push(n);
      return n;
    });
    expect(result).toEqual([]);
    expect(called).toEqual([]);
  });

  it("throws on a non-positive limit", async () => {
    await expect(mapWithConcurrency([1], 0, async (n) => n)).rejects.toThrow(/positive/i);
    await expect(mapWithConcurrency([1], -1, async (n) => n)).rejects.toThrow(/positive/i);
    await expect(mapWithConcurrency([1], 1.5, async (n) => n)).rejects.toThrow(/positive/i);
  });

  it("never runs more than `limit` workers at a time", async () => {
    const limit = 3;
    let inFlight = 0;
    let peak = 0;
    const deferreds = Array.from({ length: 10 }, () => defer<void>());

    const run = mapWithConcurrency([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], limit, async (i) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await deferreds[i]!.promise;
      inFlight -= 1;
      return i;
    });

    // Let workers boot.
    await new Promise((r) => setTimeout(r, 0));
    expect(inFlight).toBe(limit);

    // Release them one at a time; peak should never exceed `limit`.
    for (const d of deferreds) {
      d.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
    await run;
    expect(peak).toBe(limit);
  });

  it("works when limit exceeds input size", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (n) => n + 1);
    expect(result).toEqual([2, 3]);
  });

  it("surfaces errors from worker fn", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow(/boom/);
  });
});

describe("aiDocumentConcurrency", () => {
  const original = process.env.AI_DOC_CONCURRENCY;

  beforeEach(() => {
    delete process.env.AI_DOC_CONCURRENCY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AI_DOC_CONCURRENCY;
    else process.env.AI_DOC_CONCURRENCY = original;
  });

  it("defaults to 3 when unset", () => {
    expect(aiDocumentConcurrency()).toBe(3);
  });

  it("honors integer overrides", () => {
    process.env.AI_DOC_CONCURRENCY = "5";
    expect(aiDocumentConcurrency()).toBe(5);
    process.env.AI_DOC_CONCURRENCY = "1";
    expect(aiDocumentConcurrency()).toBe(1);
  });

  it("falls back to 3 on garbage / non-positive values", () => {
    process.env.AI_DOC_CONCURRENCY = "abc";
    expect(aiDocumentConcurrency()).toBe(3);
    process.env.AI_DOC_CONCURRENCY = "0";
    expect(aiDocumentConcurrency()).toBe(3);
    process.env.AI_DOC_CONCURRENCY = "-4";
    expect(aiDocumentConcurrency()).toBe(3);
  });
});

describe("aiPhotoConcurrency", () => {
  const original = process.env.AI_PHOTO_CONCURRENCY;

  beforeEach(() => {
    delete process.env.AI_PHOTO_CONCURRENCY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AI_PHOTO_CONCURRENCY;
    else process.env.AI_PHOTO_CONCURRENCY = original;
  });

  it("defaults to 2 when unset — lower than docs because photo outputs are heavier", () => {
    expect(aiPhotoConcurrency()).toBe(2);
  });

  it("honors integer overrides", () => {
    process.env.AI_PHOTO_CONCURRENCY = "1";
    expect(aiPhotoConcurrency()).toBe(1);
    process.env.AI_PHOTO_CONCURRENCY = "4";
    expect(aiPhotoConcurrency()).toBe(4);
  });

  it("falls back to 2 on garbage / non-positive values", () => {
    process.env.AI_PHOTO_CONCURRENCY = "abc";
    expect(aiPhotoConcurrency()).toBe(2);
    process.env.AI_PHOTO_CONCURRENCY = "0";
    expect(aiPhotoConcurrency()).toBe(2);
  });

  it("is independent of AI_DOC_CONCURRENCY", () => {
    process.env.AI_DOC_CONCURRENCY = "6";
    expect(aiPhotoConcurrency()).toBe(2);
  });
});
