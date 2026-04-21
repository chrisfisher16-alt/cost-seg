"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { parseUsdInputToCents } from "@/lib/estimator/format";
import { PROPERTY_TYPES } from "@/lib/estimator/types";
import { captureServer } from "@/lib/observability/posthog-server";
import {
  createSignedUploadUrl,
  downloadStudyFile,
  removeStudyFile,
  storageKey,
} from "@/lib/storage/studies";
import { ALLOWED_MIMES, MAX_UPLOAD_BYTES, validateUploadedFile } from "@/lib/storage/validate";
import { emitDocumentsReadyIfComplete, getIntakeCompleteness } from "@/lib/studies/ready-check";
import type { DocumentKind } from "@prisma/client";

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string };

const DOCUMENT_KINDS = [
  "CLOSING_DISCLOSURE",
  "IMPROVEMENT_RECEIPTS",
  "PROPERTY_PHOTO",
  "APPRAISAL",
  "OTHER",
] as const satisfies readonly DocumentKind[];

// -----------------------------------------------------------------------------
// Property details
// -----------------------------------------------------------------------------

const propertySchema = z.object({
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(100),
  state: z
    .string()
    .trim()
    .length(2, "Two-letter state code.")
    .transform((s) => s.toUpperCase()),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits or ZIP+4."),
  purchasePriceRaw: z.string().min(1, "Enter a purchase price."),
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Acquired date must be YYYY-MM-DD."),
  propertyType: z.enum(PROPERTY_TYPES),
  squareFeet: z.number().int().positive().max(1_000_000).optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
});

export async function updatePropertyAction(
  studyId: string,
  input: unknown,
): Promise<ActionOk<object> | ActionErr> {
  const { user } = await requireAuth();
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid property details.",
    };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true, propertyId: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);
  if (study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "Property details are locked once processing starts." };
  }

  const cents = parseUsdInputToCents(parsed.data.purchasePriceRaw);
  if (!cents) {
    return { ok: false, error: "Purchase price must be a positive number." };
  }

  await prisma.property.update({
    where: { id: study.propertyId },
    data: {
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state,
      zip: parsed.data.zip,
      purchasePrice: cents / 100,
      acquiredAt: new Date(parsed.data.acquiredAt),
      propertyType: parsed.data.propertyType,
      squareFeet: parsed.data.squareFeet,
      yearBuilt: parsed.data.yearBuilt,
    },
  });

  revalidatePath(`/studies/${studyId}/intake`);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Uploads
// -----------------------------------------------------------------------------

const createUploadSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_MIMES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function createUploadUrlAction(
  studyId: string,
  input: unknown,
): Promise<
  | ActionOk<{
      uploadUrl: string;
      token: string;
      storagePath: string;
      documentId: string;
    }>
  | ActionErr
> {
  const { user } = await requireAuth();
  const parsed = createUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid upload request.",
    };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);
  if (study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "Uploads are locked once processing starts." };
  }

  const documentId = randomUUID();
  const path = storageKey(studyId, parsed.data.kind, documentId, parsed.data.filename);

  try {
    const { signedUrl, token } = await createSignedUploadUrl(path);
    return {
      ok: true,
      uploadUrl: signedUrl,
      token,
      storagePath: path,
      documentId,
    };
  } catch (err) {
    console.error("[upload] createSignedUploadUrl failed", err);
    return { ok: false, error: "Could not prepare upload. Try again." };
  }
}

const finalizeSchema = z.object({
  documentId: z.string().uuid(),
  kind: z.enum(DOCUMENT_KINDS),
  filename: z.string().trim().min(1).max(200),
  storagePath: z.string().min(1).max(500),
  declaredMime: z.enum(ALLOWED_MIMES),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function finalizeUploadAction(
  studyId: string,
  input: unknown,
): Promise<ActionOk<{ documentId: string }> | ActionErr> {
  const { user } = await requireAuth();
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid finalize request.",
    };
  }

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);
  if (study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "Uploads are locked once processing starts." };
  }

  // Defense in depth — the signed upload URL was scoped to exactly this
  // key, but verify the path still points into this study's folder.
  if (!parsed.data.storagePath.startsWith(`${studyId}/`)) {
    return { ok: false, error: "Upload path does not belong to this study." };
  }

  let blob: Blob;
  try {
    blob = await downloadStudyFile(parsed.data.storagePath);
  } catch (err) {
    console.error("[upload] download for validation failed", err);
    return { ok: false, error: "Upload was not received. Please retry." };
  }

  const validation = await validateUploadedFile(blob, parsed.data.declaredMime);
  if (!validation.ok || !validation.detectedMime) {
    await removeStudyFile(parsed.data.storagePath).catch(() => {});
    return { ok: false, error: validation.error ?? "File rejected." };
  }

  try {
    await prisma.document.create({
      data: {
        id: parsed.data.documentId,
        studyId,
        kind: parsed.data.kind,
        storagePath: parsed.data.storagePath,
        filename: parsed.data.filename,
        sizeBytes: blob.size,
        mimeType: validation.detectedMime,
      },
    });
  } catch (err) {
    console.error("[upload] document insert failed", err);
    await removeStudyFile(parsed.data.storagePath).catch(() => {});
    return { ok: false, error: "Could not record the upload. Try again." };
  }

  await captureServer(user.id, "documents_uploaded", {
    studyId,
    documentId: parsed.data.documentId,
    kind: parsed.data.kind,
    sizeBytes: blob.size,
    mimeType: validation.detectedMime,
  });
  revalidatePath(`/studies/${studyId}/intake`);
  return { ok: true, documentId: parsed.data.documentId };
}

// -----------------------------------------------------------------------------
// Explicit pipeline start
// -----------------------------------------------------------------------------

/**
 * Customer clicks "Start my report" once they believe all docs are uploaded.
 * This is the single entry point that fires `study.documents.ready` and flips
 * the study from AWAITING_DOCUMENTS → PROCESSING.
 *
 * Uploads no longer auto-trigger this: Inngest snapshots documents at
 * `load-study`, so any file uploaded after autostart was silently ignored.
 * Making the trigger explicit means the customer controls when the snapshot
 * is taken, matching their mental model of "I'm done uploading now."
 */
export async function startPipelineAction(studyId: string): Promise<ActionOk<object> | ActionErr> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, userId: true, status: true },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);
  if (study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "This study has already started processing." };
  }

  const completeness = await getIntakeCompleteness(studyId);
  if (!completeness.complete) {
    const missing = completeness.missingKinds.length;
    const reason = !completeness.propertyReady
      ? "Save your property details first."
      : `${missing} required document${missing === 1 ? "" : "s"} still needed.`;
    return { ok: false, error: reason };
  }

  const emitted = await emitDocumentsReadyIfComplete(studyId);
  if (!emitted) {
    return {
      ok: false,
      error: "Could not start the pipeline. Try again in a minute.",
    };
  }

  revalidatePath(`/studies/${studyId}/intake`);
  return { ok: true };
}

export async function removeDocumentAction(
  studyId: string,
  documentId: string,
): Promise<ActionOk<object> | ActionErr> {
  const { user } = await requireAuth();
  const prisma = getPrisma();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      storagePath: true,
      studyId: true,
      study: { select: { userId: true, status: true } },
    },
  });
  if (!doc || doc.studyId !== studyId) {
    return { ok: false, error: "Document not found." };
  }
  assertOwnership(user, { userId: doc.study.userId });
  if (doc.study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "Uploads are locked once processing starts." };
  }

  await removeStudyFile(doc.storagePath).catch((err) => {
    console.warn("[upload] storage remove failed", err);
  });
  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath(`/studies/${studyId}/intake`);
  return { ok: true };
}
