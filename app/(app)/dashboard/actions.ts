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
  const url = await mintDeliverableUrl(studyId);
  if (!url) redirect("/dashboard");
  redirect(url as Route);
}

/**
 * Client-callable variant: returns the signed URL so the caller can open it in a
 * new tab or drive a client-side `window.location` navigation without a form POST.
 */
export async function getDeliverableUrlAction(
  studyId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const url = await mintDeliverableUrl(studyId);
  if (!url) return { ok: false, error: "Report not available yet." };
  return { ok: true, url };
}

async function mintDeliverableUrl(studyId: string): Promise<string | null> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true, deliverableUrl: true },
  });
  if (!study || !study.deliverableUrl) return null;
  assertOwnership(user, study);
  if (study.status !== "DELIVERED") return null;
  return await createSignedReadUrl(study.deliverableUrl, 7 * 24 * 60 * 60);
}
