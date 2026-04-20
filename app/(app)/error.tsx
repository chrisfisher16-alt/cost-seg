"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for authenticated app routes (/dashboard, /studies/*).
 * Renders inside the AppHeader layout so the user still has nav context.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      retry={unstable_retry}
      title="We couldn't load this page."
      description="Usually a transient database or network blip — one retry fixes it. Your study data isn't affected; nothing has been lost."
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
