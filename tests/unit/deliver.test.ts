import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma, type PrismaMocks } from "@/tests/stubs/prisma-mock";

/**
 * Tests for `lib/studies/deliver.ts` — 1.35% covered at V1.2 wrap.
 *
 * Covers the three exported functions:
 *   • `deliverAiReport` — Tier 1 + DIY; idempotency, tier rejection,
 *     missing-assetSchedule guard, upload failure bubble, email-failure
 *     tolerance, happy-path writes (transitionStudy + StudyEvent +
 *     delivery_email_sent PostHog capture).
 *   • `deliverEngineeredStudy` — Tier 2 only; already-delivered guard,
 *     tier rejection, happy path.
 *   • `resendDeliveryEmail` — refuses non-DELIVERED; refreshes signed URL;
 *     writes `admin.delivery_email_resent` StudyEvent; no status change.
 *
 * Partial-failure semantics: email failure must NOT prevent the Study from
 * reaching DELIVERED — the money already changed hands and the admin can
 * resend via the inspector. Upload failure DOES bubble, because a missing
 * PDF in storage is worse than a pending delivery.
 */

let mocks: PrismaMocks;

const renderAiReportPdfMock = vi.fn();
const sendReportDeliveredEmailMock = vi.fn();
const createSignedReadUrlMock = vi.fn();
const supabaseUploadMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const transitionStudyMock = vi.fn();
const captureServerMock = vi.fn();

vi.mock("@/lib/db/client", () => ({ getPrisma: () => mocks }));
vi.mock("@/lib/pdf/render", () => ({
  renderAiReportPdf: (arg: unknown) => renderAiReportPdfMock(arg),
}));
vi.mock("@/lib/email/send", () => ({
  sendReportDeliveredEmail: (arg: unknown) => sendReportDeliveredEmailMock(arg),
}));
vi.mock("@/lib/storage/studies", () => ({
  STUDIES_BUCKET: "studies",
  createSignedReadUrl: (path: string, exp: number) => createSignedReadUrlMock(path, exp),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));
vi.mock("@/lib/studies/transitions", () => ({
  transitionStudy: (args: unknown) => transitionStudyMock(args),
}));
vi.mock("@/lib/observability/posthog-server", () => ({
  captureServer: (id: string, event: string, props: unknown) => captureServerMock(id, event, props),
}));

const STUDY_BASE = {
  id: "s1",
  tier: "AI_REPORT" as const,
  status: "AI_COMPLETE" as const,
  userId: "u1",
  deliverableUrl: null,
  assetSchedule: {
    decomposition: {
      purchasePriceCents: 50_000_000,
      landValueCents: 10_000_000,
      buildingValueCents: 40_000_000,
      landAllocationPct: 0.2,
      methodology: "residual",
      confidence: 0.85,
    },
    schedule: {
      lineItems: [
        { category: "5yr", name: "HVAC", amountCents: 1_000_000, basis: "receipt", rationale: "" },
      ],
      assumptions: "",
    },
    narrative: {
      executiveSummary: "",
      propertyDescription: "",
      methodology: "",
      assetScheduleExplanation: "",
      scheduleSummaryTable: "",
    },
    totalCents: 40_000_000,
  },
  user: { email: "buyer@example.com", name: "Jane Buyer" },
  property: {
    address: "123 Main",
    city: "Austin",
    state: "TX",
    zip: "78704",
    propertyType: "SHORT_TERM_RENTAL",
    squareFeet: 1800,
    yearBuilt: 1985,
    acquiredAt: new Date("2026-01-15T00:00:00Z"),
  },
};

function seedSupabaseUploadOk() {
  supabaseUploadMock.mockResolvedValue({ data: {}, error: null });
  getSupabaseAdminMock.mockReturnValue({
    storage: { from: () => ({ upload: supabaseUploadMock }) },
  });
}

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;

  renderAiReportPdfMock.mockReset();
  renderAiReportPdfMock.mockResolvedValue(Buffer.from("pdf"));
  sendReportDeliveredEmailMock.mockReset();
  sendReportDeliveredEmailMock.mockResolvedValue(undefined);
  createSignedReadUrlMock.mockReset();
  createSignedReadUrlMock.mockResolvedValue("https://signed.test/pdf");
  supabaseUploadMock.mockReset();
  getSupabaseAdminMock.mockReset();
  seedSupabaseUploadOk();
  transitionStudyMock.mockReset();
  transitionStudyMock.mockResolvedValue(undefined);
  captureServerMock.mockReset();
  captureServerMock.mockResolvedValue(undefined);

  vi.resetModules();
});

// ---- deliverAiReport ---------------------------------------------------

describe("deliverAiReport", () => {
  it("returns not-found when the study is missing", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(null);
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("ghost");
    expect(result).toMatchObject({ ok: false, skippedReason: "study not found" });
    expect(renderAiReportPdfMock).not.toHaveBeenCalled();
  });

  it("is idempotent — returns ok on an already-DELIVERED study without re-rendering", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE, status: "DELIVERED" });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("s1");
    expect(result).toMatchObject({ ok: true, skippedReason: "already delivered" });
    expect(renderAiReportPdfMock).not.toHaveBeenCalled();
    expect(transitionStudyMock).not.toHaveBeenCalled();
  });

  it("rejects Tier 2 (ENGINEER_REVIEWED) — that path goes through deliverEngineeredStudy", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE, tier: "ENGINEER_REVIEWED" });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("s1");
    expect(result).toMatchObject({
      ok: false,
      skippedReason: "deliverAiReport handles only DIY and AI_REPORT tiers",
    });
  });

  it("rejects when the study has no assetSchedule (upstream pipeline didn't finish)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE, assetSchedule: null });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("s1");
    expect(result).toMatchObject({ ok: false, skippedReason: "study has no assetSchedule" });
  });

  it("bubbles a Supabase upload failure (missing PDF in storage is worse than pending delivery)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE });
    supabaseUploadMock.mockResolvedValueOnce({
      data: null,
      error: { message: "bucket not found" },
    });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    await expect(deliverAiReport("s1")).rejects.toThrow(/PDF upload failed/i);
    expect(transitionStudyMock).not.toHaveBeenCalled();
  });

  it("signed URL is requested at the 7-day expiry constant", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    await deliverAiReport("s1");
    const [, expirySec] = createSignedReadUrlMock.mock.calls[0] ?? [];
    expect(expirySec).toBe(7 * 24 * 60 * 60);
  });

  it("happy path: renders PDF, uploads, transitions AI_COMPLETE → DELIVERED, writes StudyEvent, captures delivery_email_sent", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE });
    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("s1");

    expect(result.ok).toBe(true);
    expect(result.storagePath).toBe("s1/deliverables/ai-report.pdf");
    expect(result.signedUrl).toBe("https://signed.test/pdf");

    // transitionStudy wired for AI_COMPLETE → DELIVERED + tier + extraData.
    expect(transitionStudyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: "s1",
        from: "AI_COMPLETE",
        to: "DELIVERED",
        tier: "AI_REPORT",
        extraData: expect.objectContaining({
          deliverableUrl: "s1/deliverables/ai-report.pdf",
        }),
      }),
    );
    // StudyEvent recorded.
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      studyId: "s1",
      kind: "study.delivered",
      payload: expect.objectContaining({ storagePath: "s1/deliverables/ai-report.pdf" }),
    });
    // PostHog capture only fires on successful email send.
    expect(captureServerMock).toHaveBeenCalledWith(
      "u1",
      "delivery_email_sent",
      expect.objectContaining({ studyId: "s1", tier: "AI_REPORT" }),
    );
  });

  it("email failure does NOT revert delivery; PostHog event is NOT fired (no email sent)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE });
    sendReportDeliveredEmailMock.mockRejectedValueOnce(new Error("Resend 500"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { deliverAiReport } = await import("@/lib/studies/deliver");
    const result = await deliverAiReport("s1");

    expect(result.ok).toBe(true);
    expect(transitionStudyMock).toHaveBeenCalled();
    expect(
      captureServerMock.mock.calls.find((c) => c[1] === "delivery_email_sent"),
      "delivery_email_sent should NOT fire when the send threw",
    ).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[deliver] email send failed", expect.any(Error));
  });
});

// ---- deliverEngineeredStudy --------------------------------------------

describe("deliverEngineeredStudy", () => {
  const ENGINEER_STUDY = {
    ...STUDY_BASE,
    tier: "ENGINEER_REVIEWED" as const,
    status: "ENGINEER_REVIEWED" as const,
  };

  it("returns not-found when the study doesn't exist", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(null);
    const { deliverEngineeredStudy } = await import("@/lib/studies/deliver");
    const result = await deliverEngineeredStudy({
      studyId: "ghost",
      actorId: "admin-1",
      engineerName: "P.E.",
      engineerLicense: "PE-123",
      storagePath: "s/engineer.pdf",
    });
    expect(result).toMatchObject({ ok: false, skippedReason: "study not found" });
  });

  it("rejects a non-Tier-2 study (Tier 1 / DIY should never hit this path)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE, tier: "AI_REPORT" });
    const { deliverEngineeredStudy } = await import("@/lib/studies/deliver");
    const result = await deliverEngineeredStudy({
      studyId: "s1",
      actorId: "admin-1",
      engineerName: "P.E.",
      engineerLicense: "PE-123",
      storagePath: "s/engineer.pdf",
    });
    expect(result).toMatchObject({ ok: false, skippedReason: "not a Tier 2 study" });
  });

  it("is idempotent on an already-DELIVERED Tier 2 study — preserves deliverableUrl", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      ...ENGINEER_STUDY,
      status: "DELIVERED",
      deliverableUrl: "s1/deliverables/engineer-study.pdf",
    });
    const { deliverEngineeredStudy } = await import("@/lib/studies/deliver");
    const result = await deliverEngineeredStudy({
      studyId: "s1",
      actorId: "admin-1",
      engineerName: "P.E.",
      engineerLicense: "PE-123",
      storagePath: "should-be-ignored",
    });
    expect(result.ok).toBe(true);
    expect(result.storagePath).toBe("s1/deliverables/engineer-study.pdf");
    expect(transitionStudyMock).not.toHaveBeenCalled();
  });

  it("happy path: fresh signed URL, transition ENGINEER_REVIEWED → DELIVERED, writes StudyEvent", async () => {
    mocks.study.findUnique.mockResolvedValueOnce(ENGINEER_STUDY);
    const { deliverEngineeredStudy } = await import("@/lib/studies/deliver");
    const result = await deliverEngineeredStudy({
      studyId: "s1",
      actorId: "admin-1",
      engineerName: "Jane P.E.",
      engineerLicense: "PE-9012",
      storagePath: "s1/deliverables/engineer-study.pdf",
    });
    expect(result.ok).toBe(true);
    expect(transitionStudyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: "s1",
        from: "ENGINEER_REVIEWED",
        to: "DELIVERED",
        tier: "ENGINEER_REVIEWED",
      }),
    );
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      kind: "engineer.signed_and_delivered",
      actorId: "admin-1",
      payload: expect.objectContaining({
        engineerName: "Jane P.E.",
        engineerLicense: "PE-9012",
      }),
    });
  });
});

// ---- resendDeliveryEmail -----------------------------------------------

describe("resendDeliveryEmail", () => {
  it("refuses when there's no deliverableUrl on the row", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({ ...STUDY_BASE, deliverableUrl: null });
    const { resendDeliveryEmail } = await import("@/lib/studies/deliver");
    const result = await resendDeliveryEmail("s1", "admin-1");
    expect(result).toMatchObject({ ok: false, skippedReason: "no deliverable to resend" });
  });

  it("refuses when the study isn't DELIVERED (can't resend what wasn't sent)", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      ...STUDY_BASE,
      deliverableUrl: "s1/deliverables/ai-report.pdf",
      status: "AI_COMPLETE",
    });
    const { resendDeliveryEmail } = await import("@/lib/studies/deliver");
    const result = await resendDeliveryEmail("s1", "admin-1");
    expect(result).toMatchObject({ ok: false, skippedReason: "study is not DELIVERED" });
  });

  it("happy path: fresh 7-day signed URL + re-sends email + writes admin.delivery_email_resent; NO status change", async () => {
    mocks.study.findUnique.mockResolvedValueOnce({
      ...STUDY_BASE,
      status: "DELIVERED",
      deliverableUrl: "s1/deliverables/ai-report.pdf",
    });
    const { resendDeliveryEmail } = await import("@/lib/studies/deliver");
    const result = await resendDeliveryEmail("s1", "admin-1");

    expect(result.ok).toBe(true);
    expect(result.storagePath).toBe("s1/deliverables/ai-report.pdf");
    const [, expirySec] = createSignedReadUrlMock.mock.calls[0] ?? [];
    expect(expirySec).toBe(7 * 24 * 60 * 60);
    expect(sendReportDeliveredEmailMock).toHaveBeenCalled();
    // No status transition on resend.
    expect(transitionStudyMock).not.toHaveBeenCalled();
    // Event captures who re-sent.
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      kind: "admin.delivery_email_resent",
      actorId: "admin-1",
      payload: expect.objectContaining({ expiresAtIso: expect.any(String) }),
    });
  });
});
