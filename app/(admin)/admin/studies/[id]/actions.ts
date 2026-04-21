"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { requireRole } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { STUDIES_BUCKET } from "@/lib/storage/studies";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { BULK_MARK_FAILED_CAP } from "@/lib/studies/admin-limits";
import { deliverEngineeredStudy, resendDeliveryEmail } from "@/lib/studies/deliver";
import { safeInngestSend } from "@/lib/studies/inngest-safe";
import { transitionStudy } from "@/lib/studies/transitions";

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

  const sendResult = await safeInngestSend(
    { name: "study.documents.ready", data: { studyId: study.id, tier: study.tier } },
    { caller: "admin.rerunPipeline", studyId, actorId: user.id },
  );
  if (!sendResult.ok) {
    return {
      ok: false,
      error:
        "Couldn't queue the re-run — the background job service is unreachable. Check the Inngest dev server (or cloud status) and try again.",
    };
  }

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

  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId,
      from: [
        "PENDING_PAYMENT",
        "AWAITING_DOCUMENTS",
        "PROCESSING",
        "AI_COMPLETE",
        "AWAITING_ENGINEER",
        "ENGINEER_REVIEWED",
      ],
      to: "FAILED",
      extraData: { failedReason: trimmed },
      tx,
    });
    await tx.studyEvent.create({
      data: {
        studyId,
        kind: "admin.marked_failed",
        actorId: user.id,
        payload: { priorStatus: study.status, reason: trimmed } as Prisma.InputJsonValue,
      },
    });
  });

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

  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId,
      from: "AWAITING_ENGINEER",
      to: "ENGINEER_REVIEWED",
      tier: "ENGINEER_REVIEWED",
      tx,
    });
    await tx.studyEvent.create({
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
    });
  });

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

export type BulkMarkFailedOutcome =
  | { studyId: string; ok: true }
  | { studyId: string; ok: false; error: string };

export type BulkMarkFailedResult =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Per-study outcomes in the order they were submitted. */
      results: BulkMarkFailedOutcome[];
    };

/**
 * Mark multiple studies as FAILED with one shared reason. The typical use case
 * is spotting a batch with the same blocker in the engineer queue (e.g. every
 * closing disclosure got redacted) — this lets admin clear the queue with one
 * action instead of opening each study individually.
 *
 * We process studies sequentially inside a single action call so partial
 * failure is honest: the caller gets per-study `ok: true | false` so the UI
 * can toast "N succeeded, M skipped" with specific reasons. We intentionally
 * DON'T wrap the whole thing in a single Prisma transaction — one malformed
 * study shouldn't roll back the other 4 that succeeded.
 *
 * Hard caps at 50 studies per call to keep the action under serverless
 * timeouts even if the Prisma round-trips slow down.
 */
export async function adminBulkMarkFailedAction(
  studyIds: string[],
  reason: string,
): Promise<BulkMarkFailedResult> {
  const { user } = await requireRole(["ADMIN"]);

  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false, error: "Reason must be 3–500 characters." };
  }

  // Dedup + cap. Order is preserved so the UI's "results" array lines up
  // with the checkbox selection the admin submitted.
  const unique = Array.from(new Set(studyIds.filter((id) => typeof id === "string" && id.length)));
  if (unique.length === 0) {
    return { ok: false, error: "No studies selected." };
  }
  if (unique.length > BULK_MARK_FAILED_CAP) {
    return {
      ok: false,
      error: `Bulk mark is capped at ${BULK_MARK_FAILED_CAP} studies — do it in batches.`,
    };
  }

  const prisma = getPrisma();
  const results: BulkMarkFailedOutcome[] = [];

  for (const studyId of unique) {
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, status: true },
    });
    if (!study) {
      results.push({ studyId, ok: false, error: "Study not found" });
      continue;
    }
    if (study.status === "DELIVERED") {
      results.push({
        studyId,
        ok: false,
        error: "Already DELIVERED — refund instead of marking failed.",
      });
      continue;
    }
    if (study.status === "FAILED") {
      // Idempotent: re-marking a failed study is a no-op, not an error.
      results.push({ studyId, ok: true });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await transitionStudy({
          studyId,
          from: [
            "PENDING_PAYMENT",
            "AWAITING_DOCUMENTS",
            "PROCESSING",
            "AI_COMPLETE",
            "AWAITING_ENGINEER",
            "ENGINEER_REVIEWED",
          ],
          to: "FAILED",
          extraData: { failedReason: trimmed },
          tx,
        });
        await tx.studyEvent.create({
          data: {
            studyId,
            kind: "admin.marked_failed",
            actorId: user.id,
            payload: {
              priorStatus: study.status,
              reason: trimmed,
              bulk: true,
            } as Prisma.InputJsonValue,
          },
        });
      });
      results.push({ studyId, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown DB error";
      results.push({ studyId, ok: false, error: message });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/engineer-queue");
  for (const r of results) {
    if (r.ok) revalidatePath(`/admin/studies/${r.studyId}`);
  }
  return { ok: true, results };
}
