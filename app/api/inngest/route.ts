import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { deliverAiReport } from "@/inngest/functions/deliver-ai-report";
import { processStudy } from "@/inngest/functions/process-study";

// Vercel Pro defaults serverless functions to 300s. That's too tight for
// v2 delivery: rendering a full per-asset-gallery PDF with inlined photo
// data URIs, running the review gate, and uploading can comfortably push
// past 5 min on a real property. Step-c-classify-assets-v2 also streams
// Opus output for 4-5 min on 80-180 item schedules. 800s is the Pro-plan
// ceiling and gives both steps ample headroom without sitting that long
// on the happy path (the function returns as soon as its work is done).
export const maxDuration = 800;

// The Inngest SDK reads INNGEST_SIGNING_KEY from env automatically.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStudy, deliverAiReport],
});
