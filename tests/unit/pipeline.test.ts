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

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;
  transitionStudyMock.mockReset();
  transitionStudyMock.mockResolvedValue(undefined);
  captureServerMock.mockReset();
  captureServerMock.mockResolvedValue(undefined);
  inngestSendMock.mockReset();
  inngestSendMock.mockResolvedValue(undefined);
  vi.resetModules();
});

describe("loadStudyForPipeline", () => {
  it("returns the shaped row when the study exists", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      id: "s1",
      tier: "AI_REPORT",
      property: {
        propertyType: "SHORT_TERM_RENTAL",
        address: "123 Main",
        squareFeet: 1800,
        yearBuilt: 1985,
        acquiredAt: new Date("2026-04-20T12:34:56Z"),
      },
      documents: [
        {
          id: "d1",
          kind: "CLOSING_DISCLOSURE",
          filename: "cd.pdf",
          mimeType: "application/pdf",
          storagePath: "s1/cd",
        },
      ],
    });
    const { loadStudyForPipeline } = await import("@/lib/studies/pipeline");
    const loaded = await loadStudyForPipeline("s1");
    expect(loaded).toEqual({
      id: "s1",
      tier: "AI_REPORT",
      propertyType: "SHORT_TERM_RENTAL",
      address: "123 Main",
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
        },
      ],
    });
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
