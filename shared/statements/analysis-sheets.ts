// ABOUTME: Pure report-sheet builder shared by the browser exports and the public statement API.
// ABOUTME: One sheet per analysis section, with numeric amounts for downstream analysis.

import type { ConsolidatedAnalysis } from "./consolidate";
import { groupContacts } from "./group";

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
        ["Most active day", analysis.summary.mostActiveDay ? `${analysis.summary.mostActiveDay.date} (${analysis.summary.mostActiveDay.count})` : "-"],
        ["Busiest weekday", analysis.summary.busiestWeekday ? `${analysis.summary.busiestWeekday.day} (${analysis.summary.busiestWeekday.count})` : "-"],
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
