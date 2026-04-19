"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { parseUsdInputToCents } from "@/lib/estimator/format";
import { PROPERTY_TYPES } from "@/lib/estimator/types";
import { inngest } from "@/inngest/client";
import { buildDiySchedule } from "@/lib/studies/diy-pipeline";
import { Prisma } from "@prisma/client";

type ActionResult = { ok: true; redirectTo: string } | { ok: false; error: string };

const diySchema = z.object({
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(100),
  state: z
    .string()
    .trim()
    .length(2, "Two-letter state code.")
    .transform((s) => s.toUpperCase()),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "ZIP must be 5 digits or ZIP+4."),
  purchasePriceRaw: z.string().min(1, "Enter a purchase price."),
  landValueRaw: z.string().min(1, "Enter a land value."),
  acquiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Acquired date must be YYYY-MM-DD."),
  propertyType: z.enum(PROPERTY_TYPES),
  squareFeet: z.number().int().positive().max(1_000_000).optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
});

/**
 * Submit a DIY study: persist the property details the user just entered, run
 * the pure buildDiySchedule pipeline, mark the study AI_COMPLETE, and emit
 * `study.ai.complete` so the existing delivery function renders the PDF and
 * emails the user. Redirects to the pipeline-live page so they see the
 * celebration moment.
 */
export async function submitDiyStudyAction(studyId: string, input: unknown): Promise<ActionResult> {
  const { user } = await requireAuth();
  const parsed = diySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      userId: true,
      tier: true,
      status: true,
      propertyId: true,
    },
  });
  if (!study) return { ok: false, error: "Study not found." };
  assertOwnership(user, study);

  if (study.tier !== "DIY") {
    return { ok: false, error: "This study is not a DIY Self-Serve study." };
  }
  if (study.status !== "AWAITING_DOCUMENTS") {
    return { ok: false, error: "This study has already been submitted." };
  }

  const purchasePriceCents = parseUsdInputToCents(data.purchasePriceRaw);
  const landValueCents = parseUsdInputToCents(data.landValueRaw);
  if (!purchasePriceCents || purchasePriceCents <= 0) {
    return { ok: false, error: "Enter a valid purchase price." };
  }
  if (landValueCents === null || landValueCents < 0) {
    return { ok: false, error: "Enter a valid land value (can be zero)." };
  }
  if (landValueCents >= purchasePriceCents) {
    return {
      ok: false,
      error: "Land value must be less than the purchase price — otherwise no basis is depreciable.",
    };
  }

  // Build the schedule with the user's declared numbers.
  const schedule = buildDiySchedule({
    propertyType: data.propertyType,
    propertyAddress: data.address,
    city: data.city,
    state: data.state,
    acquiredAtIso: data.acquiredAt,
    purchasePriceCents,
    landValueCents,
  });

  try {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: study.propertyId },
        data: {
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          purchasePrice: purchasePriceCents / 100,
          acquiredAt: new Date(`${data.acquiredAt}T00:00:00Z`),
          propertyType: data.propertyType,
          squareFeet: data.squareFeet ?? null,
          yearBuilt: data.yearBuilt ?? null,
        },
      }),
      prisma.study.update({
        where: { id: studyId },
        data: {
          status: "AI_COMPLETE",
          assetSchedule: schedule as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.studyEvent.create({
        data: {
          studyId,
          kind: "diy.generated",
          payload: {
            purchasePriceCents,
            landValueCents,
            buildingValueCents: schedule.totalCents,
            lineItemCount: schedule.schedule.lineItems.length,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);
  } catch (err) {
    console.error("[diy] failed to persist schedule", err);
    return { ok: false, error: "Could not save your study. Please try again." };
  }

  // Kick off delivery in the background. The existing deliverAiReport Inngest
  // function accepts DIY as of Day 3, and handles PDF render + storage + email.
  try {
    await inngest.send({
      name: "study.ai.complete",
      data: { studyId, tier: "DIY" },
    });
  } catch (err) {
    // Inngest not configured in this env. Log and continue — the user can
    // still see the processing page, and an admin can trigger delivery manually.
    console.warn("[diy] inngest send failed; delivery must be triggered manually", err);
  }

  const processingHref = `/studies/${studyId}/processing` as Route;
  redirect(processingHref);
}
