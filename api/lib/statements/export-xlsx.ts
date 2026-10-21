// ABOUTME: Server-side XLSX workbook builder for statement exports (transactions plus analysis sheets).
// ABOUTME: Mirrors the published sheet set; every number is written as a number so Excel can sum it.

import ExcelJS from "exceljs";
import type { StatementAnalysis } from "@shared/statements/analyze";
import type { ExportTransaction } from "@shared/statements/export/csv";

export interface StatementWorkbookInput {
  fileName?: string | null;
  provider: string;
  kind: string;
  currency: string;
  rows: ExportTransaction[];
  analysis: StatementAnalysis;
  /** Sheet names to include; omitted means all. Main Transactions is always included. */
  sheets?: string[];
}

type Row = Array<string | number | null | undefined>;

function styleHeader(worksheet: ExcelJS.Worksheet, headers: string[], widths: number[]): void {
  worksheet.columns = headers.map((header, index) => ({
    header,
    key: `c${index}`,
    width: widths[index] ?? 18,
  }));
  const row = worksheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC73E1D" } };
  row.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

function addRows(worksheet: ExcelJS.Worksheet, rows: Row[], moneyColumns: number[] = []): void {
  for (const values of rows) worksheet.addRow(values);
  for (const column of moneyColumns) worksheet.getColumn(column + 1).numFmt = "#,##0.00";
}

function moneyRow(label: string, value: string | number | null, currency: string): Row {
  return [`${label} (${currency})`, value === null ? "" : value];
}

function feeType(details: string): string {
  const d = details.toLowerCase();
  if (d.includes("pay bill charge")) return "Pay Bill Fee";
  if (d.includes("merchant charge")) return "Merchant Payment Fee";
  if (d.includes("withdrawal charge")) return "Withdrawal Fee";
  if (d.includes("transfer of funds charge")) return "Send Money Fee";
  if (d.includes("fuliza") || d.includes("overdraw")) return "Fuliza Fee";
  return "Other Fee";
}

export async function buildStatementWorkbook(input: StatementWorkbookInput): Promise<Buffer> {
  const { analysis, rows } = input;
  const include = (name: string) => !input.sheets || input.sheets.length === 0 || input.sheets.includes(name);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FinaFlow";
  workbook.created = new Date();

  // 1. Main Transactions (always)
  const transactions = workbook.addWorksheet("Main Transactions");
  styleHeader(
    transactions,
    ["Receipt No", "Completion Time", "Details", "Status", "Paid In", "Withdrawn", "Balance", "Category", "Direction", "Type"],
    [16, 20, 52, 12, 14, 14, 14, 22, 9, 16],
  );
  addRows(
    transactions,
    rows.map((row) => [
      row.receiptNo,
      `${row.date}${row.time ? ` ${row.time}` : ""}`,
      row.details,
      row.status,
      Number(row.paidIn || 0),
      Number(row.withdrawn || 0),
      Number(row.balance || 0),
      row.categoryName ?? "No category",
      row.direction ?? "",
      row.txnType ?? "",
    ]),
    [4, 5, 6],
  );

  // 2. Financial Summary
  if (include("summary")) {
    const sheet = workbook.addWorksheet("Financial Summary");
    styleHeader(sheet, ["Metric", "Value"], [38, 28]);
    const s = analysis.summary;
    addRows(sheet, [
      ["Period", `${analysis.period.start ?? "?"} → ${analysis.period.end ?? "?"}`],
      ["Total days", analysis.period.days],
      ["Total transactions", s.rowCount],
      moneyRow("Total money in", s.totalIn, input.currency),
      moneyRow("Total money out", s.totalOut, input.currency),
      moneyRow("Net cash flow", s.net, input.currency),
      moneyRow("Total fees", s.totalFees, input.currency),
      moneyRow("Average daily income", s.avgDailyIn, input.currency),
      moneyRow("Average daily spending", s.avgDailyOut, input.currency),
      ["Average transactions/day", s.avgTransactionsPerDay],
      moneyRow("Highest single income", s.highestSingleIn, input.currency),
      moneyRow("Highest single expense", s.highestSingleOut, input.currency),
      ["Most active day", s.mostActiveDay ? `${s.mostActiveDay.date} (${s.mostActiveDay.count})` : ""],
      ["Busiest weekday", s.busiestWeekday ? `${s.busiestWeekday.day} (${s.busiestWeekday.count})` : ""],
      ["Statement summary matches", analysis.reconciliation.matches ? "Yes" : "Review"],
    ]);
    sheet.getColumn(2).numFmt = "#,##0.00";
  }

  // 3. Money In
  if (include("money-in")) {
    const inRows = rows.filter(
      (row) => row.direction === "in" && row.txnType !== "charge" && row.rail !== "fuliza_draw",
    );
    const sheet = workbook.addWorksheet("Money In");
    styleHeader(sheet, ["Receipt No", "Completion Time", "Details", "Sender", "Amount", "Balance"], [16, 20, 48, 28, 14, 14]);
    addRows(
      sheet,
      inRows.map((row) => [
        row.receiptNo,
        `${row.date}${row.time ? ` ${row.time}` : ""}`,
        row.details,
        row.counterpartyName ?? "",
        Number(row.paidIn || 0),
        Number(row.balance || 0),
      ]),
      [4, 5],
    );
  }

  // 4. Money Out
  if (include("money-out")) {
    const outRows = rows.filter(
      (row) => row.direction === "out" && row.txnType !== "charge" && row.rail !== "fuliza_repay",
    );
    const sheet = workbook.addWorksheet("Money Out");
    styleHeader(sheet, ["Receipt No", "Completion Time", "Details", "Recipient", "Amount", "Balance"], [16, 20, 48, 28, 14, 14]);
    addRows(
      sheet,
      outRows.map((row) => [
        row.receiptNo,
        `${row.date}${row.time ? ` ${row.time}` : ""}`,
        row.details,
        row.counterpartyName ?? "",
        Number(row.withdrawn || 0),
        Number(row.balance || 0),
      ]),
      [4, 5],
    );
  }

  // 5. Charges & Fees
  if (include("charges")) {
    const charges = rows.filter((row) => row.txnType === "charge");
    const sheet = workbook.addWorksheet("Charges & Fees");
    styleHeader(sheet, ["Receipt No", "Date", "Details", "Charge", "Fee Type"], [16, 20, 52, 14, 22]);
    addRows(
      sheet,
      charges.map((row) => [
        row.receiptNo,
        `${row.date}${row.time ? ` ${row.time}` : ""}`,
        row.details,
        Number(row.withdrawn || 0),
        feeType(row.details),
      ]),
      [3],
    );
    sheet.addRow([]);
    sheet.addRow(["Total", "", "", Number(analysis.fees.total), `${analysis.fees.count} charges`]).font = { bold: true };
    sheet.addRow(["Fee as % of spend", "", "", analysis.fees.percentOfOut, "%"]);
  }

  // 6. Reversals
  if (include("reversals") && analysis.reversals.length > 0) {
    const sheet = workbook.addWorksheet("Reversals");
    styleHeader(sheet, ["Receipt", "Date", "Details", "Direction", "Amount", "Linked Receipt", "Link Method"], [16, 20, 48, 10, 14, 16, 14]);
    addRows(
      sheet,
      analysis.reversals.map((row) => [
        row.externalId,
        `${row.date}${row.time ? ` ${row.time}` : ""}`,
        row.details,
        row.direction,
        Number(row.amount),
        row.linkedExternalId ?? "",
        row.linkMethod,
      ]),
      [4],
    );
  }

  // 7. Daily Balance Tracker
  if (include("daily-balance") && analysis.dailyBalance.length > 0) {
    const sheet = workbook.addWorksheet("Daily Balance");
    styleHeader(sheet, ["Date", "End Balance", "Transactions", "Highest", "Lowest"], [14, 16, 12, 16, 16]);
    addRows(
      sheet,
      analysis.dailyBalance.map((row) => [
        row.date,
        Number(row.endBalance),
        row.count,
        Number(row.highest),
        Number(row.lowest),
      ]),
      [1, 3, 4],
    );
  }

  // 8. Monthly & Weekly Breakdown
  if (include("breakdown")) {
    const sheet = workbook.addWorksheet("Monthly & Weekly");
    styleHeader(sheet, ["Period", "Money In", "Money Out", "Net", "Avg Transaction", "Count"], [22, 16, 16, 16, 16, 10]);
    const write = (rows: typeof analysis.breakdown.monthly) => {
      for (const row of rows) {
        sheet.addRow([row.label, Number(row.totalIn), Number(row.totalOut), Number(row.net), Number(row.average), row.count]);
      }
    };
    write(analysis.breakdown.monthly);
    sheet.addRow([]);
    sheet.addRow(["WEEKLY", "", "", "", "", ""]).font = { bold: true };
    write(analysis.breakdown.weekly);
    [1, 2, 3, 4].forEach((column) => (sheet.getColumn(column + 1).numFmt = "#,##0.00"));
  }

  // 9. Amount Distribution
  if (include("distribution")) {
    const sheet = workbook.addWorksheet("Distribution");
    styleHeader(sheet, ["Range", "In Count", "In Total", "Out Count", "Out Total"], [22, 12, 16, 12, 16]);
    addRows(
      sheet,
      analysis.distribution.map((row) => [row.label, row.inCount, Number(row.inTotal), row.outCount, Number(row.outTotal)]),
      [2, 4],
    );
  }

  // 10. Top Contacts
  if (include("contacts")) {
    const sheet = workbook.addWorksheet("Top Contacts");
    styleHeader(sheet, ["Sent To", "Total", "Count", "", "Received From", "Total", "Count"], [32, 16, 9, 3, 32, 16, 9]);
    const max = Math.max(analysis.topContacts.sent.length, analysis.topContacts.received.length);
    for (let i = 0; i < max; i++) {
      const sent = analysis.topContacts.sent[i];
      const received = analysis.topContacts.received[i];
      sheet.addRow([
        sent?.name ?? "",
        sent ? Number(sent.total) : "",
        sent?.count ?? "",
        "",
        received?.name ?? "",
        received ? Number(received.total) : "",
        received?.count ?? "",
      ]);
    }
    [1, 5].forEach((column) => (sheet.getColumn(column + 1).numFmt = "#,##0.00"));
  }

  // 11. Recurring Transactions
  if (include("recurring") && analysis.recurring.length > 0) {
    const sheet = workbook.addWorksheet("Recurring");
    styleHeader(
      sheet,
      ["Description", "Type", "Frequency", "Occurrences", "Avg Amount", "Total", "Pattern", "Last", "Next Expected"],
      [40, 12, 12, 11, 14, 14, 10, 13, 14],
    );
    addRows(
      sheet,
      analysis.recurring.map((row) => [
        row.description,
        row.type,
        row.frequency,
        row.occurrences,
        Number(row.averageAmount),
        Number(row.totalAmount),
        row.amountPattern,
        row.lastDate,
        row.nextExpected ?? "",
      ]),
      [4, 5],
    );
  }

  // 12. Time of Day
  if (include("time-of-day")) {
    const sheet = workbook.addWorksheet("Time of Day");
    styleHeader(sheet, ["Period", "Transactions", "% of Total", "Money In", "Money Out", "Net"], [32, 12, 11, 16, 16, 16]);
    addRows(
      sheet,
      [...analysis.timeOfDay.periods, ...analysis.timeOfDay.hours].map((row) => [
        row.label,
        row.count,
        row.share,
        Number(row.totalIn),
        Number(row.totalOut),
        Number(row.net),
      ]),
      [3, 4, 5],
    );
  }

  // 13. Day of Week
  if (include("day-of-week")) {
    const sheet = workbook.addWorksheet("Day of Week");
    styleHeader(sheet, ["Day", "Transactions", "% of Total", "Money In", "Money Out", "Net"], [14, 12, 11, 16, 16, 16]);
    addRows(
      sheet,
      analysis.dayOfWeek.map((row) => [row.label, row.count, row.share, Number(row.totalIn), Number(row.totalOut), Number(row.net)]),
      [3, 4, 5],
    );
  }

  // 14. Pay Bills & Tills
  if (include("pay-bills-tills")) {
    const sheet = workbook.addWorksheet("Pay Bills & Tills");
    styleHeader(sheet, ["Type", "Number", "Name", "Total", "Count", "Fees", "Account"], [10, 14, 36, 16, 9, 12, 22]);
    addRows(
      sheet,
      analysis.payBillsTills.shortcodes.map((row) => [
        row.type,
        row.number ?? "",
        row.name ?? "",
        Number(row.total),
        row.count,
        Number(row.fees),
        row.accountReference ?? "",
      ]),
      [3, 5],
    );
    sheet.addRow([]);
    sheet.addRow(["PAYBILL ACCOUNT REFERENCES", "", "", "", "", "", ""]).font = { bold: true };
    sheet.addRow(["Account", "Paybill", "Count", "Total", "", "", ""]).font = { bold: true };
    for (const row of analysis.payBillsTills.accounts) {
      sheet.addRow([row.account, row.paybill ?? "", row.count, Number(row.total), "", "", ""]);
    }
  }

  // 15. Categories
  if (include("categories")) {
    const sheet = workbook.addWorksheet("Categories");
    styleHeader(sheet, ["Category", "Transactions", "Money Out", "Share of Spend"], [28, 12, 16, 14]);
    addRows(
      sheet,
      analysis.categories.map((row) => [row.name, row.count, Number(row.totalOut), row.shareOfOut]),
      [2],
    );
  }

  // 16. Anomalies
  if (include("anomalies")) {
    const sheet = workbook.addWorksheet("Anomalies");
    styleHeader(sheet, ["Type", "Receipt", "Date", "Details", "Amount", "Note"], [20, 16, 13, 48, 14, 28]);
    const rowsToWrite: Row[] = [
      ...analysis.anomalies.duplicates.map((row) => ["Duplicate", row.externalId, row.date, row.details, Number(row.amount), row.reason]),
      ...analysis.anomalies.large.map((row) => ["Large", row.externalId, row.date, row.details, Number(row.amount), row.reason]),
      ...analysis.anomalies.outOfHours.map((row) => ["Out of hours", row.externalId, row.date, row.details, Number(row.amount), row.reason]),
      ...analysis.anomalies.balanceBreaks.map((row) => ["Balance chain", row.currentExternalId, "", row.details, Number(row.gap), row.reason]),
    ];
    addRows(sheet, rowsToWrite, [4]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
