import "server-only";

import { downloadStudyFile } from "@/lib/storage/studies";
import { spreadsheetBytesToText, isSpreadsheetMime } from "@/lib/ocr/spreadsheet-to-text";

import type { AttachmentInput } from "@/lib/ai/call";

/**
 * Pull a stored document out of Supabase Storage and prepare it for a
 * Claude `messages.create` call. Returns an `AttachmentInput` the
 * AI call wrapper can pass straight through.
 *
 * V1 hands PDFs and images to Claude directly — see ADR 0006.
 *
 * Spreadsheets (xlsx / xls) are parsed server-side into Markdown via
 * `spreadsheet-to-text.ts` and delivered as a `kind: "text"`
 * attachment — Claude's content blocks don't support spreadsheet
 * uploads natively. The upload validator (`lib/storage/validate.ts`)
 * already accepts these MIMEs at intake; this is the downstream half.
 */
export async function loadDocumentForAi(
  storagePath: string,
  mimeType: string,
  title?: string,
): Promise<AttachmentInput> {
  const blob = await downloadStudyFile(storagePath);
  const buffer = Buffer.from(await blob.arrayBuffer());

  if (mimeType === "application/pdf") {
    return {
      kind: "document",
      mediaType: "application/pdf",
      base64: buffer.toString("base64"),
      title,
    };
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return {
      kind: "image",
      mediaType: mimeType,
      base64: buffer.toString("base64"),
      title,
    };
  }
  if (isSpreadsheetMime(mimeType)) {
    const text = spreadsheetBytesToText(buffer, { title });
    return { kind: "text", text, title };
  }
  throw new Error(`Unsupported MIME for AI pipeline: ${mimeType}`);
}
