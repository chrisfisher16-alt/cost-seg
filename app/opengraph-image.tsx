import { ImageResponse } from "next/og";

import { BRAND } from "@/lib/brand";

/**
 * Default OpenGraph image for every page that doesn't declare its own.
 * Rendered at build time at 1200×630 — the canonical social-preview size.
 */

export const runtime = "edge";
export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background:
          "radial-gradient(ellipse at top left, rgba(15,46,71,0.12), transparent 60%), radial-gradient(ellipse at bottom right, rgba(232,154,74,0.18), transparent 60%), #FAFAF9",
        color: "#0A0A0A",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: BRAND.colors.navy,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 4,
            padding: "0 0 12px 0",
          }}
        >
          <div style={{ width: 6, height: 12, borderRadius: 2, background: "#5B89AD" }} />
          <div style={{ width: 6, height: 20, borderRadius: 2, background: "#8FB4D1" }} />
          <div style={{ width: 6, height: 28, borderRadius: 2, background: "#F2C17A" }} />
          <div style={{ width: 6, height: 36, borderRadius: 2, background: BRAND.colors.amber }} />
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.8, display: "flex" }}>
          {BRAND.name}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(15,46,71,0.08)",
            color: BRAND.colors.navy,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          OBBBA · 100% bonus depreciation restored
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.02,
            display: "flex",
          }}
        >
          Cost segregation studies,
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.02,
            background: `linear-gradient(135deg, ${BRAND.colors.navy}, ${BRAND.colors.amber})`,
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          without the six-week wait.
        </div>
        <div style={{ fontSize: 28, color: "#4B5563", lineHeight: 1.35, display: "flex" }}>
          AI modeling in minutes. Engineer-reviewed in days. From $149.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
          color: "#6B7280",
        }}
      >
        <div style={{ display: "flex" }}>{BRAND.email.domain}</div>
        <div style={{ display: "flex", gap: 28 }}>
          <span>DIY $149</span>
          <span>AI Report $295</span>
          <span>Engineer-Reviewed $1,495</span>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
