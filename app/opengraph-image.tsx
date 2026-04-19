import { ImageResponse } from "next/og";

/**
 * Default OpenGraph image for every page that doesn't declare its own.
 * Rendered at build time at 1200×630 — the canonical social-preview size.
 */

export const runtime = "edge";
export const alt = "Cost Seg — AI-powered cost segregation studies, without the six-week wait";
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
          "radial-gradient(ellipse at top left, rgba(4,120,87,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(30,64,175,0.15), transparent 60%), #FAFAF9",
        color: "#0A0A0A",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "linear-gradient(135deg, #047857, #1E40AF)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 0 10px 0",
            gap: 2.5,
          }}
        >
          <div
            style={{ width: 28, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.95)" }}
          />
          <div
            style={{ width: 22, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.75)" }}
          />
          <div
            style={{ width: 16, height: 6, borderRadius: 2, background: "rgba(255,255,255,0.5)" }}
          />
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.8, display: "flex" }}>
          Cost Seg
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(4,120,87,0.12)",
            color: "#047857",
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
            background: "linear-gradient(135deg, #047857, #1E40AF)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          without the six-week wait.
        </div>
        <div style={{ fontSize: 28, color: "#4B5563", lineHeight: 1.35, display: "flex" }}>
          AI modeling in minutes. Engineer-signed in days. From $149.
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
        <div style={{ display: "flex" }}>costseg.app</div>
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
