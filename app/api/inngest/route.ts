import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { processStudy } from "@/inngest/functions/process-study";

// The Inngest SDK reads INNGEST_SIGNING_KEY from env automatically.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processStudy],
});
