"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteStudyAction } from "@/app/(app)/studies/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Small destructive-action button that lives on each dashboard StudyCard.
 * Opens a confirmation dialog — hard-deleting a study removes every
 * Document + StudyEvent + StudyShare row (via schema-level cascades) plus
 * best-effort storage cleanup, so the confirm-step is non-negotiable.
 *
 * Blocked by the server action while status === "PROCESSING" — the
 * operator can still click, but the action will refuse and surface a
 * toast. Keeping the button visible in that state is deliberate: it
 * means we don't have to thread the study's status through the card
 * twice (server-rendered card, client-rendered button) just to
 * conditionally render.
 */
export function DeleteStudyButton({
  studyId,
  propertyLabel,
}: {
  studyId: string;
  propertyLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteStudyAction(studyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Study deleted.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          leadingIcon={<Trash2Icon />}
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete study for ${propertyLabel}`}
        >
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this study?</DialogTitle>
          <DialogDescription>
            {propertyLabel}. This permanently removes uploaded documents, pipeline events, and any
            share links. You can&rsquo;t undo this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep the study
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={pending}
            loadingText="Deleting…"
            leadingIcon={<Trash2Icon />}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
