"use client";

import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { startPipelineAction } from "@/app/(app)/studies/[id]/actions";
import { Button } from "@/components/ui/button";

/**
 * Client-side trigger for the pipeline. Lives in the intake sidebar alongside
 * the "Ready to start" progress card; only rendered when the readiness check
 * reports `complete && !processing && !locked` on the server.
 *
 * On success the server action writes the `documents.ready` guard event +
 * fires the Inngest trigger; we revalidate the intake path and push the user
 * to the processing page where PipelineLive polls for state.
 */
export function IntakeStartButton({ studyId }: { studyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errored, setErrored] = useState(false);

  function onClick() {
    setErrored(false);
    startTransition(async () => {
      const result = await startPipelineAction(studyId);
      if (!result.ok) {
        setErrored(true);
        toast.error(result.error);
        return;
      }
      toast.success("Pipeline queued — watching it run now.");
      router.push(`/studies/${studyId}/processing`);
    });
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      loading={pending}
      loadingText="Starting…"
      leadingIcon={<SparklesIcon />}
      onClick={onClick}
      variant={errored ? "outline" : "default"}
    >
      Start my report
    </Button>
  );
}
