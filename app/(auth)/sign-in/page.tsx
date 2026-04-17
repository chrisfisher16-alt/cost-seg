import { SignInForm } from "@/components/auth/SignInForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Magic links or Google — no passwords.
        </p>
      </div>
      {params.error === "callback" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          That sign-in link is invalid or expired. Try sending a fresh one.
        </p>
      ) : null}
      <SignInForm next={params.next} supabaseConfigured={configured} />
    </div>
  );
}
