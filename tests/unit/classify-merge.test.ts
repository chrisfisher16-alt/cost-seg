import { describe, expect, it } from "vitest";

import { mergeCandidates, normalizeItemName } from "@/lib/ai/merge-candidates-v2";
import type { AssetLineItemV2 } from "@/lib/ai/prompts/classify-assets-v2";

/**
 * Regression fixtures for the v2 fan-out merge (ADR 0014). The merge
 * is the weakest link in the fan-out — a too-loose normalize
 * over-merges distinct items; too strict regresses on "same dining
 * table shot from two angles". This file seeds both shapes + the
 * receipt-never-dedupes rule + the residual-plug arithmetic.
 */

function photoItem(
  partial: Partial<AssetLineItemV2> & { name: string; docId?: string },
): AssetLineItemV2 {
  const base: AssetLineItemV2 = {
    category: partial.category ?? "5yr",
    name: partial.name,
    quantity: 1,
    unit: "each",
    source: "pricesearch",
    comparable: { description: partial.name, unitCostCents: 10_000 },
    physicalMultiplier: 0.8,
    physicalJustification: "Good condition.",
    functionalMultiplier: 1,
    functionalJustification: "Timeless item.",
    timeMultiplier: 1,
    timeBasis: "2025 basis.",
    locationMultiplier: 1,
    locationBasis: "Austin, TX.",
    adjustedCostCents: 8_000,
    rationale: "Detected in photo.",
    photoDocumentId: partial.docId,
  };
  return { ...base, ...partial } as AssetLineItemV2;
}

function receiptItem(description: string, amountCents: number): AssetLineItemV2 {
  return {
    category: "5yr",
    name: description,
    quantity: 1,
    unit: "each",
    source: "receipt",
    comparable: { description, unitCostCents: amountCents },
    physicalMultiplier: 1,
    physicalJustification: "Receipt — no adjustment.",
    functionalMultiplier: 1,
    functionalJustification: "Receipt — no adjustment.",
    timeMultiplier: 1,
    timeBasis: "Receipt — no adjustment.",
    locationMultiplier: 1,
    locationBasis: "Receipt — no adjustment.",
    adjustedCostCents: amountCents,
    rationale: description,
  };
}

describe("normalizeItemName", () => {
  it("lowercases + collapses whitespace + strips filler words", () => {
    expect(normalizeItemName("The Chrome Double Towel Bar")).toBe("chrome double towel bar");
    expect(normalizeItemName("  STAINLESS  french-door   refrigerator  ")).toBe(
      "stainless french door refrigerator",
    );
    expect(normalizeItemName("A bench with cushion")).toBe("bench cushion");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeItemName("   ")).toBe("");
    expect(normalizeItemName("")).toBe("");
  });
});

describe("mergeCandidates — dedupe invariants", () => {
  it("merges two photo candidates with same normalized name + category into ONE line", () => {
    const result = mergeCandidates({
      slices: [
        { lineItems: [photoItem({ name: "dining table", docId: "photo-a" })] },
        { lineItems: [photoItem({ name: "Dining Table", docId: "photo-b" })] },
      ],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    // One merged item + one residual
    const nonResidual = result.schedule.lineItems.filter((li) => li.isResidual !== true);
    expect(nonResidual).toHaveLength(1);
    expect(nonResidual[0]!.photoDocumentIds).toEqual(
      expect.arrayContaining(["photo-a", "photo-b"]),
    );
    expect(result.stats.collisionsResolved).toBe(1);
  });

  it("keeps the candidate with the higher physicalMultiplier on collision", () => {
    const dim = photoItem({
      name: "dishwasher",
      docId: "dim",
      physicalMultiplier: 0.4,
      comparable: { description: "stainless dishwasher", unitCostCents: 60_000 },
      adjustedCostCents: 24_000,
    });
    const clear = photoItem({
      name: "dishwasher",
      docId: "clear",
      physicalMultiplier: 1,
      comparable: { description: "stainless dishwasher", unitCostCents: 60_000 },
      adjustedCostCents: 60_000,
    });

    const result = mergeCandidates({
      slices: [{ lineItems: [dim] }, { lineItems: [clear] }],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    const merged = result.schedule.lineItems.find((li) => li.isResidual !== true)!;
    expect(merged.physicalMultiplier).toBe(1);
    expect(merged.adjustedCostCents).toBe(60_000);
    expect(merged.photoDocumentIds).toEqual(expect.arrayContaining(["dim", "clear"]));
  });

  it("does NOT merge photo candidates that share a name but have different categories", () => {
    const result = mergeCandidates({
      slices: [
        {
          lineItems: [
            photoItem({ name: "cabinet", category: "7yr", docId: "a" }),
            photoItem({ name: "cabinet", category: "15yr", docId: "b" }),
          ],
        },
      ],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    const nonResidual = result.schedule.lineItems.filter((li) => li.isResidual !== true);
    expect(nonResidual).toHaveLength(2);
    expect(result.stats.collisionsResolved).toBe(0);
  });

  it("never dedupes receipt candidates against photo candidates, even when names collide", () => {
    const result = mergeCandidates({
      slices: [
        { lineItems: [photoItem({ name: "dishwasher", docId: "photo-1" })] },
        { lineItems: [receiptItem("dishwasher", 85_000)] },
      ],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    const nonResidual = result.schedule.lineItems.filter((li) => li.isResidual !== true);
    expect(nonResidual).toHaveLength(2);
    expect(result.stats.receiptLines).toBe(1);
    expect(result.stats.photoLines).toBe(1);
  });

  it("never dedupes two receipts with the same description", () => {
    const result = mergeCandidates({
      slices: [
        {
          lineItems: [
            receiptItem("hardwood flooring installation", 300_000),
            receiptItem("hardwood flooring installation", 150_000),
          ],
        },
      ],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    expect(result.stats.receiptLines).toBe(2);
  });
});

describe("mergeCandidates — residual + illegal residual dropping", () => {
  it("always emits exactly one residual line with the property-type class", () => {
    const residential = mergeCandidates({
      slices: [{ lineItems: [photoItem({ name: "towel bar" })] }],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    const resR = residential.schedule.lineItems.filter((li) => li.isResidual === true);
    expect(resR).toHaveLength(1);
    expect(resR[0]!.category).toBe("27_5yr");

    const stNr = mergeCandidates({
      slices: [{ lineItems: [photoItem({ name: "towel bar" })] }],
      buildingValueCents: 1_000_000,
      residualClass: "39yr",
    });
    expect(stNr.schedule.lineItems.find((li) => li.isResidual === true)!.category).toBe("39yr");
  });

  it("residual cents = buildingValue - Σ(non-residual adjustedCents)", () => {
    const result = mergeCandidates({
      slices: [
        {
          lineItems: [
            photoItem({ name: "table", adjustedCostCents: 100_000 }),
            photoItem({ name: "lamp", adjustedCostCents: 50_000 }),
          ],
        },
        { lineItems: [receiptItem("new roof", 800_000)] },
      ],
      buildingValueCents: 2_000_000,
      residualClass: "27_5yr",
    });
    const residual = result.schedule.lineItems.find((li) => li.isResidual === true)!;
    expect(residual.adjustedCostCents).toBe(2_000_000 - 100_000 - 50_000 - 800_000);
    expect(residual.comparable.unitCostCents).toBe(residual.adjustedCostCents);
  });

  it("drops illegal model-emitted residuals and counts them in stats", () => {
    const sneaky: AssetLineItemV2 = {
      ...photoItem({ name: "building" }),
      isResidual: true,
    };
    const result = mergeCandidates({
      slices: [{ lineItems: [photoItem({ name: "real item" }), sneaky] }],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    expect(result.stats.illegalResidualsDropped).toBe(1);
    const residuals = result.schedule.lineItems.filter((li) => li.isResidual === true);
    expect(residuals).toHaveLength(1);
    // The real residual is the deterministic one — name proves it.
    expect(residuals[0]!.name).toBe("Building structure (residual)");
  });

  it("emits a negative residual when non-residual sum exceeds building value (caller retries)", () => {
    const result = mergeCandidates({
      slices: [{ lineItems: [photoItem({ name: "mega item", adjustedCostCents: 2_000_000 })] }],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    const residual = result.schedule.lineItems.find((li) => li.isResidual === true)!;
    expect(residual.adjustedCostCents).toBe(-1_000_000);
  });
});

describe("mergeCandidates — telemetry stats", () => {
  it("returns accurate candidate/merged counts across slices", () => {
    const result = mergeCandidates({
      slices: [
        {
          lineItems: [
            photoItem({ name: "sofa", docId: "a" }),
            photoItem({ name: "Sofa", docId: "b" }),
          ],
        },
        { lineItems: [receiptItem("roof replacement", 500_000)] },
        { lineItems: [] },
      ],
      buildingValueCents: 1_000_000,
      residualClass: "27_5yr",
    });
    expect(result.stats.candidatesIn).toBe(3);
    // 1 merged photo + 1 receipt + 1 residual = 3 final
    expect(result.stats.mergedOut).toBe(3);
    expect(result.stats.collisionsResolved).toBe(1);
    expect(result.stats.receiptLines).toBe(1);
    expect(result.stats.photoLines).toBe(1);
  });
});
