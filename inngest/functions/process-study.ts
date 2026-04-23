import { NonRetriableError } from "inngest";

import type { Prisma } from "@prisma/client";

import { inngest } from "../client";

/**
 * Write a progression StudyEvent. Kept lazily-imported in each caller so
 * the top of this Inngest function file stays tree-shakable for the
 * Inngest introspector — but extracted here so the per-step event emits
 * read the same everywhere. Each event kind fires at most once per study
 * (Inngest step.run memoizes the call by id), so a retry of a later
 * pipeline step won't duplicate an earlier event row.
 */
async function emitProgressEvent(
  studyId: string,
  kind: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { getPrisma } = await import("@/lib/db/client");
  await getPrisma().studyEvent.create({
    data: { studyId, kind, payload: payload as Prisma.InputJsonValue },
  });
}

/**
 * Phase 5 pipeline. Each AI step is wrapped in `step.run()` so Inngest
 * gives us durability + per-step retry. The AiAuditLog cache in
 * `lib/ai/call.ts` makes retries idempotent — a re-run with the same
 * inputs returns the prior output.
 */
export const processStudy = inngest.createFunction(
  {
    id: "process-study",
    name: "Process study",
    retries: 2,
    // Serialize runs per study — prevents the "two concurrent Inngest
    // runs race on mark-processing, one crashes after flipping status,
    // the other gets stuck" class of failures the transition SSOT
    // can't detect from inside a single run.
    concurrency: { key: "event.data.studyId", limit: 1 },
    triggers: [{ event: "study.documents.ready" }],
    // When a run exhausts retries, flip the study to FAILED with the
    // underlying error so the next customer-retry enters from a clean
    // state. Without this, a crashed run leaves the study stuck in
    // PROCESSING and the next mark-processing refuses the transition.
    onFailure: async ({ event, error }) => {
      const eventData = (event as { data?: { event?: { data?: { studyId?: unknown } } } }).data
        ?.event?.data;
      const studyId = typeof eventData?.studyId === "string" ? eventData.studyId : null;
      if (!studyId) return;
      const pipelineMod = await import("@/lib/studies/pipeline");
      try {
        await pipelineMod.markStudyFailed(
          studyId,
          `processStudy exhausted retries: ${error instanceof Error ? error.message : String(error)}`.slice(
            0,
            500,
          ),
        );
      } catch (err) {
        // markStudyFailed refuses to move a DELIVERED / REFUNDED / already-
        // FAILED study. Those are terminal; swallowing here keeps onFailure
        // from looping on its own Inngest retry.
        console.warn(`[processStudy.onFailure] markStudyFailed swallowed for ${studyId}`, err);
      }
    },
  },
  async ({ event, step, logger }) => {
    const data = event.data as { studyId: string; tier: string };
    const { studyId } = data;

    const pipeline = await import("@/lib/studies/pipeline");

    let study = await step.run("load-study", () => pipeline.loadStudyForPipeline(studyId));

    await step.run("mark-processing", async () => {
      const { getPrisma } = await import("@/lib/db/client");
      const { captureServer } = await import("@/lib/observability/posthog-server");
      const { transitionStudy } = await import("@/lib/studies/transitions");
      const prisma = getPrisma();
      await prisma.$transaction(async (tx) => {
        const current = await tx.study.findUnique({
          where: { id: studyId },
          select: { status: true },
        });
        if (!current) {
          throw new NonRetriableError(`Study ${studyId} not found`);
        }
        if (current.status === "PROCESSING") {
          // Recovery entry. A previous Inngest run crashed after the
          // first transition and before onFailure could reset status
          // (either pre-fix processStudy, or a race between retries).
          // The transitionStudy SSOT rejects same-state moves on
          // principle, so skip the transition and treat this as a
          // legitimate restart — the pipeline.started event gets a
          // `recovered: true` flag for audit trail.
        } else {
          await transitionStudy({
            studyId,
            // Rerun-from-FAILED is legitimate; allow AWAITING_DOCUMENTS
            // (first-time run) and FAILED (admin rerun) as legal preconditions.
            from: ["AWAITING_DOCUMENTS", "FAILED"],
            to: "PROCESSING",
            tier: study.tier,
            tx,
          });
        }
        await tx.studyEvent.create({
          data: {
            studyId,
            kind: "pipeline.started",
            payload: {
              tier: study.tier,
              docCount: study.documents.length,
              ...(current.status === "PROCESSING" ? { recovered: true } : {}),
            },
          },
        });
      });
      // Resolve the userId post-commit for the distinctId; study.userId is
      // on the loaded Study but we haven't threaded it here. A cheap read
      // keeps the event accurate.
      const row = await prisma.study.findUnique({
        where: { id: studyId },
        select: { userId: true },
      });
      await captureServer(row?.userId ?? `study:${studyId}`, "study_processing_started", {
        studyId,
        tier: study.tier,
        docCount: study.documents.length,
      });
    });

    // v2 Phase 4 (flag-gated): look up assessor + listing data via
    // web_search before any AI calls that depend on property facts. The
    // result is persisted on Property.enrichmentJson and threaded
    // through the in-memory `study` so Step B + the narrative can read
    // it without another DB round-trip. Off path: no-op.
    const { isV2PropertyEnrichEnabled } = await import("@/lib/features/v2-report");
    if (isV2PropertyEnrichEnabled()) {
      const enrichment = await step.run("step-enrich-property", () =>
        pipeline.runEnrichProperty(study),
      );
      await step.run("persist-enrichment", () =>
        pipeline.persistEnrichment(study.propertyId, enrichment),
      );
      await step.run("emit-enrichment-event", () =>
        emitProgressEvent(studyId, "property.enriched", {
          hasAssessorRatio: pipeline.hasAssessorRatio(enrichment),
          hasListing: Boolean(enrichment.listingUrl),
          overallConfidence: enrichment.confidence.overall,
        }),
      );
      // Re-thread enrichment into the in-memory study so downstream
      // steps (Step B in particular) don't read stale nulls.
      study = { ...study, enrichment };
    }

    const classified = await step.run("step-a-classify-documents", () =>
      pipeline.runClassifyDocumentsBatch(study),
    );

    await step.run("persist-classifier-fields", () => pipeline.persistClassifierFields(classified));

    // Progress event #1: classification done. Drives the "Parsing your
    // documents" step → done on the live pipeline view and lets
    // estimatePipelineEta advance the active step.
    await step.run("emit-classify-event", () =>
      emitProgressEvent(studyId, "documents.classified", {
        docCount: classified.length,
      }),
    );

    // v2 Phase 1 (flag-gated): run the vision describer on every uploaded
    // photo and persist the structured detected-object list. Output is
    // stored on Document.photoAnalysis for Phase 2's classifier rewrite
    // to consume. Off path: no-op, pipeline continues identically to v1.
    const { isV2PhotosEnabled } = await import("@/lib/features/v2-report");
    if (isV2PhotosEnabled()) {
      const photoBatch = await step.run("step-a2-describe-photos", () =>
        pipeline.runDescribePhotosBatch(study),
      );
      if (photoBatch.length > 0) {
        await step.run("persist-photo-analysis", () => pipeline.persistPhotoAnalysis(photoBatch));
        await step.run("emit-photos-event", () =>
          emitProgressEvent(studyId, "photos.described", {
            photoCount: photoBatch.length,
            totalDetectedObjects: photoBatch.reduce(
              (acc, row) => acc + row.output.detectedObjects.length,
              0,
            ),
          }),
        );
      }
    }

    const cdFields = pipeline.findClosingDisclosureFields(classified);
    if (!cdFields) {
      await step.run("fail-no-cd", () =>
        pipeline.markStudyFailed(
          studyId,
          "Step A did not identify a closing disclosure among the uploaded documents.",
        ),
      );
      throw new NonRetriableError("No CLOSING_DISCLOSURE in uploaded documents");
    }

    const improvements = pipeline.collectImprovementLineItems(classified);

    const decomposition = await step.run("step-b-decompose", () =>
      pipeline.runDecompose(study, cdFields),
    );

    // Progress event #2: land-vs-building split computed.
    await step.run("emit-decompose-event", () =>
      emitProgressEvent(studyId, "decomposition.complete", {
        buildingValueCents: decomposition.buildingValueCents,
      }),
    );

    // v2 Phase 2 (flag-gated): Step C runs the per-object v2 classifier
    // when V2_REPORT_CLASSIFIER is on. The v2 schedule shape is not
    // compatible with the v1 PDF renderer yet (Phase 5 work) — but the
    // shape is persisted so admin surfaces + follow-on work can see it.
    //
    // v2 Phase 8 (ADR 0014): when V2_REPORT_CLASSIFIER_FANOUT is also on,
    // Step C fans out into one LLM call per photo + one for receipts,
    // each wrapped in its own `step.run(...)` for durable memoization.
    // This removes the single-HTTP-timeout failure mode; schedule shape
    // is unchanged so downstream code (narrative, PDF, review gate)
    // does not branch on this flag.
    const { isV2ClassifierEnabled, isV2ClassifierFanoutEnabled } =
      await import("@/lib/features/v2-report");
    const useV2Classifier = isV2ClassifierEnabled();
    const useV2Fanout = useV2Classifier && isV2ClassifierFanoutEnabled();

    // Union of the three possible classifier result shapes. Downstream
    // only reads `.balanced`, `.schedule.lineItems`, `.balanceMessage`,
    // `.attempts` — all common to v1, v2 monolith, and v2 fan-out. The
    // `schedule.lineItems` reducer below handles both v1 (`amountCents`)
    // and v2 (`adjustedCostCents`) shapes.
    type AnyAssetsResult =
      | Awaited<ReturnType<typeof pipeline.runClassifyAssets>>
      | Awaited<ReturnType<typeof pipeline.runClassifyAssetsV2>>;
    let assetsResult: AnyAssetsResult;
    let fanoutStats: {
      candidatesIn: number;
      mergedOut: number;
      collisionsResolved: number;
      illegalResidualsDropped: number;
      receiptLines: number;
      photoLines: number;
      photoCallCount: number;
      receiptsCallCount: number;
      attempts: number;
    } | null = null;

    if (useV2Fanout) {
      const { runFanout, invokePhotoCandidate, invokeReceiptsCandidate } =
        await import("@/lib/ai/steps/classify-assets-v2-fanout");
      const orchestratorInput = await pipeline.buildClassifyAssetsV2Input(
        study,
        decomposition.buildingValueCents,
        improvements,
      );
      const fanoutResult = await runFanout(orchestratorInput, {
        classifyPhoto: (promptInput, attempt) =>
          step.run(
            `step-c-candidates-photo-${promptInput.photo.documentId}-attempt-${attempt}`,
            () => invokePhotoCandidate(studyId, promptInput, attempt),
          ),
        classifyReceipts: (promptInput, attempt) =>
          step.run(`step-c-candidates-receipts-attempt-${attempt}`, () =>
            invokeReceiptsCandidate(studyId, promptInput, attempt),
          ),
      });
      assetsResult = fanoutResult;
      fanoutStats = fanoutResult.stats;
    } else if (useV2Classifier) {
      assetsResult = await step.run("step-c-classify-assets-v2", () =>
        pipeline.runClassifyAssetsV2(study, decomposition.buildingValueCents, improvements),
      );
    } else {
      assetsResult = await step.run("step-c-classify-assets", () =>
        pipeline.runClassifyAssets(study, decomposition.buildingValueCents, improvements),
      );
    }

    if (!assetsResult.balanced) {
      await step.run("fail-unbalanced", () =>
        pipeline.markStudyFailed(
          studyId,
          `Step C could not produce a balanced schedule after 2 attempts: ${assetsResult.balanceMessage ?? "unknown"}`,
        ),
      );
      throw new NonRetriableError("Asset schedule did not balance after retry");
    }

    // Progress event #3: every asset classified into MACRS buckets.
    await step.run("emit-assets-event", () =>
      emitProgressEvent(studyId, "assets.classified", {
        lineItemCount: assetsResult.schedule.lineItems.length,
        attempts: assetsResult.attempts,
        schema: useV2Classifier ? "v2" : "v1",
      }),
    );

    // Fan-out telemetry (ADR 0014). Captures the merge heuristic's
    // collision + drop rates so we can spot drift in production without
    // a test failure — a sudden spike in `collisionsResolved` vs.
    // `candidatesIn` means the normalize rule is over-merging.
    if (fanoutStats) {
      await step.run("emit-dedupe-stats-event", () =>
        emitProgressEvent(
          studyId,
          "classifier.dedupe_stats",
          fanoutStats as Record<string, unknown>,
        ),
      );
    }

    const narrative = await step.run("step-d-narrative", () =>
      pipeline.runNarrative(
        study,
        decomposition as unknown as Record<string, unknown>,
        assetsResult.schedule as unknown as Record<string, unknown>,
      ),
    );

    // Progress event #4: methodology narrative written. Render + deliver
    // happen in `deliver-ai-report` (AI_REPORT/DIY) or via admin upload
    // (ENGINEER_REVIEWED); those fire `study.delivered` which is the
    // signal the UI uses to light up the render + deliver steps together.
    await step.run("emit-narrative-event", () => emitProgressEvent(studyId, "narrative.drafted"));

    // v1 line items use `amountCents`; v2 uses `adjustedCostCents`. Sum
    // whichever is present. The total is the depreciable basis either way.
    const totalCents = assetsResult.schedule.lineItems.reduce((acc, li) => {
      const v1Amount = (li as { amountCents?: number }).amountCents;
      const v2Amount = (li as { adjustedCostCents?: number }).adjustedCostCents;
      return acc + (v1Amount ?? v2Amount ?? 0);
    }, 0);

    await step.run("finalize", () =>
      pipeline.finalizeStudy({
        studyId,
        tier: study.tier,
        decomposition: decomposition as unknown as Record<string, unknown>,
        schedule: {
          schema: useV2Classifier ? "v2" : "v1",
          ...(assetsResult.schedule as unknown as Record<string, unknown>),
        },
        narrative: narrative as unknown as Record<string, unknown>,
        assetScheduleTotalCents: totalCents,
      }),
    );

    logger.info("process-study completed", {
      studyId,
      tier: study.tier,
      attempts: assetsResult.attempts,
    });
    return {
      studyId,
      tier: study.tier,
      attempts: assetsResult.attempts,
      totalCents,
    };
  },
);
