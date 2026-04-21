import "server-only";

import { randomBytes } from "node:crypto";

import { getPrisma } from "@/lib/db/client";
import { captureServer } from "@/lib/observability/posthog-server";
import { isAcceptedEmailMatch, normalizeEmail } from "@/lib/studies/share-format";
import type { StudyShareStatus, User } from "@prisma/client";

// Re-export pure helpers so existing `@/lib/studies/share` server-side
// callers keep working. Client components must import from
// `@/lib/studies/share-format` directly — see that module's header.
export {
  formatShareCooldown,
  isAcceptedEmailMatch,
  normalizeEmail,
} from "@/lib/studies/share-format";

export interface CreateShareArgs {
  studyId: string;
  inviter: Pick<User, "id" | "role">;
  invitedEmail: string;
  note?: string | null;
}

export interface ShareRow {
  id: string;
  studyId: string;
  invitedEmail: string;
  status: StudyShareStatus;
  note: string | null;
  token: string;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  acceptedBy: { id: string; email: string; name: string | null } | null;
}

function generateShareToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Build the public URL a sharee clicks to accept an invite.
 */
export function buildShareUrl(token: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/share/${token}`;
}

/**
 * Owner creates a new share. If a non-revoked share already exists for this
 * {studyId, invitedEmail} pair, returns that existing row instead of duplicating.
 */
export async function createShare(args: CreateShareArgs): Promise<ShareRow> {
  const prisma = getPrisma();
  const email = normalizeEmail(args.invitedEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Invalid email address.");
  }

  // Reuse an existing unexpired share if one exists — avoids spamming the CPA.
  const existing = await prisma.studyShare.findFirst({
    where: { studyId: args.studyId, invitedEmail: email, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
    include: { acceptedBy: { select: { id: true, email: true, name: true } } },
  });
  if (existing) {
    return toShareRow(existing);
  }

  const token = generateShareToken();
  const row = await prisma.studyShare.create({
    data: {
      studyId: args.studyId,
      invitedEmail: email,
      invitedById: args.inviter.id,
      note: args.note ?? null,
      token,
      status: "PENDING",
    },
    include: { acceptedBy: { select: { id: true, email: true, name: true } } },
  });
  return toShareRow(row);
}

/**
 * List every share on a study (both pending and accepted; revoked entries are
 * filtered out so owners see a clean panel). Owner-only — caller must have
 * owner or admin access, enforced by the caller.
 */
export async function listSharesForStudy(studyId: string): Promise<ShareRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.studyShare.findMany({
    where: { studyId, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
    include: { acceptedBy: { select: { id: true, email: true, name: true } } },
  });
  return rows.map(toShareRow);
}

/**
 * List studies shared with (and accepted by) a given user. Used to populate
 * the CPA-side of the dashboard.
 */
export async function listStudiesSharedWith(userId: string) {
  const prisma = getPrisma();
  const shares = await prisma.studyShare.findMany({
    where: { acceptedById: userId, status: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    select: {
      id: true,
      acceptedAt: true,
      study: {
        select: {
          id: true,
          tier: true,
          status: true,
          createdAt: true,
          deliverableUrl: true,
          user: { select: { id: true, name: true, email: true } },
          property: { select: { address: true, city: true, state: true } },
        },
      },
    },
  });
  return shares;
}

export async function revokeShare(shareId: string, actorId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.studyShare.update({
    where: { id: shareId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await prisma.studyEvent.create({
    data: {
      studyId: (await prisma.studyShare.findUnique({
        where: { id: shareId },
        select: { studyId: true },
      }))!.studyId,
      kind: "share.revoked",
      actorId,
      payload: { shareId } as never,
    },
  });
}

/**
 * Accept a share by token. The accepting user's id is stored on the share, and
 * if they were a CUSTOMER (the default role) they are promoted to CPA so their
 * dashboard picks up the shared-studies affordance.
 *
 * Returns the share row after acceptance. Throws if the token is invalid,
 * revoked, or already accepted by a different user.
 */
export async function acceptShareByToken(
  token: string,
  accepter: Pick<User, "id" | "role" | "email">,
): Promise<{ share: ShareRow; studyId: string }> {
  const prisma = getPrisma();
  const existing = await prisma.studyShare.findUnique({
    where: { token },
    include: { acceptedBy: { select: { id: true, email: true, name: true } } },
  });
  if (!existing) throw new Error("Share link not found.");
  if (existing.status === "REVOKED") throw new Error("This invitation has been revoked.");

  // Idempotent: re-accepting by the same user is fine.
  if (existing.status === "ACCEPTED" && existing.acceptedById === accepter.id) {
    return { share: toShareRow(existing), studyId: existing.studyId };
  }

  if (existing.status === "ACCEPTED" && existing.acceptedById !== accepter.id) {
    throw new Error("This invitation was already accepted by a different account.");
  }

  // Invites are NOT strict-locked — a CPA signed in with email B can still
  // accept an invite addressed to email A (common: aliases, @-sign quirks,
  // household inboxes). But we MUST audit the mismatch so the admin
  // inspector can surface it; Day 49's "warn on email mismatch" was
  // implemented as an empty `if` block that threw away the signal.
  const normalized = normalizeEmail(accepter.email);
  const emailMatched = isAcceptedEmailMatch(existing.invitedEmail, accepter.email);

  const updated = await prisma.$transaction(async (tx) => {
    const share = await tx.studyShare.update({
      where: { id: existing.id },
      data: {
        status: "ACCEPTED",
        acceptedById: accepter.id,
        acceptedAt: new Date(),
      },
      include: { acceptedBy: { select: { id: true, email: true, name: true } } },
    });
    // Promote CUSTOMER accounts to CPA so their dashboard shows the shared-studies surface.
    if (accepter.role === "CUSTOMER") {
      await tx.user.update({ where: { id: accepter.id }, data: { role: "CPA" } });
    }
    await tx.studyEvent.create({
      data: {
        studyId: share.studyId,
        kind: "share.accepted",
        actorId: accepter.id,
        payload: {
          shareId: share.id,
          invitedEmail: share.invitedEmail,
          accepterEmail: normalized,
          emailMatched,
        } as never,
      },
    });
    return share;
  });

  await captureServer(accepter.id, "cpa_accepted", {
    studyId: updated.studyId,
    shareId: updated.id,
    emailMatched,
    rolePromoted: accepter.role === "CUSTOMER",
  });

  return { share: toShareRow(updated), studyId: updated.studyId };
}

function toShareRow(row: {
  id: string;
  studyId: string;
  invitedEmail: string;
  status: StudyShareStatus;
  note: string | null;
  token: string;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  acceptedBy: { id: string; email: string; name: string | null } | null;
}): ShareRow {
  return {
    id: row.id,
    studyId: row.studyId,
    invitedEmail: row.invitedEmail,
    status: row.status,
    note: row.note,
    token: row.token,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    acceptedBy: row.acceptedBy,
  };
}
