"use client";

import { CheckCircle2Icon, DownloadIcon } from "lucide-react";
import { useState } from "react";

import { attachLeadEmailAction } from "@/app/(marketing)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_SAMPLE_ID } from "@/lib/samples/catalog";

interface Props {
  /** Which sample to download. Defaults to `oak-ridge` — the most representative. */
  sampleId?: string;
}

export function SampleDownloadForm({ sampleId = DEFAULT_SAMPLE_ID }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    // Capture the lead first (best-effort), then trigger the download. If lead
    // capture fails the download still happens — we don't gate on Prisma here.
    const res = await attachLeadEmailAction(null, email);
    if (!res.ok) {
      setState("error");
      setMessage(res.error);
      return;
    }
    setState("success");
    // Open the PDF in a new tab so the thank-you state stays visible.
    window.open(`/api/samples/${sampleId}/pdf`, "_blank", "noopener,noreferrer");
  }

  const pdfHref = `/api/samples/${sampleId}/pdf`;

  if (state === "success") {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <div className="border-success/30 bg-success/5 text-success flex items-start gap-3 rounded-md border p-4 text-sm">
          <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Opening the PDF in a new tab. Saved your email (
            <span className="font-mono">{email}</span>) so we can follow up.
          </span>
        </div>
        <div className="flex gap-3">
          <Button asChild size="sm" variant="outline" leadingIcon={<DownloadIcon />}>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer" download>
              Didn&rsquo;t open? Download again
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="h-11"
        />
        <Button
          type="submit"
          size="lg"
          loading={state === "pending"}
          loadingText="Opening PDF…"
          trailingIcon={<DownloadIcon />}
        >
          Download the PDF
        </Button>
      </form>
      {state === "error" ? (
        <p role="alert" className="text-destructive mt-2 text-xs font-medium">
          {message}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-xs">
        Opens in a new tab. No marketing sequence — a single follow-up at most.{" "}
        <a
          href={pdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Or skip the email and download directly →
        </a>
      </p>
    </div>
  );
}
