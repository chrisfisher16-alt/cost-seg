import { inngest } from "../client";

/**
 * Phase 4 stub. Phase 5 replaces the body with the real pipeline:
 *   A. OCR (Textract)
 *   B. purchase-price decomposition (Claude)
 *   C. asset classification (Claude + rules validator)
 *   D. narrative (Claude)
 * and transitions the study through PROCESSING -> AI_COMPLETE.
 */
export const processStudy = inngest.createFunction(
  {
    id: "process-study",
    name: "Process study",
    triggers: [{ event: "study.documents.ready" }],
  },
  async ({ event, step, logger }) => {
    const data = event.data as { studyId: string; tier: string };
    const { studyId, tier } = data;

    await step.run("mark-processing", async () => {
      const { getPrisma } = await import("@/lib/db/client");
      const prisma = getPrisma();
      await prisma.$transaction([
        prisma.study.update({
          where: { id: studyId },
          data: { status: "PROCESSING" },
        }),
        prisma.studyEvent.create({
          data: {
            studyId,
            kind: "pipeline.started",
            payload: { tier, phase: "phase-4-placeholder" },
          },
        }),
      ]);
    });

    logger.info("process-study placeholder ran", { studyId, tier });
    return { studyId, status: "PROCESSING" };
  },
);
