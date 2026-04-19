import "server-only";

import type { User } from "@prisma/client";

import { getPrisma } from "@/lib/db/client";

export type StudyAccessReason = "owner" | "admin" | "shared" | null;

/**
 * Returns the reason the given user may access a study, or null if they may not.
 *
 *   • owner  — user is the study.userId
 *   • admin  — user.role === ADMIN
 *   • shared — a StudyShare row grants this user read-only access (status ACCEPTED)
 *
 * Use this everywhere a non-owner might legitimately read a study: the read-only
 * view page, the deliverable URL action, any future CPA surfaces. Never use
 * `assertOwnership` for those — it blocks CPAs.
 */
export async function resolveStudyAccess(
  caller: Pick<User, "id" | "role">,
  studyId: string,
): Promise<StudyAccessReason> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true },
  });
  if (!study) return null;

  if (caller.role === "ADMIN") return "admin";
  if (caller.id === study.userId) return "owner";

  const share = await prisma.studyShare.findFirst({
    where: {
      studyId,
      acceptedById: caller.id,
      status: "ACCEPTED",
    },
    select: { id: true },
  });
  if (share) return "shared";
  return null;
}

/**
 * Throws if the caller cannot access the study. Returns the access reason on success.
 */
export async function requireStudyAccess(
  caller: Pick<User, "id" | "role">,
  studyId: string,
): Promise<StudyAccessReason> {
  const reason = await resolveStudyAccess(caller, studyId);
  if (!reason) {
    throw new Error("Forbidden: caller does not have access to this study.");
  }
  return reason;
}
