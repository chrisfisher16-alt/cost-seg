"use client";

import { useEffect } from "react";
import Link from "next/link";

import { BRAND } from "@/lib/brand";

/**
 * Catastrophic-error boundary. Renders when `app/error.tsx` itself fails or
 * the root layout throws. Must declare its own <html> and <body> — Next
 * bypasses the root layout when this renders. Keep it dependency-free:
 * no Tailwind theme tokens, no providers. Ship inline styles only.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#FAFAF9",
          color: "#0A0A0A",
        }}
      >
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "rgba(220, 38, 38, 0.1)",
              color: "#B91C1C",
              marginBottom: 16,
              fontSize: 24,
              fontWeight: 700,
            }}
            aria-hidden
          >
            !
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
            Something broke badly enough that we couldn&rsquo;t recover.
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#52525B",
              margin: "0 0 24px",
            }}
          >
            This page failed before we could even load our normal error screen. Try again — if it
            keeps happening, email{" "}
            <a
              href={`mailto:${BRAND.email.support}`}
              style={{ color: "#047857", textDecoration: "underline" }}
            >
              {BRAND.email.support}
            </a>{" "}
            with the error ref below and we&rsquo;ll get right on it.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: "#71717A",
                margin: "0 0 24px",
              }}
            >
              Error ref: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#047857",
                color: "white",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #E4E4E7",
                background: "white",
                color: "#0A0A0A",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
