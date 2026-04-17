import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { AiReportTemplate, type AiReportProps } from "@/components/pdf/AiReportTemplate";

/**
 * Render the Tier 1 AI Report to a PDF buffer. Pure — callers are
 * responsible for sourcing props (decomposition, schedule, narrative) from
 * the study's persisted AI output.
 */
export async function renderAiReportPdf(props: AiReportProps): Promise<Buffer> {
  return renderToBuffer(AiReportTemplate(props));
}
