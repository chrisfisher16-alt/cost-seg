"use client";

import { useState, useTransition } from "react";

import { sendMagicLinkAction } from "@/app/(auth)/actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        Sign-in is not configured in this environment. Set{" "}
        <code className="rounded bg-white/60 px-1 dark:bg-black/40">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-white/60 px-1 dark:bg-black/40">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code>.env.local</code>.
      </div>
    );
  }

  if (stage.kind === "sent") {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p className="font-semibold">Check your email.</p>
        <p>
          We sent a sign-in link to <strong>{stage.email}</strong>. The link expires in 1 hour.
        </p>
        <button
          type="button"
          onClick={() => setStage({ kind: "idle" })}
          className="text-xs underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  const sending = stage.kind === "sending";

  return (
    <div className="space-y-6">
      <form onSubmit={submitEmail} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={sending}
          className={cn(
            "bg-foreground text-background inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition",
            sending ? "opacity-60" : "hover:opacity-90",
          )}
        >
          {sending ? "Sending…" : "Email me a magic link"}
        </button>
        {stage.kind === "error" ? (
          <p role="alert" className="text-xs text-red-600">
            {stage.message}
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isGooglePending}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white text-sm font-medium transition dark:border-zinc-700 dark:bg-zinc-950",
          isGooglePending ? "opacity-60" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        )}
      >
        <GoogleIcon />
        {isGooglePending ? "Opening Google…" : "Continue with Google"}
      </button>

      <p className="text-center text-xs text-zinc-500">
        By continuing you agree to our terms and privacy policy.
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
