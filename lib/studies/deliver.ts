import "server-only";

import { sendReportDeliveredEmail } from "@/lib/email/send";
import { STUDIES_BUCKET, createSignedReadUrl } from "@/lib/storage/studies";
import { DEFAULT_BRACKET } from "@/lib/estimator/compute";
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { CATALOG } from "@/lib/stripe/catalog";
import { getPrisma } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renderAiReportPdf } from "@/lib/pdf/render";
import { computeYearOneProjection, groupByDepreciationClass } from "@/lib/pdf/year-one";

import { Prisma } from "@prisma/client";

const DELIVERABLE_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

interface StoredSchedule {
  decomposition: {
    purchasePriceCents: number;
    landValueCents: number;
    buildingValueCents: number;
    landAllocationPct: number;
    methodology: string;
    confidence: number;
  };
  schedule: {
    lineItems: Array<{
      category: string;
      name: string;
      amountCents: number;
      basis: string;
      percentOfBuilding?: number;
      rationale: string;
    }>;
    assumptions: string;
  };
  narrative: {
    executiveSummary: string;
    propertyDescription: string;
    methodology: string;
    assetScheduleExplanation: string;
    scheduleSummaryTable: string;
  };
  totalCents: number;
}

interface DeliverAiReportResult {
  ok: boolean;
  storagePath?: string;
  signedUrl?: string;
  expiresAtIso?: string;
  skippedReason?: string;
}

/**
 * End-to-end delivery for a Tier 1 AI Report: render the PDF from persisted
 * AI output, upload to Supabase Storage, generate a signed URL valid for
 * 7 days, email the customer, and mark the study DELIVERED.
 *
 * Idempotent — re-running on a DELIVERED study is a noop. Partial failure
 * (e.g. email) does not revert the upload; admin can re-trigger delivery.
 */
export async function deliverAiReport(studyId: string): Promise<DeliverAiReportResult> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      tier: true,
      status: true,
      userId: true,
      assetSchedule: true,
      deliverableUrl: true,
      user: { select: { email: true, name: true } },
      property: {
        select: {
          address: true,
          city: true,
          state: true,
          zip: true,
          propertyType: true,
          squareFeet: true,
          yearBuilt: true,
          acquiredAt: true,
        },
      },
    },
  });
  if (!study) return { ok: false, skippedReason: "study not found" };
  if (study.status === "DELIVERED") {
    return { ok: true, skippedReason: "already delivered" };
  }
  if (study.tier !== "AI_REPORT") {
    return { ok: false, skippedReason: "deliverAiReport only handles Tier 1" };
  }
  if (!study.assetSchedule) {
    return { ok: false, skippedReason: "study has no assetSchedule" };
  }

  const stored = study.assetSchedule as unknown as StoredSchedule;

  const buffer = await renderAiReportPdf({
    studyId: study.id,
    generatedAt: new Date(),
    tierLabel: CATALOG[study.tier].label,
    property: {
      address: study.property.address,
      city: study.property.city,
      state: study.property.state,
      zip: study.property.zip,
      propertyTypeLabel: PROPERTY_TYPE_LABELS[study.property.propertyType],
      squareFeet: study.property.squareFeet,
      yearBuilt: study.property.yearBuilt,
      acquiredAtIso: study.property.acquiredAt.toISOString().slice(0, 10),
    },
    decomposition: stored.decomposition,
    narrative: stored.narrative,
    schedule: {
      lineItems: stored.schedule.lineItems,
      groups: groupByDepreciationClass(
        stored.schedule.lineItems,
        stored.decomposition.buildingValueCents,
      ),
      totalCents: stored.totalCents,
    },
    projection: computeYearOneProjection(stored.schedule.lineItems),
    assumedBracket: DEFAULT_BRACKET,
  });

  const storagePath = `${studyId}/deliverables/ai-report.pdf`;
  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage
    .from(STUDIES_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`PDF upload failed: ${uploadError.message}`);
  }

  const signedUrl = await createSignedReadUrl(storagePath, DELIVERABLE_EXPIRY_SECONDS);
  const expiresAtIso = new Date(Date.now() + DELIVERABLE_EXPIRY_SECONDS * 1000).toISOString();

  try {
    await sendReportDeliveredEmail({
      to: study.user.email,
      firstName: study.user.name ? study.user.name.split(" ")[0] : null,
      tier: study.tier,
      downloadUrl: signedUrl,
      propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state}`,
      expiresAtIso,
    });
  } catch (err) {
    // Email failure doesn't reverse delivery — admin can resend.
    console.error("[deliver] email send failed", err);
  }

  await prisma.$transaction([
    prisma.study.update({
      where: { id: studyId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliverableUrl: storagePath,
      },
    }),
    prisma.studyEvent.create({
      data: {
        studyId,
        kind: "study.delivered",
        payload: {
          storagePath,
          expiresAtIso,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { ok: true, storagePath, signedUrl, expiresAtIso };
}

interface DeliverEngineeredArgs {
  studyId: string;
  actorId: string;
  engineerName: string;
  engineerLicense: string;
  /** Already-uploaded storage path — typically `{studyId}/deliverables/engineer-study.pdf`. */
  storagePath: string;
}

/**
 * Deliver a Tier 2 engineer-signed PDF. Assumes the PDF is already in
 * Supabase Storage at `storagePath`. Flips status to DELIVERED, records the
 * signing engineer on the Study via StudyEvent, and emails the customer.
 */
export async function deliverEngineeredStudy(
  args: DeliverEngineeredArgs,
): Promise<DeliverAiReportResult> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: args.studyId },
    select: {
      id: true,
      tier: true,
      status: true,
      user: { select: { email: true, name: true } },
      property: { select: { address: true, city: true, state: true } },
    },
  });
  if (!study) return { ok: false, skippedReason: "study not found" };
  if (study.tier !== "ENGINEER_REVIEWED") {
    return { ok: false, skippedReason: "not a Tier 2 study" };
  }

  const signedUrl = await createSignedReadUrl(args.storagePath, DELIVERABLE_EXPIRY_SECONDS);
  const expiresAtIso = new Date(Date.now() + DELIVERABLE_EXPIRY_SECONDS * 1000).toISOString();

  try {
    await sendReportDeliveredEmail({
      to: study.user.email,
      firstName: study.user.name ? study.user.name.split(" ")[0] : null,
      tier: study.tier,
      downloadUrl: signedUrl,
      propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state}`,
      expiresAtIso,
    });
  } catch (err) {
    console.error("[deliver] engineer email send failed", err);
  }

  await prisma.$transaction([
    prisma.study.update({
      where: { id: args.studyId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        deliverableUrl: args.storagePath,
        engineerSignedAt: new Date(),
      },
    }),
    prisma.studyEvent.create({
      data: {
        studyId: args.studyId,
        kind: "engineer.signed_and_delivered",
        actorId: args.actorId,
        payload: {
          storagePath: args.storagePath,
          engineerName: args.engineerName,
          engineerLicense: args.engineerLicense,
          expiresAtIso,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { ok: true, storagePath: args.storagePath, signedUrl, expiresAtIso };
}

/**
 * Regenerate a fresh 7-day signed URL for an already-delivered study and
 * re-send the delivery email. Doesn't move status.
 */
export async function resendDeliveryEmail(
  studyId: string,
  actorId: string,
): Promise<DeliverAiReportResult> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      tier: true,
      status: true,
      deliverableUrl: true,
      user: { select: { email: true, name: true } },
      property: { select: { address: true, city: true, state: true } },
    },
  });
  if (!study || !study.deliverableUrl) {
    return { ok: false, skippedReason: "no deliverable to resend" };
  }
  if (study.status !== "DELIVERED") {
    return { ok: false, skippedReason: "study is not DELIVERED" };
  }

  const signedUrl = await createSignedReadUrl(study.deliverableUrl, DELIVERABLE_EXPIRY_SECONDS);
  const expiresAtIso = new Date(Date.now() + DELIVERABLE_EXPIRY_SECONDS * 1000).toISOString();

  await sendReportDeliveredEmail({
    to: study.user.email,
    firstName: study.user.name ? study.user.name.split(" ")[0] : null,
    tier: study.tier,
    downloadUrl: signedUrl,
    propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state}`,
    expiresAtIso,
  });

  await prisma.studyEvent.create({
    data: {
      studyId,
      kind: "admin.delivery_email_resent",
      actorId,
      payload: { expiresAtIso } as Prisma.InputJsonValue,
    },
  });

  return { ok: true, storagePath: study.deliverableUrl, signedUrl, expiresAtIso };
}
