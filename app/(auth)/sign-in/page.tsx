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
  description: "Sign in to Cost Seg — magic link or Google. No passwords.",
};

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="text-muted-foreground text-sm">Magic links or Google — no passwords.</p>
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
