import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Private bucket for customer-uploaded study documents. Must be created once
 * per Supabase project — see docs/runbooks/supabase-bootstrap.md.
 */
export const STUDIES_BUCKET = "studies";

/**
 * Construct the storage object key for a new document. Filename is sanitized
 * and length-capped so we can't accept path-traversal or pathologically long
 * S3 keys.
 */
export function storageKey(
  studyId: string,
  kind: string,
  documentId: string,
  filename: string,
): string {
  const safe =
    filename
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120) || "file";
  return `${studyId}/${kind}/${documentId}-${safe}`;
}

export interface SignedUpload {
  signedUrl: string;
  token: string;
  path: string;
}

export async function createSignedUploadUrl(storagePath: string): Promise<SignedUpload> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(STUDIES_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "unknown"}`);
  }
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function createSignedReadUrl(
  storagePath: string,
  expiresInSeconds: number = 60 * 60,
): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(STUDIES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) {
    throw new Error(`createSignedUrl failed: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

export async function downloadStudyFile(storagePath: string): Promise<Blob> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(STUDIES_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`download failed: ${error?.message ?? "unknown"}`);
  }
  return data;
}

export async function removeStudyFile(storagePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage.from(STUDIES_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`remove failed: ${error.message}`);
  }
}
