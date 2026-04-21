import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockPrisma, type PrismaMocks } from "@/tests/stubs/prisma-mock";

/**
 * Integration-shape tests for `lib/studies/share.ts` — the piece that was
 * 6.8% covered at V1.2 wrap. Exercises the full Prisma-fronted functions:
 *
 *   - createShare: dedup against existing non-revoked shares
 *   - listSharesForStudy: excludes REVOKED
 *   - listStudiesSharedWith: includes only ACCEPTED
 *   - revokeShare: writes StudyShare + StudyEvent atomically
 *   - acceptShareByToken: four classified error paths + happy path with
 *     the Bucket-4 email-mismatch audit flag
 *
 * The Prisma client is replaced via `vi.mock('@/lib/db/client')` so each test
 * configures the exact return values it needs.
 */

let mocks: PrismaMocks;

vi.mock("@/lib/db/client", () => ({
  getPrisma: () => mocks,
}));

// Silence the PostHog server client across these tests — captureServer()
// is invoked from acceptShareByToken after a successful accept; we're not
// asserting observability wiring here.
vi.mock("@/lib/observability/posthog-server", () => ({
  captureServer: vi.fn(async () => undefined),
}));

// Stable sample rows.
const SHARE_BASE = {
  id: "share-1",
  studyId: "study-1",
  invitedEmail: "cpa@firm.com",
  invitedById: "owner-1",
  status: "PENDING" as const,
  note: null,
  token: "abc",
  createdAt: new Date("2026-04-20T00:00:00Z"),
  acceptedAt: null,
  acceptedById: null,
  revokedAt: null,
  acceptedBy: null,
};

beforeEach(() => {
  const created = createMockPrisma();
  mocks = created.mocks;
  vi.resetModules();
});

describe("createShare", () => {
  it("returns an existing non-revoked share instead of creating a duplicate", async () => {
    mocks.studyShare.findFirst.mockResolvedValueOnce({ ...SHARE_BASE });
    const { createShare } = await import("@/lib/studies/share");
    const row = await createShare({
      studyId: "study-1",
      inviter: { id: "owner-1", role: "CUSTOMER" },
      invitedEmail: "cpa@firm.com",
    });
    expect(row.id).toBe("share-1");
    expect(mocks.studyShare.create).not.toHaveBeenCalled();
  });

  it("creates a new row when no non-revoked share exists", async () => {
    mocks.studyShare.findFirst.mockResolvedValueOnce(null);
    mocks.studyShare.create.mockResolvedValueOnce({ ...SHARE_BASE, id: "share-2" });
    const { createShare } = await import("@/lib/studies/share");
    const row = await createShare({
      studyId: "study-1",
      inviter: { id: "owner-1", role: "CUSTOMER" },
      invitedEmail: "Cpa@Firm.com",
      note: "please review before I file",
    });
    expect(row.id).toBe("share-2");
    const createCall = mocks.studyShare.create.mock.calls[0]?.[0];
    expect(createCall?.data.invitedEmail).toBe("cpa@firm.com"); // normalized
    expect(createCall?.data.note).toBe("please review before I file");
    expect(createCall?.data.token).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes → 64 hex
  });

  it("rejects a malformed email before hitting the DB", async () => {
    const { createShare } = await import("@/lib/studies/share");
    await expect(
      createShare({
        studyId: "study-1",
        inviter: { id: "owner-1", role: "CUSTOMER" },
        invitedEmail: "not-an-email",
      }),
    ).rejects.toThrow(/Invalid email/i);
    expect(mocks.studyShare.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an absurdly long email (254-char cap)", async () => {
    const { createShare } = await import("@/lib/studies/share");
    const long = "a".repeat(250) + "@x.com";
    await expect(
      createShare({
        studyId: "study-1",
        inviter: { id: "owner-1", role: "CUSTOMER" },
        invitedEmail: long,
      }),
    ).rejects.toThrow(/Invalid email/i);
  });
});

describe("listSharesForStudy", () => {
  it("filters out revoked shares (findMany where.status.not=REVOKED)", async () => {
    mocks.studyShare.findMany.mockResolvedValueOnce([{ ...SHARE_BASE }]);
    const { listSharesForStudy } = await import("@/lib/studies/share");
    const rows = await listSharesForStudy("study-1");
    expect(rows).toHaveLength(1);
    const call = mocks.studyShare.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({
      studyId: "study-1",
      status: { not: "REVOKED" },
    });
  });
});

describe("listStudiesSharedWith", () => {
  it("returns only ACCEPTED shares for the given acceptedById", async () => {
    mocks.studyShare.findMany.mockResolvedValueOnce([
      { id: "share-1", acceptedAt: new Date(), study: {} },
    ]);
    const { listStudiesSharedWith } = await import("@/lib/studies/share");
    await listStudiesSharedWith("user-cpa");
    const call = mocks.studyShare.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      acceptedById: "user-cpa",
      status: "ACCEPTED",
    });
  });
});

describe("revokeShare", () => {
  it("flips StudyShare to REVOKED + writes a share.revoked StudyEvent", async () => {
    mocks.studyShare.update.mockResolvedValueOnce({ ...SHARE_BASE, status: "REVOKED" });
    mocks.studyShare.findUnique.mockResolvedValueOnce({ studyId: "study-1" });
    mocks.studyEvent.create.mockResolvedValueOnce({ id: "evt-1" });
    const { revokeShare } = await import("@/lib/studies/share");
    await revokeShare("share-1", "actor-1");
    expect(mocks.studyShare.update).toHaveBeenCalledWith({
      where: { id: "share-1" },
      data: expect.objectContaining({ status: "REVOKED" }),
    });
    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      studyId: "study-1",
      kind: "share.revoked",
      actorId: "actor-1",
    });
  });
});

describe("acceptShareByToken", () => {
  const ACCEPTER = { id: "user-cpa", role: "CPA" as const, email: "cpa@firm.com" };

  it("throws 'Share link not found' for unknown tokens", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce(null);
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await expect(acceptShareByToken("unknown", ACCEPTER)).rejects.toThrow(/not found/i);
  });

  it("throws 'revoked' when the share is REVOKED", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "REVOKED",
    });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await expect(acceptShareByToken("abc", ACCEPTER)).rejects.toThrow(/revoked/i);
  });

  it("is idempotent when re-accepted by the same user", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "ACCEPTED",
      acceptedById: ACCEPTER.id,
      acceptedAt: new Date(),
    });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    const result = await acceptShareByToken("abc", ACCEPTER);
    expect(result.studyId).toBe("study-1");
    // No writes — same-user re-accept short-circuits.
    expect(mocks.studyShare.update).not.toHaveBeenCalled();
  });

  it("throws 'different account' when ACCEPTED by someone else", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "ACCEPTED",
      acceptedById: "someone-else",
      acceptedAt: new Date(),
    });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await expect(acceptShareByToken("abc", ACCEPTER)).rejects.toThrow(/different account/i);
  });

  it("on first accept, updates the share + records emailMatched=true in the audit event", async () => {
    // Matching email: invitedEmail=cpa@firm.com, accepter.email=cpa@firm.com.
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "PENDING",
    });
    mocks.studyShare.update.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "ACCEPTED",
      acceptedById: ACCEPTER.id,
      acceptedAt: new Date(),
    });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await acceptShareByToken("abc", ACCEPTER);

    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data).toMatchObject({
      kind: "share.accepted",
      actorId: ACCEPTER.id,
      payload: expect.objectContaining({
        emailMatched: true,
        accepterEmail: "cpa@firm.com",
      }),
    });
  });

  it("records emailMatched=false when the invite went to a different address (Bucket 4 audit)", async () => {
    // Invite was for foo@firm.com; accepter signs in as bar@firm.com.
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      invitedEmail: "foo@firm.com",
      status: "PENDING",
    });
    mocks.studyShare.update.mockResolvedValueOnce({
      ...SHARE_BASE,
      invitedEmail: "foo@firm.com",
      status: "ACCEPTED",
    });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await acceptShareByToken("abc", { ...ACCEPTER, email: "bar@firm.com" });

    const eventCall = mocks.studyEvent.create.mock.calls[0]?.[0];
    expect(eventCall?.data.payload).toMatchObject({
      emailMatched: false,
      invitedEmail: "foo@firm.com",
      accepterEmail: "bar@firm.com",
    });
  });

  it("promotes a CUSTOMER acceptor to CPA on first accept", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "PENDING",
    });
    mocks.studyShare.update.mockResolvedValueOnce({ ...SHARE_BASE, status: "ACCEPTED" });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await acceptShareByToken("abc", { ...ACCEPTER, role: "CUSTOMER" });

    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: ACCEPTER.id },
      data: { role: "CPA" },
    });
  });

  it("does NOT promote role if acceptor was already CPA or ADMIN", async () => {
    mocks.studyShare.findUnique.mockResolvedValueOnce({
      ...SHARE_BASE,
      status: "PENDING",
    });
    mocks.studyShare.update.mockResolvedValueOnce({ ...SHARE_BASE, status: "ACCEPTED" });
    const { acceptShareByToken } = await import("@/lib/studies/share");
    await acceptShareByToken("abc", { ...ACCEPTER, role: "CPA" });
    expect(mocks.user.update).not.toHaveBeenCalled();
  });
});
