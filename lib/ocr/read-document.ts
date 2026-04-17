import "server-only";

import { downloadStudyFile } from "@/lib/storage/studies";

import type { AttachmentInput } from "@/lib/ai/call";

/**
 * Pull a stored document out of Supabase Storage and prepare it for a
 * Claude `messages.create` call. Returns an `AttachmentInput` the
 * AI call wrapper can pass straight through.
 *
 * V1 hands PDFs and images to Claude directly — see ADR 0006.
 */
export async function loadDocumentForAi(
  storagePath: string,
  mimeType: string,
  title?: string,
): Promise<AttachmentInput> {
  const blob = await downloadStudyFile(storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const base64 = buffer.toString("base64");

  if (mimeType === "application/pdf") {
    return { kind: "document", mediaType: "application/pdf", base64, title };
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return { kind: "image", mediaType: mimeType, base64, title };
  }
  throw new Error(`Unsupported MIME for AI pipeline: ${mimeType}`);
}
