import { describe, expect, it } from "vitest";

import { statusContext, statusLabel } from "@/lib/studies/status-label";

describe("statusLabel", () => {
  it("maps every known StudyStatus to human copy", () => {
    expect(statusLabel("PENDING_PAYMENT")).toBe("Awaiting payment");
    expect(statusLabel("AWAITING_DOCUMENTS")).toBe("Upload needed");
    expect(statusLabel("PROCESSING")).toBe("Processing");
    expect(statusLabel("AI_COMPLETE")).toBe("AI complete");
    expect(statusLabel("AWAITING_ENGINEER")).toBe("In engineer queue");
    expect(statusLabel("ENGINEER_REVIEWED")).toBe("Engineer reviewed");
    expect(statusLabel("DELIVERED")).toBe("Delivered");
    expect(statusLabel("FAILED")).toBe("Failed");
    expect(statusLabel("REFUNDED")).toBe("Refunded");
  });

  it("forward-compatible: unknown status is humanized + sentence-cased", () => {
    expect(statusLabel("SOME_FUTURE_STATUS")).toBe("Some future status");
    // Single-token still capitalizes:
    expect(statusLabel("ARCHIVED")).toBe("Archived");
  });

  it("never returns the raw enum string with underscores", () => {
    const r = statusLabel("AI_COMPLETE");
    expect(r).not.toContain("_");
    expect(r).not.toBe("ai complete");
  });
});

describe("statusContext", () => {
  it("returns context for known statuses", () => {
    expect(statusContext("DELIVERED")).toMatch(/pdf.*ready/i);
    expect(statusContext("FAILED")).toMatch(/paused/i);
    expect(statusContext("AWAITING_ENGINEER")).toMatch(/engineer/i);
  });

  it("returns null for unknown statuses (caller can fall through)", () => {
    expect(statusContext("SOMETHING_NEW")).toBeNull();
  });
});
