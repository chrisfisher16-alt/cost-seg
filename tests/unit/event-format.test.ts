import { describe, expect, it } from "vitest";

import { formatStudyEvent } from "@/lib/studies/event-format";

describe("formatStudyEvent", () => {
  it("checkout.completed — includes email + amount", () => {
    const r = formatStudyEvent("checkout.completed", {
      customerEmail: "chris@example.com",
      amountTotal: 29500,
    });
    expect(r.title).toBe("Checkout completed");
    expect(r.detail).toContain("chris@example.com");
    expect(r.detail).toContain("$295");
    expect(r.tone).toBe("success");
  });

  it("checkout.completed — survives missing payload fields", () => {
    const r = formatStudyEvent("checkout.completed", {});
    expect(r.title).toBe("Checkout completed");
    expect(r.tone).toBe("success");
    // No email or amount means detail is an empty string (or undefined) — either
    // is fine as long as the render path doesn't explode.
    expect(r.detail ?? "").not.toContain("undefined");
  });

  it("documents.ready — formats the required kinds list", () => {
    const r = formatStudyEvent("documents.ready", {
      requiredKinds: ["CLOSING_DISCLOSURE", "PROPERTY_PHOTO"],
    });
    expect(r.title).toMatch(/pipeline queued/i);
    expect(r.detail).toContain("closing disclosure");
    expect(r.detail).toContain("property photo");
    expect(r.tone).toBe("primary");
  });

  it("pipeline.failed — surfaces reason in destructive tone", () => {
    const r = formatStudyEvent("pipeline.failed", {
      reason: "Claude returned invalid JSON on second retry",
    });
    expect(r.title).toBe("Pipeline failed");
    expect(r.detail).toContain("invalid JSON");
    expect(r.tone).toBe("destructive");
  });

  it("pipeline.completed — formats reclassified basis", () => {
    const r = formatStudyEvent("pipeline.completed", {
      status: "AI_COMPLETE",
      totalCents: 147_200_00,
    });
    expect(r.title).toBe("Pipeline completed");
    expect(r.detail).toContain("AI complete");
    expect(r.detail).toContain("$147,200");
    expect(r.tone).toBe("success");
  });

  it("engineer.signed_and_delivered — shows name + license", () => {
    const r = formatStudyEvent("engineer.signed_and_delivered", {
      engineerName: "Taylor Chen, P.E.",
      engineerLicense: "CA-12345",
    });
    expect(r.title).toMatch(/engineer signed/i);
    expect(r.detail).toContain("Taylor Chen");
    expect(r.detail).toContain("PE CA-12345");
    expect(r.tone).toBe("success");
  });

  it("admin.marked_failed — surfaces prior status + reason", () => {
    const r = formatStudyEvent("admin.marked_failed", {
      priorStatus: "AWAITING_ENGINEER",
      reason: "Closing disclosure appears redacted",
    });
    expect(r.title).toMatch(/admin marked study failed/i);
    expect(r.detail).toContain("In engineer queue");
    expect(r.detail).toContain("redacted");
    expect(r.tone).toBe("destructive");
  });

  it("admin.rerun_pipeline — warning tone", () => {
    const r = formatStudyEvent("admin.rerun_pipeline", { priorStatus: "FAILED" });
    expect(r.tone).toBe("warning");
    expect(r.detail).toContain("Failed");
  });

  it("share.created + share.accepted + share.revoked — each tone matches the semantic", () => {
    expect(formatStudyEvent("share.created", { invitedEmail: "priya@acmecpa.com" }).tone).toBe(
      "primary",
    );
    expect(formatStudyEvent("share.accepted", { invitedEmail: "priya@acmecpa.com" }).tone).toBe(
      "success",
    );
    expect(formatStudyEvent("share.revoked", { shareId: "abc" }).tone).toBe("warning");
  });

  it("diy.generated — formats basis + building + line items", () => {
    const r = formatStudyEvent("diy.generated", {
      purchasePriceCents: 500_000_00,
      buildingValueCents: 380_000_00,
      lineItemCount: 42,
    });
    expect(r.title).toBe("DIY study generated");
    expect(r.detail).toContain("$500,000");
    expect(r.detail).toContain("$380,000");
    expect(r.detail).toContain("42 line items");
  });

  it("unknown kind — falls through with muted tone instead of crashing", () => {
    const r = formatStudyEvent("something.we.never.emit", { whatever: true });
    expect(r.title).toBe("something.we.never.emit");
    expect(r.tone).toBe("muted");
  });

  it("null payload — doesn't throw", () => {
    expect(() => formatStudyEvent("pipeline.failed", null)).not.toThrow();
    expect(() => formatStudyEvent("checkout.completed", undefined)).not.toThrow();
  });
});
