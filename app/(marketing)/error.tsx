"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for marketing routes. These are mostly static so an error
 * here is rare — usually a sample-data failure or a broken server action
 * (estimator / lead capture).
 */
export default function MarketingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[marketing-error]", error);
  }, [error]);

  return (
    <ErrorFallback
      error={error}
      retry={unstable_retry}
      title="This page didn't load."
      description="We hit an error rendering marketing content. Refresh in a moment, or browse elsewhere."
      action={
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      }
    />
  );
}
