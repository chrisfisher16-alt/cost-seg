"use client";

import { CheckCircle2Icon, MailIcon } from "lucide-react";
import { useState } from "react";

import { attachLeadEmailAction } from "@/app/(marketing)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DiyWaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    // Leverages the existing lead-capture action. It creates a Lead without a leadId, which the
    // server upserts by email.
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
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-start gap-3 p-6">
          <CheckCircle2Icon className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-success font-semibold">You&rsquo;re on the list.</p>
            <p className="text-success/90 mt-1 text-sm">
              We&rsquo;ll email <span className="font-mono">{email}</span> the moment DIY Self-Serve
              is live. Your first property will be free.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-7">
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Email"
            required
            htmlFor="diy-email"
            hint="We only email about DIY launch. Unsubscribe any time."
          >
            <Input
              id="diy-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              leadingAdornment={<MailIcon className="h-4 w-4" />}
            />
          </Field>
          {state === "error" ? (
            <p role="alert" className="text-destructive text-sm font-medium">
              {message}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={state === "pending"}
            loadingText="Saving your spot…"
          >
            Reserve my spot
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
