import { inngest } from "../client";

export const deliverAiReport = inngest.createFunction(
  {
    id: "deliver-ai-report",
    name: "Deliver AI Report",
    retries: 3,
    triggers: [{ event: "study.ai.complete" }],
  },
  async ({ event, step, logger }) => {
    const data = event.data as { studyId: string; tier: string };
    if (data.tier !== "AI_REPORT") {
      // Sanity — finalizeStudy only emits for Tier 1, but belt + suspenders.
      logger.info("deliver-ai-report skipping non-Tier-1 event", data);
      return { skipped: true, reason: "not Tier 1" };
    }

    const result = await step.run("render-upload-email-deliver", async () => {
      const { deliverAiReport } = await import("@/lib/studies/deliver");
      return deliverAiReport(data.studyId);
    });

    logger.info("deliver-ai-report finished", {
      studyId: data.studyId,
      result,
    });
    return result;
  },
);
