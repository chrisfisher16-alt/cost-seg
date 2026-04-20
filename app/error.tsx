"use client";

import { useEffect } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for routes outside any route group (e.g. /get-started,
 * /share/[token], /get-started/success). These routes render directly under
 * the root layout, so we provide our own minimal header here.
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Future: pipe into Sentry. For now, console.error is visible in server
    // and client logs and helps during local dev.
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center justify-between">
          <BrandMark />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
        </Container>
      </header>
      <ErrorFallback error={error} retry={unstable_retry} />
    </div>
  );
}
