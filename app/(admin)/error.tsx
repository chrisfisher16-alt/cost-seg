"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for admin routes. Renders inside the AdminHeader so admins
 * keep their nav + the "back to pipeline" escape hatch.
 */
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      retry={unstable_retry}
      title="Admin view hit an error."
      description="Usually means Prisma, Supabase, or Inngest is having a moment. Check the respective status pages if retry doesn't clear it — the error ref below pins the exact request in the server logs."
      action={
        <Button asChild variant="outline">
          <Link href="/admin">Back to pipeline</Link>
        </Button>
      }
    />
  );
}
