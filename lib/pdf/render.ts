import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { AiReportTemplate, type AiReportProps } from "@/components/pdf/AiReportTemplate";

/**
 * Render the Tier 1 AI Report to a PDF buffer.
 *
 * react-pdf has a long-standing "clipBorderTop crash" bug class: when
 * certain layout conditions push the renderer to compute a coordinate
 * outside pdfkit's ±1e21 sanity window, the render throws
 * `Error: unsupported number: -1.9e21`. The crash surfaces
 * non-deterministically — it depends on specific combinations of line
 * content length, bordered-view placement, and page-break timing.
 *
 * We've fixed every bordered `<View>` we could find with `wrap={false}`
 * over multiple PRs. But defensively, if a render still crashes with
 * the coordinate error, retry ONCE with sanitized props that drop the
 * content most likely to be driving the pathology (inlined photo data
 * URIs, long justification prose). The retry produces a degraded-but-
 * readable PDF — numbers, MACRS schedule, and narrative intact; the
 * Appendix B asset cards just render without photos and with
 * truncated prose.
 *
 * This is a ship-the-report safety net, not a root-cause fix. Every
 * fallback invocation logs to stderr so we can track how often it
 * fires; sustained triggers mean we need another round of template
 * hardening.
 */
export async function renderAiReportPdf(props: AiReportProps): Promise<Buffer> {
  try {
    return await renderToBuffer(AiReportTemplate(props));
  } catch (err) {
    if (!isCoordinateOverflowError(err)) throw err;
    console.error(
      `[pdf] primary render hit react-pdf coordinate overflow; retrying with sanitized props.`,
      { study: props.studyId, message: errorMessage(err) },
    );
    const sanitized = sanitizeForFallbackRender(props);
    try {
      return await renderToBuffer(AiReportTemplate(sanitized));
    } catch (fallbackErr) {
      console.error(`[pdf] sanitized fallback also failed`, {
        study: props.studyId,
        message: errorMessage(fallbackErr),
      });
      throw fallbackErr;
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isCoordinateOverflowError(err: unknown): boolean {
  const msg = errorMessage(err);
  // pdfkit's throw site is literally `unsupported number: ${n}` when n
  // falls outside ±1e21. That string is stable across pdfkit versions.
  return /unsupported number/i.test(msg);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Strip the content most likely to be driving the layout pathology:
 * photo data URIs (can produce bad geometry if decode fails) and
 * verbose v2 justification prose (length variance across line items
 * produces cards of wildly different heights, which is when the
 * clipBorderTop crash empirically surfaces).
 *
 * The resulting PDF is visually less rich but numerically identical.
 * Every dollar figure, MACRS line, and narrative paragraph is preserved.
 */
export function sanitizeForFallbackRender(props: AiReportProps): AiReportProps {
  return {
    ...props,
    schedule: {
      ...props.schedule,
      lineItems: props.schedule.lineItems.map((item) => ({
        ...item,
        name: truncate(item.name, 140),
        rationale: truncate(item.rationale, 200),
        // Drop photos entirely on fallback — they're the most common
        // layout-pathology trigger (decode failure → bad dimensions →
        // parent geometry explodes).
        photoDataUri: undefined,
        // Truncate long v2 justification prose that empirically
        // contributes to card-height variance.
        comparableDescription: item.comparableDescription
          ? truncate(item.comparableDescription, 200)
          : undefined,
        physicalJustification: item.physicalJustification
          ? truncate(item.physicalJustification, 240)
          : undefined,
        functionalJustification: item.functionalJustification
          ? truncate(item.functionalJustification, 240)
          : undefined,
        timeBasis: item.timeBasis ? truncate(item.timeBasis, 120) : undefined,
        locationBasis: item.locationBasis ? truncate(item.locationBasis, 120) : undefined,
      })),
    },
    // Cover hero photo uses the same data URI mechanism — strip it
    // on fallback so a single bad image can't kill the whole render.
    property: {
      ...props.property,
      heroPhotoDataUri: null,
    },
  };
}
