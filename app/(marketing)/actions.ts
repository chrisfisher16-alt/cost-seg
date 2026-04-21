"use server";

import { headers } from "next/headers";

import { getPrisma } from "@/lib/db/client";
import { computeEstimate } from "@/lib/estimator/compute";
import { estimatorInputSchema, type EstimatorResult } from "@/lib/estimator/types";
import { captureServer } from "@/lib/observability/posthog-server";
import { estimatorLimiter, leadCaptureLimiter } from "@/lib/ratelimit";
import { hashIp, resolveIp } from "@/lib/server/request-ip";

export type EstimateActionResult =
  | { ok: true; result: EstimatorResult; leadId: string | null }
  | { ok: false; error: string };

export type LeadCaptureResult = { ok: true } | { ok: false; error: string };

/**
 * Public estimator server action. Rate-limited per IP. Writes an anonymous
 * Lead row (best-effort) with the inputs + resulting range for funnel
 * analytics. DB failures are logged but never prevent the visitor from
 * seeing their estimate.
 */
export async function estimateAction(input: unknown): Promise<EstimateActionResult> {
  const h = await headers();
  const ip = resolveIp(h);

  const gate = await estimatorLimiter().check(ip);
  if (!gate.ok) {
    return {
      ok: false,
      error: "Too many estimates from this address — try again in a minute.",
    };
  }

  const parsed = estimatorInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = computeEstimate(parsed.data);

  let leadId: string | null = null;
  try {
    const lead = await getPrisma().lead.create({
      data: {
        email: null,
        source: "estimator",
        estimatorInputs: parsed.data,
        estimatedSavingsLowCents: result.savingsLowCents,
        estimatedSavingsHighCents: result.savingsHighCents,
        userAgent: h.get("user-agent") ?? null,
        ipHash: hashIp(ip),
      },
      select: { id: true },
    });
    leadId = lead.id;
  } catch (error) {
    console.warn("estimator: lead write failed", error);
  }

  await captureServer(leadId ?? `anon:${hashIp(ip).slice(0, 16)}`, "estimator_submitted", {
    propertyType: parsed.data.propertyType,
    purchasePriceCents: parsed.data.purchasePriceCents,
    savingsLowCents: result.savingsLowCents,
    savingsHighCents: result.savingsHighCents,
  });

  return { ok: true, result, leadId };
}

/**
 * Attach an email to a previously-created estimator Lead, or create a new
 * email-only Lead if no prior row exists. Rate-limited per IP.
 */
export async function attachLeadEmailAction(
  leadId: string | null,
  email: string,
): Promise<LeadCaptureResult> {
  const h = await headers();
  const ip = resolveIp(h);

  const gate = await leadCaptureLimiter().check(ip);
  if (!gate.ok) {
    return { ok: false, error: "Too many requests. Try again shortly." };
  }

  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }

  try {
    if (leadId) {
      await getPrisma().lead.update({
        where: { id: leadId },
        data: { email: trimmed, source: "estimator_email" },
      });
    } else {
      await getPrisma().lead.create({
        data: {
          email: trimmed,
          source: "estimator_email",
          userAgent: h.get("user-agent") ?? null,
          ipHash: hashIp(ip),
        },
      });
    }
  } catch (error) {
    console.warn("lead-capture: write failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  await captureServer(leadId ?? `email:${trimmed}`, "lead_email_attached", {
    hasPriorEstimate: Boolean(leadId),
  });

  return { ok: true };
}
