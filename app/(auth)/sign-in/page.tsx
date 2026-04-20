import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/SignInForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Segra — magic link or Google. No passwords.",
};

/**
 * Map a raw `next` path to a human-friendly destination label. Keeps the
 * sign-in hero context-aware without echoing raw URLs at the user.
 * Falls through to "your account" for anything unrecognized.
 */
function destinationLabel(next: string | undefined): string | null {
  if (!next) return null;
  if (next.startsWith("/dashboard")) return "your dashboard";
  if (next.startsWith("/admin/engineer-queue")) return "the engineer queue";
  if (next.startsWith("/admin")) return "the admin pipeline";
  if (next.match(/^\/studies\/[^/]+\/intake/)) return "your document upload";
  if (next.match(/^\/studies\/[^/]+\/processing/)) return "your running study";
  if (next.match(/^\/studies\/[^/]+\/diy/)) return "your DIY study";
  if (next.match(/^\/studies\/[^/]+\/view/)) return "the shared study";
  if (next.startsWith("/share/")) return "your CPA invite";
  return "your account";
}

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const destination = destinationLabel(params.next);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
        {destination ? (
          <p className="text-muted-foreground text-sm">
            Sign in to continue to{" "}
            <span className="text-foreground font-medium">{destination}</span>.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">Magic links or Google — no passwords.</p>
        )}
      </div>

      {params.error === "callback" ? (
        <Alert variant="destructive">
          <AlertTitle>That link didn&rsquo;t work.</AlertTitle>
          <AlertDescription>
            It&rsquo;s invalid or expired. Send a fresh one below.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-7">
          <SignInForm next={params.next} supabaseConfigured={configured} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        Don&rsquo;t have an account yet?{" "}
        <a href="/pricing" className="text-primary font-medium underline-offset-2 hover:underline">
          Start a study →
        </a>
      </p>
    </div>
  );
}
