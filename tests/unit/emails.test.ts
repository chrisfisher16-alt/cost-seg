import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { CpaInviteEmail } from "@/lib/email/templates/CpaInviteEmail";
import { ReportDeliveredEmail } from "@/lib/email/templates/ReportDeliveredEmail";
import { WelcomeEmail } from "@/lib/email/templates/WelcomeEmail";

/**
 * Content-level guards for the three transactional templates. We don't pin a
 * full HTML snapshot — @react-email updates the generated markup across
 * releases and a full snapshot would churn on every upgrade. Instead we
 * assert the pieces the user actually reads: brand name, preview text,
 * CTA link, and tier-specific copy.
 *
 * Catches the classes of regression that slipped in before (stale brand
 * strings, wrong CTA URL, missing property address, tier-copy swap).
 */

const APP_URL = "https://segra.tax";

describe("WelcomeEmail", () => {
  it("renders the AI_REPORT welcome with a working intake CTA", async () => {
    const html = await render(
      WelcomeEmail({
        firstName: "Taylor",
        tier: "AI_REPORT",
        intakeUrl: "https://segra.tax/studies/abc123/intake?token=deadbeef",
        appUrl: APP_URL,
      }),
    );

    expect(html).toContain("Hi Taylor,");
    expect(html).toContain("Segra");
    // Tier-specific copy branch
    expect(html).toContain("closing disclosure");
    expect(html).toContain("Upload documents");
    // CTA href is preserved through react-email's HTML sanitization
    expect(html).toContain("studies/abc123/intake");
    // Preview shown in inbox before the user opens
    expect(html).toMatch(/Upload your documents to start your AI Report/);
  });

  it("falls back to 'Hi there,' when firstName is missing", async () => {
    const html = await render(
      WelcomeEmail({
        firstName: null,
        tier: "AI_REPORT",
        intakeUrl: `${APP_URL}/studies/x/intake`,
        appUrl: APP_URL,
      }),
    );
    expect(html).toContain("Hi there,");
    expect(html).not.toContain("Hi null");
    expect(html).not.toContain("Hi ,");
  });

  it("DIY welcome uses 'Enter the numbers' instead of 'Upload documents'", async () => {
    const html = await render(
      WelcomeEmail({
        firstName: "Sam",
        tier: "DIY",
        intakeUrl: `${APP_URL}/studies/x/diy`,
        appUrl: APP_URL,
      }),
    );
    expect(html).toContain("Enter the numbers");
    expect(html).not.toContain("Upload documents");
    // DIY is software-modeling; must include the filing caveat
    expect(html).toMatch(/not a complete cost segregation study/i);
  });

  it("ENGINEER_REVIEWED welcome promises PE signature + 3–7 day turnaround", async () => {
    const html = await render(
      WelcomeEmail({
        firstName: null,
        tier: "ENGINEER_REVIEWED",
        intakeUrl: `${APP_URL}/studies/x/intake`,
        appUrl: APP_URL,
      }),
    );
    expect(html).toContain("licensed PE");
    expect(html).toContain("3–7 days");
    // Engineer-Reviewed skips the DIY/AI caveat block (it IS audit-defensible)
    expect(html).not.toMatch(/not a complete cost segregation study/i);
  });
});

describe("ReportDeliveredEmail", () => {
  it("includes the headline year-1 KPI when cents > 0", async () => {
    const html = await render(
      ReportDeliveredEmail({
        firstName: "Priya",
        tier: "AI_REPORT",
        downloadUrl: "https://supabase.co/storage/signed/abc.pdf?token=x",
        appUrl: APP_URL,
        propertyAddress: "412 Magnolia Ave, Austin, TX 78704",
        expiresAtIso: new Date("2027-01-15T12:00:00Z").toISOString(),
        year1DeductionCents: 84_250_00,
      }),
    );

    expect(html).toContain("Hi Priya,");
    expect(html).toContain("Segra");
    expect(html).toContain("412 Magnolia Ave");
    // $84,250 — whole dollars, no cents, no misplaced fractional digits
    expect(html).toContain("$84,250");
    expect(html).not.toContain("$84,250.00");
    // Download link is preserved
    expect(html).toContain("supabase.co/storage/signed/abc.pdf");
    // Preview copy leads with the KPI
    expect(html).toMatch(/\$84,250 year-one deduction/);
  });

  it("omits the KPI block when year1DeductionCents is missing or zero", async () => {
    const html = await render(
      ReportDeliveredEmail({
        firstName: null,
        tier: "AI_REPORT",
        downloadUrl: `${APP_URL}/download`,
        appUrl: APP_URL,
        propertyAddress: "88 Riverside Blvd, Boise, ID 83702",
        expiresAtIso: new Date().toISOString(),
      }),
    );
    expect(html).toContain("Riverside Blvd");
    // Preview copy should fall back to the heading-only form (no $ prefix)
    expect(html).not.toMatch(/^\$\d/);
  });

  it("Engineer-Reviewed delivery brags about the PE signature", async () => {
    const html = await render(
      ReportDeliveredEmail({
        firstName: "Chris",
        tier: "ENGINEER_REVIEWED",
        downloadUrl: `${APP_URL}/download`,
        appUrl: APP_URL,
        propertyAddress: "123 Oak Ridge Drive, Nashville, TN 37215",
        expiresAtIso: new Date().toISOString(),
      }),
    );
    expect(html).toContain("Professional Engineer");
    expect(html).toMatch(/audit-defensible/i);
    expect(html).toMatch(/IRS Publication 5653/);
  });
});

describe("CpaInviteEmail", () => {
  it("names the owner and property in both preview and body", async () => {
    const html = await render(
      CpaInviteEmail({
        ownerName: "Jess Park",
        ownerEmail: "jess@acmecpa.com",
        propertyAddress: "412 Magnolia Ave, Austin, TX 78704",
        shareUrl: "https://segra.tax/share/abc123def456",
        appUrl: APP_URL,
        note: "Our 2025 filing is due next week.",
      }),
    );
    expect(html).toContain("Jess Park");
    expect(html).toContain("412 Magnolia Ave");
    // Share link survives markup
    expect(html).toContain("/share/abc123def456");
    // Owner-supplied note flows through
    expect(html).toContain("Our 2025 filing is due next week");
    expect(html).toContain("Segra");
  });

  it("falls back to ownerEmail when ownerName is absent", async () => {
    const html = await render(
      CpaInviteEmail({
        ownerName: null,
        ownerEmail: "owner@example.com",
        propertyAddress: "88 Riverside Blvd, Boise, ID 83702",
        shareUrl: `${APP_URL}/share/x`,
        appUrl: APP_URL,
        note: null,
      }),
    );
    // Preview says "owner@example.com invited you..."
    expect(html).toContain("owner@example.com");
    expect(html).not.toContain("null invited you");
  });
});
