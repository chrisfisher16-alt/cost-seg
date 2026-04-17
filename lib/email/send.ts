import "server-only";

import { render } from "@react-email/render";

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
