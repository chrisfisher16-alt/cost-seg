"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/shared/Container";

interface Props {
  /** The caught error — Next passes this to every `error.tsx`. */
  error: Error & { digest?: string };
  /** Attempts to re-render the errored segment. Next 16 API. */
  retry: () => void;
  /** Short headline (e.g. "Dashboard couldn't load"). */
  title?: string;
  /** Optional longer description. Pairs with title. */
  description?: string;
  /** Optional inline action node rendered alongside Retry. */
  action?: React.ReactNode;
}

/**
 * Shared error-boundary fallback UI. Used by every `error.tsx` we ship so the
 * tone, layout, and retry behavior stay consistent across surfaces.
 */
export function ErrorFallback({ error, retry, title, description, action }: Props) {
  const headline = title ?? "Something went wrong.";
  const body =
    description ??
    "We hit an unexpected error. Try again — if it keeps happening, refresh the page or get in touch.";

  return (
    <Container size="md" className="py-16 sm:py-24">
      <Card className="border-destructive/40">
        <CardContent className="space-y-5 p-8">
          <div className="flex items-start gap-3">
            <div className="bg-destructive/10 text-destructive flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertTriangleIcon className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{headline}</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
            </div>
          </div>

          {error.digest ? (
            <p className="text-muted-foreground border-border/60 border-t pt-4 font-mono text-xs">
              Error ref: <span className="text-foreground">{error.digest}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={retry} variant="default" leadingIcon={<RefreshCwIcon />}>
              Try again
            </Button>
            {action}
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
