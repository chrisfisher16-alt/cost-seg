import { Document, Image, Page, Text, View } from "@react-pdf/renderer";

import { BRAND } from "@/lib/brand";
import { TIER_1_SCOPE_DISCLOSURE } from "@/lib/pdf/disclosure";
import {
  computeForm3115Worksheet,
  form3115InputFromLineItems,
  type Form3115Worksheet,
} from "@/lib/pdf/form-3115";
import { aggregateBasisByClass, computeMacrsSchedule, type MacrsSchedule } from "@/lib/pdf/macrs";
import {
  DEPRECIATION_CLASS_LABEL,
  type DepreciationClassKey,
  type YearOneProjection,
  type AssetGroup,
} from "@/lib/pdf/types";

import {
  BrandMarkPdf,
  DataTable,
  type DataTableColumn,
  KeyValue,
  KeyValueGrid,
  Markdownish,
  PageFooter,
  SectionHeader,
  SoftKpi,
  baseStyles,
  pdfColors,
} from "./shared";

// -----------------------------------------------------------------------------
// Props — backward-compatible with deliver.ts. Optional fields enable v2 features.
// -----------------------------------------------------------------------------

export interface AiReportProps {
  studyId: string;
  generatedAt: Date;
  tierLabel: string;

  /** Display label for the owner / preparer — defaults to property address if absent. */
  ownerLabel?: string | null;
  /** Tax year the owner will file — defaults to the current year from generatedAt. */
  taxYear?: number;

  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    propertyTypeLabel: string;
    /** Property classification for MACRS real-property life (27.5 for residential, 39 otherwise). */
    realPropertyYears?: 27.5 | 39;
    squareFeet?: number | null;
    yearBuilt?: number | null;
    /** YYYY-MM-DD — the acquisition date. */
    acquiredAtIso: string;
    /** YYYY-MM-DD — the placed-in-service date. Defaults to acquiredAtIso if missing. */
    placedInServiceIso?: string;
    /**
     * v2 Phase 5 (ADR 0012). Public-records enrichment sourced from
     * `Property.enrichmentJson`. When present, the Property Info page
     * renders concrete facts from here instead of "Not provided".
     * Always optional — v1 delivery continues to ignore this field.
     */
    enrichment?: {
      squareFeet?: number | null;
      yearBuilt?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      constructionType?: string | null;
      roofType?: string | null;
      lotSizeSqft?: number | null;
      assessorUrl?: string | null;
      listingUrl?: string | null;
    } | null;
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
      /** Optional per-asset enrichment from richer classifier outputs. */
      quantity?: number;
      unit?: string;
      unitCostCents?: number;
      costSource?: string;
      physicalMultiplier?: number;
      functionalMultiplier?: number;
      timeMultiplier?: number;
      locationMultiplier?: number;
      /**
       * v2 Phase 5 (ADR 0012) additions. All optional — when absent
       * AssetDetailCard renders the v1 chip layout unchanged.
       *
       * `photoDataUri` is a base64 `data:image/jpeg;base64,...` string
       * resolved by deliver.ts from the Document storage path. Inline
       * embedding keeps the PDF self-contained (no signed-URL expiry).
       */
      photoDataUri?: string;
      comparableDescription?: string;
      comparableSourceUrl?: string;
      physicalJustification?: string;
      functionalJustification?: string;
      timeBasis?: string;
      locationBasis?: string;
      isResidual?: boolean;
    }>;
    groups: AssetGroup[];
    totalCents: number;
  };

  projection: YearOneProjection;
  assumedBracket: number;

  /**
   * Whether 100% bonus depreciation applies to 5/7/15-year property. The pipeline
   * should set this based on acquisition date against TCJA (2017-09-28) and OBBBA
   * (2025-01-19) cutoffs. Defaults to true when unspecified (matches legacy behavior).
   */
  bonusEligible?: boolean;
}

// -----------------------------------------------------------------------------
// Formatters
// -----------------------------------------------------------------------------

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function fmtCents(cents: number): string {
  return usd0.format(Math.round(cents / 100));
}
function fmtCentsPrecise(cents: number): string {
  return usd2.format(cents / 100);
}
function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// -----------------------------------------------------------------------------
// Document
// -----------------------------------------------------------------------------

export function AiReportTemplate(props: AiReportProps) {
  const taxYear = props.taxYear ?? new Date(props.generatedAt).getFullYear() - 1;
  const realPropertyYears = props.property.realPropertyYears ?? 39;
  const placedInServiceIso = props.property.placedInServiceIso ?? props.property.acquiredAtIso;
  const placedInServiceDate = new Date(`${placedInServiceIso}T00:00:00`);

  const basisByClass = aggregateBasisByClass(props.schedule.lineItems);
  const macrs = computeMacrsSchedule({
    fiveYrBasisCents: basisByClass.fiveYrBasisCents,
    sevenYrBasisCents: basisByClass.sevenYrBasisCents,
    fifteenYrBasisCents: basisByClass.fifteenYrBasisCents,
    residualRealCents: basisByClass.twentySevenHalfCents + basisByClass.thirtyNineCents,
    placedInServiceYear: placedInServiceDate.getFullYear(),
    placedInServiceMonth: placedInServiceDate.getMonth() + 1,
    bonusEligible: props.bonusEligible ?? true,
    realPropertyYears,
  });

  const form3115 = computeForm3115Worksheet(
    form3115InputFromLineItems(props.schedule.lineItems, {
      placedInServiceYear: placedInServiceDate.getFullYear(),
      placedInServiceMonth: placedInServiceDate.getMonth() + 1,
      taxYear,
      bonusEligible: props.bonusEligible ?? true,
      realPropertyYears,
    }),
  );

  return (
    <Document
      title={`Cost Segregation Study — ${props.property.address} — ${BRAND.name}`}
      author={BRAND.name}
      subject={`Tier-1 AI modeling report for ${props.property.address}`}
      creator={`${BRAND.name} · ${BRAND.email.domain}`}
      producer={BRAND.name}
    >
      <CoverPage {...props} taxYear={taxYear} />
      <TableOfContents {...props} />
      <ExecutiveSummaryPage {...props} macrs={macrs} realPropertyYears={realPropertyYears} />
      <PropertyInformationPage
        {...props}
        placedInServiceIso={placedInServiceIso}
        realPropertyYears={realPropertyYears}
      />
      <LandAndBasisPage {...props} />
      <AssetSummaryPage {...props} />
      <DepreciationSchedulePage {...props} macrs={macrs} realPropertyYears={realPropertyYears} />
      <MethodologyPage {...props} />

      <AppendixCover
        letter="A"
        title="Methodology"
        subtitle="Detailed regulatory framework, valuation procedures, and compliance standards"
        studyId={props.studyId}
      />
      <AppendixAContent {...props} />

      <AppendixCover
        letter="B"
        title="Detailed Asset Schedule"
        subtitle="Every classified line item with its rationale and adjustments"
        studyId={props.studyId}
      />
      <AppendixBContent {...props} />

      <AppendixCover
        letter="C"
        title="Reference Documentation"
        subtitle={`Supporting source materials — available on your ${BRAND.name} dashboard`}
        studyId={props.studyId}
      />
      <AppendixCContent {...props} />

      <AppendixCover
        letter="D"
        title="Expenditure Classification Schedule"
        subtitle="Spreadsheet-style listing of every classified expenditure"
        studyId={props.studyId}
      />
      <AppendixDContent {...props} />

      <AppendixCover
        letter="E"
        title="CPA Filing Worksheet"
        subtitle="Pre-filled inputs for Form 3115 (or Form 4562), including the §481(a) adjustment and recommended DCN"
        studyId={props.studyId}
      />
      <AppendixEContent
        {...props}
        worksheet={form3115}
        taxYear={taxYear}
        placedInServiceIso={placedInServiceIso}
      />
    </Document>
  );
}

// -----------------------------------------------------------------------------
// Cover
// -----------------------------------------------------------------------------

function CoverPage(props: AiReportProps & { taxYear: number }) {
  const ownerLabel = props.ownerLabel ?? `the owner of ${props.property.address}`;
  return (
    <Page size="LETTER" style={baseStyles.coverPage}>
      <View style={{ marginBottom: 36 }}>
        <BrandMarkPdf size={22} />
      </View>

      <View
        style={{
          backgroundColor: pdfColors.primarySoft,
          borderColor: pdfColors.primarySoftBorder,
          borderWidth: 1,
          borderRadius: 8,
          padding: 32,
          minHeight: 220,
          justifyContent: "center",
        }}
      >
        <Text style={baseStyles.eyebrow}>
          {BRAND.name} · {props.tierLabel}
        </Text>
        <Text style={baseStyles.coverTitle}>Cost Segregation Study</Text>
        <Text style={[baseStyles.coverSubtitle, { marginTop: 14 }]}>
          {props.property.address}, {props.property.city}, {props.property.state}{" "}
          {props.property.zip}
        </Text>
        <Text style={baseStyles.coverSubtitle}>
          Prepared for {ownerLabel} on {fmtDateLong(props.generatedAt)}
        </Text>
        {/* v2 Phase 6 polish: surface enriched property facts on the
            cover when we have them. Intake-null + no enrichment → fact
            line is suppressed. */}
        <CoverPropertyFacts property={props.property} />
      </View>

      <View style={{ flex: 1 }} />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: pdfColors.hairline,
          paddingTop: 16,
          flexDirection: "row",
          gap: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              color: pdfColors.subtle,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Prepared by
          </Text>
          <Text style={{ fontSize: 10, marginTop: 3, fontFamily: "Helvetica-Bold" }}>
            {BRAND.name}
          </Text>
          <Text style={{ fontSize: 9, color: pdfColors.subtle }}>{BRAND.email.support}</Text>
          <Text style={{ fontSize: 9, color: pdfColors.subtle }}>{BRAND.email.domain}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              color: pdfColors.subtle,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Tax year
          </Text>
          <Text style={{ fontSize: 10, marginTop: 3, fontFamily: "Helvetica-Bold" }}>
            {props.taxYear}
          </Text>
          <Text
            style={{
              fontSize: 7.5,
              color: pdfColors.subtle,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              marginTop: 8,
            }}
          >
            Report date
          </Text>
          <Text style={{ fontSize: 9, color: pdfColors.subtle }}>
            {fmtDateLong(props.generatedAt)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 7.5,
              color: pdfColors.subtle,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Study ID
          </Text>
          <Text style={{ fontSize: 10, marginTop: 3, fontFamily: "Courier" }}>
            {props.studyId.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={{ fontSize: 7.5, color: pdfColors.subtle, marginTop: 8 }}>
            Reference this ID in any support correspondence.
          </Text>
        </View>
      </View>

      {/* Phase 7 layout discipline (ADR 0013): disclosure footer on
          every page, cover included. Acceptance criterion #8. */}
      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

/**
 * v2 Phase 6 polish — single-line property-facts block on the cover
 * page. Prefers enrichment values (from Phase 4) over intake nulls.
 * Renders nothing when no fact is available so the cover layout stays
 * clean for intake-only studies.
 */
function CoverPropertyFacts({ property }: { property: AiReportProps["property"] }) {
  const enrichment = property.enrichment ?? null;
  const sqft = enrichment?.squareFeet ?? property.squareFeet ?? null;
  const yearBuilt = enrichment?.yearBuilt ?? property.yearBuilt ?? null;
  const constructionType = enrichment?.constructionType ?? null;

  const parts: string[] = [];
  if (sqft) parts.push(`${sqft.toLocaleString()} sq ft`);
  if (yearBuilt) parts.push(`Built ${yearBuilt}`);
  if (constructionType) parts.push(constructionType.replace(/_/g, " "));
  if (parts.length === 0) return null;

  return <Text style={baseStyles.coverSubtitle}>{parts.join(" · ")}</Text>;
}

// -----------------------------------------------------------------------------
// Table of contents
// -----------------------------------------------------------------------------

function TableOfContents(props: AiReportProps) {
  const sections: Array<{ label: string; indent: 0 | 1 | 2 }> = [
    { label: "Cost Segregation Study", indent: 0 },
    { label: "Executive Summary", indent: 1 },
    { label: "Property Information", indent: 1 },
    { label: "Property Description", indent: 1 },
    { label: "Land Value", indent: 1 },
    { label: "Cost Basis", indent: 1 },
    { label: "Depreciable Basis", indent: 1 },
    { label: "Asset Summary", indent: 1 },
    { label: "Depreciation Schedule (MACRS)", indent: 1 },
    { label: "Methodology", indent: 1 },
    { label: "Appendix A — Methodology", indent: 0 },
    { label: "Regulatory framework and compliance", indent: 1 },
    { label: "Valuation methodology — Residual + RCNLD", indent: 1 },
    { label: "Cost estimation sources", indent: 1 },
    { label: "Adjustment methodologies", indent: 1 },
    { label: "Asset classification standards", indent: 1 },
    { label: "Quality assurance and audit defense", indent: 1 },
    { label: "Limitations and assumptions", indent: 1 },
    { label: "Appendix B — Detailed Asset Schedule", indent: 0 },
    { label: "Appendix C — Reference Documentation", indent: 0 },
    { label: "Appendix D — Expenditure Classification Schedule", indent: 0 },
    { label: "Appendix E — CPA Filing Worksheet", indent: 0 },
    { label: "Recommended form + §481(a) adjustment", indent: 1 },
    { label: "Prior-year method-change analysis", indent: 1 },
    { label: "Per-class Form 4562 pre-fills", indent: 1 },
  ];
  return (
    <Page size="LETTER" style={baseStyles.page}>
      <Text style={baseStyles.eyebrow}>Contents</Text>
      <Text style={baseStyles.h2} minPresenceAhead={72}>
        Cost Segregation Study · {props.property.address}
      </Text>
      <Text style={baseStyles.muted}>
        {props.tierLabel} · Generated {fmtDateLong(props.generatedAt)}
      </Text>

      <View style={[baseStyles.hr, { marginTop: 18 }]} />

      <View style={{ marginTop: 8 }}>
        {sections.map((s, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              paddingVertical: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: pdfColors.hairline,
            }}
          >
            <Text
              style={{
                flex: 1,
                marginLeft: s.indent * 16,
                fontFamily: s.indent === 0 ? "Helvetica-Bold" : "Helvetica",
                fontSize: s.indent === 0 ? 11 : 10,
                color: s.indent === 0 ? pdfColors.foreground : pdfColors.subtle,
              }}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Body pages
// -----------------------------------------------------------------------------

function ExecutiveSummaryPage(
  props: AiReportProps & { macrs: MacrsSchedule; realPropertyYears: 27.5 | 39 },
) {
  const building = props.decomposition.buildingValueCents;
  const acceleratedCents = props.schedule.groups
    .filter((g) => g.category === "5yr" || g.category === "7yr" || g.category === "15yr")
    .reduce((sum, g) => sum + g.amountCents, 0);
  const acceleratedPct = building > 0 ? acceleratedCents / building : 0;

  const fiveYr = props.schedule.groups.find((g) => g.category === "5yr");
  const sevenYr = props.schedule.groups.find((g) => g.category === "7yr");
  const fifteenYr = props.schedule.groups.find((g) => g.category === "15yr");
  const firstYearTotal = props.macrs.lines.reduce(
    (sum, line) =>
      line.year === "Bonus" || line.year === props.macrs.lines[1]?.year
        ? sum + line.totalCents
        : sum,
    0,
  );

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader
        eyebrow="Cost Segregation Study"
        title="Executive Summary"
        subtitle={`This study identifies and reclassifies property components for ${props.property.address}. Key results are summarized below.`}
      />

      {/* Phase 7 layout discipline (ADR 0013): the KPI block is atomic —
          never split the two headline numbers across pages. */}
      <View style={baseStyles.kpiBox} wrap={false}>
        <View style={{ flexDirection: "row", gap: 20 }}>
          <SoftKpi
            label="Year-1 deduction"
            value={fmtCents(firstYearTotal)}
            hint={`At ${fmtPct(props.assumedBracket, 0)} bracket ≈ ${fmtCents(Math.round(firstYearTotal * props.assumedBracket))} in tax savings`}
            accent
          />
          <SoftKpi
            label="Accelerated property"
            value={fmtCents(acceleratedCents)}
            hint={`${fmtPct(acceleratedPct, 1)} of depreciable basis`}
          />
        </View>
      </View>

      <View style={{ marginTop: 14, gap: 5 }}>
        <KeyValue k="Cost basis" v={fmtCents(props.decomposition.purchasePriceCents)} bold />
        <KeyValue k="Land value" v={fmtCents(props.decomposition.landValueCents)} bold />
        <KeyValue k="Depreciable basis" v={fmtCents(building)} bold />
        <KeyValue
          k={`Accelerated property (5/7/15-year)`}
          v={`${fmtCents(acceleratedCents)} (${fmtPct(acceleratedPct, 1)} of depreciable basis)`}
          bold
        />
        <KeyValue
          k="Accelerated breakdown"
          v={
            `5-year ${fmtCents(fiveYr?.amountCents ?? 0)} (${fmtPct(fiveYr?.pctOfBuilding ?? 0, 1)})` +
            `, 7-year ${fmtCents(sevenYr?.amountCents ?? 0)} (${fmtPct(sevenYr?.pctOfBuilding ?? 0, 1)})` +
            `, 15-year ${fmtCents(fifteenYr?.amountCents ?? 0)} (${fmtPct(fifteenYr?.pctOfBuilding ?? 0, 1)})`
          }
        />
      </View>

      <View style={baseStyles.hr} />
      <Text style={baseStyles.muted}>
        Methodology follows IRS Publication 5653 (Cost Segregation Audit Techniques Guide, 2-2025)
        and Rev. Proc. 87-56. See Appendix A for the complete framework.
      </Text>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function PropertyInformationPage(
  props: AiReportProps & { placedInServiceIso: string; realPropertyYears: 27.5 | 39 },
) {
  // v2 Phase 5 (ADR 0012): enrichment fields override intake nulls,
  // and surface construction / roof / lot size when the public record
  // returned them. When enrichment isn't provided the grid renders
  // identically to v1.
  const enrichment = props.property.enrichment ?? null;
  const sqft = enrichment?.squareFeet ?? props.property.squareFeet ?? null;
  const yearBuilt = enrichment?.yearBuilt ?? props.property.yearBuilt ?? null;
  const constructionType = enrichment?.constructionType ?? null;
  const roofType = enrichment?.roofType ?? null;
  const lotSizeSqft = enrichment?.lotSizeSqft ?? null;

  const entries: Array<{ k: string; v: string }> = [
    {
      k: "Property address",
      v: `${props.property.address}, ${props.property.city}, ${props.property.state} ${props.property.zip}`,
    },
    { k: "Property owner", v: props.ownerLabel ?? "—" },
    { k: "Date placed in service", v: fmtDate(props.placedInServiceIso) },
    { k: "Acquisition date", v: fmtDate(props.property.acquiredAtIso) },
    { k: "Property type", v: props.property.propertyTypeLabel },
    {
      k: "Real-property life",
      v: `${props.realPropertyYears}-year ${props.realPropertyYears === 27.5 ? "(Section 168(e)(2)(A) residential rental)" : "(Section 168(e)(2)(B) nonresidential real property)"}`,
    },
    {
      k: "Square footage",
      v: sqft ? `${sqft.toLocaleString()} sq ft` : "Not specified",
    },
    {
      k: "Year built",
      v: yearBuilt ? yearBuilt.toString() : "Not specified",
    },
    { k: "Acquisition price", v: fmtCents(props.decomposition.purchasePriceCents) },
  ];
  if (constructionType) {
    entries.push({ k: "Construction", v: constructionType.replace(/_/g, " ") });
  }
  if (roofType) {
    entries.push({ k: "Roof", v: roofType.replace(/_/g, " ") });
  }
  if (lotSizeSqft) {
    entries.push({ k: "Lot size", v: `${lotSizeSqft.toLocaleString()} sq ft` });
  }

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader title="Property Information" />
      <KeyValueGrid columns={2} entries={entries} />

      {enrichment && (enrichment.assessorUrl || enrichment.listingUrl) ? (
        <View style={{ marginTop: 8 }}>
          <Text style={baseStyles.muted}>
            Source references:
            {enrichment.assessorUrl ? (
              <>
                {" "}
                assessor record{" "}
                <Text style={{ fontFamily: "Courier", fontSize: 8 }}>{enrichment.assessorUrl}</Text>
              </>
            ) : null}
            {enrichment.assessorUrl && enrichment.listingUrl ? " · " : null}
            {enrichment.listingUrl ? (
              <>
                listing{" "}
                <Text style={{ fontFamily: "Courier", fontSize: 8 }}>{enrichment.listingUrl}</Text>
              </>
            ) : null}
          </Text>
        </View>
      ) : null}

      <SectionHeader title="Property Description" />
      <Markdownish text={props.narrative.propertyDescription} />

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function LandAndBasisPage(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader title="Land Value" />
      <KeyValue k="Land value" v={fmtCents(props.decomposition.landValueCents)} bold />
      <Text style={[baseStyles.p, { marginTop: 10 }]}>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Land value determination. </Text>
        {props.decomposition.methodology}
      </Text>
      <Text style={baseStyles.muted}>
        Land allocation is {fmtPct(props.decomposition.landAllocationPct, 2)} of the acquisition
        price. Confidence: {fmtPct(props.decomposition.confidence, 0)}.
      </Text>

      <SectionHeader title="Cost Basis" />
      <KeyValue k="Total cost basis" v={fmtCents(props.decomposition.purchasePriceCents)} bold />
      <Text style={[baseStyles.p, { marginTop: 8 }]}>
        The total cost basis is calculated from the purchase price reflected on the closing
        disclosure, including any capitalized closing costs (appraisal fees, title insurance,
        recording fees, transfer taxes, and other costs that attach to basis under Treas. Reg.
        §1.263(a)-2). Operating expenses such as prorated utilities, HOA dues, and similar items
        have been excluded from basis.
      </Text>

      <SectionHeader title="Depreciable Basis" />
      <Text style={baseStyles.p}>
        The depreciable basis represents the portion of the cost basis that can be recovered through
        depreciation deductions. Land is not depreciable because it does not wear out or become
        obsolete; therefore, the land value is subtracted from the total cost basis.
      </Text>
      <View style={baseStyles.panelBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Formula</Text>
        <Text style={{ fontFamily: "Courier", fontSize: 9.5, marginBottom: 8 }}>
          Depreciable Basis = Total Cost Basis − Land Value
        </Text>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Calculation</Text>
        <Text style={{ fontFamily: "Courier", fontSize: 9.5 }}>
          {fmtCents(props.decomposition.buildingValueCents)} ={" "}
          {fmtCents(props.decomposition.purchasePriceCents)} −{" "}
          {fmtCents(props.decomposition.landValueCents)}
        </Text>
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function AssetSummaryPage(props: AiReportProps) {
  const building = props.decomposition.buildingValueCents;
  const groupByKey = new Map<string, AssetGroup>();
  for (const g of props.schedule.groups) groupByKey.set(g.category, g);

  const summaryRows: Array<{
    category: string;
    period: string;
    amount: number;
    pct: number;
    description: string;
  }> = [
    {
      category: "5-year property",
      period: "5 years",
      amount: groupByKey.get("5yr")?.amountCents ?? 0,
      pct: groupByKey.get("5yr")?.pctOfBuilding ?? 0,
      description:
        "Personal property — appliances, carpeting, decorative lighting, cabinetry, specialty equipment.",
    },
    {
      category: "7-year property",
      period: "7 years",
      amount: groupByKey.get("7yr")?.amountCents ?? 0,
      pct: groupByKey.get("7yr")?.pctOfBuilding ?? 0,
      description: "Office furniture, fixtures, equipment not classified elsewhere.",
    },
    {
      category: "15-year property",
      period: "15 years",
      amount: groupByKey.get("15yr")?.amountCents ?? 0,
      pct: groupByKey.get("15yr")?.pctOfBuilding ?? 0,
      description:
        "Land improvements — landscaping, sidewalks, driveways, fencing, site utilities.",
    },
    {
      category: "Residual real property",
      period: `${props.property.realPropertyYears ?? 39} years`,
      amount:
        (groupByKey.get("27_5yr")?.amountCents ?? 0) + (groupByKey.get("39yr")?.amountCents ?? 0),
      pct:
        (groupByKey.get("27_5yr")?.pctOfBuilding ?? 0) +
        (groupByKey.get("39yr")?.pctOfBuilding ?? 0),
      description:
        "Building shell + integral components — walls, roofing, core plumbing, integral HVAC, electrical wiring.",
    },
  ].filter((r) => r.amount > 0);

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader
        title="Asset Summary"
        subtitle="Under the Modified Accelerated Cost Recovery System (MACRS), property components are classified into recovery periods based on their nature and use."
      />

      <DataTable
        columns={[
          { key: "category", header: "Asset category", flex: 2, render: (r) => r.category },
          { key: "period", header: "Recovery period", flex: 1.2, render: (r) => r.period },
          {
            key: "amount",
            header: "Allocated cost",
            flex: 1.3,
            align: "right",
            render: (r) => fmtCents(r.amount),
            boldInFooter: true,
          },
          {
            key: "pct",
            header: "% of basis",
            flex: 1,
            align: "right",
            render: (r) => fmtPct(r.pct, 1),
          },
        ]}
        rows={summaryRows}
        footer={{
          category: "Depreciable basis total",
          period: "",
          amount: fmtCents(building),
          pct: "100.0%",
        }}
      />

      <SectionHeader title="Scope of the accelerated schedule" />
      <Markdownish text={props.narrative.assetScheduleExplanation} />

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function DepreciationSchedulePage(
  props: AiReportProps & { macrs: MacrsSchedule; realPropertyYears: 27.5 | 39 },
) {
  const { macrs, realPropertyYears } = props;
  const hasFive = macrs.totals.fiveYrCents > 0 || macrs.lines.some((l) => l.fiveYrCents > 0);
  const hasSeven = macrs.totals.sevenYrCents > 0 || macrs.lines.some((l) => l.sevenYrCents > 0);
  const hasFifteen =
    macrs.totals.fifteenYrCents > 0 || macrs.lines.some((l) => l.fifteenYrCents > 0);
  const hasReal = macrs.totals.thirtyNineYrCents > 0;

  type Row = {
    year: string;
    five: string;
    seven: string;
    fifteen: string;
    real: string;
    total: string;
  };

  const rows: Row[] = macrs.lines
    .filter((line) => line.totalCents > 0 || line.year === "Bonus")
    .map((line) => ({
      year: line.year === "Bonus" ? "Bonus" : String(line.year),
      five: line.fiveYrCents === 0 ? "—" : fmtCentsPrecise(line.fiveYrCents),
      seven: line.sevenYrCents === 0 ? "—" : fmtCentsPrecise(line.sevenYrCents),
      fifteen: line.fifteenYrCents === 0 ? "—" : fmtCentsPrecise(line.fifteenYrCents),
      real: line.thirtyNineYrCents === 0 ? "—" : fmtCentsPrecise(line.thirtyNineYrCents),
      total: fmtCentsPrecise(line.totalCents),
    }));

  const columns: DataTableColumn<Row>[] = [
    { key: "year", header: "Year", flex: 1, render: (r) => r.year },
  ];
  if (hasFive)
    columns.push({
      key: "five",
      header: "5-year",
      flex: 1.3,
      align: "right",
      render: (r) => r.five,
    });
  if (hasSeven)
    columns.push({
      key: "seven",
      header: "7-year",
      flex: 1.3,
      align: "right",
      render: (r) => r.seven,
    });
  if (hasFifteen)
    columns.push({
      key: "fifteen",
      header: "15-year",
      flex: 1.3,
      align: "right",
      render: (r) => r.fifteen,
    });
  if (hasReal)
    columns.push({
      key: "real",
      header: `${realPropertyYears}-year`,
      flex: 1.3,
      align: "right",
      render: (r) => r.real,
    });
  columns.push({
    key: "total",
    header: "Total annual",
    flex: 1.4,
    align: "right",
    render: (r) => r.total,
    boldInFooter: true,
  });

  const footer: Record<string, string> = {
    year: "Totals",
    five: hasFive ? fmtCentsPrecise(macrs.totals.fiveYrCents) : "—",
    seven: hasSeven ? fmtCentsPrecise(macrs.totals.sevenYrCents) : "—",
    fifteen: hasFifteen ? fmtCentsPrecise(macrs.totals.fifteenYrCents) : "—",
    real: hasReal ? fmtCentsPrecise(macrs.totals.thirtyNineYrCents) : "—",
    total: fmtCentsPrecise(macrs.totals.totalCents),
  };

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader
        eyebrow="Cost Segregation Study"
        title="Depreciation Schedule (MACRS)"
        subtitle={
          macrs.bonusAppliedFully
            ? `Under the OBBBA, 100% bonus depreciation was applied to 5-, 7-, and 15-year property placed in service on or after January 19, 2025. Subsequent years show $0 on those classes. Residual real property depreciates over ${realPropertyYears} years using the straight-line method with mid-month convention. Personal and land-improvement classes use the half-year convention (200% DB for 5/7-year, 150% DB for 15-year).`
            : `Standard MACRS applies — the bonus row is $0 because this property falls outside the TCJA/OBBBA bonus-eligibility window. The 5-, 7-, and 15-year classes use the half-year convention; residual real property depreciates straight-line over ${realPropertyYears} years with the mid-month convention.`
        }
      />
      <DataTable columns={columns} rows={rows} footer={footer} />

      <View style={baseStyles.hr} />
      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Notes on calculations and IRS compliance
      </Text>
      <View style={{ gap: 6 }}>
        <MacrsNote
          label="Bonus eligibility"
          body={
            macrs.bonusAppliedFully
              ? "Per OBBBA §70306, 100% bonus depreciation is restored for qualifying property. All 5/7/15-year basis is deducted in the bonus row."
              : "Per IRS Pub 946 and OBBBA §70306, bonus rate has been determined to be 0% for this acquisition. All classes depreciate under the standard MACRS tables below."
          }
        />
        <MacrsNote
          label={`${realPropertyYears}-year real property`}
          body={`Mid-month convention: the first year's deduction is prorated from the mid-point of the placed-in-service month. Subsequent years use the full ${(1 / realPropertyYears) * 100}% of basis (1/${realPropertyYears}) until the final year, which picks up the remainder so totals reconcile to basis.`}
        />
        <MacrsNote
          label="Personal property (half-year)"
          body="5-, 7-, and 15-year classes use the half-year convention, treating assets as placed in service at the midpoint of the year. 5/7-year classes use 200% declining-balance; 15-year uses 150% declining-balance — both switching to straight-line when SL yields a higher rate."
        />
        <MacrsNote
          label="Reconciliation"
          body={`Schedule totals reconcile to the depreciable basis of ${fmtCents(props.decomposition.buildingValueCents)}. Any pennies of rounding are absorbed in the final real-property row.`}
        />
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function MacrsNote({ label, body }: { label: string; body: string }) {
  // Phase 7 layout discipline (ADR 0013): keep each MACRS note as an
  // atomic row — a bold label stranded from its body is a classic
  // react-pdf pagination bug.
  return (
    <View style={{ flexDirection: "row", gap: 6 }} wrap={false}>
      <Text style={{ fontFamily: "Helvetica-Bold", width: 140 }}>{label}</Text>
      <Text style={{ flex: 1, color: pdfColors.subtle }}>{body}</Text>
    </View>
  );
}

function MethodologyPage(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <SectionHeader title="Methodology" />
      <Markdownish text={props.narrative.methodology} />
      <Text style={baseStyles.muted}>
        Complete regulatory framework, valuation procedures, and compliance standards are provided
        in <Text style={{ fontFamily: "Helvetica-Bold" }}>Appendix A: Methodology</Text>. Individual
        line items are detailed in <Text style={{ fontFamily: "Helvetica-Bold" }}>Appendix B</Text>.
        Source documents are available via your dashboard (referenced in{" "}
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Appendix C</Text>). A spreadsheet-style
        expenditure schedule is provided in{" "}
        <Text style={{ fontFamily: "Helvetica-Bold" }}>Appendix D</Text>.
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

// -----------------------------------------------------------------------------
// Appendix covers
// -----------------------------------------------------------------------------

function AppendixCover({
  letter,
  title,
  subtitle,
  studyId,
}: {
  letter: string;
  title: string;
  subtitle: string;
  studyId: string;
}) {
  return (
    // Phase 7 layout discipline (ADR 0013). Every appendix begins on a
    // fresh page — `break` is belt-and-suspenders over the implicit page
    // boundary a new <Page> already creates, so if a future refactor
    // restructures the document tree, the invariant still holds.
    <Page size="LETTER" style={baseStyles.appendixCoverPage} break>
      <Text
        style={{
          fontSize: 10,
          color: pdfColors.muted,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Cost Segregation Study
      </Text>
      <Text
        style={{ fontSize: 42, fontFamily: "Helvetica-Bold", letterSpacing: -1, marginTop: 12 }}
      >
        Appendix {letter}
      </Text>
      <Text
        style={{
          fontSize: 18,
          color: pdfColors.primary,
          marginTop: 10,
          fontFamily: "Helvetica-Bold",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: pdfColors.subtle,
          marginTop: 20,
          maxWidth: 420,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </Text>
      <PageFooter studyId={studyId} />
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Appendix A: Methodology deep dive
// -----------------------------------------------------------------------------

function AppendixAContent(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <Text style={baseStyles.eyebrow}>Appendix A</Text>
      <Text style={baseStyles.h2} minPresenceAhead={72}>
        Cost Segregation Study Methodology
      </Text>
      <Text style={baseStyles.lead}>
        This methodology provides a robust, IRS-compliant framework for conducting cost segregation
        studies on residential rental and short-term rental properties. It integrates the Residual
        Estimation Method with Replacement Cost New Less Depreciation (RCNLD), adheres to IRS
        guidelines including Revenue Procedure 87-56, Treasury Regulation §1.167(a)-1, and Treasury
        Regulation §1.263(a)-1, and follows the IRS Cost Segregation Audit Techniques Guide
        (Publication 5653, 2-2025).
      </Text>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Regulatory framework and compliance
      </Text>
      <Text style={baseStyles.p}>
        The methodology complies with IRS standards outlined in the Cost Segregation Audit
        Techniques Guide, ensuring accurate depreciation under the Modified Accelerated Cost
        Recovery System (MACRS). Key regulations include:
      </Text>
      <View style={{ gap: 3, marginBottom: 10 }}>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Revenue Procedure 87-56:</Text> defines
          asset classes for MACRS depreciation.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Revenue Procedure 2004-34:</Text> provides
          safe-harbor guidelines for compliance.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Treasury Regulation §1.167(a)-1:</Text>{" "}
          governs general depreciation rules.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Treasury Regulation §1.263(a)-1:</Text>{" "}
          guides capital expenditure and repair allocations.
        </Text>
      </View>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Valuation methodology — Residual + RCNLD
      </Text>
      <Text style={baseStyles.p}>
        The Residual Estimation Method, endorsed in Chapter 3, Section C.4 of the Audit Techniques
        Guide, serves as the primary valuation approach. It allocates the total property basis
        proportionally among components adjusted for time, location, physical depreciation, and
        functional obsolescence.
      </Text>
      <View style={baseStyles.panelBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Allocation formula</Text>
        <Text style={{ fontFamily: "Courier", fontSize: 9 }}>
          Component Allocated Value = (Component Adjusted Value / Σ Adjusted Values) × Total Basis
        </Text>
        <Text style={{ fontFamily: "Courier", fontSize: 9, marginTop: 4 }}>
          RCNLD = RCN × Time × Location × Physical × Functional
        </Text>
      </View>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Cost estimation sources
      </Text>
      <DataTable
        columns={[
          {
            key: "source",
            header: "Source",
            flex: 1.5,
            render: (r: { s: string; c: string; a: string }) => r.s,
          },
          { key: "coverage", header: "Coverage", flex: 2, render: (r) => r.c },
          { key: "application", header: "Application", flex: 2, render: (r) => r.a },
        ]}
        rows={[
          {
            s: "RSMeans Building Construction Cost Data",
            c: "Comprehensive construction costs",
            a: "Structural, HVAC, electrical work",
          },
          {
            s: "Craftsman National Repair & Remodeling Estimator (2026)",
            c: "Materials, labor, overhead",
            a: "Flooring, fixtures, site improvements",
          },
          {
            s: "PriceSearch market research",
            c: "Real-time retail pricing",
            a: "Appliances, lighting, specialty equipment",
          },
        ]}
      />
      <Text style={[baseStyles.muted, { marginTop: 6 }]}>
        A 10% general-contractor overhead markup is applied to RSMeans and Craftsman estimates, not
        to PriceSearch.
      </Text>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Adjustment methodologies
      </Text>
      <Text style={baseStyles.p}>
        Each component&apos;s Replacement Cost New is adjusted by four multipliers, each grounded in
        IRS-accepted sources:
      </Text>
      <View style={{ gap: 4, marginBottom: 8 }}>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Time:</Text> converts historical costs to
          current-year values using RSMeans Historical Cost Indices or the Craftsman Building Cost
          Historical Index.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Location:</Text> regional cost variations
          applied via Craftsman Area Modification Factors.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Physical depreciation:</Text> a condition
          rating (Excellent 1.0 / Good 0.8 / Fair 0.6 / Poor 0.4 / Salvage 0.15) grounded in visual
          inspection and maintenance history.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Functional obsolescence:</Text> adjustments
          for outdated design or technology (high obsolescence for single-zone HVAC, outdated
          electrical panels, obsolete appliances; moderate for older plumbing and dated lighting;
          low or none for modern structural components).
        </Text>
      </View>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Asset classification standards
      </Text>
      <Text style={baseStyles.p}>
        Components are classified per Chapter 6, Section C of the Audit Techniques Guide. The
        distinction between residual Section 1250 real property and 5-year personal property under
        Section 1245 is determined through tests derived from tax law and landmark court cases:
      </Text>
      <View style={{ gap: 4, marginBottom: 8 }}>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Whiteco factors (permanence test):</Text>{" "}
          movability, design intent, circumstances of removal, effort of removal, potential for
          damage, and manner of affixation.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>HCA v. Commissioner tests:</Text> the
          sole-justification test (accessories to a specific business function) and the
          primary-vs-secondary systems test.
        </Text>
        <Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Dedicated vs. necessary:</Text> necessary
          &amp; ordinary components (foundation, roof, load-bearing walls) are residual real
          property; dedicated, decorative, or removable components (wall coverings, specialty
          fixtures, landscaping) are typically 5- or 15-year.
        </Text>
      </View>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Quality assurance and audit defense
      </Text>
      <Text style={baseStyles.p}>
        Comprehensive documentation ensures audit defensibility per Chapter 4, Section D of the ATG:
        cost support (detailed estimates, comparable justifications, adjustment worksheets),
        physical evidence (photographs, inspection reports, condition assessments), and organized
        audit files (verified calculations, expert qualifications, regulatory compliance).
      </Text>

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Limitations and assumptions
      </Text>
      <Text style={baseStyles.p}>
        Methodological limitations include dependence on current cost data, inherent subjectivity in
        condition and obsolescence evaluations, market variability, and evolving IRS
        interpretations. Key assumptions: cost-data sources are accurate and current, market
        conditions remain stable, asset classifications align with IRS interpretations, and
        depreciation periods are correctly applied.
      </Text>
      <Text style={baseStyles.p}>
        This study uses software-generated cost comps and condition multipliers. For filings, the
        Engineer-Reviewed tier adds review and signature by a US-licensed Professional Engineer and
        a completed 13-element ATG compliance checklist.
      </Text>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Appendix B: Detailed Asset Schedule (per-line-item entries)
// -----------------------------------------------------------------------------

function AppendixBContent(props: AiReportProps) {
  // Render line items in chunks, each on its own <Page>. This bounds
  // how much content any single Page must paginate, avoiding the
  // @react-pdf layout pathology where a Page's accumulated children
  // overflow into clipBorderTop with -1.9e+21 once the total height
  // crosses several pages' worth. Chunk size chosen so a realistic v2
  // card (~200-400pt tall) lets 4-6 cards fit per printable page and
  // the chunk fits within a handful of page breaks.
  const PAGE_CHUNK = 10;
  const chunks: (typeof props.schedule.lineItems)[] = [];
  for (let i = 0; i < props.schedule.lineItems.length; i += PAGE_CHUNK) {
    chunks.push(props.schedule.lineItems.slice(i, i + PAGE_CHUNK));
  }

  return (
    <>
      {chunks.map((chunk, chunkIdx) => (
        <Page key={chunkIdx} size="LETTER" style={baseStyles.page} wrap>
          {chunkIdx === 0 ? (
            <>
              <Text style={baseStyles.eyebrow}>Appendix B</Text>
              <Text style={baseStyles.h2} minPresenceAhead={72}>
                Detailed Asset Schedule
              </Text>
              <Text style={baseStyles.lead}>
                Complete listing of all classified assets with quantity, unit cost, rationale, and
                adjustments. Sorted by depreciation class.
              </Text>
            </>
          ) : (
            <Text style={baseStyles.eyebrow}>
              Appendix B (continued · {chunkIdx + 1} of {chunks.length})
            </Text>
          )}

          {chunk.map((li, idx) => (
            <AssetDetailCard
              key={`${li.category}-${li.name}-${chunkIdx}-${idx}`}
              item={li}
              decomposition={props.decomposition}
            />
          ))}

          <PageFooter studyId={props.studyId} />
        </Page>
      ))}
    </>
  );
}

function AssetDetailCard({
  item,
  decomposition,
}: {
  item: AiReportProps["schedule"]["lineItems"][number];
  decomposition: AiReportProps["decomposition"];
}) {
  const classLabel =
    DEPRECIATION_CLASS_LABEL[item.category as DepreciationClassKey] ?? item.category;
  const pctOfBuilding =
    item.percentOfBuilding ??
    (decomposition.buildingValueCents > 0
      ? item.amountCents / decomposition.buildingValueCents
      : 0);
  const hasAdjustments =
    item.quantity !== undefined ||
    item.unitCostCents !== undefined ||
    item.physicalMultiplier !== undefined ||
    item.functionalMultiplier !== undefined ||
    item.timeMultiplier !== undefined ||
    item.locationMultiplier !== undefined;
  // v2 Phase 5: the richer layout switches on when paragraph-level v2
  // justification data is present. Chip-only v1 outputs still render
  // the original compact card.
  const hasV2Detail =
    Boolean(item.photoDataUri) ||
    Boolean(item.physicalJustification) ||
    Boolean(item.functionalJustification) ||
    Boolean(item.timeBasis) ||
    Boolean(item.locationBasis) ||
    Boolean(item.comparableDescription);

  // Flat layout: every piece of v2 detail is rendered as a direct <Text>
  // child of the outer View. Earlier iterations used nested <View>
  // section wrappers (borders then backgroundColor then plain) — all
  // of them triggered @react-pdf's clipBorderTop crash
  // ("unsupported number: -1.9e+21") when cumulative card content
  // exceeded a page and the layout engine mis-clipped the subtree at
  // the page boundary. A flat sequence of siblings renders clean across
  // page breaks in the local repro
  // (tests/unit/pdf-render.test.ts > renders a dense v2 study).
  const qty = item.quantity ?? 1;
  const unitCost = item.unitCostCents ?? 0;
  const baseCostCents = qty * unitCost;
  const adjChips: string[] = [];
  if (item.quantity !== undefined) {
    adjChips.push(`Qty ${item.unit ? `${item.quantity} ${item.unit}` : item.quantity}`);
  }
  if (item.unitCostCents !== undefined)
    adjChips.push(`Unit ${fmtCentsPrecise(item.unitCostCents)}`);
  if (item.costSource) adjChips.push(`Src ${item.costSource}`);
  if (item.physicalMultiplier !== undefined)
    adjChips.push(`Phys ${item.physicalMultiplier.toFixed(4)}`);
  if (item.functionalMultiplier !== undefined)
    adjChips.push(`Fn ${item.functionalMultiplier.toFixed(4)}`);
  if (item.timeMultiplier !== undefined) adjChips.push(`Time ${item.timeMultiplier.toFixed(4)}`);
  if (item.locationMultiplier !== undefined)
    adjChips.push(`Loc ${item.locationMultiplier.toFixed(4)}`);

  // Return a flat fragment of Text siblings so there's NO wrapping
  // container. The parent <Page> paginates these siblings directly,
  // which avoids the clipBorderTop pathology that any <View> wrapper
  // triggers once its cumulative content height exceeds a single page.
  return (
    <>
      <Text style={{ marginTop: 10, fontSize: 11, fontFamily: "Helvetica-Bold" }}>
        {classLabel}
        {item.isResidual ? " — Residual" : ""} · {item.name}
      </Text>
      <Text style={{ fontSize: 10, color: pdfColors.subtle }}>
        {fmtCents(item.amountCents)} · {fmtPct(pctOfBuilding, 2)} of basis
      </Text>
      {item.photoDataUri ? (
        /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> has no alt prop; PDF is not an a11y tree. */
        <Image src={item.photoDataUri} style={{ width: 180, height: 135, marginTop: 4 }} />
      ) : null}
      <Text style={{ marginTop: 4, fontSize: 9 }}>Justification: {item.rationale}</Text>
      {hasV2Detail && item.comparableDescription ? (
        <Text style={{ marginTop: 3, fontSize: 9 }}>
          Cost estimate: {item.comparableDescription}
        </Text>
      ) : null}
      {hasV2Detail && item.physicalJustification ? (
        <Text style={{ marginTop: 3, fontSize: 9 }}>Physical: {item.physicalJustification}</Text>
      ) : null}
      {hasV2Detail && item.functionalJustification ? (
        <Text style={{ marginTop: 3, fontSize: 9 }}>
          Functional: {item.functionalJustification}
        </Text>
      ) : null}
      {hasV2Detail && item.timeBasis ? (
        <Text style={{ marginTop: 3, fontSize: 9 }}>Time: {item.timeBasis}</Text>
      ) : null}
      {hasV2Detail && item.locationBasis ? (
        <Text style={{ marginTop: 3, fontSize: 9 }}>Location: {item.locationBasis}</Text>
      ) : null}
    </>
  );
}

// -----------------------------------------------------------------------------
// Appendix C: Reference Documentation
// -----------------------------------------------------------------------------

function AppendixCContent(props: AiReportProps) {
  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <Text style={baseStyles.eyebrow}>Appendix C</Text>
      <Text style={baseStyles.h2} minPresenceAhead={72}>
        Reference Documentation
      </Text>
      <Text style={baseStyles.lead}>
        Supporting source materials used to produce this study. Encrypted originals are accessible
        from your {BRAND.name} dashboard at{" "}
        <Text style={{ fontFamily: "Courier" }}>
          {BRAND.email.domain}/studies/{props.studyId.slice(0, 8)}
        </Text>
        .
      </Text>

      <View style={{ gap: 10, marginTop: 10 }}>
        <ReferenceCard
          title="Closing disclosure / HUD-1 / ALTA settlement"
          description="The recorded purchase price, title charges, and any capitalized closing costs used to build the cost basis."
        />
        <ReferenceCard
          title="Improvement receipts"
          description="Any capital expenditures since acquisition — used to bolster the detailed asset schedule beyond a plain residual allocation."
        />
        <ReferenceCard
          title="Property photos"
          description="Interior and exterior photographs supporting condition assessments for the physical-depreciation multipliers in Appendix B."
        />
        <ReferenceCard
          title="Public assessor record / aerial"
          description="Assessor-ratio allocation used to separate land from improvements, cross-checked against public map data."
        />
      </View>

      <View style={baseStyles.panelBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
          Engineer-Reviewed tier
        </Text>
        <Text>
          For audit-defensible filing, upgrade to the Engineer-Reviewed tier. A US-licensed
          Professional Engineer will review every classification decision, complete the 13-element
          ATG compliance checklist, and sign the report — without re-uploading any documents.
        </Text>
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function ReferenceCard({ title, description }: { title: string; description: string }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: pdfColors.hairline,
        borderRadius: 4,
        padding: 10,
      }}
      wrap={false}
    >
      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{title}</Text>
      <Text style={{ fontSize: 9, color: pdfColors.subtle, marginTop: 4 }}>{description}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Appendix D: Expenditure Classification Schedule
// -----------------------------------------------------------------------------

function AppendixDContent(props: AiReportProps) {
  const sorted = [...props.schedule.lineItems].sort((a, b) => b.amountCents - a.amountCents);

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <Text style={baseStyles.eyebrow}>Appendix D</Text>
      <Text style={baseStyles.h2} minPresenceAhead={72}>
        Expenditure Classification Schedule
      </Text>
      <Text style={baseStyles.lead}>
        Every classified expenditure sorted by cost, with its MACRS class assignment. This is the
        spreadsheet your CPA will likely want for direct import into depreciation software.
      </Text>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Description",
            flex: 3.5,
            render: (r: (typeof sorted)[number]) => r.name,
          },
          {
            key: "cost",
            header: "Total cost",
            flex: 1.2,
            align: "right",
            render: (r) => fmtCents(r.amountCents),
            boldInFooter: true,
          },
          {
            key: "class",
            header: "Classification",
            flex: 1.2,
            align: "right",
            render: (r) =>
              DEPRECIATION_CLASS_LABEL[r.category as DepreciationClassKey] ?? r.category,
          },
        ]}
        rows={sorted}
        footer={{
          name: "Total depreciable basis",
          cost: fmtCents(props.decomposition.buildingValueCents),
          class: "",
        }}
      />

      <Text style={[baseStyles.muted, { marginTop: 10 }]}>
        Rounding: line-item amounts are rounded to whole dollars; totals reconcile to the
        depreciable basis shown on the summary page.
      </Text>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

// -----------------------------------------------------------------------------
// Appendix E: CPA Filing Worksheet — §481(a) adjustment + Form 4562 pre-fills
// -----------------------------------------------------------------------------

function AppendixEContent(
  props: AiReportProps & {
    worksheet: Form3115Worksheet;
    taxYear: number;
    placedInServiceIso: string;
  },
) {
  const { worksheet, taxYear, placedInServiceIso } = props;

  return (
    <Page size="LETTER" style={baseStyles.page} wrap>
      <Text style={baseStyles.eyebrow}>Appendix E</Text>
      <Text style={baseStyles.h2} minPresenceAhead={72}>
        CPA Filing Worksheet
      </Text>
      <Text style={baseStyles.lead}>
        Decision support for the tax filing that applies this cost segregation study. This is{" "}
        <Text style={{ fontFamily: "Helvetica-Bold" }}>not</Text> a substitute for Form 3115 or Form
        4562 — it is the numerical work a CPA would otherwise have to reconstruct from scratch. The
        taxpayer&rsquo;s preparer must independently verify every figure against their own records
        before filing.
      </Text>

      <View
        style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 6,
          backgroundColor: pdfColors.primarySoft,
          borderColor: pdfColors.primarySoftBorder,
          borderWidth: 1,
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontFamily: "Helvetica-Bold",
            letterSpacing: 1.4,
            color: pdfColors.primaryInk,
            textTransform: "uppercase",
          }}
        >
          Recommended filing
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontFamily: "Helvetica-Bold",
            letterSpacing: -0.4,
            marginTop: 6,
            color: pdfColors.primaryInk,
          }}
        >
          {worksheet.recommendedForm}
          {worksheet.designatedChangeNumber ? ` · DCN ${worksheet.designatedChangeNumber}` : ""}
        </Text>
        <Text
          style={{ fontSize: 10, color: pdfColors.primaryInk, marginTop: 10, lineHeight: 1.55 }}
        >
          {worksheet.summaryParagraph}
        </Text>
      </View>

      <SectionHeader title="Key numbers" />
      <KeyValueGrid
        columns={2}
        entries={[
          { k: "Year of change", v: String(taxYear) },
          { k: "Placed in service", v: fmtDate(placedInServiceIso) },
          {
            k: "Prior-year old method (SL)",
            v: fmtCents(worksheet.priorYearTotals.oldMethodCents),
          },
          {
            k: "Prior-year new method (cost seg)",
            v: fmtCents(worksheet.priorYearTotals.newMethodCents),
          },
          {
            k: "§481(a) catch-up adjustment",
            v: fmtCents(worksheet.section481AdjustmentCents),
          },
          {
            k: `${taxYear} depreciation (new method)`,
            v: fmtCents(worksheet.yearOfChangeDepreciationCents),
          },
        ]}
      />

      {worksheet.form3115Applies ? (
        <>
          <SectionHeader title="Prior-year method-change analysis" />
          <Text style={baseStyles.muted}>
            Year-by-year depreciation under both methods. The §481(a) adjustment is the sum of the
            Delta column — the cumulative catch-up deduction the taxpayer claims in {taxYear}.
          </Text>
          <DataTable
            columns={[
              {
                key: "year",
                header: "Year",
                flex: 1,
                render: (r: Form3115Worksheet["priorYearBreakdown"][number]) => String(r.year),
              },
              {
                key: "old",
                header: "Old method (SL)",
                flex: 1.5,
                align: "right",
                render: (r) => fmtCents(r.oldMethodCents),
                boldInFooter: true,
              },
              {
                key: "new",
                header: "New method (cost seg)",
                flex: 1.5,
                align: "right",
                render: (r) => fmtCents(r.newMethodCents),
                boldInFooter: true,
              },
              {
                key: "delta",
                header: "Δ (new − old)",
                flex: 1.5,
                align: "right",
                render: (r) => fmtCents(r.deltaCents),
                boldInFooter: true,
              },
            ]}
            rows={worksheet.priorYearBreakdown}
            footer={{
              year: "Total",
              old: fmtCents(worksheet.priorYearTotals.oldMethodCents),
              new: fmtCents(worksheet.priorYearTotals.newMethodCents),
              delta: fmtCents(worksheet.section481AdjustmentCents),
            }}
          />
        </>
      ) : (
        <>
          <SectionHeader title="Year-of-acquisition filing" />
          <Text style={baseStyles.p}>
            The study is applied in the same tax year the property was placed in service, so there
            is no prior-method depreciation to adjust. The CPA claims the accelerated MACRS classes
            directly on Form 4562 without a §481(a) catch-up.
          </Text>
        </>
      )}

      <SectionHeader title="Per-class depreciation input for Form 4562" />
      <DataTable
        columns={[
          {
            key: "label",
            header: "Asset class",
            flex: 2.5,
            render: (r: Form3115Worksheet["classSummary"][number]) => r.label,
          },
          {
            key: "basis",
            header: "Basis",
            flex: 1.2,
            align: "right",
            render: (r) => fmtCents(r.basisCents),
            boldInFooter: true,
          },
          {
            key: "recovery",
            header: "Recovery",
            flex: 1,
            align: "right",
            render: (r) => r.recoveryPeriod,
          },
          {
            key: "convention",
            header: "Convention",
            flex: 1.1,
            align: "right",
            render: (r) => r.convention,
          },
          { key: "method", header: "Method", flex: 1.5, align: "right", render: (r) => r.method },
        ]}
        rows={worksheet.classSummary}
      />

      <View style={[baseStyles.hr, { marginTop: 20 }]} />

      <Text style={baseStyles.h3} minPresenceAhead={60}>
        Procedural checklist for the filing CPA
      </Text>
      <View style={{ gap: 5 }}>
        <Form3115Checkbox
          label={`Confirm the year of change (${taxYear}) matches the taxpayer's tax year on the return.`}
        />
        <Form3115Checkbox
          label={
            worksheet.form3115Applies
              ? `File Form 3115 with DCN ${worksheet.designatedChangeNumber} under Rev. Proc. 2015-13 (automatic consent). Attach one copy to the return and mail the duplicate to the IRS Ogden or Covington address per the current instructions.`
              : "File Form 4562 with the accelerated classes shown above. Skip Form 3115 — no prior-method adjustment applies."
          }
        />
        <Form3115Checkbox label="Verify the taxpayer's identifying information (EIN/SSN, legal name, address, filing status) before submitting." />
        <Form3115Checkbox
          label={`Recalculate bonus depreciation eligibility against the taxpayer's actual acquisition date (we used ${fmtDate(
            placedInServiceIso,
          )}).`}
        />
        <Form3115Checkbox label="Confirm the real-property classification (27.5-year residential vs 39-year nonresidential) matches the taxpayer's facts." />
        <Form3115Checkbox label="Retain this study, the asset schedule, and source documentation for the life of the depreciation schedule." />
      </View>

      <View style={baseStyles.disclosureBox}>
        <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
          Decision-support only.
        </Text>
        <Text>
          This worksheet is computed from the cost-seg study inputs. It is not tax advice; in the
          Tier-1 tier it is not reviewed by a CPA or EA. A credentialed preparer must independently
          verify every figure, confirm the taxpayer&rsquo;s facts, and apply professional judgment
          before filing.
        </Text>
      </View>

      <PageFooter studyId={props.studyId} />
    </Page>
  );
}

function Form3115Checkbox({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <View
        style={{
          width: 10,
          height: 10,
          marginTop: 2,
          borderColor: pdfColors.softBorder,
          borderWidth: 1,
          borderRadius: 2,
        }}
      />
      <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.5 }}>{label}</Text>
    </View>
  );
}
