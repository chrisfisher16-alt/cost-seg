import "server-only";

import * as XLSX from "xlsx";

/**
 * Convert an xlsx / xls buffer into a compact Markdown rendering the
 * AI pipeline can consume via a text attachment.
 *
 * Design choices:
 *   • Markdown tables — Claude's tool-use classifier already reads
 *     them well and they preserve per-cell alignment better than CSV
 *     when a column title has commas.
 *   • One section per sheet, with the sheet name as a heading. The
 *     improvement-receipts spreadsheet frequently has multiple tabs
 *     (e.g. "Improvements" + "Furnishings") and we don't want to
 *     silently drop any.
 *   • Trim empty trailing rows + columns so the model doesn't waste
 *     tokens on a sea of blank cells (common for hand-authored
 *     templates).
 *   • Cap at a generous upper bound to avoid pathological 100k-row
 *     sheets blowing the context. Real improvement ledgers are
 *     10–300 rows; 5,000 is a safe ceiling.
 */

export const SPREADSHEET_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
] as const;

export function isSpreadsheetMime(mime: string): boolean {
  return (SPREADSHEET_MIMES as readonly string[]).includes(mime);
}

const MAX_ROWS_PER_SHEET = 5_000;
const MAX_COLS_PER_SHEET = 64;

export interface SpreadsheetToTextOptions {
  title?: string;
  maxRowsPerSheet?: number;
  maxColsPerSheet?: number;
}

export function spreadsheetBytesToText(
  buffer: Buffer,
  options: SpreadsheetToTextOptions = {},
): string {
  const maxRows = options.maxRowsPerSheet ?? MAX_ROWS_PER_SHEET;
  const maxCols = options.maxColsPerSheet ?? MAX_COLS_PER_SHEET;

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  if (options.title) {
    parts.push(`# Spreadsheet: ${options.title}`, "");
  }

  let sheetsEmitted = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Defaults to returning arrays-of-arrays, blank: empty string.
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    });
    if (rows.length === 0) continue;

    const trimmed = trimEmptyEdges(rows, maxRows, maxCols);
    if (trimmed.length === 0) continue;

    parts.push(`## Sheet: ${sheetName}`, "");
    parts.push(renderMarkdownTable(trimmed));
    parts.push("");
    sheetsEmitted += 1;
  }

  if (sheetsEmitted === 0) {
    // Defensive — the model handles "empty spreadsheet" gracefully
    // rather than failing the whole Step A call.
    return options.title
      ? `# Spreadsheet: ${options.title}\n\n(No sheets with data.)`
      : "(Empty spreadsheet.)";
  }
  return parts.join("\n");
}

function trimEmptyEdges(
  rows: Array<Array<string | number | boolean | Date | null>>,
  maxRows: number,
  maxCols: number,
): Array<Array<string>> {
  // Find the last non-empty column across all rows so we don't carry a
  // tail of empty columns from merged-cell templates.
  let lastColUsed = -1;
  for (const row of rows) {
    for (let c = row.length - 1; c > lastColUsed; c -= 1) {
      if (cellToString(row[c]) !== "") {
        lastColUsed = c;
        break;
      }
    }
  }
  if (lastColUsed === -1) return [];

  const colCap = Math.min(lastColUsed + 1, maxCols);
  const rowCap = Math.min(rows.length, maxRows);
  const out: string[][] = [];
  for (let r = 0; r < rowCap; r += 1) {
    const row = rows[r] ?? [];
    const cells: string[] = [];
    let hasContent = false;
    for (let c = 0; c < colCap; c += 1) {
      const s = cellToString(row[c] ?? "");
      if (s !== "") hasContent = true;
      cells.push(s);
    }
    if (hasContent) out.push(cells);
  }
  return out;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    // ISO date-only for day-granularity receipt entries; ISO timestamp
    // otherwise (rare in improvement ledgers).
    const hhmmss = v.toISOString().slice(11, 19);
    return hhmmss === "00:00:00" ? v.toISOString().slice(0, 10) : v.toISOString();
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v).replace(/\|/g, "\\|").trim();
  return s;
}

function renderMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widthByCol: number[] = [];
  for (const row of rows) {
    for (let c = 0; c < row.length; c += 1) {
      widthByCol[c] = Math.max(widthByCol[c] ?? 0, row[c]?.length ?? 0);
    }
  }
  const header = rows[0]!;
  const pad = (s: string, c: number): string => {
    const w = widthByCol[c] ?? 0;
    return s.padEnd(w, " ");
  };
  const headerLine = `| ${header.map((h, c) => pad(h, c)).join(" | ")} |`;
  const sepLine = `| ${widthByCol.map((w) => "-".repeat(Math.max(w, 3))).join(" | ")} |`;
  const bodyLines = rows
    .slice(1)
    .map((row) => `| ${widthByCol.map((_, c) => pad(row[c] ?? "", c)).join(" | ")} |`);
  return [headerLine, sepLine, ...bodyLines].join("\n");
}
