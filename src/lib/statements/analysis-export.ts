// ABOUTME: Browser download adapters for the shared consolidated analysis report sheets.
// ABOUTME: Excel uses one worksheet per report; the CSV option bundles one CSV per report in a ZIP.

import type { ConsolidatedAnalysis } from "@shared/statements/consolidate";
import { buildAnalysisSheets, type AnalysisSheet } from "@shared/statements/analysis-sheets";

export { buildAnalysisSheets, type AnalysisSheet };

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sheetToCsv(sheet: AnalysisSheet): string {
  return `\uFEFF${[sheet.columns, ...sheet.rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function saveConsolidatedXlsx(consolidated: ConsolidatedAnalysis): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FinaFlow";
  workbook.created = new Date();
  for (const sheet of buildAnalysisSheets(consolidated)) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    worksheet.addRow(sheet.columns);
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC73E1D" } };
    worksheet.getRow(1).alignment = { vertical: "middle" };
    for (const row of sheet.rows) worksheet.addRow(row);
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    worksheet.columns.forEach((column, index) => {
      const values = [sheet.columns[index], ...sheet.rows.map((row) => String(row[index] ?? ""))];
      column.width = Math.min(48, Math.max(12, ...values.map((value) => value.length + 2)));
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `bank-consolidated-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export async function saveConsolidatedCsvBundle(consolidated: ConsolidatedAnalysis): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const sheet of buildAnalysisSheets(consolidated)) {
    zip.file(`${slug(sheet.name)}.csv`, sheetToCsv(sheet));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, `bank-consolidated-analysis-${new Date().toISOString().slice(0, 10)}-csv.zip`);
}
