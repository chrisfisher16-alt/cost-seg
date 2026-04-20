import type { StudyStatus, Tier } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { isLegalTransition, transitionStudy } from "@/lib/studies/transitions";

/**
 * Guards the legal-transition graph from `lib/studies/transitions.ts`. Three
 * layers:
 *
 *   1. `isLegalTransition` matrix — every legal edge from §2.3 passes,
 *      every not-listed edge fails, tier-specific edges gate correctly.
 *   2. `transitionStudy` happy-path — throws on illegal static transitions
 *      before hitting the DB.
 *   3. `transitionStudy` runtime guard — `updateMany.count === 0` surfaces
 *      as a thrown "refused" error (concurrent writer or missing row).
 */

// ---- isLegalTransition --------------------------------------------------

const ALL_STATUSES: StudyStatus[] = [
  "PENDING_PAYMENT",
  "AWAITING_DOCUMENTS",
  "PROCESSING",
  "AI_COMPLETE",
  "AWAITING_ENGINEER",
  "ENGINEER_REVIEWED",
  "DELIVERED",
  "FAILED",
  "REFUNDED",
];

describe("isLegalTransition — tier-independent edges", () => {
  it("allows PENDING_PAYMENT → AWAITING_DOCUMENTS for every tier", () => {
    expect(isLegalTransition("PENDING_PAYMENT", "AWAITING_DOCUMENTS", "DIY")).toBe(true);
    expect(isLegalTransition("PENDING_PAYMENT", "AWAITING_DOCUMENTS", "AI_REPORT")).toBe(true);
    expect(isLegalTransition("PENDING_PAYMENT", "AWAITING_DOCUMENTS", "ENGINEER_REVIEWED")).toBe(
      true,
    );
  });

  it("allows AI_COMPLETE → DELIVERED for every tier", () => {
    for (const tier of ["DIY", "AI_REPORT", "ENGINEER_REVIEWED"] as const) {
      expect(isLegalTransition("AI_COMPLETE", "DELIVERED", tier)).toBe(true);
    }
  });

  it("allows AWAITING_ENGINEER → ENGINEER_REVIEWED → DELIVERED for Tier 2", () => {
    expect(isLegalTransition("AWAITING_ENGINEER", "ENGINEER_REVIEWED", "ENGINEER_REVIEWED")).toBe(
      true,
    );
    expect(isLegalTransition("ENGINEER_REVIEWED", "DELIVERED", "ENGINEER_REVIEWED")).toBe(true);
  });
});

describe("isLegalTransition — tier-gated edges", () => {
  it("permits AWAITING_DOCUMENTS → PROCESSING only for AI_REPORT and ENGINEER_REVIEWED", () => {
    expect(isLegalTransition("AWAITING_DOCUMENTS", "PROCESSING", "AI_REPORT")).toBe(true);
    expect(isLegalTransition("AWAITING_DOCUMENTS", "PROCESSING", "ENGINEER_REVIEWED")).toBe(true);
    expect(isLegalTransition("AWAITING_DOCUMENTS", "PROCESSING", "DIY")).toBe(false);
  });

  it("permits AWAITING_DOCUMENTS → AI_COMPLETE only for DIY (synthesized)", () => {
    expect(isLegalTransition("AWAITING_DOCUMENTS", "AI_COMPLETE", "DIY")).toBe(true);
    expect(isLegalTransition("AWAITING_DOCUMENTS", "AI_COMPLETE", "AI_REPORT")).toBe(false);
    expect(isLegalTransition("AWAITING_DOCUMENTS", "AI_COMPLETE", "ENGINEER_REVIEWED")).toBe(false);
  });

  it("permits PROCESSING → AI_COMPLETE only for AI_REPORT (Tier 1) and DIY (rerun)", () => {
    expect(isLegalTransition("PROCESSING", "AI_COMPLETE", "AI_REPORT")).toBe(true);
    expect(isLegalTransition("PROCESSING", "AI_COMPLETE", "DIY")).toBe(true);
    expect(isLegalTransition("PROCESSING", "AI_COMPLETE", "ENGINEER_REVIEWED")).toBe(false);
  });

  it("permits PROCESSING → AWAITING_ENGINEER only for ENGINEER_REVIEWED (Tier 2)", () => {
    expect(isLegalTransition("PROCESSING", "AWAITING_ENGINEER", "ENGINEER_REVIEWED")).toBe(true);
    expect(isLegalTransition("PROCESSING", "AWAITING_ENGINEER", "AI_REPORT")).toBe(false);
    expect(isLegalTransition("PROCESSING", "AWAITING_ENGINEER", "DIY")).toBe(false);
  });

  it("without tier, tier-gated edges default to permitted (caller-facing predicate only)", () => {
    expect(isLegalTransition("AWAITING_DOCUMENTS", "PROCESSING")).toBe(true);
    expect(isLegalTransition("AWAITING_DOCUMENTS", "AI_COMPLETE")).toBe(true);
    expect(isLegalTransition("PROCESSING", "AI_COMPLETE")).toBe(true);
    expect(isLegalTransition("PROCESSING", "AWAITING_ENGINEER")).toBe(true);
  });
});

describe("isLegalTransition — failure / refund / recovery", () => {
  it("allows → FAILED from any non-terminal status", () => {
    const nonTerminal: StudyStatus[] = [
      "PENDING_PAYMENT",
      "AWAITING_DOCUMENTS",
      "PROCESSING",
      "AI_COMPLETE",
      "AWAITING_ENGINEER",
      "ENGINEER_REVIEWED",
    ];
    for (const from of nonTerminal) {
      expect(isLegalTransition(from, "FAILED")).toBe(true);
    }
  });

  it("refuses → FAILED from the terminals DELIVERED / FAILED / REFUNDED", () => {
    expect(isLegalTransition("DELIVERED", "FAILED")).toBe(false);
    expect(isLegalTransition("FAILED", "FAILED")).toBe(false);
    expect(isLegalTransition("REFUNDED", "FAILED")).toBe(false);
  });

  it("allows → REFUNDED from any status except REFUNDED itself", () => {
    for (const from of ALL_STATUSES) {
      const expected = from !== "REFUNDED";
      expect(isLegalTransition(from, "REFUNDED"), `${from} → REFUNDED`).toBe(expected);
    }
  });

  it("permits FAILED → PROCESSING (admin rerun) for AI_REPORT and ENGINEER_REVIEWED only", () => {
    expect(isLegalTransition("FAILED", "PROCESSING", "AI_REPORT")).toBe(true);
    expect(isLegalTransition("FAILED", "PROCESSING", "ENGINEER_REVIEWED")).toBe(true);
    expect(isLegalTransition("FAILED", "PROCESSING", "DIY")).toBe(false);
  });

  it("terminal states have no forward edges except REFUNDED", () => {
    for (const to of ALL_STATUSES) {
      if (to === "REFUNDED") continue;
      expect(isLegalTransition("REFUNDED", to), `REFUNDED → ${to}`).toBe(false);
    }
    for (const to of ALL_STATUSES) {
      if (to === "REFUNDED" || to === "PROCESSING") continue;
      expect(isLegalTransition("FAILED", to), `FAILED → ${to}`).toBe(false);
    }
    for (const to of ALL_STATUSES) {
      if (to === "REFUNDED") continue;
      expect(isLegalTransition("DELIVERED", to), `DELIVERED → ${to}`).toBe(false);
    }
  });
});

describe("isLegalTransition — illegal edges", () => {
  it("never permits a no-op transition (forces read-before-write)", () => {
    for (const s of ALL_STATUSES) {
      expect(isLegalTransition(s, s), `${s} → ${s}`).toBe(false);
    }
  });

  it("rejects common drift patterns", () => {
    // Skipping PROCESSING for Tier 1/2.
    expect(isLegalTransition("AWAITING_DOCUMENTS", "DELIVERED", "AI_REPORT")).toBe(false);
    // Skipping the engineer queue for Tier 2.
    expect(isLegalTransition("PROCESSING", "DELIVERED", "ENGINEER_REVIEWED")).toBe(false);
    // Jumping backwards.
    expect(isLegalTransition("DELIVERED", "AWAITING_DOCUMENTS")).toBe(false);
    expect(isLegalTransition("ENGINEER_REVIEWED", "AWAITING_ENGINEER")).toBe(false);
    // Stale "completed" interpretation — Tier 2 must go AWAITING_ENGINEER, not AI_COMPLETE.
    expect(isLegalTransition("PROCESSING", "AI_COMPLETE", "ENGINEER_REVIEWED")).toBe(false);
  });
});

// ---- transitionStudy runtime guard --------------------------------------

/**
 * Minimal mock Prisma transaction client — lets us exercise the
 * `updateMany` path of `transitionStudy` without a live DB. The tests
 * that reach this block are about the runtime guard (count check + error
 * shape); the static-graph logic is covered above.
 */
function mockTx(updateManyCount: number) {
  const updateMany = vi.fn(async () => ({ count: updateManyCount }));
  const tx = { study: { updateMany } } as unknown as Parameters<typeof transitionStudy>[0]["tx"];
  return { tx, updateMany };
}

describe("transitionStudy — static legality", () => {
  it("throws before hitting the DB on an illegal transition", async () => {
    const { tx, updateMany } = mockTx(1);
    await expect(
      transitionStudy({
        studyId: "s1",
        from: "DELIVERED",
        to: "AWAITING_DOCUMENTS",
        tx,
      }),
    ).rejects.toThrow(/illegal transition/i);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("throws on a tier-gated edge with the wrong tier (no DB hit)", async () => {
    const { tx, updateMany } = mockTx(1);
    await expect(
      transitionStudy({
        studyId: "s1",
        from: "AWAITING_DOCUMENTS",
        to: "AI_COMPLETE",
        tier: "AI_REPORT" as Tier,
        tx,
      }),
    ).rejects.toThrow(/illegal transition/i);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("transitionStudy — runtime guard", () => {
  it("passes the expected-from statuses into the where clause", async () => {
    const { tx, updateMany } = mockTx(1);
    await transitionStudy({
      studyId: "s1",
      from: "AI_COMPLETE",
      to: "DELIVERED",
      tier: "AI_REPORT" as Tier,
      extraData: { deliveredAt: new Date("2026-04-20T00:00:00Z") },
      tx,
    });
    expect(updateMany).toHaveBeenCalledOnce();
    const call = updateMany.mock.calls[0]?.[0];
    expect(call.where).toMatchObject({
      id: "s1",
      status: { in: ["AI_COMPLETE"] },
    });
    expect(call.data).toMatchObject({
      status: "DELIVERED",
      deliveredAt: expect.any(Date),
    });
  });

  it("accepts an array of allowed-from statuses (admin mark-failed)", async () => {
    const { tx, updateMany } = mockTx(1);
    await transitionStudy({
      studyId: "s1",
      from: ["PROCESSING", "AI_COMPLETE", "AWAITING_ENGINEER"],
      to: "FAILED",
      extraData: { failedReason: "manual mark" },
      tx,
    });
    const call = updateMany.mock.calls[0]?.[0];
    expect(call.where.status).toEqual({
      in: ["PROCESSING", "AI_COMPLETE", "AWAITING_ENGINEER"],
    });
  });

  it("throws 'refused' when count === 0 (row missing or already transitioned)", async () => {
    const { tx } = mockTx(0);
    await expect(
      transitionStudy({
        studyId: "ghost",
        from: "AI_COMPLETE",
        to: "DELIVERED",
        tier: "AI_REPORT" as Tier,
        tx,
      }),
    ).rejects.toThrow(/refused to move study ghost to DELIVERED/);
  });
});
