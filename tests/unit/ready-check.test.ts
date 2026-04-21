import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma, type PrismaMocks } from "@/tests/stubs/prisma-mock";

/**
 * Tests for `lib/studies/ready-check.ts` — 0% covered at V1.2 wrap.
 *
 * Covers `getIntakeCompleteness` (pure, DB-backed check) and
 * `emitDocumentsReadyIfComplete` (fires `study.documents.ready` at most
 * once via a StudyEvent guard row, short-circuits on every wrong-status
 * branch).
 */

let mocks: PrismaMocks;
const safeInngestSendMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getPrisma: () => mocks,
}));

vi.mock("@/lib/studies/inngest-safe", () => ({
  safeInngestSend: (event: unknown, ctx: unknown) => safeInngestSendMock(event, ctx),
}));

const VALID_PROPERTY = {
  address: "123 Real St",
  city: "Austin",
  state: "TX",
  zip: "78704",
  purchasePrice: 500_000,
};

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;
  safeInngestSendMock.mockReset();
  safeInngestSendMock.mockResolvedValue({ ok: true });
  vi.resetModules();
});

describe("getIntakeCompleteness", () => {
  it("returns complete=true when property fields are sane and both required docs present", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ property: VALID_PROPERTY });
    mocks.document.findMany.mockResolvedValueOnce([
      { kind: "CLOSING_DISCLOSURE" },
      { kind: "PROPERTY_PHOTO" },
    ]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result).toEqual({
      propertyReady: true,
      missingKinds: [],
      complete: true,
    });
  });

  it("flags propertyReady=false when address still carries the '(provided' placeholder", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      property: { ...VALID_PROPERTY, address: "(provided during intake)" },
    });
    mocks.document.findMany.mockResolvedValueOnce([
      { kind: "CLOSING_DISCLOSURE" },
      { kind: "PROPERTY_PHOTO" },
    ]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result.propertyReady).toBe(false);
    expect(result.complete).toBe(false);
  });

  it("flags propertyReady=false for the 'XX' state sentinel", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      property: { ...VALID_PROPERTY, state: "XX" },
    });
    mocks.document.findMany.mockResolvedValueOnce([]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result.propertyReady).toBe(false);
  });

  it("flags propertyReady=false for a malformed ZIP", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      property: { ...VALID_PROPERTY, zip: "nope" },
    });
    mocks.document.findMany.mockResolvedValueOnce([]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result.propertyReady).toBe(false);
  });

  it("reports every missing required document kind", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ property: VALID_PROPERTY });
    mocks.document.findMany.mockResolvedValueOnce([]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result.missingKinds).toEqual(["CLOSING_DISCLOSURE", "PROPERTY_PHOTO"]);
    expect(result.complete).toBe(false);
  });

  it("treats an optional doc kind as fine (improvement receipts aren't required)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ property: VALID_PROPERTY });
    mocks.document.findMany.mockResolvedValueOnce([
      { kind: "CLOSING_DISCLOSURE" },
      { kind: "PROPERTY_PHOTO" },
      { kind: "IMPROVEMENT_RECEIPTS" },
    ]);
    const { getIntakeCompleteness } = await import("@/lib/studies/ready-check");
    const result = await getIntakeCompleteness("s1");
    expect(result.complete).toBe(true);
  });
});

describe("emitDocumentsReadyIfComplete", () => {
  function mockReady(opts: { status: string; priorEvent: boolean; complete: boolean }) {
    mocks.study.findUnique
      // First call: status/tier probe.
      .mockResolvedValueOnce({ id: "s1", tier: "AI_REPORT", status: opts.status })
      // Second call (inside getIntakeCompleteness).
      .mockResolvedValueOnce({ property: VALID_PROPERTY });
    mocks.document.findMany.mockResolvedValueOnce(
      opts.complete
        ? [{ kind: "CLOSING_DISCLOSURE" }, { kind: "PROPERTY_PHOTO" }]
        : [{ kind: "CLOSING_DISCLOSURE" }],
    );
    mocks.studyEvent.findFirst.mockResolvedValueOnce(opts.priorEvent ? { id: "evt" } : null);
  }

  it("returns false when the study doesn't exist", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(null);
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    const result = await emitDocumentsReadyIfComplete("ghost");
    expect(result).toBe(false);
    expect(safeInngestSendMock).not.toHaveBeenCalled();
  });

  it("returns false when the study isn't in AWAITING_DOCUMENTS", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      id: "s1",
      tier: "AI_REPORT",
      status: "PROCESSING",
    });
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    expect(await emitDocumentsReadyIfComplete("s1")).toBe(false);
    expect(safeInngestSendMock).not.toHaveBeenCalled();
  });

  it("returns false when the intake isn't complete", async () => {
    mockReady({ status: "AWAITING_DOCUMENTS", priorEvent: false, complete: false });
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    expect(await emitDocumentsReadyIfComplete("s1")).toBe(false);
    expect(safeInngestSendMock).not.toHaveBeenCalled();
  });

  it("returns false (without re-emitting) when a prior 'documents.ready' event exists", async () => {
    mockReady({ status: "AWAITING_DOCUMENTS", priorEvent: true, complete: true });
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    expect(await emitDocumentsReadyIfComplete("s1")).toBe(false);
    expect(safeInngestSendMock).not.toHaveBeenCalled();
    expect(mocks.studyEvent.create).not.toHaveBeenCalled();
  });

  it("emits + writes the guard event when everything's ready and Inngest succeeds", async () => {
    mockReady({ status: "AWAITING_DOCUMENTS", priorEvent: false, complete: true });
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    const result = await emitDocumentsReadyIfComplete("s1");
    expect(result).toBe(true);

    expect(safeInngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "study.documents.ready" }),
      expect.objectContaining({ caller: "ready-check", studyId: "s1" }),
    );
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      studyId: "s1",
      kind: "documents.ready",
      payload: expect.objectContaining({
        requiredKinds: expect.arrayContaining(["CLOSING_DISCLOSURE", "PROPERTY_PHOTO"]),
      }),
    });
  });

  it("does NOT write the guard event when Inngest send fails (so the next call retries)", async () => {
    mockReady({ status: "AWAITING_DOCUMENTS", priorEvent: false, complete: true });
    safeInngestSendMock.mockResolvedValueOnce({ ok: false, error: "ECONNREFUSED" });
    const { emitDocumentsReadyIfComplete } = await import("@/lib/studies/ready-check");
    const result = await emitDocumentsReadyIfComplete("s1");
    expect(result).toBe(false);
    expect(mocks.studyEvent.create).not.toHaveBeenCalled();
  });
});
