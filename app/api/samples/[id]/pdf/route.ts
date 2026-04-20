import type { NextRequest } from "next/server";

import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { renderAiReportPdf } from "@/lib/pdf/render";
import { samplePdfLimiter } from "@/lib/ratelimit";
import { buildSampleSchedule, getSample, samplePdfFilename } from "@/lib/samples/catalog";
import { hashIp, resolveIp } from "@/lib/server/request-ip";

/**
 * Render the on-demand sample PDF.
 *
 *   GET /api/samples/oak-ridge/pdf       → application/pdf
 *   GET /api/samples/magnolia-duplex/pdf
 *   GET /api/samples/riverside-commercial/pdf
 *
 * Re-uses the production Tier-1 template + MACRS pipeline so the sample PDF
 * mirrors what a real customer gets. Rate-limited to 10 hits/min/IP.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const sample = getSample(id);
  if (!sample) {
    return new Response("Sample not found", { status: 404 });
  }

  const ip = resolveIp(request.headers);
  const gate = await samplePdfLimiter().check(hashIp(ip));
  if (!gate.ok) {
    return new Response("Too many requests. Try again in a minute.", {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Reset": gate.resetAt.toString(),
      },
    });
  }

  const stored = buildSampleSchedule(sample);
  const acquiredAt = new Date(`${sample.acquisitionDate}T00:00:00Z`);
  const realPropertyYears: 27.5 | 39 =
    sample.propertyTypeKey === "SHORT_TERM_RENTAL" || sample.propertyTypeKey === "COMMERCIAL"
      ? 39
      : 27.5;

  const buffer = await renderAiReportPdf({
    studyId: `sample-${sample.id}`,
    generatedAt: new Date(),
    tierLabel: sample.tier === "AI Report" ? "AI Report" : "Engineer-Reviewed Study",
    ownerLabel: sample.ownerLabel,
    taxYear: acquiredAt.getUTCFullYear(),
    property: {
      address: sample.address.split(",")[0]?.trim() ?? sample.address,
      city: sample.address.split(",")[1]?.trim() ?? "",
      state: (sample.address.split(",")[2]?.trim() ?? "").split(" ")[0] ?? "",
      zip: (sample.address.split(",")[2]?.trim() ?? "").split(" ")[1] ?? "",
      propertyTypeLabel: PROPERTY_TYPE_LABELS[sample.propertyTypeKey],
      realPropertyYears,
      squareFeet: sample.squareFeet,
      yearBuilt: sample.yearBuilt,
      acquiredAtIso: sample.acquisitionDate,
      placedInServiceIso: sample.acquisitionDate,
    },
    decomposition: stored.decomposition,
    narrative: stored.narrative,
    schedule: {
      lineItems: stored.schedule.lineItems,
      groups: [],
      totalCents: stored.totalCents,
    },
    projection: {
      bonusEligibleCents:
        sample.accelerated.fiveYear * 100 +
        sample.accelerated.sevenYear * 100 +
        sample.accelerated.fifteenYear * 100,
      longLifeBasisCents: (sample.depreciableBasis - sample.accelerated.value) * 100,
      longLifeYear1Cents: 0,
    },
    assumedBracket: 0.37,
    bonusEligible: sample.bonusRate >= 100,
  });

  const filename = samplePdfFilename(sample.id);

  const body = new Uint8Array(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
