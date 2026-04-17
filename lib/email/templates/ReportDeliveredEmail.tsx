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
}

const TIER_COPY: Record<Tier, { heading: string; caveat: string }> = {
  AI_REPORT: {
    heading: "Your AI Report is ready",
    caveat:
      "The AI Report is a planning tool — have your CPA review before filing. Reply to this email if you'd like to upgrade to an Engineer-Reviewed study.",
  },
  ENGINEER_REVIEWED: {
    heading: "Your Engineer-Reviewed Study is ready",
    caveat:
      "The study is signed by a US-licensed Professional Engineer and is audit-defensible under IRS Pub 5653.",
  },
};

export function ReportDeliveredEmail({
  firstName,
  tier,
  downloadUrl,
  appUrl,
  propertyAddress,
  expiresAtIso,
}: ReportDeliveredEmailProps) {
  const copy = TIER_COPY[tier];
  return (
    <Html>
      <Head />
      <Preview>{copy.heading}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>Cost Seg</Text>
          <Text style={heading}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
          <Text style={paragraph}>
            {copy.heading} for <strong>{propertyAddress}</strong>.
          </Text>
          <Section style={{ textAlign: "center", marginTop: 32 }}>
            <Button style={button} href={downloadUrl}>
              Download report &rarr;
            </Button>
          </Section>
          <Text style={paragraphSmall}>
            This link expires on{" "}
            <strong>
              {new Date(expiresAtIso).toLocaleDateString("en-US", {
                dateStyle: "long",
              })}
            </strong>
            . Request a fresh link anytime from{" "}
            <Link href={`${appUrl}/dashboard`} style={link}>
              your dashboard
            </Link>
            .
          </Text>
          <Hr style={hr} />
          <Text style={paragraphSmall}>{copy.caveat}</Text>
          <Text style={paragraphSmall}>Questions? Reply to this email.</Text>
          <Text style={footer}>
            Cost Seg &middot;{" "}
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

const body: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  padding: "40px 0",
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  margin: "0 auto",
  maxWidth: 560,
  padding: "32px 40px",
};
const brand: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: 0.3,
  color: "#111",
  marginBottom: 24,
};
const heading: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: "#111",
  margin: 0,
};
const paragraph: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.55,
  color: "#333",
  marginTop: 12,
};
const paragraphSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#555",
  marginTop: 16,
};
const link: React.CSSProperties = { color: "#111", textDecoration: "underline" };
const button: React.CSSProperties = {
  backgroundColor: "#111",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
};
const hr: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #eee",
  margin: "32px 0 16px",
};
const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
  marginTop: 24,
  textAlign: "center",
};
