"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { createSignedReadUrl } from "@/lib/storage/studies";

/**
 * Mint a fresh 7-day signed URL for the owner's delivered study PDF and
 * redirect to it. Used by the "Download report" button on the customer
 * dashboard so links always work even after the original 7-day email link
 * has expired.
 */
export async function downloadMyDeliverableAction(studyId: string): Promise<void> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true, deliverableUrl: true },
  });
  if (!study || !study.deliverableUrl) {
    redirect("/dashboard");
  }
  assertOwnership(user, study);
  if (study.status !== "DELIVERED") {
    redirect("/dashboard");
  }

  const signedUrl = await createSignedReadUrl(study.deliverableUrl, 7 * 24 * 60 * 60);
  redirect(signedUrl as Route);
}
