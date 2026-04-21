import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma, type PrismaMocks } from "@/tests/stubs/prisma-mock";

/**
 * Targeted tests for the `pipelineStartedAtIso` anchor the
 * processing page reads. Regression guard on the "elapsed timer
 * resets when you navigate back" bug: the client used to derive
 * its anchor from mount time; now it derives from this server
 * field, so if this field stops being computed correctly the bug
 * returns silently.
 */

let mocks: PrismaMocks;
const requireAuthMock = vi.fn();
const assertOwnershipMock = vi.fn();

vi.mock("@/lib/db/client", () => ({ getPrisma: () => mocks }));
vi.mock("@/lib/auth/require", () => ({
  requireAuth: () => requireAuthMock(),
  assertOwnership: (...args: unknown[]) => assertOwnershipMock(...args),
}));

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;
  requireAuthMock.mockReset();
  requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "CUSTOMER" } });
  assertOwnershipMock.mockReset();
  vi.resetModules();
});

function mkStudy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s1",
    userId: "u1",
    status: "PROCESSING",
    deliverableUrl: null,
    failedReason: null,
    assetSchedule: null,
    ...overrides,
  };
}

describe("pollProcessingStateAction — pipelineStartedAtIso", () => {
  it("returns the pipeline.started event's createdAt when present", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(mkStudy());
    const started = new Date("2026-04-20T22:58:07.000Z");
    mocks.studyEvent.findMany.mockResolvedValueOnce([
      {
        id: "e-later",
        kind: "documents.classified",
        createdAt: new Date("2026-04-20T22:58:40.000Z"),
      },
      { id: "e-started", kind: "pipeline.started", createdAt: started },
    ]);
    const { pollProcessingStateAction } =
      await import("@/app/(app)/studies/[id]/processing/actions");
    const result = await pollProcessingStateAction("s1");
    if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
    expect(result.pipelineStartedAtIso).toBe(started.toISOString());
  });

  it("falls back to the oldest event when pipeline.started isn't in the 20-event window", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(mkStudy({ status: "AI_COMPLETE" }));
    const older = new Date("2026-04-20T22:59:00.000Z");
    const newer = new Date("2026-04-20T23:00:00.000Z");
    mocks.studyEvent.findMany.mockResolvedValueOnce([
      { id: "a", kind: "narrative.drafted", createdAt: newer },
      { id: "b", kind: "assets.classified", createdAt: older },
    ]);
    const { pollProcessingStateAction } =
      await import("@/app/(app)/studies/[id]/processing/actions");
    const result = await pollProcessingStateAction("s1");
    if (!result.ok) throw new Error("expected ok");
    expect(result.pipelineStartedAtIso).toBe(older.toISOString());
  });

  it("returns null when no events have been written yet (genuinely queued)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(mkStudy({ status: "AWAITING_DOCUMENTS" }));
    mocks.studyEvent.findMany.mockResolvedValueOnce([]);
    const { pollProcessingStateAction } =
      await import("@/app/(app)/studies/[id]/processing/actions");
    const result = await pollProcessingStateAction("s1");
    if (!result.ok) throw new Error("expected ok");
    expect(result.pipelineStartedAtIso).toBeNull();
  });

  it("is stable across two polls — same study, same events → same anchor", async () => {
    const started = new Date("2026-04-20T22:58:07.000Z");
    const events = [
      {
        id: "e-later",
        kind: "documents.classified",
        createdAt: new Date("2026-04-20T22:59:10.000Z"),
      },
      { id: "e-started", kind: "pipeline.started", createdAt: started },
    ];
    mocks.study.findUnique.mockResolvedValue(mkStudy());
    mocks.studyEvent.findMany.mockResolvedValue(events);
    const { pollProcessingStateAction } =
      await import("@/app/(app)/studies/[id]/processing/actions");
    const a = await pollProcessingStateAction("s1");
    const b = await pollProcessingStateAction("s1");
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.pipelineStartedAtIso).toBe(b.pipelineStartedAtIso);
    expect(a.pipelineStartedAtIso).toBe(started.toISOString());
  });
});
