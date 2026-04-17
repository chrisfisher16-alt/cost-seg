import "server-only";

import { render } from "@react-email/render";

import { ReportDeliveredEmail } from "./templates/ReportDeliveredEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { getFromAddress, getResend } from "./resend";

import type { Tier } from "@/lib/stripe/catalog";

interface SendWelcomeArgs {
  to: string;
  firstName?: string | null;
  tier: Tier;
  intakeUrl: string;
}

/**
 * Send the post-payment welcome email with a magic link to the intake page.
 * No-ops (with a log) when RESEND_API_KEY is unset so local dev still works.
 */
export async function sendWelcomeEmail(args: SendWelcomeArgs): Promise<void> {
  const client = getResend();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const element = WelcomeEmail({
    firstName: args.firstName ?? null,
    tier: args.tier,
    intakeUrl: args.intakeUrl,
    appUrl,
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  const subject =
    args.tier === "AI_REPORT"
      ? "Upload your documents to start your AI Report"
      : "Upload your documents to start your Engineer-Reviewed Study";

  if (!client) {
    console.info("[email] RESEND_API_KEY unset — welcome email not sent.", {
      to: args.to,
      subject,
      intakeUrl: args.intakeUrl,
    });
    return;
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error("[email] resend rejected welcome email", error);
    throw new Error(`Resend error: ${error.message}`);
  }
}

interface SendReportDeliveredArgs {
  to: string;
  firstName?: string | null;
  tier: Tier;
  downloadUrl: string;
  propertyAddress: string;
  expiresAtIso: string;
}

/**
 * Deliver the signed-URL download link to the customer once their report
 * (Tier 1 AI Report or Tier 2 Engineer-Reviewed Study) is ready.
 */
export async function sendReportDeliveredEmail(args: SendReportDeliveredArgs): Promise<void> {
  const client = getResend();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const element = ReportDeliveredEmail({
    firstName: args.firstName ?? null,
    tier: args.tier,
    downloadUrl: args.downloadUrl,
    propertyAddress: args.propertyAddress,
    expiresAtIso: args.expiresAtIso,
    appUrl,
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  const subject =
    args.tier === "AI_REPORT"
      ? "Your AI Cost Segregation Report is ready"
      : "Your Engineer-Reviewed Cost Segregation Study is ready";

  if (!client) {
    console.info("[email] RESEND_API_KEY unset — delivery email not sent.", {
      to: args.to,
      subject,
      downloadUrl: args.downloadUrl,
    });
    return;
  }

  const { error } = await client.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error("[email] resend rejected delivery email", error);
    throw new Error(`Resend error: ${error.message}`);
  }
}
