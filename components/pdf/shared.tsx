import * as React from "react";
import { StyleSheet, Svg, Defs, LinearGradient, Stop, Rect, Text, View } from "@react-pdf/renderer";

/**
 * Palette — sRGB approximations of the web design tokens, tuned for print.
 * Emerald-forward, with quiet neutrals and a single amber accent reserved for
 * warnings and the scope-disclosure box.
 */
export const pdfColors = {
  foreground: "#0A0A0A",
  subtle: "#4B5563",
  muted: "#6B7280",
  hairline: "#E5E7EB",
  softBorder: "#D1D5DB",
  surface: "#FFFFFF",
  offWhite: "#FAFAF9",
  panel: "#F9FAFB",
  accentBg: "#F3F4F6",

  /** Brand emerald — the single "important" color on the page. */
  primary: "#047857",
  primaryInk: "#065F46",
  primarySoft: "#ECFDF5",
  primarySoftBorder: "#A7F3D0",

  /** Cobalt paired with emerald only on the brand lockup gradient. */
  brandCobalt: "#1E40AF",

  /** Amber — scope disclosure only. Never a primary UI color. */
  amberBg: "#FFFBEB",
  amberBorder: "#F59E0B",
  amberText: "#78350F",

  /** Data-table alt row shading. */
  zebra: "#F9FAFB",
  headerRow: "#F3F4F6",
} as const;

const PAGE_PADDING_TOP = 56;
const PAGE_PADDING_BOTTOM = 72;
const PAGE_PADDING_X = 52;

export const baseStyles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING_TOP,
    paddingBottom: PAGE_PADDING_BOTTOM,
    paddingHorizontal: PAGE_PADDING_X,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: pdfColors.foreground,
    lineHeight: 1.45,
    backgroundColor: pdfColors.surface,
  },
  coverPage: {
    paddingTop: 64,
    paddingBottom: 72,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: pdfColors.foreground,
    backgroundColor: pdfColors.offWhite,
  },
  appendixCoverPage: {
    paddingTop: PAGE_PADDING_TOP,
    paddingBottom: PAGE_PADDING_BOTTOM,
    paddingHorizontal: PAGE_PADDING_X,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: pdfColors.foreground,
    backgroundColor: pdfColors.surface,
    justifyContent: "center",
    alignItems: "center",
  },

  h1: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.5,
    lineHeight: 1.1,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.3,
    marginTop: 22,
    marginBottom: 8,
  },
  h3: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  h4: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.6,
    color: pdfColors.primary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  p: { marginBottom: 8, lineHeight: 1.55, color: pdfColors.foreground },
  lead: {
    fontSize: 11,
    lineHeight: 1.55,
    color: pdfColors.subtle,
    marginBottom: 10,
  },
  muted: { color: pdfColors.subtle, fontSize: 9, lineHeight: 1.5 },
  mono: {
    fontFamily: "Courier",
    fontSize: 9,
    color: pdfColors.subtle,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  hr: {
    borderBottomColor: pdfColors.hairline,
    borderBottomWidth: 1,
    marginVertical: 14,
  },

  disclosureBox: {
    borderColor: pdfColors.amberBorder,
    borderWidth: 1,
    backgroundColor: pdfColors.amberBg,
    color: pdfColors.amberText,
    padding: 12,
    borderRadius: 4,
    marginVertical: 12,
  },
  kpiBox: {
    borderColor: pdfColors.primarySoftBorder,
    borderWidth: 1,
    backgroundColor: pdfColors.primarySoft,
    padding: 16,
    borderRadius: 6,
    marginVertical: 10,
  },
  panelBox: {
    borderColor: pdfColors.hairline,
    borderWidth: 1,
    backgroundColor: pdfColors.panel,
    padding: 12,
    borderRadius: 4,
    marginVertical: 8,
  },

  footer: {
    position: "absolute",
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    bottom: 30,
    borderTopWidth: 1,
    borderTopColor: pdfColors.hairline,
    paddingTop: 10,
    color: pdfColors.muted,
    fontSize: 7.5,
    letterSpacing: 0.3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Core table styles
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.foreground,
    paddingVertical: 6,
    backgroundColor: pdfColors.headerRow,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: pdfColors.hairline,
    paddingVertical: 5,
    paddingHorizontal: 4,
    backgroundColor: pdfColors.zebra,
  },
  tableFooterRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: pdfColors.foreground,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: pdfColors.headerRow,
  },

  // KPI blocks
  kpiLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    color: pdfColors.subtle,
    textTransform: "uppercase",
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.4,
    color: pdfColors.foreground,
    marginTop: 4,
  },
  kpiValueAccent: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.5,
    color: pdfColors.primary,
    marginTop: 4,
  },
  kpiHint: {
    fontSize: 8,
    color: pdfColors.subtle,
    marginTop: 2,
    lineHeight: 1.4,
  },

  // Brand-gradient-aware block
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.6,
    lineHeight: 1.08,
    color: pdfColors.foreground,
  },
  coverSubtitle: {
    fontSize: 11,
    color: pdfColors.subtle,
    marginTop: 8,
    lineHeight: 1.5,
  },
});

export { PAGE_PADDING_X, PAGE_PADDING_TOP, PAGE_PADDING_BOTTOM };

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 10 }}>{"•"}</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function KeyValue({
  k,
  v,
  bold,
}: {
  k: string;
  v: string;
  /** When true, render the value in bold (e.g. a headline number). */
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 140, color: pdfColors.subtle }}>{k}</Text>
      <Text style={bold ? { flex: 1, fontFamily: "Helvetica-Bold" } : { flex: 1 }}>{v}</Text>
    </View>
  );
}

export function KeyValueGrid({
  entries,
  columns = 2,
}: {
  entries: Array<{ k: string; v: string }>;
  columns?: 2 | 3;
}) {
  const rows: Array<typeof entries> = [];
  for (let i = 0; i < entries.length; i += columns) {
    rows.push(entries.slice(i, i + columns));
  }
  return (
    <View>
      {rows.map((row, idx) => (
        <View key={idx} style={{ flexDirection: "row", marginBottom: 6, gap: 12 }}>
          {row.map((entry) => (
            <View key={entry.k} style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 8,
                  color: pdfColors.subtle,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {entry.k}
              </Text>
              <Text style={{ fontSize: 10, marginTop: 2 }}>{entry.v}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function SoftKpi({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={baseStyles.kpiLabel}>{label}</Text>
      <Text style={accent ? baseStyles.kpiValueAccent : baseStyles.kpiValue}>{value}</Text>
      {hint ? <Text style={baseStyles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

export function BrandMarkPdf({
  size = 18,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="cs-pdf-brand" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={pdfColors.primary} />
            <Stop offset="1" stopColor={pdfColors.brandCobalt} />
          </LinearGradient>
        </Defs>
        <Rect x="3" y="3" width="26" height="26" rx="7" fill="url(#cs-pdf-brand)" />
        <Rect x="8" y="20" width="16" height="3" rx="1" fill="white" fillOpacity={0.95} />
        <Rect x="10" y="15" width="12" height="3" rx="1" fill="white" fillOpacity={0.75} />
        <Rect x="12" y="10" width="8" height="3" rx="1" fill="white" fillOpacity={0.5} />
      </Svg>
      {showWordmark ? (
        <Text style={{ fontSize: size * 0.75, fontFamily: "Helvetica-Bold", letterSpacing: -0.2 }}>
          Cost Seg
        </Text>
      ) : null}
    </View>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ marginTop: 16, marginBottom: 10 }}>
      {eyebrow ? <Text style={baseStyles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={baseStyles.h2}>{title}</Text>
      {subtitle ? <Text style={baseStyles.lead}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Simple paragraph-split renderer. Good enough for the narrative sections we
 * generate; preserves double-newline breaks from the Claude outputs.
 */
export function Markdownish({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <View>
      {paragraphs.map((para, i) => (
        <Text key={i} style={baseStyles.p}>
          {para}
        </Text>
      ))}
    </View>
  );
}

export function PageFooter({ studyId }: { studyId: string }) {
  return (
    <View style={baseStyles.footer} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <BrandMarkPdf size={10} />
        <Text style={{ color: pdfColors.muted }}>
          · Planning estimate, not an IRS-defensible study under Pub 5653.
        </Text>
      </View>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages} · Study ${studyId.slice(0, 8)}`
        }
      />
    </View>
  );
}

/**
 * Generic data-table component with header + zebra rows + optional footer.
 * Keeps table rows together with wrap={false} on each row so the pagination
 * doesn't split a single row across pages.
 */
export interface DataTableColumn<Row> {
  key: string;
  header: string;
  /** Flex basis for the column. Sum across columns should be reasonable (e.g. 1-6). */
  flex: number;
  align?: "left" | "right" | "center";
  /** Render function — return a string; table cells are always <Text>. */
  render: (row: Row) => string;
  /** Apply bold to this column in the footer (totals) row. */
  boldInFooter?: boolean;
}

export function DataTable<Row>({
  columns,
  rows,
  footer,
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  footer?: Record<string, string>;
}) {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={baseStyles.tableHeaderRow}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={{
              flex: col.flex,
              textAlign: col.align ?? "left",
              fontFamily: "Helvetica-Bold",
              fontSize: 9,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View
          key={idx}
          style={idx % 2 === 0 ? baseStyles.tableRow : baseStyles.tableRowAlt}
          wrap={false}
        >
          {columns.map((col) => (
            <Text
              key={col.key}
              style={{
                flex: col.flex,
                textAlign: col.align ?? "left",
              }}
            >
              {col.render(row)}
            </Text>
          ))}
        </View>
      ))}
      {footer ? (
        <View style={baseStyles.tableFooterRow} wrap={false}>
          {columns.map((col) => (
            <Text
              key={col.key}
              style={{
                flex: col.flex,
                textAlign: col.align ?? "left",
                fontFamily: col.boldInFooter ? "Helvetica-Bold" : "Helvetica",
              }}
            >
              {footer[col.key] ?? ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
