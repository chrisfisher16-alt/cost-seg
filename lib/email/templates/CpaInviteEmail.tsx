import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { BRAND } from "@/lib/brand";

export interface CpaInviteEmailProps {
  ownerName?: string | null;
  ownerEmail: string;
  propertyAddress: string;
  shareUrl: string;
  appUrl: string;
  note?: string | null;
}

export function CpaInviteEmail({
  ownerName,
  ownerEmail,
  propertyAddress,
  shareUrl,
  appUrl,
  note,
}: CpaInviteEmailProps) {
  const whoFrom = ownerName ? `${ownerName} (${ownerEmail})` : ownerEmail;
  return (
    <Html>
      <Head />
      <Preview>{`${ownerName ?? ownerEmail} invited you to review a cost segregation study for ${propertyAddress}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandBar}>
            <Img
              src={`${appUrl}${BRAND.assets.logoPng1600}`}
              alt={BRAND.name}
              width="140"
              height="40"
              style={brandLogo}
            />
            <Text style={badge}>Shared with you</Text>
          </Section>

          <Text style={greeting}>Hi there,</Text>
          <Text style={heroHeading}>
            {ownerName ?? `A ${BRAND.name} customer`} invited you to review a cost segregation
            study.
          </Text>
          <Text style={subhead}>For {propertyAddress}.</Text>

          <Section style={infoBlock}>
            <Text style={infoLabel}>Invited by</Text>
            <Text style={infoValue}>{whoFrom}</Text>
            <Text style={{ ...infoLabel, marginTop: 10 }}>Property</Text>
            <Text style={infoValue}>{propertyAddress}</Text>
            {note ? (
              <>
                <Text style={{ ...infoLabel, marginTop: 10 }}>Their note</Text>
                <Text style={{ ...infoValue, fontStyle: "italic" }}>&ldquo;{note}&rdquo;</Text>
              </>
            ) : null}
          </Section>

          <Section style={{ textAlign: "center", marginTop: 28 }}>
            <Button style={primaryButton} href={shareUrl}>
              Open the study →
            </Button>
          </Section>
          <Text style={paragraphSmall}>
            When you click the link we&rsquo;ll prompt you to sign in (or create a {BRAND.name}{" "}
            account if you don&rsquo;t have one). Your access is read-only — you&rsquo;ll see the
            property details, asset schedule, MACRS projection, and a downloadable PDF.
          </Text>

          <Hr style={hr} />

          <Text style={sectionHeading}>About {BRAND.name}</Text>
          <Text style={paragraph}>
            {BRAND.name} is an AI-powered cost segregation platform. Customers run a study in
            minutes, share it with their CPA for review, and (when filing) upgrade to an
            engineer-reviewed, audit-defensible study under IRS Publication 5653. Learn more at{" "}
            <Link href={appUrl} style={link}>
              {new URL(appUrl).host}
            </Link>
            .
          </Text>

          <Text style={footer}>
            If you weren&rsquo;t expecting this invitation, you can safely ignore this email. The
            share link expires if the inviter revokes access.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CpaInviteEmail;

// Palette — mirrors web tokens in sRGB approximations.
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
const brandLogo: React.CSSProperties = {
  display: "block",
  margin: 0,
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
  fontSize: 24,
  fontWeight: 600,
  color: INK,
  letterSpacing: -0.4,
  lineHeight: 1.2,
  margin: "0 0 8px 0",
};
const subhead: React.CSSProperties = {
  fontSize: 14,
  color: MUTED,
  margin: 0,
};
const infoBlock: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  borderRadius: 12,
  backgroundColor: "#f9fafb",
  border: `1px solid ${SOFT_BORDER}`,
};
const infoLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: MUTED,
  margin: 0,
};
const infoValue: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: INK,
  margin: "4px 0 0 0",
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
const paragraph: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: INK,
  marginTop: 12,
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
  margin: "8px 0 6px 0",
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
};
