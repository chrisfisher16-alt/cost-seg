import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { deliverAiReport } from "@/inngest/functions/deliver-ai-report";
import { processStudy } from "@/inngest/functions/process-study";

// Raise the Inngest route's serverless timeout headroom above Vercel's
// default. 300s is Vercel Pro's conservative baseline; our `deliver-ai-
// report` flow (render v2 PDF with inlined photo data URIs + upload +
// email) and `process-study` step-c-classify-assets-v2 (Opus streaming
// on 80-180 item schedules) both cluster around 4-5 min. Value only
// binds when a step actually runs long — happy paths are unaffected.
export const maxDuration = 300;

// The Inngest SDK reads INNGEST_SIGNING_KEY from env automatically.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStudy, deliverAiReport],
});
