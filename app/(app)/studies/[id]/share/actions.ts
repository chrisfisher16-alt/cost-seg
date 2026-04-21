"use server";

import { z } from "zod";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { sendCpaInviteEmail } from "@/lib/email/send";
import { captureServer } from "@/lib/observability/posthog-server";
import { shareInviteLimiter } from "@/lib/ratelimit";
import {
  buildShareUrl,
  createShare,
  listSharesForStudy,
  revokeShare,
  type ShareRow,
} from "@/lib/studies/share";

export type ShareActionResult =
  | { ok: true; share: SerializableShareRow; shareUrl: string }
  | {
      ok: false;
      error: string;
      /**
       * Present only when the owner hit the per-study invite rate-limit.
       * Client uses this to show a tailored "try again in N minutes"
       * message instead of the generic error.
       */
      retryAfterSec?: number;
    };

export type SerializableShareRow = Omit<ShareRow, "createdAt" | "acceptedAt" | "revokedAt"> & {
  createdAtIso: string;
  acceptedAtIso: string | null;
  revokedAtIso: string | null;
};

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  note: z.string().trim().max(300).optional(),
});

function toSerializable(row: ShareRow): SerializableShareRow {
  return {
    ...row,
    createdAtIso: row.createdAt.toISOString(),
    acceptedAtIso: row.acceptedAt?.toISOString() ?? null,
    revokedAtIso: row.revokedAt?.toISOString() ?? null,
  };
}

/**
 * Owner shares a study with a CPA. Idempotent when called again with the same
 * email — re-sends the invite email against the existing non-revoked share.
 */
export async function shareStudyAction(
  studyId: string,
  input: unknown,
): Promise<ShareActionResult> {
  const { user } = await requireAuth();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true, email: true } },
      property: { select: { address: true, city: true, state: true } },
    },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);

  // Gate after ownership check so a non-owner trying to share someone else's
  // study doesn't burn their rate-limit budget on a denied request. Keyed
  // per {studyId, ownerId} — the owner can share across multiple studies
  // without hitting the limit, and the same study can't be flooded even if
  // two admin accounts are somehow involved.
  const gate = await shareInviteLimiter().check(`${studyId}:${user.id}`);
  if (!gate.ok) {
    const retryAfterSec = Math.max(1, Math.ceil((gate.resetAt - Date.now()) / 1000));
    const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
    return {
      ok: false,
      error: `You've sent 5 invites for this study in the last hour. Try again in ${minutes} ${
        minutes === 1 ? "minute" : "minutes"
      }.`,
      retryAfterSec,
    };
  }

  let share: ShareRow;
  try {
    share = await createShare({
      studyId,
      inviter: user,
      invitedEmail: parsed.data.email,
      note: parsed.data.note ?? null,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create share." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = buildShareUrl(share.token, appUrl);
  const propertyAddress = `${study.property.address}, ${study.property.city}, ${study.property.state}`;

  try {
    await sendCpaInviteEmail({
      to: parsed.data.email,
      ownerName: study.user.name,
      ownerEmail: study.user.email,
      propertyAddress,
      shareUrl,
      note: parsed.data.note ?? null,
    });
  } catch (err) {
    console.error("[share] invite email failed", err);
    // Soft failure — the share row still exists; owner can copy the link.
  }

  await prisma.studyEvent.create({
    data: {
      studyId,
      kind: "share.created",
      actorId: user.id,
      payload: {
        shareId: share.id,
        invitedEmail: share.invitedEmail,
      } as never,
    },
  });
  await captureServer(user.id, "cpa_invited", {
    studyId,
    shareId: share.id,
    // `invitedEmail` is already persisted on StudyShare; omitting from the
    // event payload keeps PostHog's person profile PII-lean.
  });

  return { ok: true, share: toSerializable(share), shareUrl };
}

export type ListSharesResult =
  | { ok: true; shares: SerializableShareRow[]; shareUrls: Record<string, string> }
  | { ok: false; error: string };

export async function listSharesAction(studyId: string): Promise<ListSharesResult> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);

  const shares = await listSharesForStudy(studyId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrls = Object.fromEntries(shares.map((s) => [s.id, buildShareUrl(s.token, appUrl)]));
  return { ok: true, shares: shares.map(toSerializable), shareUrls };
}

export async function revokeShareAction(
  studyId: string,
  shareId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);

  const share = await prisma.studyShare.findUnique({
    where: { id: shareId },
    select: { id: true, studyId: true },
  });
  if (!share || share.studyId !== studyId) {
    return { ok: false, error: "Share not found on this study." };
  }
  await revokeShare(shareId, user.id);
  return { ok: true };
}
