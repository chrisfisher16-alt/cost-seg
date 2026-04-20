"use client";

import {
  CheckCircle2Icon,
  FileIcon,
  ImageIcon,
  Loader2Icon,
  LockIcon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createUploadUrlAction,
  finalizeUploadAction,
  removeDocumentAction,
} from "@/app/(app)/studies/[id]/actions";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { DOCUMENT_KIND_META, EXT_TO_MIME, acceptAttrForExts } from "./meta";

import type { DocumentKind } from "@prisma/client";

interface UploadedDoc {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

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
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startRemoveTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const isUploading = uploadingCount > 0;
  const disabled = locked || isUploading || (!meta.allowMultiple && uploaded.length > 0);

  // Build the per-kind MIME allowlist from meta once — used by both the drop
  // handler and the client-side validation path. Server re-validates.
  const acceptedMimes = meta.acceptedExts.map((e) => EXT_TO_MIME[e]);
  const acceptedLabels = meta.acceptedExts.map((e) => e.toUpperCase());

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(`File exceeds ${MAX_BYTES / 1024 / 1024}MB limit.`);
        return;
      }
      // Some browsers leave file.type empty for esoteric types; fall back to
      // extension matching so a genuine .xlsx from Safari still goes through.
      const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      const extOk =
        extMatch &&
        meta.acceptedExts.some(
          (e) => `.${e}` === `.${extMatch[1]}` || (e === "jpg" && extMatch[1] === "jpeg"),
        );
      if (!acceptedMimes.includes(file.type) && !extOk) {
        setError(`Unsupported type for this field. Use ${acceptedLabels.join(", ")}.`);
        return;
      }
      setUploadingCount((n) => n + 1);
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
        toast.success(`Uploaded ${file.name}`, {
          description: "Stored encrypted — safe to close this tab and come back.",
          icon: <CheckCircle2Icon className="h-4 w-4" />,
        });
        router.refresh();
      } finally {
        setUploadingCount((n) => Math.max(0, n - 1));
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [acceptedLabels, acceptedMimes, kind, meta.acceptedExts, router, studyId],
  );

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    // Single-file kinds reject extras before any upload starts so the user
    // gets a clear error instead of silently dropping later files.
    if (!meta.allowMultiple && list.length > 1) {
      setError("Only one file for this field. Remove the current file first.");
      return;
    }
    // Uploads run sequentially — the Property / Supabase storage signed URLs
    // don't love 10 parallel PUTs, and serial gives a predictable toast order.
    for (const file of list) {
      await handleFile(file);
    }
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    void handleFiles(event.dataTransfer.files);
  }

  function onDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function onDragLeave() {
    setIsDragOver(false);
  }

  function onRemove(documentId: string, filename: string) {
    if (
      !confirm(`Remove "${filename}"? You can re-upload it any time before we start processing.`)
    ) {
      return;
    }
    startRemoveTransition(async () => {
      const result = await removeDocumentAction(studyId, documentId);
      if (!result.ok) {
        setError(result.error);
        toast.error("Couldn't remove file", { description: result.error });
        return;
      }
      toast(`Removed ${filename}`);
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
          accept={acceptAttrForExts(meta.acceptedExts)}
          multiple={meta.allowMultiple}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
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
            ? uploadingCount > 1
              ? `Uploading ${uploadingCount}…`
              : "Uploading…"
            : meta.allowMultiple || uploaded.length === 0
              ? meta.allowMultiple
                ? "Drop files or tap to upload"
                : "Drop a file or tap to upload"
              : "Remove the current file to replace it"}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          {acceptedLabels.map((ext) => (
            <span
              key={ext}
              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono tracking-wide"
            >
              {ext}
            </span>
          ))}
          <span className="text-muted-foreground">up to {MAX_BYTES / 1024 / 1024}MB each</span>
        </div>
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <LockIcon className="h-3 w-3" aria-hidden />
          Encrypted at rest · only you and your engineer can see it
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
                  onClick={() => onRemove(doc.id, doc.filename)}
                  aria-label={`Remove ${doc.filename}`}
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
