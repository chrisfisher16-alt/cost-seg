"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireRole } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { inngest } from "@/inngest/client";
import { STUDIES_BUCKET } from "@/lib/storage/studies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deliverEngineeredStudy, resendDeliveryEmail } from "@/lib/studies/deliver";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Requeue the AI pipeline for a study. Re-emits `study.documents.ready`;
 * the Inngest function is idempotent via AiAuditLog caching — cached
 * steps return prior outputs so only genuinely changed steps hit Anthropic.
 */
export async function adminRerunPipelineAction(studyId: string): Promise<ActionResult> {
  const { user } = await requireRole(["ADMIN"]);

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, tier: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found" };

  await inngest.send({
    name: "study.documents.ready",
    data: { studyId: study.id, tier: study.tier },
  });

  await prisma.studyEvent.create({
    data: {
      studyId,
      kind: "admin.rerun_pipeline",
      actorId: user.id,
      payload: { priorStatus: study.status } as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/admin/studies/${studyId}`);
  return { ok: true };
}

/**
 * Manually flip a study to FAILED with an admin-supplied reason. Use for edge
 * cases that don't recover via retry (bad closing disclosure, refund initiated,
 * etc.). Writes a StudyEvent for audit.
 */
export async function adminMarkFailedAction(
  studyId: string,
  reason: string,
): Promise<ActionResult> {
  const { user } = await requireRole(["ADMIN"]);
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false, error: "Reason must be 3–500 characters." };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found" };
  if (study.status === "DELIVERED") {
    return {
      ok: false,
      error: "Study is already DELIVERED — use refund flow instead of marking failed.",
    };
  }

  await prisma.$transaction([
    prisma.study.update({
      where: { id: studyId },
      data: { status: "FAILED", failedReason: trimmed },
    }),
    prisma.studyEvent.create({
      data: {
        studyId,
        kind: "admin.marked_failed",
        actorId: user.id,
        payload: { priorStatus: study.status, reason: trimmed } as Prisma.InputJsonValue,
      },
    }),
  ]);

  revalidatePath(`/admin/studies/${studyId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Resend the delivery email with a fresh 7-day signed URL.
 */
export async function adminResendDeliveryEmailAction(studyId: string): Promise<ActionResult> {
  const { user } = await requireRole(["ADMIN"]);
  const result = await resendDeliveryEmail(studyId, user.id);
  if (!result.ok) {
    return { ok: false, error: result.skippedReason ?? "resend failed" };
  }
  revalidatePath(`/admin/studies/${studyId}`);
  return { ok: true };
}

/**
 * Upload the engineer-signed PDF for a Tier 2 study, then deliver it.
 */
export async function adminUploadSignedStudyAction(
  studyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRole(["ADMIN"]);

  const file = formData.get("file");
  const engineerName = formData.get("engineerName");
  const engineerLicense = formData.get("engineerLicense");

  if (!(file instanceof File)) return { ok: false, error: "Missing file." };
  if (typeof engineerName !== "string" || engineerName.trim().length < 2) {
    return { ok: false, error: "Engineer name required." };
  }
  if (typeof engineerLicense !== "string" || engineerLicense.trim().length < 2) {
    return { ok: false, error: "Engineer license required." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Signed study must be a PDF." };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { ok: false, error: "Signed study must be ≤ 50MB." };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, tier: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found" };
  if (study.tier !== "ENGINEER_REVIEWED") {
    return { ok: false, error: "Only Tier 2 studies accept signed PDF uploads." };
  }
  if (study.status !== "AWAITING_ENGINEER") {
    return {
      ok: false,
      error: `Study is in ${study.status}; expected AWAITING_ENGINEER.`,
    };
  }

  const storagePath = `${studyId}/deliverables/engineer-study.pdf`;
  const arrayBuffer = await file.arrayBuffer();
  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage
    .from(STUDIES_BUCKET)
    .upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  await prisma.$transaction([
    prisma.study.update({
      where: { id: studyId },
      data: { status: "ENGINEER_REVIEWED" },
    }),
    prisma.studyEvent.create({
      data: {
        studyId,
        kind: "admin.engineer_pdf_uploaded",
        actorId: user.id,
        payload: {
          storagePath,
          engineerName: engineerName.trim(),
          engineerLicense: engineerLicense.trim(),
          sizeBytes: file.size,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  const deliverResult = await deliverEngineeredStudy({
    studyId,
    actorId: user.id,
    engineerName: engineerName.trim(),
    engineerLicense: engineerLicense.trim(),
    storagePath,
  });
  if (!deliverResult.ok) {
    return {
      ok: false,
      error: deliverResult.skippedReason ?? "Delivery failed after upload.",
    };
  }

  revalidatePath(`/admin/studies/${studyId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/engineer-queue");
  return { ok: true };
}
