import { describe, expect, it, vi } from "vitest";

import {
  runFanout,
  type PhotoCandidateFn,
  type ReceiptsCandidateFn,
} from "@/lib/ai/steps/classify-assets-v2-fanout";
import type { ClassifyAssetsV2OrchestratorInput } from "@/lib/ai/steps/classify-assets-v2";
import type { ClassifyCandidatesV2Output } from "@/lib/ai/prompts/classify-candidates-v2";
import type { AssetLineItemV2 } from "@/lib/ai/prompts/classify-assets-v2";
import type { DescribePhotoOutput } from "@/lib/ai/prompts/describe-photos";

const makePhotoFn = () => vi.fn<PhotoCandidateFn>();
const makeReceiptsFn = () => vi.fn<ReceiptsCandidateFn>();

/**
 * Covers ADR 0014's fan-out orchestrator behavior:
 *   • skips LLM call for photos with zero detected objects
 *   • threads the priorAttemptError into every slice on retry
 *   • returns unbalanced=false (plus balanceMessage) when the retry
 *     also produces a negative residual
 *   • passes receipt manifest into every photo call
 *   • concurrency cap honored (implicitly via mapWithConcurrency)
 */

function photoAnalysis(
  detectedObjects: DescribePhotoOutput["detectedObjects"],
): DescribePhotoOutput {
  return {
    caption: "test photo",
    roomType: "kitchen",
    roomConfidence: 0.9,
    detectedObjects,
  };
}

function line(partial: Partial<AssetLineItemV2> & { name: string }): AssetLineItemV2 {
  // Keep the validator's arithmetic check happy: multipliers all 1.0
  // and unitCost = adjustedCost so round(qty × unit × 1 × 1 × 1 × 1)
  // exactly equals adjustedCost. Tests that care about a specific
  // multiplier should override both unitCost + multiplier explicitly.
  const adjusted = partial.adjustedCostCents ?? 8_000;
  const base: AssetLineItemV2 = {
    category: partial.category ?? "5yr",
    name: partial.name,
    quantity: 1,
    unit: "each",
    source: partial.source ?? "pricesearch",
    comparable: partial.comparable ?? { description: partial.name, unitCostCents: adjusted },
    physicalMultiplier: partial.physicalMultiplier ?? 1,
    physicalJustification: "ok",
    functionalMultiplier: 1,
    functionalJustification: "ok",
    timeMultiplier: 1,
    timeBasis: "ok",
    locationMultiplier: 1,
    locationBasis: "ok",
    adjustedCostCents: adjusted,
    rationale: "ok",
    photoDocumentId: partial.photoDocumentId,
  };
  return { ...base, ...partial };
}

function baseInput(
  overrides: Partial<ClassifyAssetsV2OrchestratorInput> = {},
): ClassifyAssetsV2OrchestratorInput {
  return {
    studyId: "study-1",
    propertyType: "SHORT_TERM_RENTAL",
    address: "123 Main St",
    squareFeet: 1800,
    yearBuilt: 1995,
    acquiredAtIso: "2024-01-15",
    buildingValueCents: 2_000_000,
    photos: [],
    improvementLineItems: [],
    ...overrides,
  };
}

describe("runFanout — skip empty photos + receipt manifest plumbing", () => {
  it("does not call classifyPhoto for photos with empty detectedObjects", async () => {
    const classifyPhoto = makePhotoFn().mockResolvedValue({ lineItems: [], assumptions: "" });
    const classifyReceipts = makeReceiptsFn().mockResolvedValue({ lineItems: [], assumptions: "" });

    await runFanout(
      baseInput({
        photos: [
          { documentId: "p1", filename: "a.jpg", analysis: photoAnalysis([]) },
          {
            documentId: "p2",
            filename: "b.jpg",
            analysis: photoAnalysis([
              {
                name: "sink",
                category: "plumbing",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
      }),
      { classifyPhoto, classifyReceipts },
    );

    expect(classifyPhoto).toHaveBeenCalledTimes(1);
    expect(classifyPhoto.mock.calls[0]![0].photo.documentId).toBe("p2");
  });

  it("threads the receipt manifest (description + category) into every photo prompt", async () => {
    const classifyPhoto = makePhotoFn().mockResolvedValue({ lineItems: [], assumptions: "" });
    const classifyReceipts = makeReceiptsFn().mockResolvedValue({ lineItems: [], assumptions: "" });

    await runFanout(
      baseInput({
        photos: [
          {
            documentId: "p1",
            filename: "kitchen.jpg",
            analysis: photoAnalysis([
              {
                name: "dishwasher",
                category: "appliance",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
        improvementLineItems: [
          { description: "new stainless dishwasher", amountCents: 85_000, category: "appliance" },
        ],
      }),
      { classifyPhoto, classifyReceipts },
    );

    const firstPhotoInput = classifyPhoto.mock.calls[0]![0];
    expect(firstPhotoInput.receiptManifest).toEqual([
      { description: "new stainless dishwasher", category: "appliance" },
    ]);
  });

  it("skips the receipts call entirely when improvementLineItems is empty", async () => {
    const classifyPhoto = makePhotoFn();
    const classifyReceipts = makeReceiptsFn();
    await runFanout(baseInput(), { classifyPhoto, classifyReceipts });
    expect(classifyReceipts).not.toHaveBeenCalled();
  });
});

describe("runFanout — balance + retry behavior", () => {
  it("retries once with the validation error threaded in when the first pass is unbalanced", async () => {
    const classifyPhoto = makePhotoFn();
    // First attempt returns a non-residual sum EXCEEDING building value →
    // balance error → retry.
    classifyPhoto
      .mockResolvedValueOnce({
        lineItems: [line({ name: "mega", adjustedCostCents: 3_000_000 })],
        assumptions: "",
      })
      .mockResolvedValueOnce({
        lineItems: [line({ name: "mega", adjustedCostCents: 500_000 })],
        assumptions: "",
      });

    const classifyReceipts = makeReceiptsFn().mockResolvedValue({ lineItems: [], assumptions: "" });

    const result = await runFanout(
      baseInput({
        buildingValueCents: 2_000_000,
        photos: [
          {
            documentId: "p1",
            filename: "a.jpg",
            analysis: photoAnalysis([
              {
                name: "mega",
                category: "furniture",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
      }),
      { classifyPhoto, classifyReceipts },
    );

    expect(classifyPhoto).toHaveBeenCalledTimes(2);
    // Second call received a priorAttemptError.
    expect(classifyPhoto.mock.calls[1]![0].priorAttemptError).toBeTruthy();
    expect(classifyPhoto.mock.calls[1]![0].priorAttemptError).toMatch(
      /exceed|non-residual|building value/i,
    );
    expect(result.balanced).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("returns balanced=false when both attempts fail the balance check", async () => {
    const classifyPhoto = makePhotoFn().mockResolvedValue({
      lineItems: [line({ name: "mega", adjustedCostCents: 3_000_000 })],
      assumptions: "",
    });
    const classifyReceipts = makeReceiptsFn().mockResolvedValue({ lineItems: [], assumptions: "" });

    const result = await runFanout(
      baseInput({
        buildingValueCents: 2_000_000,
        photos: [
          {
            documentId: "p1",
            filename: "a.jpg",
            analysis: photoAnalysis([
              {
                name: "mega",
                category: "furniture",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
      }),
      { classifyPhoto, classifyReceipts },
    );

    expect(result.balanced).toBe(false);
    expect(result.balanceMessage).toBeTruthy();
    expect(result.attempts).toBe(2);
  });

  it("threads a caller-supplied priorAttemptError (from the review-retry loop) into attempt 1", async () => {
    const classifyPhoto = makePhotoFn().mockResolvedValue({
      lineItems: [line({ name: "item", adjustedCostCents: 500_000 })],
      assumptions: "",
    });
    const classifyReceipts = makeReceiptsFn().mockResolvedValue({ lineItems: [], assumptions: "" });

    await runFanout(
      baseInput({
        buildingValueCents: 2_000_000,
        priorAttemptError: "Review gate said: items are too generic.",
        photos: [
          {
            documentId: "p1",
            filename: "a.jpg",
            analysis: photoAnalysis([
              {
                name: "item",
                category: "furniture",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
      }),
      { classifyPhoto, classifyReceipts },
    );

    expect(classifyPhoto.mock.calls[0]![0].priorAttemptError).toContain("too generic");
  });
});

describe("runFanout — stats shape", () => {
  it("reports photoCallCount + receiptsCallCount matching actual invocations", async () => {
    const classifyPhoto = makePhotoFn().mockResolvedValue({
      lineItems: [line({ name: "widget", adjustedCostCents: 50_000 })],
      assumptions: "",
    });
    const classifyReceipts = makeReceiptsFn().mockResolvedValue({
      lineItems: [line({ name: "receipt", source: "receipt", adjustedCostCents: 100_000 })],
      assumptions: "",
    });

    const result = await runFanout(
      baseInput({
        buildingValueCents: 10_000_000,
        photos: [
          {
            documentId: "p1",
            filename: "a.jpg",
            analysis: photoAnalysis([
              {
                name: "widget",
                category: "furniture",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
          {
            documentId: "p2",
            filename: "b.jpg",
            analysis: photoAnalysis([
              {
                name: "widget",
                category: "furniture",
                quantity: 1,
                condition: "good",
                conditionJustification: "ok",
              },
            ]),
          },
        ],
        improvementLineItems: [{ description: "roof", amountCents: 100_000 }],
      }),
      { classifyPhoto, classifyReceipts },
    );

    expect(result.stats.photoCallCount).toBe(2);
    expect(result.stats.receiptsCallCount).toBe(1);
    expect(result.stats.collisionsResolved).toBe(1);
    expect(result.stats.receiptLines).toBe(1);
    expect(result.stats.photoLines).toBe(1);
  });
});
