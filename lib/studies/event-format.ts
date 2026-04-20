/**
 * Human-readable renderer for StudyEvent rows on the admin inspector.
 *
 * Every event kind we emit gets:
 *   - `title`: a short English sentence summarizing what happened
 *   - `detail`: optional secondary copy (e.g. reason, counts, actor)
 *   - `tone`: drives the color cue on the timeline card
 *
 * Unknown kinds fall through to the raw payload — the admin can still see
 * what happened, just not formatted. Prevents a bad emit from turning a
 * timeline row into "undefined".
 */

export type EventTone = "default" | "primary" | "success" | "warning" | "destructive" | "muted";

export interface FormattedEvent {
  title: string;
  detail?: string;
  tone: EventTone;
}

/**
 * Pure. Never throws on malformed payloads — callers render raw JSON as a
 * fallback when `raw` is true in the returned detail.
 */
export function formatStudyEvent(kind: string, payload: unknown): FormattedEvent {
  const p = (payload ?? {}) as Record<string, unknown>;

  switch (kind) {
    case "checkout.completed": {
      const email = typeof p.customerEmail === "string" ? p.customerEmail : null;
      const amount = typeof p.amountTotal === "number" ? p.amountTotal : null;
      return {
        title: "Checkout completed",
        detail: [
          email ? `Customer ${email}` : null,
          amount ? `Charged ${formatCents(amount)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "success",
      };
    }

    case "documents.ready": {
      const kinds = Array.isArray(p.requiredKinds) ? (p.requiredKinds as string[]) : [];
      return {
        title: "Documents complete — pipeline queued",
        detail: kinds.length ? `Required: ${kinds.map(humanizeKind).join(", ")}` : undefined,
        tone: "primary",
      };
    }

    case "pipeline.completed": {
      const total = typeof p.totalCents === "number" ? p.totalCents : null;
      const status = typeof p.status === "string" ? p.status : null;
      return {
        title: "Pipeline completed",
        detail: [
          status ? `Transitioned to ${status.replace(/_/g, " ").toLowerCase()}` : null,
          total ? `Reclassified basis ${formatCents(total)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "success",
      };
    }

    case "pipeline.failed": {
      const reason = typeof p.reason === "string" ? p.reason : "unknown cause";
      return {
        title: "Pipeline failed",
        detail: reason,
        tone: "destructive",
      };
    }

    case "study.delivered":
      return {
        title: "Report delivered",
        detail:
          typeof p.expiresAtIso === "string"
            ? `Download link expires ${formatIso(p.expiresAtIso)}`
            : undefined,
        tone: "success",
      };

    case "engineer.signed_and_delivered": {
      const engineer = typeof p.engineerName === "string" ? p.engineerName : null;
      const license = typeof p.engineerLicense === "string" ? p.engineerLicense : null;
      return {
        title: "Engineer signed — final PDF delivered",
        detail: [engineer, license ? `PE ${license}` : null].filter(Boolean).join(" · "),
        tone: "success",
      };
    }

    case "admin.delivery_email_resent":
      return {
        title: "Delivery email re-sent",
        detail:
          typeof p.expiresAtIso === "string"
            ? `New link expires ${formatIso(p.expiresAtIso)}`
            : undefined,
        tone: "muted",
      };

    case "admin.rerun_pipeline":
      return {
        title: "Admin re-ran the pipeline",
        detail:
          typeof p.priorStatus === "string"
            ? `From status ${p.priorStatus.replace(/_/g, " ").toLowerCase()}`
            : undefined,
        tone: "warning",
      };

    case "admin.marked_failed": {
      const reason = typeof p.reason === "string" ? p.reason : "no reason provided";
      const prior = typeof p.priorStatus === "string" ? p.priorStatus : null;
      return {
        title: "Admin marked study failed",
        detail: [
          prior ? `From ${prior.replace(/_/g, " ").toLowerCase()}` : null,
          `Reason: ${reason}`,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "destructive",
      };
    }

    case "admin.engineer_pdf_uploaded": {
      const engineer = typeof p.engineerName === "string" ? p.engineerName : null;
      const size = typeof p.sizeBytes === "number" ? p.sizeBytes : null;
      return {
        title: "Signed engineer PDF uploaded",
        detail: [engineer, size ? `${(size / 1024).toFixed(0)} KB` : null]
          .filter(Boolean)
          .join(" · "),
        tone: "primary",
      };
    }

    case "share.created": {
      const email = typeof p.invitedEmail === "string" ? p.invitedEmail : null;
      return {
        title: "CPA invite sent",
        detail: email ?? undefined,
        tone: "primary",
      };
    }

    case "share.accepted": {
      const email = typeof p.invitedEmail === "string" ? p.invitedEmail : null;
      return {
        title: "CPA accepted the invite",
        detail: email ? `${email} can now view the study` : undefined,
        tone: "success",
      };
    }

    case "share.revoked":
      return {
        title: "Share revoked",
        tone: "warning",
      };

    case "diy.generated": {
      const price = typeof p.purchasePriceCents === "number" ? p.purchasePriceCents : null;
      const building = typeof p.buildingValueCents === "number" ? p.buildingValueCents : null;
      const items = typeof p.lineItemCount === "number" ? p.lineItemCount : null;
      return {
        title: "DIY study generated",
        detail: [
          price ? `Basis ${formatCents(price)}` : null,
          building ? `Building ${formatCents(building)}` : null,
          items ? `${items} line items` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        tone: "success",
      };
    }

    default:
      return {
        title: kind,
        tone: "muted",
      };
  }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function humanizeKind(k: string): string {
  return k.replace(/_/g, " ").toLowerCase();
}
