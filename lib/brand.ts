/**
 * Single source of truth for brand-identifying strings and asset paths.
 *
 * Prevents drift across headers, emails, PDFs, and metadata. If the product
 * ever gets renamed again, this is the only surface that MUST change — every
 * user-visible reference should either import from here or be reviewed against
 * this module.
 *
 * Notes on what lives here vs. elsewhere:
 *   - Visual design tokens (colors used by the app) stay in `globals.css`.
 *     `colors` below is mirrored for email/PDF contexts that can't consume CSS
 *     variables — it is NOT the source of truth for the web UI palette.
 *   - Product-tier names ("AI Report", "Engineer-Reviewed Study") live in
 *     `lib/stripe/catalog.ts`; they describe SKUs, not the brand.
 */
export const BRAND = {
  name: "Segra",
  tagline: "Cost segregation in minutes.",
  fullName: "Segra — Cost segregation in minutes",
  description:
    "Cost segregation studies, without the six-week wait. Get an AI modeling report in minutes, or an engineer-reviewed, audit-defensible study in days.",
  email: {
    from: "Segra <noreply@segra.tax>",
    domain: "segra.tax",
    support: "support@segra.tax",
  },
  colors: {
    navy: "#0F2E47",
    amber: "#E89A4A",
  },
  assets: {
    logoSvg: "/brand/segra-logo.svg",
    logoMonoSvg: "/brand/segra-logo-mono.svg",
    iconSvg: "/brand/segra-icon.svg",
    logoPng1600: "/brand/segra-logo-primary-1600.png",
    logoPng2400: "/brand/segra-logo-primary-2400.png",
    logoMonoPng1600: "/brand/segra-logo-mono-1600.png",
    iconPng512: "/brand/segra-icon-dark-512.png",
    iconPng256: "/brand/segra-icon-dark-256.png",
    iconPng128: "/brand/segra-icon-dark-128.png",
    iconPng64: "/brand/segra-icon-dark-64.png",
    iconPng32: "/brand/segra-icon-dark-32.png",
  },
} as const;
