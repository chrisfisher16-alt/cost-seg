import "server-only";

import { render } from "@react-email/render";

import { CpaInviteEmail } from "./templates/CpaInviteEmail";
import { ReportDeliveredEmail } from "./templates/ReportDeliveredEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { getFromAddress, getResend } from "./resend";

import { BRAND } from "@/lib/brand";

import type { Tier } from "@/lib/stripe/catalog";

const TIER_WELCOME_SUBJECT: Record<Tier, string> = {
  DIY: `Welcome to ${BRAND.name} — generate your DIY Self-Serve study`,
  AI_REPORT: `Welcome to ${BRAND.name} — upload your documents to start your AI Report`,
  ENGINEER_REVIEWED: `Welcome to ${BRAND.name} — upload your documents to start your Engineer-Reviewed Study`,
};

const TIER_DELIVERY_SUBJECT: Record<Tier, string> = {
  DIY: `Your ${BRAND.name} DIY Self-Serve Report is ready`,
  AI_REPORT: `Your ${BRAND.name} AI Report is ready`,
  ENGINEER_REVIEWED: `Your ${BRAND.name} Engineer-Reviewed Study is ready`,
};

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

  const subject = TIER_WELCOME_SUBJECT[args.tier];

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
 * (Tier 1 DIY/AI Report or Tier 2 Engineer-Reviewed Study) is ready.
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

  const subject = TIER_DELIVERY_SUBJECT[args.tier];

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

interface SendCpaInviteArgs {
  to: string;
  ownerName?: string | null;
  ownerEmail: string;
  propertyAddress: string;
  shareUrl: string;
  note?: string | null;
}

/**
 * Send a CPA / collaborator invite email. The recipient clicks through to
 * `/share/<token>`, signs in, and is routed to the read-only study view.
 */
export async function sendCpaInviteEmail(args: SendCpaInviteArgs): Promise<void> {
  const client = getResend();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const element = CpaInviteEmail({
    ownerName: args.ownerName ?? null,
    ownerEmail: args.ownerEmail,
    propertyAddress: args.propertyAddress,
    shareUrl: args.shareUrl,
    appUrl,
    note: args.note ?? null,
  });
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  const subject = `Review a ${BRAND.name} study for ${args.propertyAddress}`;

  if (!client) {
    console.info("[email] RESEND_API_KEY unset — CPA invite not sent.", {
      to: args.to,
      subject,
      shareUrl: args.shareUrl,
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
    console.error("[email] resend rejected CPA invite", error);
    throw new Error(`Resend error: ${error.message}`);
  }
}
