import { StyleSheet, Text, View } from "@react-pdf/renderer";

export const pdfColors = {
  foreground: "#111111",
  subtle: "#555555",
  muted: "#888888",
  hairline: "#dcdcdc",
  accentBg: "#f4f4f4",
  amberBg: "#fff8eb",
  amberBorder: "#f4c06a",
  amberText: "#653b0b",
} as const;

export const baseStyles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: pdfColors.foreground,
    lineHeight: 1.45,
  },
  h1: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
  },
  h3: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  p: { marginBottom: 8 },
  muted: { color: pdfColors.subtle, fontSize: 9 },
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
    marginVertical: 10,
  },
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 30,
    borderTopWidth: 1,
    borderTopColor: pdfColors.hairline,
    paddingTop: 10,
    color: pdfColors.muted,
    fontSize: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.hairline,
    paddingVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.foreground,
    paddingVertical: 6,
    backgroundColor: pdfColors.accentBg,
  },
});

export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ width: 10 }}>{"•"}</Text>
      <Text style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ width: 140, color: pdfColors.subtle }}>{k}</Text>
      <Text style={{ flex: 1 }}>{v}</Text>
    </View>
  );
}

export function PageFooter({ studyId }: { studyId: string }) {
  return (
    <View style={baseStyles.footer} fixed>
      <Text>Cost Seg — planning estimate, not an IRS-defensible study under Pub 5653.</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages} · Study ${studyId.slice(0, 8)}`
        }
      />
    </View>
  );
}
