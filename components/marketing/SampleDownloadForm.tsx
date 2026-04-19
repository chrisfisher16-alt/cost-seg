"use client";

import { CheckCircle2Icon, DownloadIcon } from "lucide-react";
import { useState } from "react";

import { attachLeadEmailAction } from "@/app/(marketing)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SampleDownloadForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    const res = await attachLeadEmailAction(null, email);
    if (res.ok) {
      setState("success");
    } else {
      setState("error");
      setMessage(res.error);
    }
  }

  if (state === "success") {
    return (
      <div className="border-success/30 bg-success/5 text-success mx-auto flex max-w-md items-start gap-3 rounded-md border p-4 text-sm">
        <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          On its way. Check <span className="font-mono">{email}</span> in the next business day.
        </span>
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
          loadingText="Sending…"
          trailingIcon={<DownloadIcon />}
        >
          Email me the PDF
        </Button>
      </form>
      {state === "error" ? (
        <p role="alert" className="text-destructive mt-2 text-xs font-medium">
          {message}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-3 text-xs">
        We&rsquo;ll send a single email with the PDF. No marketing sequence.
      </p>
    </div>
  );
}
