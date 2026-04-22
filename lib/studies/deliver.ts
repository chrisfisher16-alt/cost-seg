import "server-only";

import { sendReportDeliveredEmail } from "@/lib/email/send";
import {
  isV2PdfEnabled,
  isV2ReviewEnabled,
  isV2ReviewEnforceEnabled,
} from "@/lib/features/v2-report";
import { STUDIES_BUCKET, createSignedReadUrl } from "@/lib/storage/studies";
import { DEFAULT_BRACKET } from "@/lib/estimator/compute";
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { CATALOG } from "@/lib/stripe/catalog";
import { getPrisma } from "@/lib/db/client";
import { captureServer } from "@/lib/observability/posthog-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renderAiReportPdf } from "@/lib/pdf/render";
import type { AiReportProps } from "@/components/pdf/AiReportTemplate";
import { computeYearOneProjection, groupByDepreciationClass } from "@/lib/pdf/year-one";
import {
  isV2Schedule,
  loadPhotoDataUrisByDocumentId,
  mapEnrichment,
  mapV2LineItems,
  type V2LineItem,
} from "@/lib/studies/pdf-v2-mapping";
import { reclassifyV2ForDeliver } from "@/lib/studies/reclassify-for-deliver";
import { runReviewGate } from "@/lib/studies/review-gate";
import { runRenderReviewLoop } from "@/lib/studies/review-retry-loop";
import { transitionStudy } from "@/lib/studies/transitions";

import { Prisma, type PropertyType } from "@prisma/client";

/**
 * Maps our internal property types to the MACRS real-property life per §168(e):
 * residential rental uses 27.5-year life; short-term rental (transient) and
 * commercial/mixed-use use 39-year nonresidential.
 */
function realPropertyYearsFor(type: PropertyType): 27.5 | 39 {
  switch (type) {
    case "SINGLE_FAMILY_RENTAL":
    case "SMALL_MULTIFAMILY":
    case "MID_MULTIFAMILY":
      return 27.5;
    case "SHORT_TERM_RENTAL":
    case "COMMERCIAL":
      return 39;
    default:
      return 39;
  }
}

/**
 * Bonus depreciation eligibility based on acquisition date.
 *
 * Simplified to the two common cases today:
 *   • Acquired on or after 2025-01-19 → 100% (OBBBA §70306 restoration).
 *   • Acquired after 2017-09-27 → 100% (TCJA peak through late 2022).
 *   • Anything earlier → 0%.
 *
 * A future refinement can phase down 80/60/40% for 2023-2024 acquisitions.
 * This is stated explicitly on the depreciation-schedule page of the report.
 */
function isBonusEligible(acquiredAt: Date): boolean {
  const acquiredMs = acquiredAt.getTime();
  const TCJA_START = Date.UTC(2017, 8, 28); // 2017-09-28
  return acquiredMs >= TCJA_START;
}

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
  /** v2 Phase 7b (ADR 0013). Populated when V2_REPORT_REVIEW_ENFORCE
   *  blocked delivery — ops reads this to know why no email went out. */
  reviewBlockerCount?: number;
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
          enrichmentJson: true,
        },
      },
      documents: {
        where: { kind: "PROPERTY_PHOTO" },
        select: { id: true, storagePath: true, mimeType: true },
      },
    },
  });
  if (!study) return { ok: false, skippedReason: "study not found" };
  if (study.status === "DELIVERED") {
    return { ok: true, skippedReason: "already delivered" };
  }
  if (study.tier !== "AI_REPORT" && study.tier !== "DIY") {
    return { ok: false, skippedReason: "deliverAiReport handles only DIY and AI_REPORT tiers" };
  }
  if (!study.assetSchedule) {
    return { ok: false, skippedReason: "study has no assetSchedule" };
  }

  // Alias so TypeScript preserves the null-check narrowing inside the
  // nested `buildProps` closure below.
  const loadedStudy = study;
  const stored = loadedStudy.assetSchedule as unknown as StoredSchedule;
  const now = new Date();
  const realPropertyYears = realPropertyYearsFor(study.property.propertyType);
  const bonusEligible = isBonusEligible(study.property.acquiredAt);
  const acquiredAtIso = study.property.acquiredAt.toISOString().slice(0, 10);

  // v2 Phase 5 (ADR 0012). When the persisted schedule is v2-shaped AND
  // the flag is on, map the richer fields into the template props and
  // inline property photos as data URIs. Off path: identical to v1.
  const v2Pdf = isV2PdfEnabled() && isV2Schedule(study.assetSchedule);
  const photoDataUris = v2Pdf
    ? await loadPhotoDataUrisByDocumentId(
        study.documents.map((d) => ({
          documentId: d.id,
          storagePath: d.storagePath,
          mimeType: d.mimeType,
        })),
      )
    : new Map<string, string>();

  // Mutable schedule view — the review retry loop below may replace it
  // when classify-assets-v2 is rerun on a content blocker.
  let currentV2LineItems: V2LineItem[] | null = v2Pdf
    ? (
        study.assetSchedule as unknown as {
          schema: "v2";
          schedule: { lineItems: V2LineItem[] };
        }
      ).schedule.lineItems
    : null;
  let currentTotalCents = stored.totalCents;

  const renderedEnrichment = v2Pdf ? mapEnrichment(study.property.enrichmentJson) : null;

  function buildRenderedLineItems(): Array<Record<string, unknown>> {
    if (v2Pdf && currentV2LineItems) {
      return mapV2LineItems(currentV2LineItems, photoDataUris) as unknown as Array<
        Record<string, unknown>
      >;
    }
    return stored.schedule.lineItems as unknown as Array<Record<string, unknown>>;
  }

  function buildProps(): AiReportProps {
    const renderedLineItems = buildRenderedLineItems();
    return {
      studyId: loadedStudy.id,
      generatedAt: now,
      tierLabel: CATALOG[loadedStudy.tier].label,
      ownerLabel: loadedStudy.user.name ?? null,
      // Tax year = the year the property was placed in service, i.e. the
      // year the owner first applies the cost-seg reclassification. The
      // previous `now.getFullYear() - 1` formula assumed every study was
      // backward-looking (filing prior-year return) which breaks for
      // recently-acquired properties — e.g. a study generated in April
      // 2026 for a property acquired in April 2026 should show tax year
      // 2026, not 2025.
      taxYear: loadedStudy.property.acquiredAt.getFullYear(),
      property: {
        address: loadedStudy.property.address,
        city: loadedStudy.property.city,
        state: loadedStudy.property.state,
        zip: loadedStudy.property.zip,
        propertyTypeLabel: PROPERTY_TYPE_LABELS[loadedStudy.property.propertyType],
        realPropertyYears,
        squareFeet: loadedStudy.property.squareFeet,
        yearBuilt: loadedStudy.property.yearBuilt,
        acquiredAtIso,
        placedInServiceIso: acquiredAtIso,
        enrichment: renderedEnrichment,
      },
      decomposition: stored.decomposition,
      narrative: stored.narrative,
      schedule: {
        lineItems: renderedLineItems as unknown as AiReportProps["schedule"]["lineItems"],
        groups: groupByDepreciationClass(
          renderedLineItems as unknown as Array<{ category: string; amountCents: number }>,
          stored.decomposition.buildingValueCents,
        ),
        totalCents: currentTotalCents,
      },
      projection: computeYearOneProjection(
        renderedLineItems as unknown as Array<{ category: string; amountCents: number }>,
      ),
      assumedBracket: DEFAULT_BRACKET,
      bonusEligible,
    };
  }

  // v2 Phase 7b (ADR 0013): rasterize + vision-review the rendered PDF
  // before uploading. Phase 7 slice 3 adds a retry loop on content
  // blockers — the classifier is re-run with the findings formatted
  // as a priorAttemptError, up to `REVIEW_RETRY_CAP` attempts. Layout
  // blockers still short-circuit delivery (the template isn't
  // runtime-parameterized for layout fixes — a dev must patch).
  const reviewOn = isV2ReviewEnabled();
  const enforce = isV2ReviewEnforceEnabled();
  const address = `${study.property.address}, ${study.property.city}, ${study.property.state}`;
  let buffer: Buffer;
  if (reviewOn && v2Pdf) {
    const loop = await runRenderReviewLoop({
      renderPdf: () => renderAiReportPdf(buildProps()),
      runReview: (pdf) =>
        runReviewGate({ studyId: study.id, address, pdf, context: "v2 schedule", enforce }),
      reclassifyAndPersist: async (priorAttemptError) => {
        const reclassified = await reclassifyV2ForDeliver(study.id, priorAttemptError);
        currentV2LineItems = reclassified.lineItems as unknown as V2LineItem[];
        currentTotalCents = reclassified.totalCents;
        return reclassified;
      },
    });

    await prisma.studyEvent.create({
      data: {
        studyId: study.id,
        kind:
          loop.outcome.kind === "blocked" ? "pipeline.review_failed" : "pipeline.review_completed",
        payload: {
          findings: loop.allFindings,
          summary: loop.outcome.output?.summary ?? null,
          batchCount: loop.outcome.batchCount,
          warning: loop.outcome.kind === "ok" ? (loop.outcome.warning ?? null) : null,
          enforced: enforce,
          attempts: loop.attempts,
          reclassifications: loop.reclassifications,
        } as Prisma.InputJsonValue,
      },
    });

    if (loop.outcome.kind === "blocked") {
      const blockerCount = loop.outcome.output.findings.filter(
        (f) => f.severity === "blocker",
      ).length;
      await captureServer(study.userId, "review_blocked_delivery", {
        studyId,
        blockerCount,
        reclassifications: loop.reclassifications,
      });
      return {
        ok: false,
        skippedReason: "review blocked delivery — see pipeline.review_failed event",
        reviewBlockerCount: blockerCount,
      };
    }
    buffer = loop.pdf;
  } else {
    // v1 path, or v2-without-review: render once and (optionally)
    // single-pass review. Retains slice-2 behavior for non-v2 schedules.
    buffer = await renderAiReportPdf(buildProps());
    if (reviewOn) {
      const outcome = await runReviewGate({
        studyId: study.id,
        address,
        pdf: buffer,
        context: v2Pdf ? "v2 schedule" : "v1 schedule",
        enforce,
      });

      await prisma.studyEvent.create({
        data: {
          studyId: study.id,
          kind: outcome.kind === "blocked" ? "pipeline.review_failed" : "pipeline.review_completed",
          payload: {
            findings: outcome.output?.findings ?? [],
            summary: outcome.output?.summary ?? null,
            batchCount: outcome.batchCount,
            warning: outcome.kind === "ok" ? (outcome.warning ?? null) : null,
            enforced: enforce,
          } as Prisma.InputJsonValue,
        },
      });

      if (outcome.kind === "blocked") {
        const blockerCount = outcome.output.findings.filter((f) => f.severity === "blocker").length;
        await captureServer(study.userId, "review_blocked_delivery", {
          studyId,
          blockerCount,
        });
        return {
          ok: false,
          skippedReason: "review blocked delivery — see pipeline.review_failed event",
          reviewBlockerCount: blockerCount,
        };
      }
    }
  }

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

  let emailSent = false;
  try {
    await sendReportDeliveredEmail({
      to: study.user.email,
      firstName: study.user.name ? study.user.name.split(" ")[0] : null,
      tier: study.tier,
      downloadUrl: signedUrl,
      propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state}`,
      expiresAtIso,
    });
    emailSent = true;
  } catch (err) {
    // Email failure doesn't reverse delivery — admin can resend.
    console.error("[deliver] email send failed", err);
  }
  if (emailSent) {
    await captureServer(study.userId, "delivery_email_sent", {
      studyId,
      tier: study.tier,
    });
  }

  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId,
      from: "AI_COMPLETE",
      to: "DELIVERED",
      tier: study.tier,
      extraData: {
        deliveredAt: new Date(),
        deliverableUrl: storagePath,
      },
      tx,
    });
    await tx.studyEvent.create({
      data: {
        studyId,
        kind: "study.delivered",
        payload: {
          storagePath,
          expiresAtIso,
        } as Prisma.InputJsonValue,
      },
    });
  });

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
 *
 * Idempotent — calling on an already-DELIVERED study short-circuits with
 * `ok: true, skippedReason: "already delivered"`. This mirrors the guard
 * in deliverAiReport and protects against a race (two admins clicking
 * Upload at the same time) or a manual re-call firing a duplicate
 * customer email + overwriting `engineerSignedAt` with a newer timestamp.
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
      userId: true,
      deliverableUrl: true,
      user: { select: { email: true, name: true } },
      property: { select: { address: true, city: true, state: true } },
    },
  });
  if (!study) return { ok: false, skippedReason: "study not found" };
  if (study.tier !== "ENGINEER_REVIEWED") {
    return { ok: false, skippedReason: "not a Tier 2 study" };
  }
  if (study.status === "DELIVERED") {
    // Preserve the original delivery state. Admin's re-delivery affordance
    // is resendDeliveryEmail() which regenerates the signed URL without
    // touching status/timestamps — that's the path to take here.
    return {
      ok: true,
      skippedReason: "already delivered",
      storagePath: study.deliverableUrl ?? args.storagePath,
    };
  }

  const signedUrl = await createSignedReadUrl(args.storagePath, DELIVERABLE_EXPIRY_SECONDS);
  const expiresAtIso = new Date(Date.now() + DELIVERABLE_EXPIRY_SECONDS * 1000).toISOString();

  let emailSent = false;
  try {
    await sendReportDeliveredEmail({
      to: study.user.email,
      firstName: study.user.name ? study.user.name.split(" ")[0] : null,
      tier: study.tier,
      downloadUrl: signedUrl,
      propertyAddress: `${study.property.address}, ${study.property.city}, ${study.property.state}`,
      expiresAtIso,
    });
    emailSent = true;
  } catch (err) {
    console.error("[deliver] engineer email send failed", err);
  }
  if (emailSent) {
    await captureServer(study.userId, "delivery_email_sent", {
      studyId: args.studyId,
      tier: study.tier,
    });
  }

  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId: args.studyId,
      from: "ENGINEER_REVIEWED",
      to: "DELIVERED",
      tier: study.tier,
      extraData: {
        deliveredAt: new Date(),
        deliverableUrl: args.storagePath,
        engineerSignedAt: new Date(),
      },
      tx,
    });
    await tx.studyEvent.create({
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
    });
  });

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
