import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { Tier } from "@/lib/stripe/catalog";

export interface ReportDeliveredEmailProps {
  firstName?: string | null;
  tier: Tier;
  downloadUrl: string;
  appUrl: string;
  propertyAddress: string;
  expiresAtIso: string;
  /** Optional — year-1 headline deduction (cents). If present, we render it as the KPI. */
  year1DeductionCents?: number;
}

const TIER_COPY: Record<Tier, { heading: string; subhead: string; caveat: string; badge: string }> =
  {
    AI_REPORT: {
      heading: "Your AI Report is ready.",
      subhead: "Modeling report + full MACRS schedule.",
      badge: "AI Report",
      caveat:
        "This modeling report is a planning tool — have your CPA review before filing. Want an engineer-signed, audit-defensible study? Reply to this email and we'll upgrade your study without re-uploading anything.",
    },
    ENGINEER_REVIEWED: {
      heading: "Your Engineer-Reviewed study is ready.",
      subhead: "Reviewed and signed by a US-licensed Professional Engineer.",
      badge: "Engineer-Reviewed",
      caveat:
        "Signed under IRS Publication 5653. This study is audit-defensible. Keep the PDF — plus the work-paper appendix — with your filing records.",
    },
  };

function fmtCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function ReportDeliveredEmail({
  firstName,
  tier,
  downloadUrl,
  appUrl,
  propertyAddress,
  expiresAtIso,
  year1DeductionCents,
}: ReportDeliveredEmailProps) {
  const copy = TIER_COPY[tier];
  const hasKpi = typeof year1DeductionCents === "number" && year1DeductionCents > 0;

  return (
    <Html>
      <Head />
      <Preview>
        {hasKpi
          ? `${fmtCents(year1DeductionCents!)} year-one deduction identified. ${copy.heading}`
          : copy.heading}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Brand header */}
          <Section style={brandBar}>
            <BrandLockup />
            <Text style={badge}>{copy.badge}</Text>
          </Section>

          {/* Hero */}
          <Text style={greeting}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
          <Text style={heroHeading}>{copy.heading}</Text>
          <Text style={subhead}>{copy.subhead}</Text>

          {/* KPI block */}
          {hasKpi ? (
            <Section style={kpiBlock}>
              <Text style={kpiLabel}>Year-one deduction identified</Text>
              <Text style={kpiValue}>{fmtCents(year1DeductionCents!)}</Text>
              <Text style={kpiHint}>For {propertyAddress}</Text>
            </Section>
          ) : (
            <Section style={propertyBlock}>
              <Text style={kpiLabel}>Property</Text>
              <Text style={propertyValue}>{propertyAddress}</Text>
            </Section>
          )}

          {/* Primary CTA */}
          <Section style={{ textAlign: "center", marginTop: 28 }}>
            <Button style={primaryButton} href={downloadUrl}>
              Download your PDF →
            </Button>
          </Section>

          <Text style={paragraphSmall}>
            This download link expires on{" "}
            <strong>
              {new Date(expiresAtIso).toLocaleDateString("en-US", {
                dateStyle: "long",
              })}
            </strong>
            . You can request a fresh link any time from your{" "}
            <Link href={`${appUrl}/dashboard`} style={link}>
              Cost Seg dashboard
            </Link>
            .
          </Text>

          {/* Next steps */}
          <Hr style={hr} />
          <Text style={sectionHeading}>What&rsquo;s next</Text>
          <Section style={stepRow}>
            <Text style={stepNum}>1</Text>
            <Text style={stepBody}>
              <strong>Send to your CPA.</strong> Forward this email or share the read-only link from
              your dashboard.
            </Text>
          </Section>
          <Section style={stepRow}>
            <Text style={stepNum}>2</Text>
            <Text style={stepBody}>
              {tier === "AI_REPORT" ? (
                <>
                  <strong>Upgrade to Engineer-Reviewed</strong> before you file. We reuse every
                  document — one click from your dashboard.
                </>
              ) : (
                <>
                  <strong>Keep work papers with your filing.</strong> The methodology appendix is
                  your audit-defense package.
                </>
              )}
            </Text>
          </Section>
          <Section style={stepRow}>
            <Text style={stepNum}>3</Text>
            <Text style={stepBody}>
              <strong>Add audit protection</strong> when the add-on launches Q3 2026.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={paragraphSmall}>{copy.caveat}</Text>
          <Text style={paragraphSmall}>Questions? Reply to this email — we read every one.</Text>

          <Text style={footer}>
            Cost Seg ·{" "}
            <Link href={appUrl} style={link}>
              {new URL(appUrl).host}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReportDeliveredEmail;

function BrandLockup() {
  return (
    <Text style={brand}>
      <span style={brandDot} />
      Cost Seg
    </Text>
  );
}

// Palette — mirrors web tokens in sRGB approximations for Email clients.
const EMERALD = "#047857";
const EMERALD_SOFT = "#ECFDF5";
const INK = "#0A0A0A";
const MUTED = "#6b7280";
const SOFT_BORDER = "#e5e7eb";
const OFFWHITE = "#FAFAF9";

const body: React.CSSProperties = {
  backgroundColor: OFFWHITE,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  padding: "40px 0",
  margin: 0,
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 14,
  margin: "0 auto",
  maxWidth: 600,
  padding: "32px 40px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  border: `1px solid ${SOFT_BORDER}`,
};
const brandBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 28,
};
const brand: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: -0.1,
  color: INK,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const brandDot: React.CSSProperties = {
  display: "inline-block",
  width: 14,
  height: 14,
  borderRadius: 4,
  background: `linear-gradient(135deg, ${EMERALD}, #2563eb)`,
};
const badge: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: EMERALD_SOFT,
  color: EMERALD,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase",
  padding: "4px 10px",
  borderRadius: 999,
  margin: 0,
};
const greeting: React.CSSProperties = {
  fontSize: 14,
  color: MUTED,
  margin: "0 0 4px 0",
};
const heroHeading: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  color: INK,
  letterSpacing: -0.4,
  lineHeight: 1.15,
  margin: "0 0 8px 0",
};
const subhead: React.CSSProperties = {
  fontSize: 14,
  color: MUTED,
  margin: 0,
};
const kpiBlock: React.CSSProperties = {
  marginTop: 24,
  padding: 20,
  borderRadius: 12,
  backgroundColor: EMERALD_SOFT,
  border: `1px solid ${EMERALD}33`,
  textAlign: "left",
};
const propertyBlock: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  borderRadius: 12,
  backgroundColor: "#f9fafb",
  border: `1px solid ${SOFT_BORDER}`,
};
const kpiLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: MUTED,
  margin: 0,
};
const kpiValue: React.CSSProperties = {
  fontSize: 38,
  fontWeight: 600,
  color: EMERALD,
  letterSpacing: -0.5,
  lineHeight: 1.1,
  margin: "6px 0 4px 0",
};
const kpiHint: React.CSSProperties = {
  fontSize: 13,
  color: MUTED,
  margin: 0,
};
const propertyValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  color: INK,
  margin: "6px 0 0 0",
};
const primaryButton: React.CSSProperties = {
  backgroundColor: EMERALD,
  borderRadius: 10,
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
};
const paragraphSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.65,
  color: MUTED,
  marginTop: 16,
};
const sectionHeading: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: MUTED,
  margin: "8px 0 14px 0",
};
const stepRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  margin: "0 0 10px 0",
};
const stepNum: React.CSSProperties = {
  display: "inline-block",
  minWidth: 22,
  height: 22,
  lineHeight: "22px",
  textAlign: "center",
  borderRadius: 999,
  backgroundColor: EMERALD_SOFT,
  color: EMERALD,
  fontSize: 12,
  fontWeight: 700,
  margin: 0,
};
const stepBody: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "#333",
  margin: 0,
};
const hr: React.CSSProperties = {
  border: "none",
  borderTop: `1px solid ${SOFT_BORDER}`,
  margin: "28px 0 16px",
};
const link: React.CSSProperties = { color: EMERALD, textDecoration: "underline" };
const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
  marginTop: 24,
  textAlign: "center",
};
