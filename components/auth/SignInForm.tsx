"use client";

import { CheckCircle2Icon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { sendMagicLinkAction } from "@/app/(auth)/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Stage =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

interface Props {
  next: string | undefined;
  supabaseConfigured: boolean;
}

export function SignInForm({ next, supabaseConfigured }: Props) {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [isGooglePending, startGoogleTransition] = useTransition();

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind === "sending") return;
    setStage({ kind: "sending" });
    const result = await sendMagicLinkAction(email, next);
    if (result.ok) {
      setStage({ kind: "sent", email });
    } else {
      setStage({ kind: "error", message: result.error });
    }
  }

  function signInWithGoogle() {
    startGoogleTransition(async () => {
      const supabase = getBrowserSupabase();
      const origin = window.location.origin;
      const redirectTo = next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setStage({
          kind: "error",
          message: "Could not start the Google sign-in flow.",
        });
      }
    });
  }

  if (!supabaseConfigured) {
    return (
      <Alert variant="warning">
        <AlertTitle>Sign-in is not configured.</AlertTitle>
        <AlertDescription className="mt-2">
          Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code className="font-mono text-xs">.env.local</code>, then restart the dev server.
        </AlertDescription>
      </Alert>
    );
  }

  if (stage.kind === "sent") {
    return (
      <div className="space-y-4">
        <div className="border-success/30 bg-success/5 flex items-start gap-3 rounded-lg border p-5 text-sm">
          <CheckCircle2Icon className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="text-success">
            <p className="font-semibold">Check your email.</p>
            <p className="mt-1">
              We sent a sign-in link to <strong>{stage.email}</strong>. The link expires in 1 hour.
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStage({ kind: "idle" })}>
          Use a different email
        </Button>
      </div>
    );
  }

  const sending = stage.kind === "sending";

  return (
    <div className="space-y-6">
      <form onSubmit={submitEmail} className="space-y-4">
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            leadingAdornment={<MailIcon className="h-4 w-4" />}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={sending}
          loadingText="Sending magic link…"
        >
          Email me a magic link
        </Button>
        {stage.kind === "error" ? (
          <p role="alert" className="text-destructive text-xs font-medium">
            {stage.message}
          </p>
        ) : null}
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <Separator className="flex-1" />
        <span className="font-mono tracking-[0.18em] uppercase">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={signInWithGoogle}
        loading={isGooglePending}
        loadingText="Opening Google…"
        leadingIcon={<GoogleIcon />}
      >
        Continue with Google
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        By continuing you agree to our{" "}
        <a href="/legal/terms" className="underline-offset-2 hover:underline">
          terms
        </a>{" "}
        and{" "}
        <a href="/legal/privacy" className="underline-offset-2 hover:underline">
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 11v2.8h7.8c-.3 1.8-2.1 5.3-7.8 5.3-4.7 0-8.5-3.9-8.5-8.6s3.8-8.6 8.5-8.6c2.7 0 4.5 1.1 5.5 2.1l3.7-3.6C19.1 1.1 15.9-.2 12-.2 5.3-.2 0 5.1 0 12s5.3 12.2 12 12.2c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.3-.2-2H12z"
      />
    </svg>
  );
}
