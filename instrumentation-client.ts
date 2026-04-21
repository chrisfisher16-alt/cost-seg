import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Next.js auto-exposes VERCEL_GIT_COMMIT_SHA only to the server; for the
// client bundle we need a `NEXT_PUBLIC_` mirror. The env validator (Bucket 1
// F5/F6) can be extended to accept both. See sentry.server.config.ts for
// the rationale.
const release = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  release,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
