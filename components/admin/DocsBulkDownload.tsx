"use client";

import { DownloadCloudIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * One-click trigger to fetch every document for a study. Sequentially clicks
 * a synthetic anchor per URL so the browser treats each download as a
 * user-gesture-initiated action (avoids popup blockers + multi-file
 * download throttling you hit with setTimeout-less loops).
 *
 * Why not a server-side zip? Adding a zip lib (jszip, fflate, archiver)
 * costs ~25-100KB of deps for a feature only admins use. The docs are
 * already uploaded as PDFs + JPGs which don't compress further — the
 * "download each" flow gives the admin the same offline-access outcome
 * with zero new deps and zero server-side buffering.
 *
 * Cross-origin caveat: Supabase signed URLs are cross-origin, so the
 * `download` attribute on <a> is suggestion-only — the filename we set
 * here may be overridden by Supabase's Content-Disposition. That's OK;
 * the worst case is the PDF opens inline, which is still useful.
 */
export function DocsBulkDownload({
  docs,
}: {
  docs: Array<{ signedUrl: string; filename: string }>;
}) {
  const [pending, setPending] = useState(false);
  if (docs.length < 2) return null;

  async function downloadAll() {
    if (pending) return;
    setPending(true);
    try {
      for (let i = 0; i < docs.length; i++) {
        const { signedUrl, filename } = docs[i]!;
        const a = document.createElement("a");
        a.href = signedUrl;
        a.download = filename;
        // target=_blank is the popup-friendly fallback for cross-origin
        // URLs where `download` is ignored — the file opens in a new tab
        // and the admin can save from there.
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (i < docs.length - 1) {
          // 200ms between clicks is enough to dodge Chrome's "multiple
          // downloads" auto-cancel without feeling laggy.
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      toast.success(`Triggered ${docs.length} downloads.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={downloadAll}
      loading={pending}
      loadingText="Triggering…"
      leadingIcon={<DownloadCloudIcon />}
    >
      Download all ({docs.length})
    </Button>
  );
}
