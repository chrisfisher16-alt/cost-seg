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
    if (data.tier !== "AI_REPORT" && data.tier !== "DIY") {
      // Tier 2 engineer-reviewed studies deliver via a separate admin action.
      logger.info("deliver-ai-report skipping tier", data);
      return { skipped: true, reason: `tier ${data.tier} handled elsewhere` };
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
