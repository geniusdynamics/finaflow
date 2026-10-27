// ABOUTME: Builds one report sheet per consolidated analysis section and exports Excel or a CSV bundle.
// ABOUTME: Amounts are written as numbers to keep the workbook useful for further analysis.

import type { ConsolidatedAnalysis } from "@shared/statements/consolidate";
import { groupContacts } from "@shared/statements/group";

export interface AnalysisSheet {
  name: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

function amount(value: string): number {
  return Number(value.replace(/,/g, "")) || 0;
}

function period(start: string | null, end: string | null): string {
  return `${start ?? "?"} to ${end ?? "?"}`;
}

export function buildAnalysisSheets(consolidated: ConsolidatedAnalysis): AnalysisSheet[] {
  const { analysis, files } = consolidated;
  const groupedIn = groupContacts(analysis.moneyIn.bySource);
  const groupedOut = groupContacts(analysis.moneyOut.byDestination);

  const sheets: AnalysisSheet[] = [
    {
      name: "Summary",
      columns: ["Measure", "Value"],
      rows: [
        ["Statements", consolidated.fileCount],
        ["Transactions in consolidated view", analysis.summary.rowCount],
        ["Rows across uploaded files", consolidated.totalRowCount],
        ["Cross-file duplicate rows skipped", consolidated.duplicateRows],
        ["Period", period(consolidated.periodStart, consolidated.periodEnd)],
        ["Banks", consolidated.banks.join(", ") || "Bank"],
        ["Total money in", amount(analysis.summary.totalIn)],
        ["Total money out", amount(analysis.summary.totalOut)],
        ["Fees & charges", amount(analysis.summary.totalFees)],
        ["Net cash flow", amount(analysis.summary.net)],
        ["Average daily in", amount(analysis.summary.avgDailyIn)],
        ["Average daily out", amount(analysis.summary.avgDailyOut)],
        ["Transactions per day", analysis.summary.avgTransactionsPerDay],
        ["Highest single in", amount(analysis.summary.highestSingleIn)],
        ["Highest single out", amount(analysis.summary.highestSingleOut)],
        ["Most active day", analysis.summary.mostActiveDay ? `${analysis.summary.mostActiveDay.date} (${analysis.summary.mostActiveDay.count})` : "—"],
        ["Busiest weekday", analysis.summary.busiestWeekday ? `${analysis.summary.busiestWeekday.day} (${analysis.summary.busiestWeekday.count})` : "—"],
      ],
    },
    {
      name: "Coverage",
      columns: ["File", "Bank", "Account", "Period", "Rows", "In", "Out", "Fees", "Net", "Reconciled", "Balance gaps"],
      rows: files.map((file) => [
        file.fileName,
        file.bankName ?? "",
        [file.accountNumber, file.accountName].filter(Boolean).join(" · "),
        period(file.periodStart, file.periodEnd),
        file.rowCount,
        amount(file.totalIn),
        amount(file.totalOut),
        amount(file.totalFees),
        amount(file.net),
        file.reconciliation.matches ? "Yes" : "No",
        file.balance.continuity.unexplained,
      ]),
    },
    {
      name: "Monthly",
      columns: ["Month", "Transactions", "In", "Out", "Net"],
      rows: analysis.breakdown.monthly.map((row) => [row.label, row.count, amount(row.totalIn), amount(row.totalOut), amount(row.net)]),
    },
    {
      name: "Money In - Exact",
      columns: ["Party", "Transactions", "Total", "Average"],
      rows: analysis.moneyIn.bySource.map((row) => [row.name, row.count, amount(row.total), amount(row.average)]),
    },
    {
      name: "Money In - Grouped",
      columns: ["Party", "Variants", "Transactions", "Total", "Average"],
      rows: groupedIn.map((row) => [row.name, row.members, row.count, amount(row.total), amount(row.average)]),
    },
    {
      name: "Money Out - Exact",
      columns: ["Party", "Transactions", "Total", "Average"],
      rows: analysis.moneyOut.byDestination.map((row) => [row.name, row.count, amount(row.total), amount(row.average)]),
    },
    {
      name: "Money Out - Grouped",
      columns: ["Party", "Variants", "Transactions", "Total", "Average"],
      rows: groupedOut.map((row) => [row.name, row.members, row.count, amount(row.total), amount(row.average)]),
    },
    {
      name: "Channels",
      columns: ["Channel", "Transactions", "Amount", "Share %"],
      rows: (analysis.moneyIn.byChannel ?? []).map((row) => [row.label, row.count, amount(row.total), row.share]),
    },
    {
      name: "Categories",
      columns: ["Category", "Transactions", "In", "Out", "Share of spend %"],
      rows: analysis.categories.map((row) => [row.name, row.count, amount(row.totalIn), amount(row.totalOut), row.shareOfOut]),
    },
    {
      name: "Fees",
      columns: ["Fee type", "Count", "Total"],
      rows: analysis.fees.byType.map((row) => [row.type, row.count, amount(row.total)]),
    },
    {
      name: "Fee Recipients",
      columns: ["Recipient", "Count", "Total", "Average"],
      rows: analysis.fees.topRecipients.map((row) => [row.name, row.count, amount(row.total), amount(row.average)]),
    },
    {
      name: "Recurring",
      columns: ["Description", "Type", "Frequency", "Occurrences", "Average", "Total", "Last date", "Next expected"],
      rows: analysis.recurring.map((row) => [
        row.description,
        row.type,
        row.frequency,
        row.occurrences,
        amount(row.averageAmount),
        amount(row.totalAmount),
        row.lastDate,
        row.nextExpected ?? "",
      ]),
    },
    {
      name: "Paybills & Tills",
      columns: ["Type", "Number", "Name", "Count", "Total", "Fees", "Account"],
      rows: analysis.payBillsTills.shortcodes.map((row) => [
        row.type,
        row.number ?? "",
        row.name ?? "",
        row.count,
        amount(row.total),
        amount(row.fees),
        row.accountReference ?? "",
      ]),
    },
    {
      name: "Review",
      columns: ["Check", "Value"],
      rows: [
        ["Uncategorised spend rows", analysis.anomalies.uncategorisedSpend.count],
        ["Uncategorised spend total", amount(analysis.anomalies.uncategorisedSpend.total)],
        ["Large transactions", analysis.anomalies.large.length],
        ["Out of hours", analysis.anomalies.outOfHours.length],
        ["Duplicate candidates", analysis.anomalies.duplicates.length],
        ["Balance samples to review", files.reduce((sum, file) => sum + file.balance.continuity.unexplained, 0)],
        ["Reversals", analysis.reversals.length],
        ["Cross-file duplicate rows skipped", consolidated.duplicateRows],
      ],
    },
  ];

  return sheets.filter((sheet) => sheet.rows.length > 0);
}

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
