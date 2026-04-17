import { Document, Page, Text, View } from "@react-pdf/renderer";

import { TIER_1_SCOPE_DISCLOSURE } from "@/lib/pdf/disclosure";
import { DEPRECIATION_CLASS_LABEL, type YearOneProjection, type AssetGroup } from "@/lib/pdf/types";

import { KeyValue, PageFooter, baseStyles, pdfColors } from "./shared";

export interface AiReportProps {
  studyId: string;
  generatedAt: Date;
  tierLabel: string;
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyTypeLabel: string;
    squareFeet?: number | null;
    yearBuilt?: number | null;
    acquiredAtIso: string;
  };
  decomposition: {
    purchasePriceCents: number;
    landValueCents: number;
    buildingValueCents: number;
    landAllocationPct: number;
    methodology: string;
    confidence: number;
  };
  narrative: {
    executiveSummary: string;
    propertyDescription: string;
    methodology: string;
    assetScheduleExplanation: string;
    scheduleSummaryTable: string;
  };
  schedule: {
    lineItems: Array<{
      category: string;
      name: string;
      amountCents: number;
      percentOfBuilding?: number;
      rationale: string;
    }>;
    groups: AssetGroup[];
    totalCents: number;
  };
  projection: YearOneProjection;
  assumedBracket: number;
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtCents(cents: number): string {
  return usd0.format(Math.round(cents / 100));
}

function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function AiReportTemplate(props: AiReportProps) {
  return (
    <Document title={`AI Cost Segregation Report — ${props.property.address}`} author="Cost Seg">
      <CoverPage {...props} />
      <DisclosurePage {...props} />
      <ContentPages {...props} />
    </Document>
  );
}

function CoverPage(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page}>
      <View>
        <Text style={{ fontSize: 9, color: pdfColors.muted, letterSpacing: 2 }}>
          COST SEG · AI REPORT
        </Text>
        <Text style={[baseStyles.h1, { marginTop: 60 }]}>Cost Segregation Modeling Report</Text>
        <Text style={{ fontSize: 12, color: pdfColors.subtle, marginTop: 6 }}>
          {props.tierLabel}
        </Text>

        <View style={{ marginTop: 48 }}>
          <KeyValue
            k="Property"
            v={`${props.property.address}, ${props.property.city}, ${props.property.state} ${props.property.zip}`}
          />
          <KeyValue k="Property type" v={props.property.propertyTypeLabel} />
          <KeyValue k="Acquired" v={props.property.acquiredAtIso} />
          <KeyValue k="Purchase price" v={fmtCents(props.decomposition.purchasePriceCents)} />
          <KeyValue
            k="Generated"
            v={props.generatedAt.toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
          />
          <KeyValue k="Study ID" v={props.studyId.slice(0, 8)} />
        </View>

        <View style={[baseStyles.disclosureBox, { marginTop: 48 }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
            Important scope disclosure.
          </Text>
          <Text>{TIER_1_SCOPE_DISCLOSURE.replace(/^Important scope disclosure\.\s*/, "")}</Text>
        </View>
      </View>
      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function DisclosurePage(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page}>
      <Text style={baseStyles.h2}>Scope and limitations</Text>
      <View style={baseStyles.disclosureBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
          Important scope disclosure.
        </Text>
        <Text>{TIER_1_SCOPE_DISCLOSURE.replace(/^Important scope disclosure\.\s*/, "")}</Text>
      </View>
      <Text style={baseStyles.p}>
        This report models the reclassification of building basis into shorter MACRS recovery
        periods based on industry standard percentages and the documents you uploaded. It is a
        planning artifact. Treat the schedule as a starting point your CPA (and where applicable, a
        licensed professional engineer) should verify before using it in a tax filing.
      </Text>
      <Text style={baseStyles.p}>
        Under the One Big Beautiful Bill Act, 100% bonus depreciation was permanently restored for
        qualifying property acquired after January 19, 2025. That means assets reclassified to 5, 7,
        or 15-year recovery periods are generally deductible in full in the year the property is
        placed in service, subject to your facts and your tax advisor&apos;s judgment.
      </Text>
      <Text style={baseStyles.p}>
        This report assumes the buyer takes on depreciable basis in line with the purchase price
        decomposition shown. Year-one deduction estimates use an assumed marginal tax bracket of{" "}
        {fmtPct(props.assumedBracket, 0)} and should be recalculated with your actual rate before
        filing.
      </Text>
      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function ContentPages(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <Text style={baseStyles.h2}>Executive summary</Text>
      <Markdownish text={props.narrative.executiveSummary} />

      <Text style={baseStyles.h2}>Property description</Text>
      <Markdownish text={props.narrative.propertyDescription} />

      <Text style={baseStyles.h2}>Methodology</Text>
      <Markdownish text={props.narrative.methodology} />
      <View style={[baseStyles.hr, { marginTop: 10 }]} />
      <Text style={baseStyles.h3}>Purchase-price decomposition</Text>
      <KeyValue k="Purchase price" v={fmtCents(props.decomposition.purchasePriceCents)} />
      <KeyValue
        k="Land value"
        v={`${fmtCents(props.decomposition.landValueCents)} (${fmtPct(props.decomposition.landAllocationPct, 1)})`}
      />
      <KeyValue
        k="Building value"
        v={`${fmtCents(props.decomposition.buildingValueCents)} (${fmtPct(1 - props.decomposition.landAllocationPct, 1)})`}
      />
      <KeyValue k="Methodology" v={props.decomposition.methodology} />

      <Text style={baseStyles.h2} break>
        Asset schedule
      </Text>
      <Markdownish text={props.narrative.assetScheduleExplanation} />
      <AssetTable groups={props.schedule.groups} totalCents={props.schedule.totalCents} />

      <Text style={baseStyles.h2} break>
        Year-one depreciation projection
      </Text>
      <ProjectionTable projection={props.projection} assumedBracket={props.assumedBracket} />
      <Text style={[baseStyles.muted, { marginTop: 10 }]}>
        Assumes 100% bonus depreciation on 5/7/15-year property under OBBBA and mid-month first-year
        convention on building basis. Consult your CPA — actual deductions depend on
        placed-in-service date and your marginal rate.
      </Text>

      <View style={baseStyles.hr} />
      <Text style={baseStyles.h3}>Line-item detail</Text>
      {props.schedule.lineItems.map((li) => (
        <View key={`${li.category}-${li.name}`} style={{ marginBottom: 6 }} wrap={false}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {DEPRECIATION_CLASS_LABEL[li.category as keyof typeof DEPRECIATION_CLASS_LABEL] ??
              li.category}
            {" · "}
            {li.name}
            {" · "}
            {fmtCents(li.amountCents)}
            {li.percentOfBuilding !== undefined
              ? ` (${fmtPct(li.percentOfBuilding, 2)} of building)`
              : ""}
          </Text>
          <Text style={{ color: pdfColors.subtle }}>{li.rationale}</Text>
        </View>
      ))}

      <Text style={baseStyles.h2} break>
        Disclaimer
      </Text>
      <View style={baseStyles.disclosureBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
          Important scope disclosure.
        </Text>
        <Text>{TIER_1_SCOPE_DISCLOSURE.replace(/^Important scope disclosure\.\s*/, "")}</Text>
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function AssetTable({ groups, totalCents }: { groups: AssetGroup[]; totalCents: number }) {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={baseStyles.tableHeaderRow}>
        <Text style={{ flex: 2 }}>Depreciation class</Text>
        <Text style={{ flex: 1, textAlign: "right" }}>Amount</Text>
        <Text style={{ flex: 1, textAlign: "right" }}>% of building</Text>
      </View>
      {groups.map((g) => (
        <View key={g.category} style={baseStyles.tableRow}>
          <Text style={{ flex: 2 }}>
            {DEPRECIATION_CLASS_LABEL[g.category]} ({g.lineItemCount}{" "}
            {g.lineItemCount === 1 ? "item" : "items"})
          </Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{fmtCents(g.amountCents)}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{fmtPct(g.pctOfBuilding, 1)}</Text>
        </View>
      ))}
      <View style={[baseStyles.tableRow, { borderBottomWidth: 0, borderTopWidth: 1 }]}>
        <Text style={{ flex: 2, fontFamily: "Helvetica-Bold" }}>Building basis total</Text>
        <Text
          style={{
            flex: 1,
            textAlign: "right",
            fontFamily: "Helvetica-Bold",
          }}
        >
          {fmtCents(totalCents)}
        </Text>
        <Text style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function ProjectionTable({
  projection,
  assumedBracket,
}: {
  projection: YearOneProjection;
  assumedBracket: number;
}) {
  const rows = [
    {
      label: "5/7/15-year (bonus)",
      basis: projection.bonusEligibleCents,
      year1: projection.bonusEligibleCents,
    },
    {
      label: `27.5/39-year (first-year MACRS)`,
      basis: projection.longLifeBasisCents,
      year1: projection.longLifeYear1Cents,
    },
  ];
  const totalYear1 = projection.bonusEligibleCents + projection.longLifeYear1Cents;
  const taxSavings = Math.round(totalYear1 * assumedBracket);

  return (
    <View style={{ marginTop: 8 }}>
      <View style={baseStyles.tableHeaderRow}>
        <Text style={{ flex: 2 }}>Category</Text>
        <Text style={{ flex: 1, textAlign: "right" }}>Basis</Text>
        <Text style={{ flex: 1, textAlign: "right" }}>Year-1 deduction</Text>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={baseStyles.tableRow}>
          <Text style={{ flex: 2 }}>{r.label}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{fmtCents(r.basis)}</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>{fmtCents(r.year1)}</Text>
        </View>
      ))}
      <View style={[baseStyles.tableRow, { borderBottomWidth: 0, borderTopWidth: 1 }]}>
        <Text style={{ flex: 2, fontFamily: "Helvetica-Bold" }}>Total year-1 deduction</Text>
        <Text style={{ flex: 1 }} />
        <Text
          style={{
            flex: 1,
            textAlign: "right",
            fontFamily: "Helvetica-Bold",
          }}
        >
          {fmtCents(totalYear1)}
        </Text>
      </View>
      <Text style={[baseStyles.muted, { marginTop: 6 }]}>
        At an assumed {fmtPct(assumedBracket, 0)} marginal bracket, the year-1 tax savings is
        approximately {fmtCents(taxSavings)}. Your actual savings depend on your facts and your
        CPA&apos;s review.
      </Text>
    </View>
  );
}

/** Minimalist markdown-ish renderer: paragraph splits only. Good enough for
 *  the narrative sections we generate; richer formatting can come later. */
function Markdownish({ text }: { text: string }) {
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
