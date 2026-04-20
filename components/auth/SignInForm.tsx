"use client";

import { CheckCircle2Icon, ClockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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
  /**
   * When `retryAfterSec` is set, the submit button stays disabled for that
   * many seconds — otherwise the user mashes the button and keeps resetting
   * Supabase's per-email throttle window.
   */
  | { kind: "error"; message: string; retryAfterSec?: number };

interface Props {
  next: string | undefined;
  supabaseConfigured: boolean;
}

export function SignInForm({ next, supabaseConfigured }: Props) {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [cooldownSec, setCooldownSec] = useState(0);
  const [isGooglePending, startGoogleTransition] = useTransition();

  // Tick the cooldown down to zero once per second. We stop the interval the
  // moment it hits 0 so idle users aren't paying a useless setInterval tax.
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSec]);

  async function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind === "sending" || cooldownSec > 0) return;
    setStage({ kind: "sending" });
    const result = await sendMagicLinkAction(email, next);
    if (result.ok) {
      setStage({ kind: "sent", email });
      setCooldownSec(0);
    } else {
      setStage({
        kind: "error",
        message: result.error,
        retryAfterSec: result.retryAfterSec,
      });
      if (result.retryAfterSec && result.retryAfterSec > 0) {
        setCooldownSec(result.retryAfterSec);
      }
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
        <div className="border-success/30 bg-success/5 flex items-start gap-3 rounded-lg border p-5 text-sm motion-safe:animate-[scale-in_200ms_cubic-bezier(0.22,1,0.36,1)]">
          <CheckCircle2Icon className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="text-success space-y-1.5">
            <p className="font-semibold">Check your email.</p>
            <p>
              We sent a sign-in link to <strong>{stage.email}</strong>.
            </p>
            <p className="text-success/90 text-xs">
              The link is valid for 1 hour. Check your spam folder if it doesn&rsquo;t arrive within
              a minute.
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
  const onCooldown = cooldownSec > 0;
  // While the cooldown is ticking, we suppress the original "try again in
  // Ns" copy and show a live countdown instead — otherwise the user reads
  // a stale number as the real one ticks down silently.
  const errorMessage =
    stage.kind === "error"
      ? onCooldown
        ? `Supabase is throttling magic-link emails — try again in ${cooldownSec} ${
            cooldownSec === 1 ? "second" : "seconds"
          }.`
        : stage.message
      : null;

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
          disabled={onCooldown}
          leadingIcon={onCooldown ? <ClockIcon /> : undefined}
        >
          {onCooldown ? `Try again in ${cooldownSec}s` : "Email me a magic link"}
        </Button>
        {errorMessage ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
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

      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
        <ShieldCheckIcon className="h-3 w-3" aria-hidden />
        No passwords. No tracking across sites.
      </p>

      <p className="text-muted-foreground text-center text-xs">
        By continuing you agree to our{" "}
        <a href="/legal/terms" className="text-foreground underline-offset-2 hover:underline">
          terms
        </a>{" "}
        and{" "}
        <a href="/legal/privacy" className="text-foreground underline-offset-2 hover:underline">
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Official Google "G" logo — four-color mark. More recognizable than the
 * single-path monochrome version that was here before, which looked like a
 * red blob at small sizes.
 */
function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
