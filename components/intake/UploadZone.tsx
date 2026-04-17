"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createUploadUrlAction,
  finalizeUploadAction,
  removeDocumentAction,
} from "@/app/(app)/studies/[id]/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { DOCUMENT_KIND_META } from "./meta";

import type { DocumentKind } from "@prisma/client";

interface UploadedDoc {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

const CLIENT_ALLOWED: readonly string[] = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 25 * 1024 * 1024;
const STUDIES_BUCKET = "studies";

export function UploadZone({
  studyId,
  kind,
  uploaded,
  locked,
}: {
  studyId: string;
  kind: DocumentKind;
  uploaded: UploadedDoc[];
  locked: boolean;
}) {
  const meta = DOCUMENT_KIND_META[kind];
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const disabled = locked || isUploading || (!meta.allowMultiple && uploaded.length > 0);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(`File exceeds ${MAX_BYTES / 1024 / 1024}MB limit.`);
        return;
      }
      if (!CLIENT_ALLOWED.includes(file.type)) {
        setError("Use PDF, JPG, or PNG.");
        return;
      }
      setIsUploading(true);
      try {
        const step1 = await createUploadUrlAction(studyId, {
          kind,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!step1.ok) {
          setError(step1.error);
          return;
        }

        const supabase = getBrowserSupabase();
        const { error: uploadError } = await supabase.storage
          .from(STUDIES_BUCKET)
          .uploadToSignedUrl(step1.storagePath, step1.token, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadError) {
          setError(`Upload failed: ${uploadError.message}`);
          return;
        }

        const step2 = await finalizeUploadAction(studyId, {
          documentId: step1.documentId,
          kind,
          filename: file.name,
          storagePath: step1.storagePath,
          declaredMime: file.type,
          sizeBytes: file.size,
        });
        if (!step2.ok) {
          setError(step2.error);
          return;
        }
        router.refresh();
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [kind, router, studyId],
  );

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function onDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
  }

  function onRemove(documentId: string) {
    startRemoveTransition(async () => {
      const result = await removeDocumentAction(studyId, documentId);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={`file-${kind}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/40 p-6 text-center text-sm transition dark:border-zinc-700 dark:bg-zinc-950/40",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-zinc-400 hover:bg-zinc-50",
        )}
      >
        <input
          id={`file-${kind}`}
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <span className="font-medium">
          {isUploading
            ? "Uploading…"
            : meta.allowMultiple || uploaded.length === 0
              ? "Drop a file or click to browse"
              : "Remove the current file to replace it"}
        </span>
        <span className="text-xs text-zinc-500">PDF, JPG, or PNG up to 25MB</span>
      </label>

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}

      {uploaded.length > 0 ? (
        <ul className="space-y-2">
          {uploaded.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.filename}</p>
                <p className="text-xs text-zinc-500">
                  {(doc.sizeBytes / 1024).toFixed(0)} KB &middot; {doc.mimeType}
                </p>
              </div>
              {locked ? null : (
                <button
                  type="button"
                  onClick={() => onRemove(doc.id)}
                  className="text-xs text-red-600 underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
