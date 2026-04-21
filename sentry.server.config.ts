import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

// Vercel auto-populates VERCEL_GIT_COMMIT_SHA on every deploy; local dev
// falls through to undefined (Sentry drops the tag rather than breaking).
// Release tagging lets "errors on April 20" queries in Sentry scope to the
// exact commit that shipped the bug instead of spanning weeks of deploys.
const release = process.env.VERCEL_GIT_COMMIT_SHA;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  release,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.APP_ENV ?? process.env.NODE_ENV,
});
