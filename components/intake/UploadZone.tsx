"use client";

import { FileIcon, ImageIcon, Loader2Icon, TrashIcon, UploadCloudIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import {
  createUploadUrlAction,
  finalizeUploadAction,
  removeDocumentAction,
} from "@/app/(app)/studies/[id]/actions";
import { Button } from "@/components/ui/button";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  const [isDragOver, setIsDragOver] = useState(false);
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
    setIsDragOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function onDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function onDragLeave() {
    setIsDragOver(false);
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
        onDragLeave={onDragLeave}
        className={cn(
          "group bg-muted/20 relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center text-sm transition",
          disabled
            ? "border-border/60 cursor-not-allowed opacity-60"
            : isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-primary/5",
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
        <div
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            isDragOver
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary",
          )}
        >
          {isUploading ? (
            <Loader2Icon className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <UploadCloudIcon className="h-5 w-5" aria-hidden />
          )}
        </div>
        <span className="font-medium">
          {isUploading
            ? "Uploading…"
            : meta.allowMultiple || uploaded.length === 0
              ? "Drop a file or click to browse"
              : "Remove the current file to replace it"}
        </span>
        <span className="text-muted-foreground text-xs">
          PDF, JPG, or PNG · up to {MAX_BYTES / 1024 / 1024}MB
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}

      {uploaded.length > 0 ? (
        <ul className="space-y-2">
          {uploaded.map((doc) => (
            <li
              key={doc.id}
              className="border-border bg-card flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="bg-primary/10 text-primary inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                  {doc.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" aria-hidden />
                  ) : (
                    <FileIcon className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.filename}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatBytes(doc.sizeBytes)} ·{" "}
                    {doc.mimeType.replace("application/", "").replace("image/", "")}
                  </p>
                </div>
              </div>
              {locked ? null : (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onRemove(doc.id)}
                  aria-label="Remove file"
                >
                  <TrashIcon className="text-muted-foreground hover:text-destructive h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
