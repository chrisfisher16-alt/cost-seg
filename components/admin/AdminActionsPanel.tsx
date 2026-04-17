"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  adminRerunPipelineAction,
  adminResendDeliveryEmailAction,
  adminUploadSignedStudyAction,
} from "@/app/(admin)/admin/studies/[id]/actions";
import { cn } from "@/lib/utils";
import type { StudyStatus, Tier } from "@prisma/client";

interface Props {
  studyId: string;
  status: StudyStatus;
  tier: Tier;
  deliverableUrl: string | null;
}

export function AdminActionsPanel({ studyId, status, tier, deliverableUrl }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rerunPending, startRerun] = useTransition();
  const [resendPending, startResend] = useTransition();

  function rerun() {
    if (!confirm("Re-run the AI pipeline from the top?")) return;
    setMessage(null);
    startRerun(async () => {
      const result = await adminRerunPipelineAction(studyId);
      setMessage(
        result.ok
          ? { kind: "ok", text: "Pipeline re-run queued." }
          : { kind: "err", text: result.error },
      );
      router.refresh();
    });
  }

  function resendDelivery() {
    setMessage(null);
    startResend(async () => {
      const result = await adminResendDeliveryEmailAction(studyId);
      setMessage(
        result.ok
          ? { kind: "ok", text: "Delivery email resent." }
          : { kind: "err", text: result.error },
      );
    });
  }

  async function uploadSigned(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    const result = await adminUploadSignedStudyAction(studyId, formData);
    setMessage(
      result.ok
        ? { kind: "ok", text: "Signed study uploaded and delivered." }
        : { kind: "err", text: result.error },
    );
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

  return (
    <aside className="space-y-3 rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">Actions</h2>

      <button
        type="button"
        onClick={rerun}
        disabled={!canRerun || rerunPending}
        className={actionClass(!canRerun || rerunPending)}
      >
        {rerunPending ? "Re-running…" : "Re-run pipeline"}
      </button>

      {canUploadSigned ? (
        <form
          onSubmit={uploadSigned}
          className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
        >
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Upload engineer-signed PDF
          </label>
          <input
            type="file"
            name="file"
            accept="application/pdf"
            required
            className="block w-full text-xs"
          />
          <input
            type="text"
            name="engineerName"
            placeholder="Engineer name (on the signature)"
            required
            className="block w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="text"
            name="engineerLicense"
            placeholder="PE license # + state"
            required
            className="block w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="submit" className={actionClass(false)}>
            Upload + deliver
          </button>
        </form>
      ) : null}

      <button
        type="button"
        onClick={resendDelivery}
        disabled={!canResend || resendPending}
        className={actionClass(!canResend || resendPending)}
      >
        {resendPending ? "Resending…" : "Resend delivery email"}
      </button>

      {message ? (
        <p
          role="alert"
          className={
            message.kind === "ok"
              ? "text-xs text-emerald-700 dark:text-emerald-300"
              : "text-xs text-red-600"
          }
        >
          {message.text}
        </p>
      ) : null}
    </aside>
  );
}

function actionClass(disabled: boolean): string {
  return cn(
    "inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-300 px-3 text-xs font-medium transition dark:border-zinc-700",
    disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
  );
}
