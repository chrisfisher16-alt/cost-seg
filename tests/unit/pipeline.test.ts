import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma, type PrismaMocks } from "@/tests/stubs/prisma-mock";

/**
 * Tests for `lib/studies/pipeline.ts` — 0% covered at V1.2 wrap.
 *
 * Focuses on the non-AI helpers (loadStudyForPipeline,
 * persistClassifierFields, findClosingDisclosureFields,
 * collectImprovementLineItems, finalizeStudy, markStudyFailed). The AI
 * step wrappers (runClassifyDocumentsBatch, runDecompose, runClassifyAssets,
 * runNarrative) are thin passthroughs to modules already covered by
 * tests/unit/ai-*.test.ts.
 */

let mocks: PrismaMocks;
const transitionStudyMock = vi.fn();
const captureServerMock = vi.fn();
const inngestSendMock = vi.fn();
const describePhotoMock = vi.fn();
const classifyAssetsV2Mock = vi.fn();
const enrichPropertyMock = vi.fn();
const decomposePriceMock = vi.fn();

vi.mock("@/lib/db/client", () => ({ getPrisma: () => mocks }));
vi.mock("@/lib/studies/transitions", () => ({
  transitionStudy: (args: unknown) => transitionStudyMock(args),
}));
vi.mock("@/lib/observability/posthog-server", () => ({
  captureServer: (id: string, event: string, props: unknown) => captureServerMock(id, event, props),
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: (arg: unknown) => inngestSendMock(arg) },
}));
vi.mock("@/lib/ai/steps/describe-photos", () => ({
  describePhoto: (args: unknown) => describePhotoMock(args),
}));
vi.mock("@/lib/ai/steps/classify-assets-v2", () => ({
  classifyAssetsV2: (args: unknown) => classifyAssetsV2Mock(args),
}));
vi.mock("@/lib/ai/steps/enrich-property", () => ({
  enrichProperty: (args: unknown) => enrichPropertyMock(args),
}));
vi.mock("@/lib/ai/steps/decompose-price", () => ({
  decomposePrice: (args: unknown) => decomposePriceMock(args),
}));

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;
  transitionStudyMock.mockReset();
  transitionStudyMock.mockResolvedValue(undefined);
  captureServerMock.mockReset();
  captureServerMock.mockResolvedValue(undefined);
  inngestSendMock.mockReset();
  inngestSendMock.mockResolvedValue(undefined);
  describePhotoMock.mockReset();
  classifyAssetsV2Mock.mockReset();
  enrichPropertyMock.mockReset();
  decomposePriceMock.mockReset();
  vi.resetModules();
});

describe("loadStudyForPipeline", () => {
  it("returns the shaped row when the study exists", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      id: "s1",
      tier: "AI_REPORT",
      propertyId: "prop1",
      property: {
        propertyType: "SHORT_TERM_RENTAL",
        address: "123 Main",
        city: "Austin",
        state: "TX",
        zip: "78701",
        squareFeet: 1800,
        yearBuilt: 1985,
        acquiredAt: new Date("2026-04-20T12:34:56Z"),
        enrichmentJson: null,
      },
      documents: [
        {
          id: "d1",
          kind: "CLOSING_DISCLOSURE",
          filename: "cd.pdf",
          mimeType: "application/pdf",
          storagePath: "s1/cd",
          roomTag: null,
        },
      ],
    });
    const { loadStudyForPipeline } = await import("@/lib/studies/pipeline");
    const loaded = await loadStudyForPipeline("s1");
    expect(loaded).toEqual({
      id: "s1",
      tier: "AI_REPORT",
      propertyId: "prop1",
      propertyType: "SHORT_TERM_RENTAL",
      address: "123 Main",
      city: "Austin",
      state: "TX",
      zip: "78701",
      squareFeet: 1800,
      yearBuilt: 1985,
      acquiredAtIso: "2026-04-20", // ISO → date-only slice
      documents: [
        {
          id: "d1",
          kind: "CLOSING_DISCLOSURE",
          filename: "cd.pdf",
          mimeType: "application/pdf",
          storagePath: "s1/cd",
          roomTag: null,
        },
      ],
      enrichment: null,
    });
  });

  it("hydrates enrichment from the stored JSON when present", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      id: "s2",
      tier: "AI_REPORT",
      propertyId: "prop2",
      property: {
        propertyType: "SINGLE_FAMILY_RENTAL",
        address: "207 S Edison",
        city: "Fredericksburg",
        state: "TX",
        zip: "78624",
        squareFeet: 2197,
        yearBuilt: 1920,
        acquiredAt: new Date("2022-03-21T00:00:00Z"),
        enrichmentJson: {
          assessorLandValueCents: 15_508_000,
          assessorTotalValueCents: 53_600_000,
          assessorUrl: "https://gillespiecad.org/property/R012345",
          confidence: { overall: 0.9, assessor: 0.95, listing: 0.8 },
        },
      },
      documents: [],
    });
    const { loadStudyForPipeline } = await import("@/lib/studies/pipeline");
    const loaded = await loadStudyForPipeline("s2");
    expect(loaded.enrichment).not.toBeNull();
    expect(loaded.enrichment?.assessorLandValueCents).toBe(15_508_000);
    expect(loaded.enrichment?.assessorUrl).toBe("https://gillespiecad.org/property/R012345");
  });

  it("treats malformed enrichment JSON as null rather than throwing", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      id: "s3",
      tier: "AI_REPORT",
      propertyId: "prop3",
      property: {
        propertyType: "SHORT_TERM_RENTAL",
        address: "1 bad",
        city: "A",
        state: "TX",
        zip: "00000",
        squareFeet: null,
        yearBuilt: null,
        acquiredAt: new Date("2020-01-01"),
        enrichmentJson: { wrong: "shape" }, // missing required confidence block
      },
      documents: [],
    });
    const { loadStudyForPipeline } = await import("@/lib/studies/pipeline");
    const loaded = await loadStudyForPipeline("s3");
    expect(loaded.enrichment).toBeNull();
  });

  it("throws when the study is not found", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(null);
    const { loadStudyForPipeline } = await import("@/lib/studies/pipeline");
    await expect(loadStudyForPipeline("ghost")).rejects.toThrow(/not found/i);
  });
});

describe("persistClassifierFields", () => {
  it("writes one document.update per classifier row", async () => {
    mocks.document.update.mockResolvedValue({});
    const { persistClassifierFields } = await import("@/lib/studies/pipeline");
    await persistClassifierFields([
      {
        documentId: "d1",
        kind: "CLOSING_DISCLOSURE",
        confidence: 0.9,
        extractedFields: { purchasePriceCents: 50000 },
      },
      { documentId: "d2", kind: "PROPERTY_PHOTO", confidence: 0.8, extractedFields: {} },
    ]);
    expect(mocks.document.update).toHaveBeenCalledTimes(2);
    const firstCall = mocks.document.update.mock.calls[0]?.[0];
    expect(firstCall?.where).toEqual({ id: "d1" });
    expect(firstCall?.data.extractedJson).toMatchObject({
      kind: "CLOSING_DISCLOSURE",
      confidence: 0.9,
      extractedFields: { purchasePriceCents: 50000 },
    });
  });
});

describe("runDescribePhotosBatch", () => {
  const baseStudy = {
    id: "s1",
    tier: "AI_REPORT" as const,
    propertyId: "prop1",
    propertyType: "SHORT_TERM_RENTAL" as const,
    address: "207 S Edison",
    city: "Fredericksburg",
    state: "TX",
    zip: "78624",
    squareFeet: 2197,
    yearBuilt: 1920,
    acquiredAtIso: "2022-03-21",
    enrichment: null,
  };

  it("returns an empty array when no photos were uploaded", async () => {
    const { runDescribePhotosBatch } = await import("@/lib/studies/pipeline");
    const result = await runDescribePhotosBatch({
      ...baseStudy,
      documents: [
        {
          id: "d1",
          kind: "CLOSING_DISCLOSURE",
          filename: "cd.pdf",
          mimeType: "application/pdf",
          storagePath: "s1/cd",
          roomTag: null,
        },
      ],
    });
    expect(result).toEqual([]);
    expect(describePhotoMock).not.toHaveBeenCalled();
  });

  it("calls describePhoto once per PROPERTY_PHOTO with index + totalPhotos threaded", async () => {
    describePhotoMock.mockResolvedValueOnce({
      caption: "kitchen with stainless appliances",
      roomType: "kitchen",
      roomConfidence: 0.95,
      detectedObjects: [
        {
          name: "stainless french-door refrigerator",
          category: "appliance",
          quantity: 1,
          condition: "good",
          conditionJustification: "visible smudges but no dents",
        },
      ],
    });
    describePhotoMock.mockResolvedValueOnce({
      caption: "primary bath vanity",
      roomType: "primary_bath",
      roomConfidence: 0.9,
      detectedObjects: [],
    });

    const { runDescribePhotosBatch } = await import("@/lib/studies/pipeline");
    const result = await runDescribePhotosBatch({
      ...baseStudy,
      documents: [
        // non-photo doc — should be skipped
        {
          id: "d-cd",
          kind: "CLOSING_DISCLOSURE",
          filename: "cd.pdf",
          mimeType: "application/pdf",
          storagePath: "s1/cd",
          roomTag: null,
        },
        {
          id: "p1",
          kind: "PROPERTY_PHOTO",
          filename: "kitchen.jpg",
          mimeType: "image/jpeg",
          storagePath: "s1/p1",
          roomTag: "kitchen",
        },
        {
          id: "p2",
          kind: "PROPERTY_PHOTO",
          filename: "bath.jpg",
          mimeType: "image/jpeg",
          storagePath: "s1/p2",
          roomTag: null,
        },
      ],
    });

    expect(describePhotoMock).toHaveBeenCalledTimes(2);
    const firstCall = describePhotoMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCall).toMatchObject({
      studyId: "s1",
      documentId: "p1",
      filename: "kitchen.jpg",
      roomTagHint: "kitchen",
      photoIndex: 1,
      totalPhotos: 2,
    });
    const secondCall = describePhotoMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(secondCall).toMatchObject({
      documentId: "p2",
      roomTagHint: null,
      photoIndex: 2,
      totalPhotos: 2,
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.documentId).toBe("p1");
    expect(result[0]?.output.caption).toMatch(/kitchen/i);
  });
});

describe("persistPhotoAnalysis", () => {
  it("writes one document.update per batch row with photoAnalysis set", async () => {
    mocks.document.update.mockResolvedValue({});
    const { persistPhotoAnalysis } = await import("@/lib/studies/pipeline");
    await persistPhotoAnalysis([
      {
        documentId: "p1",
        output: {
          caption: "kitchen",
          roomType: "kitchen",
          roomConfidence: 0.95,
          detectedObjects: [
            {
              name: "fridge",
              category: "appliance",
              quantity: 1,
              condition: "good",
              conditionJustification: "normal wear",
            },
          ],
        },
      },
      {
        documentId: "p2",
        output: {
          caption: "bath",
          roomType: "primary_bath",
          roomConfidence: 0.9,
          detectedObjects: [],
        },
      },
    ]);
    expect(mocks.document.update).toHaveBeenCalledTimes(2);
    const firstCall = mocks.document.update.mock.calls[0]?.[0];
    expect(firstCall?.where).toEqual({ id: "p1" });
    expect(firstCall?.data.photoAnalysis).toMatchObject({
      caption: "kitchen",
      roomType: "kitchen",
      detectedObjects: [expect.objectContaining({ name: "fridge" })],
    });
  });
});

describe("runClassifyAssetsV2", () => {
  const baseStudy = {
    id: "s1",
    tier: "AI_REPORT" as const,
    propertyId: "prop1",
    propertyType: "SHORT_TERM_RENTAL" as const,
    address: "207 S Edison",
    city: "Fredericksburg",
    state: "TX",
    zip: "78624",
    squareFeet: 2197,
    yearBuilt: 1920,
    acquiredAtIso: "2022-03-21",
    enrichment: null,
  };

  it("fetches photoAnalysis from the DB, filters malformed rows, and passes parsed photos to classifyAssetsV2", async () => {
    mocks.document.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        filename: "kitchen.jpg",
        photoAnalysis: {
          caption: "kitchen",
          roomType: "kitchen",
          roomConfidence: 0.95,
          detectedObjects: [
            {
              name: "fridge",
              category: "appliance",
              quantity: 1,
              condition: "good",
              conditionJustification: "normal wear",
            },
          ],
        },
      },
      {
        id: "p2",
        filename: "bath.jpg",
        photoAnalysis: null, // unprocessed photo → skipped
      },
      {
        id: "p3",
        filename: "corrupted.jpg",
        photoAnalysis: { wrong: "shape" }, // malformed → filtered
      },
    ]);
    classifyAssetsV2Mock.mockResolvedValueOnce({
      schedule: { lineItems: [], assumptions: "" },
      attempts: 1,
      balanced: true,
      residualCents: 1_000,
    });

    const { runClassifyAssetsV2 } = await import("@/lib/studies/pipeline");
    await runClassifyAssetsV2(
      {
        ...baseStudy,
        documents: [
          {
            id: "p1",
            kind: "PROPERTY_PHOTO",
            filename: "kitchen.jpg",
            mimeType: "image/jpeg",
            storagePath: "s1/p1",
            roomTag: null,
          },
          {
            id: "p2",
            kind: "PROPERTY_PHOTO",
            filename: "bath.jpg",
            mimeType: "image/jpeg",
            storagePath: "s1/p2",
            roomTag: null,
          },
          {
            id: "p3",
            kind: "PROPERTY_PHOTO",
            filename: "corrupted.jpg",
            mimeType: "image/jpeg",
            storagePath: "s1/p3",
            roomTag: null,
          },
        ],
      },
      2_000_000,
      [{ description: "HVAC", amountCents: 500_000 }],
    );

    expect(classifyAssetsV2Mock).toHaveBeenCalledTimes(1);
    const call = classifyAssetsV2Mock.mock.calls[0]?.[0] as {
      photos: Array<{ documentId: string }>;
      buildingValueCents: number;
      improvementLineItems: Array<{ description: string }>;
    };
    expect(call.buildingValueCents).toBe(2_000_000);
    expect(call.photos).toHaveLength(1);
    expect(call.photos[0]?.documentId).toBe("p1");
    expect(call.improvementLineItems).toEqual([{ description: "HVAC", amountCents: 500_000 }]);
  });

  it("handles a photo-less study without querying the DB", async () => {
    classifyAssetsV2Mock.mockResolvedValueOnce({
      schedule: { lineItems: [], assumptions: "" },
      attempts: 1,
      balanced: true,
      residualCents: 1_000,
    });

    const { runClassifyAssetsV2 } = await import("@/lib/studies/pipeline");
    await runClassifyAssetsV2(
      {
        ...baseStudy,
        documents: [
          {
            id: "d1",
            kind: "CLOSING_DISCLOSURE",
            filename: "cd.pdf",
            mimeType: "application/pdf",
            storagePath: "s1/cd",
            roomTag: null,
          },
        ],
      },
      1_000_000,
      [],
    );

    expect(mocks.document.findMany).not.toHaveBeenCalled();
    const call = classifyAssetsV2Mock.mock.calls[0]?.[0] as { photos: unknown[] };
    expect(call.photos).toEqual([]);
  });
});

describe("runEnrichProperty + persistEnrichment", () => {
  const baseStudy = {
    id: "s1",
    tier: "AI_REPORT" as const,
    propertyId: "prop1",
    propertyType: "SINGLE_FAMILY_RENTAL" as const,
    address: "207 S Edison",
    city: "Fredericksburg",
    state: "TX",
    zip: "78624",
    squareFeet: 2197,
    yearBuilt: 1920,
    acquiredAtIso: "2022-03-21",
    documents: [],
    enrichment: null,
  };

  it("calls enrichProperty with address + intake hints", async () => {
    enrichPropertyMock.mockResolvedValueOnce({
      squareFeet: 2197,
      yearBuilt: 1920,
      assessorLandValueCents: 15_508_000,
      assessorTotalValueCents: 53_600_000,
      assessorUrl: "https://gillespiecad.org/property/R012345",
      confidence: { overall: 0.9, assessor: 0.95, listing: 0.8 },
    });
    const { runEnrichProperty } = await import("@/lib/studies/pipeline");
    const result = await runEnrichProperty(baseStudy);
    expect(enrichPropertyMock).toHaveBeenCalledTimes(1);
    const call = enrichPropertyMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).toMatchObject({
      propertyId: "prop1",
      address: "207 S Edison",
      city: "Fredericksburg",
      state: "TX",
      zip: "78624",
      intakeSquareFeet: 2197,
      intakeYearBuilt: 1920,
    });
    expect(result.assessorLandValueCents).toBe(15_508_000);
  });

  it("persists the enrichment JSON onto the Property row", async () => {
    mocks.property.update.mockResolvedValueOnce({});
    const { persistEnrichment } = await import("@/lib/studies/pipeline");
    await persistEnrichment("prop1", {
      assessorLandValueCents: 15_508_000,
      assessorTotalValueCents: 53_600_000,
      assessorUrl: "https://gillespiecad.org/property/R012345",
      confidence: { overall: 0.9, assessor: 0.95, listing: 0.8 },
    });
    expect(mocks.property.update).toHaveBeenCalledTimes(1);
    const call = mocks.property.update.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ id: "prop1" });
    expect(call?.data.enrichmentJson).toMatchObject({
      assessorLandValueCents: 15_508_000,
      assessorUrl: "https://gillespiecad.org/property/R012345",
    });
  });
});

describe("runDecompose threads enrichment through", () => {
  const baseStudy = {
    id: "s1",
    tier: "AI_REPORT" as const,
    propertyId: "prop1",
    propertyType: "SINGLE_FAMILY_RENTAL" as const,
    address: "207 S Edison",
    city: "Fredericksburg",
    state: "TX",
    zip: "78624",
    squareFeet: 2197,
    yearBuilt: 1920,
    acquiredAtIso: "2022-03-21",
    documents: [],
  };

  it("passes the assessor block into decomposePrice when enrichment is present", async () => {
    decomposePriceMock.mockResolvedValueOnce({
      purchasePriceCents: 100,
      landValueCents: 29,
      buildingValueCents: 71,
      landAllocationPct: 0.289,
      methodology: "Rule 2.",
      confidence: 0.9,
    });
    const { runDecompose } = await import("@/lib/studies/pipeline");
    await runDecompose(
      {
        ...baseStudy,
        enrichment: {
          assessorLandValueCents: 15_508_000,
          assessorTotalValueCents: 53_600_000,
          assessorUrl: "https://gillespiecad.org/property/R012345",
          confidence: { overall: 0.9, assessor: 0.95, listing: 0.8 },
        },
      },
      { purchasePriceCents: 100 },
    );
    const call = decomposePriceMock.mock.calls[0]?.[0] as { enrichment?: Record<string, unknown> };
    expect(call.enrichment).toMatchObject({
      assessorLandValueCents: 15_508_000,
      assessorTotalValueCents: 53_600_000,
      assessorUrl: "https://gillespiecad.org/property/R012345",
    });
  });

  it("omits the enrichment block when study has no enrichment", async () => {
    decomposePriceMock.mockResolvedValueOnce({
      purchasePriceCents: 100,
      landValueCents: 30,
      buildingValueCents: 70,
      landAllocationPct: 0.3,
      methodology: "Rule 3.",
      confidence: 0.5,
    });
    const { runDecompose } = await import("@/lib/studies/pipeline");
    await runDecompose({ ...baseStudy, enrichment: null }, {});
    const call = decomposePriceMock.mock.calls[0]?.[0] as { enrichment?: unknown };
    expect(call.enrichment).toBeUndefined();
  });
});

describe("findClosingDisclosureFields", () => {
  it("returns the CD's extractedFields when present", async () => {
    const { findClosingDisclosureFields } = await import("@/lib/studies/pipeline");
    const result = findClosingDisclosureFields([
      {
        documentId: "d1",
        kind: "CLOSING_DISCLOSURE",
        confidence: 0.95,
        extractedFields: { foo: 1 },
      },
      { documentId: "d2", kind: "PROPERTY_PHOTO", confidence: 0.9, extractedFields: { bar: 2 } },
    ]);
    expect(result).toEqual({ foo: 1 });
  });

  it("returns null when no CD is present", async () => {
    const { findClosingDisclosureFields } = await import("@/lib/studies/pipeline");
    expect(
      findClosingDisclosureFields([
        { documentId: "d1", kind: "PROPERTY_PHOTO", confidence: 0.9, extractedFields: {} },
      ]),
    ).toBeNull();
  });
});

describe("collectImprovementLineItems", () => {
  it("flattens line items from every IMPROVEMENT_RECEIPTS row", async () => {
    const { collectImprovementLineItems } = await import("@/lib/studies/pipeline");
    const result = collectImprovementLineItems([
      {
        documentId: "d1",
        kind: "IMPROVEMENT_RECEIPTS",
        confidence: 0.9,
        extractedFields: {
          lineItems: [
            { description: "HVAC", amountCents: 500000, dateIso: "2024-03-01", category: "HVAC" },
            { description: "Flooring", amountCents: 200000 },
          ],
        },
      },
      {
        documentId: "d2",
        kind: "IMPROVEMENT_RECEIPTS",
        confidence: 0.85,
        extractedFields: {
          lineItems: [{ description: "Paint", amountCents: 50000 }],
        },
      },
    ]);
    expect(result).toEqual([
      { description: "HVAC", amountCents: 500000, dateIso: "2024-03-01", category: "HVAC" },
      { description: "Flooring", amountCents: 200000, dateIso: undefined, category: undefined },
      { description: "Paint", amountCents: 50000, dateIso: undefined, category: undefined },
    ]);
  });

  it("skips rows without a lineItems array", async () => {
    const { collectImprovementLineItems } = await import("@/lib/studies/pipeline");
    const result = collectImprovementLineItems([
      {
        documentId: "d1",
        kind: "IMPROVEMENT_RECEIPTS",
        confidence: 0.5,
        extractedFields: { lineItems: "oops" }, // wrong shape
      },
    ]);
    expect(result).toEqual([]);
  });

  it("skips malformed line-item entries (missing description / amountCents)", async () => {
    const { collectImprovementLineItems } = await import("@/lib/studies/pipeline");
    const result = collectImprovementLineItems([
      {
        documentId: "d1",
        kind: "IMPROVEMENT_RECEIPTS",
        confidence: 0.5,
        extractedFields: {
          lineItems: [
            { description: "ok", amountCents: 100 },
            { description: 42, amountCents: 100 }, // bad description type
            { amountCents: 100 }, // missing description
            { description: "no amount" }, // missing amountCents
          ],
        },
      },
    ]);
    expect(result).toEqual([
      { description: "ok", amountCents: 100, dateIso: undefined, category: undefined },
    ]);
  });

  it("ignores non-IMPROVEMENT_RECEIPTS rows even when they have a lineItems array", async () => {
    const { collectImprovementLineItems } = await import("@/lib/studies/pipeline");
    const result = collectImprovementLineItems([
      {
        documentId: "d1",
        kind: "CLOSING_DISCLOSURE",
        confidence: 0.9,
        extractedFields: {
          lineItems: [{ description: "nope", amountCents: 1 }],
        },
      },
    ]);
    expect(result).toEqual([]);
  });
});

describe("finalizeStudy", () => {
  it("transitions PROCESSING → AI_COMPLETE for AI_REPORT + emits Inngest follow-on", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ userId: "u1" });
    const { finalizeStudy } = await import("@/lib/studies/pipeline");
    await finalizeStudy({
      studyId: "s1",
      tier: "AI_REPORT",
      decomposition: { a: 1 },
      schedule: { b: 2 },
      narrative: { c: 3 },
      assetScheduleTotalCents: 123_000_00,
    });
    expect(transitionStudyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: "s1",
        from: "PROCESSING",
        to: "AI_COMPLETE",
        tier: "AI_REPORT",
      }),
    );
    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "study.ai.complete" }),
    );
  });

  it("transitions PROCESSING → AWAITING_ENGINEER for ENGINEER_REVIEWED + does NOT emit follow-on", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ userId: "u1" });
    const { finalizeStudy } = await import("@/lib/studies/pipeline");
    await finalizeStudy({
      studyId: "s1",
      tier: "ENGINEER_REVIEWED",
      decomposition: {},
      schedule: {},
      narrative: {},
      assetScheduleTotalCents: 0,
    });
    expect(transitionStudyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: "s1",
        from: "PROCESSING",
        to: "AWAITING_ENGINEER",
        tier: "ENGINEER_REVIEWED",
      }),
    );
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("writes a pipeline.completed StudyEvent alongside the transition", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ userId: "u1" });
    const { finalizeStudy } = await import("@/lib/studies/pipeline");
    await finalizeStudy({
      studyId: "s1",
      tier: "AI_REPORT",
      decomposition: {},
      schedule: {},
      narrative: {},
      assetScheduleTotalCents: 42,
    });
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      studyId: "s1",
      kind: "pipeline.completed",
      payload: expect.objectContaining({ status: "AI_COMPLETE", totalCents: 42 }),
    });
  });

  it("captures study_ai_complete on the user's distinctId after the transition", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ userId: "u1" });
    const { finalizeStudy } = await import("@/lib/studies/pipeline");
    await finalizeStudy({
      studyId: "s1",
      tier: "AI_REPORT",
      decomposition: {},
      schedule: {},
      narrative: {},
      assetScheduleTotalCents: 0,
    });
    expect(captureServerMock).toHaveBeenCalledWith(
      "u1",
      "study_ai_complete",
      expect.objectContaining({ studyId: "s1", tier: "AI_REPORT" }),
    );
  });

  it("falls back to a study:<id> distinctId when userId can't be resolved", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(null);
    const { finalizeStudy } = await import("@/lib/studies/pipeline");
    await finalizeStudy({
      studyId: "s1",
      tier: "AI_REPORT",
      decomposition: {},
      schedule: {},
      narrative: {},
      assetScheduleTotalCents: 0,
    });
    expect(captureServerMock).toHaveBeenCalledWith(
      "study:s1",
      "study_ai_complete",
      expect.anything(),
    );
  });
});

describe("markStudyFailed", () => {
  it("transitions any non-terminal → FAILED with the failedReason + writes pipeline.failed event", async () => {
    const { markStudyFailed } = await import("@/lib/studies/pipeline");
    await markStudyFailed("s1", "missing closing disclosure");

    expect(transitionStudyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: "s1",
        from: expect.arrayContaining([
          "PENDING_PAYMENT",
          "AWAITING_DOCUMENTS",
          "PROCESSING",
          "AI_COMPLETE",
          "AWAITING_ENGINEER",
          "ENGINEER_REVIEWED",
        ]),
        to: "FAILED",
        extraData: { failedReason: "missing closing disclosure" },
      }),
    );
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      studyId: "s1",
      kind: "pipeline.failed",
      payload: { reason: "missing closing disclosure" },
    });
  });
});
