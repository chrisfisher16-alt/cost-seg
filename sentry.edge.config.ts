import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

// See sentry.server.config.ts for why VERCEL_GIT_COMMIT_SHA is the release
// source of truth.
const release = process.env.VERCEL_GIT_COMMIT_SHA;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  release,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.APP_ENV ?? process.env.NODE_ENV,
});
