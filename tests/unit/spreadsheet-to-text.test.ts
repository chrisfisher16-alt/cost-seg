import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  SPREADSHEET_MIMES,
  isSpreadsheetMime,
  spreadsheetBytesToText,
} from "@/lib/ocr/spreadsheet-to-text";

/**
 * Produce a small xlsx Buffer in-memory by writing an AOA (array of
 * arrays) workbook and asking SheetJS to serialize it. Lets us exercise
 * the full parse → trim → render path without checking a fixture binary
 * into the repo.
 */
function mkWorkbookBuffer(sheets: Record<string, Array<Array<string | number | null>>>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf as ArrayBuffer);
}

describe("isSpreadsheetMime / SPREADSHEET_MIMES", () => {
  it("matches xlsx + xls mime strings the upload validator already accepts", () => {
    expect(SPREADSHEET_MIMES).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(SPREADSHEET_MIMES).toContain("application/vnd.ms-excel");
  });

  it("returns false for PDFs and images", () => {
    expect(isSpreadsheetMime("application/pdf")).toBe(false);
    expect(isSpreadsheetMime("image/jpeg")).toBe(false);
    expect(isSpreadsheetMime("application/octet-stream")).toBe(false);
  });
});

describe("spreadsheetBytesToText", () => {
  it("renders a simple single-sheet workbook as a markdown table with header + separator", () => {
    const buf = mkWorkbookBuffer({
      Improvements: [
        ["Description", "Amount", "Date"],
        ["HVAC replacement", 12500, "2024-03-01"],
        ["New dishwasher", 850, "2024-05-14"],
      ],
    });
    const text = spreadsheetBytesToText(buf, { title: "receipts.xlsx" });
    expect(text).toMatch(/# Spreadsheet: receipts\.xlsx/);
    expect(text).toMatch(/## Sheet: Improvements/);
    expect(text).toMatch(/\| Description\s+\| Amount\s+\| Date\s+\|/);
    expect(text).toMatch(/\| -+\s+\| -+\s+\| -+\s+\|/);
    expect(text).toContain("HVAC replacement");
    expect(text).toContain("12500");
    expect(text).toContain("850");
  });

  it("renders multiple sheets each under its own heading", () => {
    const buf = mkWorkbookBuffer({
      Improvements: [
        ["Description", "Amount"],
        ["HVAC", 12500],
      ],
      Furnishings: [
        ["Item", "Qty", "Cost"],
        ["Sofa", 1, 1200],
      ],
    });
    const text = spreadsheetBytesToText(buf);
    expect(text).toMatch(/## Sheet: Improvements/);
    expect(text).toMatch(/## Sheet: Furnishings/);
    // Furnishings header should come after Improvements header (sheet order preserved)
    expect(text.indexOf("## Sheet: Improvements")).toBeLessThan(
      text.indexOf("## Sheet: Furnishings"),
    );
  });

  it("drops trailing empty columns from templates with extra blank cells", () => {
    const buf = mkWorkbookBuffer({
      Sheet1: [
        ["Description", "Amount", "", "", ""],
        ["HVAC", 12500, "", "", ""],
        ["Paint", 600, "", "", ""],
      ],
    });
    const text = spreadsheetBytesToText(buf);
    // The header row should only show two columns, not five.
    const headerLine = text.split("\n").find((l) => l.startsWith("| Description"));
    expect(headerLine).toBeDefined();
    // Count pipe separators — a two-column table has exactly 3 pipes.
    expect((headerLine!.match(/\|/g) ?? []).length).toBe(3);
  });

  it("returns a fallback string for a workbook with no data", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer);
    const text = spreadsheetBytesToText(buf, { title: "blank.xlsx" });
    expect(text).toMatch(/No sheets with data/);
  });

  it("caps rows at the configured limit so pathological inputs can't blow context", () => {
    const rows: Array<Array<string | number>> = [["Description", "Amount"]];
    for (let i = 0; i < 50; i += 1) rows.push([`Item ${i}`, i * 100]);
    const buf = mkWorkbookBuffer({ Sheet1: rows });
    const text = spreadsheetBytesToText(buf, { maxRowsPerSheet: 10 });
    // header + separator + 8 body rows (first 9 including header, capped at 10 total rows)
    const bodyRows = text.split("\n").filter((l) => l.startsWith("| Item "));
    expect(bodyRows.length).toBeLessThanOrEqual(10);
  });

  it("escapes pipe characters so they don't break the markdown table", () => {
    const buf = mkWorkbookBuffer({
      Sheet1: [
        ["Description", "Amount"],
        ["Kitchen | bath remodel", 50000],
      ],
    });
    const text = spreadsheetBytesToText(buf);
    expect(text).toMatch(/Kitchen \\\| bath remodel/);
  });
});
