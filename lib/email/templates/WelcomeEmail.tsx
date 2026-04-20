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

interface WelcomeEmailProps {
  firstName?: string | null;
  tier: Tier;
  intakeUrl: string;
  appUrl: string;
}

const TIER_COPY: Record<
  Tier,
  { label: string; intakeBlurb: string; intakeCta: string; eta: string }
> = {
  DIY: {
    label: "DIY Self-Serve",
    intakeBlurb:
      "Your DIY Self-Serve is ready to run as soon as you enter your basis and land value — no document upload required. It takes about 90 seconds.",
    intakeCta: "Enter the numbers →",
    eta: "Your report generates instantly once you submit the form.",
  },
  AI_REPORT: {
    label: "AI Report",
    intakeBlurb:
      "Your AI Report is ready to begin as soon as you upload three documents: your closing disclosure, any improvement receipts, and a few property photos.",
    intakeCta: "Upload documents →",
    eta: "Your report will be ready within minutes of upload.",
  },
  ENGINEER_REVIEWED: {
    label: "Engineer-Reviewed Study",
    intakeBlurb:
      "Your Engineer-Reviewed study is ready to begin as soon as you upload three documents: your closing disclosure, any improvement receipts, and a few property photos.",
    intakeCta: "Upload documents →",
    eta: "A licensed PE will review and sign within 3–7 days of upload.",
  },
};

export function WelcomeEmail({ firstName, tier, intakeUrl, appUrl }: WelcomeEmailProps) {
  const copy = TIER_COPY[tier];
  return (
    <Html>
      <Head />
      <Preview>Upload your documents to start your {copy.label}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>Cost Seg</Text>
          <Text style={heading}>{firstName ? `Hi ${firstName},` : "Hi there,"}</Text>
          <Text style={paragraph}>Thanks for your purchase. {copy.intakeBlurb}</Text>
          <Section style={{ textAlign: "center", marginTop: 32 }}>
            <Button style={button} href={intakeUrl}>
              {copy.intakeCta}
            </Button>
          </Section>
          <Text style={paragraphSmall}>
            The link above also signs you in. It expires in 1 hour; request a fresh one from{" "}
            <Link href={`${appUrl}/sign-in`} style={link}>
              the sign-in page
            </Link>{" "}
            if you need it.
          </Text>
          <Hr style={hr} />
          <Text style={paragraphSmall}>{copy.eta}</Text>
          {tier === "AI_REPORT" || tier === "DIY" ? (
            <Text style={disclosure}>
              Important: {tier === "DIY" ? "DIY Self-Serve" : "the AI Report"} is a planning and
              modeling tool produced by software. It is not a complete cost segregation study under
              IRS Pub 5653. Do not file a return relying on it without CPA review. If you need an
              audit-defensible study, reply and we can upgrade you.
            </Text>
          ) : null}
          <Text style={paragraphSmall}>Questions? Just reply to this email.</Text>
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

export default WelcomeEmail;

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

const disclosure: React.CSSProperties = {
  ...paragraphSmall,
  backgroundColor: "#fffbeb",
  border: "1px solid #fcd34d",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#78350f",
};

const link: React.CSSProperties = {
  color: "#111",
  textDecoration: "underline",
};

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
