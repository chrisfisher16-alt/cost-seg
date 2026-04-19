"use client";

import { DownloadIcon } from "lucide-react";

import { getDeliverableUrlAction } from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function ViewDownloadButton({ studyId }: { studyId: string }) {
  async function download() {
    const res = await getDeliverableUrlAction(studyId);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
  }
  return (
    <Button onClick={download} leadingIcon={<DownloadIcon />}>
      Download PDF
    </Button>
  );
}
