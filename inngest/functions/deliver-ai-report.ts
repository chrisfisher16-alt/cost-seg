import { inngest } from "../client";

export const deliverAiReport = inngest.createFunction(
  {
    id: "deliver-ai-report",
    name: "Deliver AI Report",
    retries: 3,
    // Serialize delivery per study so two concurrent runs can't both
    // render + upload + race on the AI_COMPLETE → DELIVERED transition.
    // The v2 review retry loop (Phase 7 slice 3) makes each run
    // potentially 30–90s longer, widening the window where a retry
    // event could arrive while the first run is still mid-loop.
    concurrency: { key: "event.data.studyId", limit: 1 },
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
