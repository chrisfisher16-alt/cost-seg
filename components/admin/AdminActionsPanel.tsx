"use client";

import type { StudyStatus, Tier } from "@prisma/client";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  MailIcon,
  RefreshCwIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminMarkFailedAction,
  adminRerunPipelineAction,
  adminResendDeliveryEmailAction,
  adminUploadSignedStudyAction,
} from "@/app/(admin)/admin/studies/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  studyId: string;
  status: StudyStatus;
  tier: Tier;
  deliverableUrl: string | null;
}

export function AdminActionsPanel({ studyId, status, tier, deliverableUrl }: Props) {
  const router = useRouter();
  const [rerunPending, startRerun] = useTransition();
  const [resendPending, startResend] = useTransition();

  function rerun() {
    if (!confirm("Re-run the AI pipeline from the top?")) return;
    startRerun(async () => {
      const result = await adminRerunPipelineAction(studyId);
      if (result.ok) {
        toast.success("Pipeline re-run queued", {
          icon: <RefreshCwIcon className="h-4 w-4" />,
        });
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  function resendDelivery() {
    startResend(async () => {
      const result = await adminResendDeliveryEmailAction(studyId);
      if (result.ok) {
        toast.success("Delivery email resent", { icon: <MailIcon className="h-4 w-4" /> });
      } else {
        toast.error(result.error);
      }
    });
  }

  async function uploadSigned(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await adminUploadSignedStudyAction(studyId, formData);
    if (result.ok) {
      toast.success("Signed study uploaded and delivered", {
        icon: <CheckCircle2Icon className="h-4 w-4" />,
      });
    } else {
      toast.error(result.error);
    }
    router.refresh();
  }

  const canRerun =
    status === "AWAITING_DOCUMENTS" ||
    status === "PROCESSING" ||
    status === "AI_COMPLETE" ||
    status === "AWAITING_ENGINEER" ||
    status === "FAILED";
  const canUploadSigned = tier === "ENGINEER_REVIEWED" && status === "AWAITING_ENGINEER";
  const canResend = status === "DELIVERED" && Boolean(deliverableUrl);
  const canMarkFailed = status !== "DELIVERED" && status !== "FAILED" && status !== "REFUNDED";

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          Actions
        </p>

        <Button
          type="button"
          onClick={rerun}
          disabled={!canRerun}
          loading={rerunPending}
          loadingText="Re-running…"
          variant="outline"
          className="w-full"
          leadingIcon={<RefreshCwIcon />}
        >
          Re-run pipeline
        </Button>

        <Button
          type="button"
          onClick={resendDelivery}
          disabled={!canResend}
          loading={resendPending}
          loadingText="Resending…"
          variant="outline"
          className="w-full"
          leadingIcon={<MailIcon />}
        >
          Resend delivery email
        </Button>

        {canMarkFailed ? <MarkFailedDialog studyId={studyId} status={status} /> : null}

        {canUploadSigned ? (
          <form onSubmit={uploadSigned} className="border-border space-y-2 border-t pt-4">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <UploadIcon className="h-3.5 w-3.5" />
              Upload engineer-signed PDF
            </p>
            <Field label="PDF" htmlFor="admin-signed-file">
              <Input
                id="admin-signed-file"
                type="file"
                name="file"
                accept="application/pdf"
                required
                className="text-xs"
              />
            </Field>
            <Field label="Engineer name" htmlFor="admin-engineer-name">
              <Input
                id="admin-engineer-name"
                type="text"
                name="engineerName"
                placeholder="As signed"
                required
              />
            </Field>
            <Field label="PE license" htmlFor="admin-engineer-license">
              <Input
                id="admin-engineer-license"
                type="text"
                name="engineerLicense"
                placeholder="License # + state"
                required
              />
            </Field>
            <Button type="submit" size="sm" className="w-full" leadingIcon={<UploadIcon />}>
              Upload + deliver
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MarkFailedDialog({ studyId, status }: { studyId: string; status: StudyStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminMarkFailedAction(studyId, reason);
      if (result.ok) {
        toast.success("Study marked failed", {
          icon: <XCircleIcon className="h-4 w-4" />,
        });
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/5 w-full"
          leadingIcon={<AlertCircleIcon />}
        >
          Mark as failed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark study as failed</DialogTitle>
          <DialogDescription>
            This flips the study to <code className="font-mono">FAILED</code> (from{" "}
            <code className="font-mono">{status}</code>) and stores your reason on the record. The
            customer sees the failure state on their pipeline page. Refund in Stripe separately if
            money changed hands.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Reason" required hint="Shows in StudyEvents; keep it concise.">
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Closing disclosure appears redacted; unable to classify."
              required
              minLength={3}
              maxLength={500}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-destructive text-xs font-medium">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={isPending} loadingText="Marking…">
              Mark as failed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
