import { Inngest } from "inngest";

/**
 * Events emitted by the app. New events go here so producers + functions
 * share a single source of truth.
 */
export type AppEvents = {
  "study.documents.ready": {
    name: "study.documents.ready";
    data: {
      studyId: string;
      tier: "AI_REPORT" | "ENGINEER_REVIEWED";
    };
  };
};

export const inngest = new Inngest({
  id: "cost-seg",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
