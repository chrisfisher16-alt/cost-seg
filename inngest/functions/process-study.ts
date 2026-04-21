import { NonRetriableError } from "inngest";

import { inngest } from "../client";

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
    triggers: [{ event: "study.documents.ready" }],
  },
  async ({ event, step, logger }) => {
    const data = event.data as { studyId: string; tier: string };
    const { studyId } = data;

    const pipeline = await import("@/lib/studies/pipeline");

    const study = await step.run("load-study", () => pipeline.loadStudyForPipeline(studyId));

    await step.run("mark-processing", async () => {
      const { getPrisma } = await import("@/lib/db/client");
      const { captureServer } = await import("@/lib/observability/posthog-server");
      const { transitionStudy } = await import("@/lib/studies/transitions");
      const prisma = getPrisma();
      await prisma.$transaction(async (tx) => {
        await transitionStudy({
          studyId,
          // Rerun-from-FAILED is legitimate; allow AWAITING_DOCUMENTS
          // (first-time run) and FAILED (admin rerun) as legal preconditions.
          from: ["AWAITING_DOCUMENTS", "FAILED"],
          to: "PROCESSING",
          tier: study.tier,
          tx,
        });
        await tx.studyEvent.create({
          data: {
            studyId,
            kind: "pipeline.started",
            payload: { tier: study.tier, docCount: study.documents.length },
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

    const classified = await step.run("step-a-classify-documents", () =>
      pipeline.runClassifyDocumentsBatch(study),
    );

    await step.run("persist-classifier-fields", () => pipeline.persistClassifierFields(classified));

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

    const assetsResult = await step.run("step-c-classify-assets", () =>
      pipeline.runClassifyAssets(study, decomposition.buildingValueCents, improvements),
    );

    if (!assetsResult.balanced) {
      await step.run("fail-unbalanced", () =>
        pipeline.markStudyFailed(
          studyId,
          `Step C could not produce a balanced schedule after 2 attempts: ${assetsResult.balanceMessage ?? "unknown"}`,
        ),
      );
      throw new NonRetriableError("Asset schedule did not balance after retry");
    }

    const narrative = await step.run("step-d-narrative", () =>
      pipeline.runNarrative(
        study,
        decomposition as unknown as Record<string, unknown>,
        assetsResult.schedule as unknown as Record<string, unknown>,
      ),
    );

    const totalCents = assetsResult.schedule.lineItems.reduce((acc, li) => acc + li.amountCents, 0);

    await step.run("finalize", () =>
      pipeline.finalizeStudy({
        studyId,
        tier: study.tier,
        decomposition: decomposition as unknown as Record<string, unknown>,
        schedule: assetsResult.schedule as unknown as Record<string, unknown>,
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
