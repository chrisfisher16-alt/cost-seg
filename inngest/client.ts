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
  "study.ai.complete": {
    name: "study.ai.complete";
    data: {
      studyId: string;
      tier: "AI_REPORT" | "ENGINEER_REVIEWED";
    };
  };
};

// NOTE: direct `process.env` read at module load — `env()` would force the
// whole schema to parse every time this module is imported (which includes
// `next build`, where service envs aren't populated). Inngest tolerates an
// undefined eventKey and degrades to no-auth local-dev mode.
export const inngest = new Inngest({
  id: "cost-seg",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
