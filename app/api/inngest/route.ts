import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { deliverAiReport } from "@/inngest/functions/deliver-ai-report";
import { processStudy } from "@/inngest/functions/process-study";

// Raise the Inngest route's serverless timeout headroom. The project-
// level Default Max Duration is set to 800s on Vercel; this exports the
// same value so every route invocation (not just a project-default lane)
// gets full runway. `deliver-ai-report` (render v2 PDF with inlined
// photo data URIs + upload + email) and `process-study` step-c-classify-
// assets-v2 (Opus streaming on 80-180 item schedules) both cluster
// around 4-5 min; 300s would trip them. Value only binds when a step
// actually runs long — happy paths are unaffected.
export const maxDuration = 800;

// The Inngest SDK reads INNGEST_SIGNING_KEY from env automatically.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStudy, deliverAiReport],
});
