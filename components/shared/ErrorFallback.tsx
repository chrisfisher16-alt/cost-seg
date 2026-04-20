"use client";

import { AlertTriangleIcon, CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

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
    "We hit an unexpected error. Try again — if it keeps happening, email support and we'll dig in.";

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

          {error.digest ? <ErrorDigest digest={error.digest} /> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={retry} variant="default" leadingIcon={<RefreshCwIcon />}>
              Try again
            </Button>
            {action}
          </div>

          <p className="text-muted-foreground border-border/60 border-t pt-4 text-xs">
            Still stuck? Email{" "}
            <a
              href="mailto:support@segra.tax"
              className="text-foreground font-medium underline-offset-2 hover:underline"
            >
              support@segra.tax
            </a>
            {error.digest ? " and include the error ref above" : ""}.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}

/**
 * Error-ref display with a click-to-copy button. Makes the "send us the
 * digest" debugging loop actually one click instead of hand-highlighting
 * a mono-font string from a dialog.
 */
function ErrorDigest({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied (older browsers, http context). The digest is still
      // visible for a user to hand-select; swallow silently.
    }
  }

  return (
    <div className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <p className="text-muted-foreground font-mono text-xs">
        Error ref: <span className="text-foreground">{digest}</span>
      </p>
      <Button
        type="button"
        onClick={copy}
        size="sm"
        variant="ghost"
        leadingIcon={copied ? <CheckIcon /> : <CopyIcon />}
        aria-label={copied ? "Copied to clipboard" : "Copy error reference"}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
