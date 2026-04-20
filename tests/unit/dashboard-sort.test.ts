import { describe, expect, it } from "vitest";

import { sortStudiesByWorkPriority } from "@/lib/studies/dashboard-sort";

const d = (iso: string) => new Date(iso);

describe("sortStudiesByWorkPriority", () => {
  it("floats AWAITING_DOCUMENTS above DELIVERED even when delivered is newer", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "d", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "awd", status: "AWAITING_DOCUMENTS", updatedAt: d("2026-01-01T00:00:00Z") },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["awd", "d"]);
  });

  it("groups work-in-progress (priority 1) above DELIVERED", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "delivered", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "processing", status: "PROCESSING", updatedAt: d("2026-04-20T11:00:00Z") },
      { id: "awaiting-eng", status: "AWAITING_ENGINEER", updatedAt: d("2026-04-20T10:00:00Z") },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["processing", "awaiting-eng", "delivered"]);
  });

  it("user-actionable states (priority 0) beat in-flight (priority 1)", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "proc", status: "PROCESSING", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "awd", status: "AWAITING_DOCUMENTS", updatedAt: d("2026-04-20T10:00:00Z") },
      { id: "pay", status: "PENDING_PAYMENT", updatedAt: d("2026-04-20T09:00:00Z") },
    ]);
    // AWAITING_DOCUMENTS + PENDING_PAYMENT share priority 0 — within the
    // group, updatedAt desc decides. AWD is newer.
    expect(sorted.map((s) => s.id)).toEqual(["awd", "pay", "proc"]);
  });

  it("FAILED sinks below DELIVERED, REFUNDED sinks lowest", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "refunded", status: "REFUNDED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "failed", status: "FAILED", updatedAt: d("2026-04-20T11:00:00Z") },
      { id: "delivered", status: "DELIVERED", updatedAt: d("2026-04-20T10:00:00Z") },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["delivered", "failed", "refunded"]);
  });

  it("breaks ties by updatedAt desc within the same priority bucket", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "old", status: "DELIVERED", updatedAt: d("2026-01-01T00:00:00Z") },
      { id: "new", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "mid", status: "DELIVERED", updatedAt: d("2026-03-01T00:00:00Z") },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("unknown statuses slot between delivered and failed (forward-compat)", () => {
    const sorted = sortStudiesByWorkPriority([
      { id: "delivered", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "failed", status: "FAILED", updatedAt: d("2026-04-20T11:00:00Z") },
      { id: "new-status", status: "SOMETHING_NEW", updatedAt: d("2026-04-20T10:00:00Z") },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["delivered", "new-status", "failed"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "a", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z") },
      { id: "b", status: "AWAITING_DOCUMENTS", updatedAt: d("2026-04-20T11:00:00Z") },
    ];
    const snapshot = [...input];
    sortStudiesByWorkPriority(input);
    expect(input).toEqual(snapshot);
  });

  it("handles empty input", () => {
    expect(sortStudiesByWorkPriority([])).toEqual([]);
  });

  it("preserves extra fields on the sorted objects", () => {
    interface Row {
      id: string;
      status: string;
      updatedAt: Date;
      extra: string;
    }
    const sorted = sortStudiesByWorkPriority<Row>([
      { id: "a", status: "DELIVERED", updatedAt: d("2026-04-20T12:00:00Z"), extra: "keep-me" },
    ]);
    expect(sorted[0]!.extra).toBe("keep-me");
  });
});
