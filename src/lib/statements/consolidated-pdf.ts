// ABOUTME: Client-side PDF export for the public consolidated statement analysis.
// ABOUTME: Uses jsPDF + autoTable so the full detailed report is generated in the browser.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatKES } from "@/lib/utils";
import type { ConsolidatedAnalysis, ConsolidatedReport } from "@shared/statements/consolidate";
import { groupContacts } from "@shared/statements/group";
import { providerDisplayName } from "@shared/statements/provider";

const MARGIN = 32;
const ACCENT: [number, number, number] = [199, 62, 29];

interface TableOptions {
  startY: number;
  title: string;
  head: string[];
  body: Array<Array<string | number>>;
  columnStyles?: Record<number, { halign?: "left" | "right" | "center"; cellWidth?: number | "auto" | "wrap" }>;
}

function drawPageChrome(doc: jsPDF, title: string) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 116, 110);
  doc.text("FinaFlow · consolidated bank statement analysis", MARGIN, 18);
  doc.text(title, width - MARGIN, 18, { align: "right" });
  doc.setDrawColor(232, 224, 216);
  doc.line(MARGIN, 24, width - MARGIN, 24);
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, height - 14);
}

function addTable(doc: jsPDF, options: TableOptions): number {
  const width = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);
  doc.setTextColor(45, 42, 38);
  doc.text(options.title, MARGIN, options.startY);
  autoTable(doc, {
    startY: options.startY + 8,
    head: [options.head],
    body: options.body,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN, top: 34, bottom: 26 },
    styles: {
      fontSize: 7,
      cellPadding: 3,
      overflow: "linebreak",
      textColor: [45, 42, 38],
      lineColor: [232, 224, 216],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 247, 242] },
    columnStyles: options.columnStyles,
    didDrawPage: () => drawPageChrome(doc, "Consolidated analysis"),
    tableWidth: width - MARGIN * 2,
  });
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (finalY ?? options.startY) + 14;
}

function pageBreak(doc: jsPDF, y: number): number {
  const height = doc.internal.pageSize.getHeight();
  if (y > height - 90) {
    doc.addPage();
    return 34;
  }
  return y;
}

function monthlyRows(rows: ConsolidatedAnalysis["analysis"]["breakdown"]["monthly"]): Array<Array<string | number>> {
  return rows.map((row) => [row.label, row.count.toLocaleString(), formatKES(row.totalIn), formatKES(row.totalOut), formatKES(row.net)]);
}

export function saveConsolidatedPdf(consolidated: ConsolidatedReport): void {
  const { analysis, files } = consolidated;
  const balanceGaps = files.reduce((sum, file) => sum + file.balance.continuity.unexplained, 0);
  const contactLimit = 100;
  const recurringLimit = 50;
  const groupedIn = groupContacts(analysis.moneyIn.bySource).slice(0, contactLimit);
  const groupedOut = groupContacts(analysis.moneyOut.byDestination).slice(0, contactLimit);
  const recurring = analysis.recurring.slice(0, recurringLimit);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(45, 42, 38);
  doc.text("Consolidated bank statement analysis", MARGIN, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(92, 88, 83);
  doc.text(
    `${consolidated.fileCount} statement${consolidated.fileCount === 1 ? "" : "s"} · ${analysis.summary.rowCount.toLocaleString()} transactions · ${consolidated.periodStart ?? "?"} to ${consolidated.periodEnd ?? "?"}`,
    MARGIN,
    64,
  );
  doc.text(
    `${consolidated.banks.join(", ") || "Bank"} · ${consolidated.duplicateRows.toLocaleString()} duplicate rows skipped across uploads`,
    MARGIN,
    78,
  );
  doc.setFontSize(7);
  doc.text(
    `Contact tables show the top ${contactLimit} grouped parties and top ${recurringLimit} recurring patterns; the complete exact and grouped lists are in the Excel/CSV export.`,
    MARGIN,
    89,
  );
  const firstY = 98;

  const summaryBody: Array<[string, string]> = [
    ["Statements", consolidated.fileCount.toLocaleString()],
    ["Transactions in consolidated view", analysis.summary.rowCount.toLocaleString()],
    ["Rows across uploaded files", consolidated.totalRowCount.toLocaleString()],
    ["Duplicate rows skipped", consolidated.duplicateRows.toLocaleString()],
    ["Period", `${consolidated.periodStart ?? "?"} to ${consolidated.periodEnd ?? "?"}`],
    ["Banks", consolidated.banks.join(", ") || "Bank"],
    ["Total money in", formatKES(analysis.summary.totalIn)],
    ["Total money out", formatKES(analysis.summary.totalOut)],
    ["Fees & charges", formatKES(analysis.summary.totalFees)],
    ["Net cash flow", formatKES(analysis.summary.net)],
    ["Average daily in", formatKES(analysis.summary.avgDailyIn)],
    ["Average daily out", formatKES(analysis.summary.avgDailyOut)],
    ["Transactions per day", analysis.summary.avgTransactionsPerDay.toLocaleString()],
    ["Highest single in", formatKES(analysis.summary.highestSingleIn)],
    ["Highest single out", formatKES(analysis.summary.highestSingleOut)],
    ["Most active day", analysis.summary.mostActiveDay ? `${analysis.summary.mostActiveDay.date} (${analysis.summary.mostActiveDay.count} transactions)` : "—"],
    ["Busiest weekday", analysis.summary.busiestWeekday ? `${analysis.summary.busiestWeekday.day} (${analysis.summary.busiestWeekday.count})` : "—"],
  ];
  let y = addTable(doc, {
    startY: firstY,
    title: "Consolidated summary",
    head: ["Measure", "Value"],
    body: summaryBody,
    columnStyles: { 0: { cellWidth: 230 }, 1: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: "Statement coverage",
    head: ["File", "Source", "Account", "Period", "Rows", "In", "Out", "Fees", "Net", "Reconciled", "Balance gaps"],
    body: files.map((file) => [
      file.fileName,
      file.bankName ?? providerDisplayName(file.provider),
      [file.accountNumber, file.accountName].filter(Boolean).join(" · ") || "—",
      `${file.periodStart ?? "?"}\nto ${file.periodEnd ?? "?"}`,
      file.rowCount.toLocaleString(),
      formatKES(file.totalIn),
      formatKES(file.totalOut),
      formatKES(file.totalFees),
      formatKES(file.net),
      file.reconciliation.matches ? "Yes" : "No",
      file.balance.continuity.unexplained.toLocaleString(),
    ]),
    columnStyles: {
      3: { cellWidth: 95 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "center" },
      10: { halign: "right" },
    },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: "Monthly breakdown (all months in the uploaded statements)",
    head: ["Month", "Transactions", "In", "Out", "Net"],
    body: monthlyRows(analysis.breakdown.monthly),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: `Money in by source (grouped parties, top ${contactLimit})`,
    head: ["Source", "Variants", "Transactions", "Total", "Average"],
    body: groupedIn.map((row) => [
      row.name,
      row.members.toLocaleString(),
      row.count.toLocaleString(),
      formatKES(row.total),
      formatKES(row.average),
    ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: `Money out by destination (grouped parties, top ${contactLimit})`,
    head: ["Destination", "Variants", "Transactions", "Total", "Average"],
    body: groupedOut.map((row) => [
      row.name,
      row.members.toLocaleString(),
      row.count.toLocaleString(),
      formatKES(row.total),
      formatKES(row.average),
    ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: "Money in by channel",
    head: ["Channel", "Transactions", "Amount", "Share"],
    body: (analysis.moneyIn.byChannel ?? []).map((row) => [row.label, row.count.toLocaleString(), formatKES(row.total), `${row.share.toFixed(1)}%`]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: "Spending by category",
    head: ["Category", "Transactions", "In", "Out", "Share of spend"],
    body: analysis.categories.map((row) => [
      row.name,
      row.count.toLocaleString(),
      formatKES(row.totalIn),
      formatKES(row.totalOut),
      `${row.shareOfOut.toFixed(1)}%`,
    ]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = pageBreak(doc, y);
  y = addTable(doc, {
    startY: y,
    title: "Fees and charges",
    head: ["Fee type", "Count", "Total"],
    body: analysis.fees.byType.map((row) => [row.type, row.count.toLocaleString(), formatKES(row.total)]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  if (analysis.fees.topRecipients.length > 0) {
    y = pageBreak(doc, y);
    y = addTable(doc, {
      startY: y,
      title: "Top fee recipients",
      head: ["Recipient", "Count", "Total", "Average"],
      body: analysis.fees.topRecipients.map((row) => [row.name, row.count.toLocaleString(), formatKES(row.total), formatKES(row.average)]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }

  if (recurring.length > 0) {
    y = pageBreak(doc, y);
    y = addTable(doc, {
      startY: y,
      title: `Recurring payments (top ${recurringLimit})`,
      head: ["Description", "Type", "Frequency", "Occurrences", "Average", "Total", "Last date", "Next expected"],
      body: recurring.map((row) => [
        row.description,
        row.type,
        row.frequency,
        row.occurrences.toLocaleString(),
        formatKES(row.averageAmount),
        formatKES(row.totalAmount),
        row.lastDate,
        row.nextExpected ?? "—",
      ]),
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
  }

  if (analysis.payBillsTills.shortcodes.length > 0) {
    y = pageBreak(doc, y);
    y = addTable(doc, {
      startY: y,
      title: "Paybills and tills",
      head: ["Type", "Number", "Name", "Count", "Total", "Fees", "Account"],
      body: analysis.payBillsTills.shortcodes.map((row) => [
        row.type,
        row.number ?? "—",
        row.name ?? "—",
        row.count.toLocaleString(),
        formatKES(row.total),
        formatKES(row.fees),
        row.accountReference ?? "—",
      ]),
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
  }

  y = pageBreak(doc, y);
  addTable(doc, {
    startY: y,
    title: "Review items",
    head: ["Check", "Value"],
    body: [
      ["Uncategorised spend", `${analysis.anomalies.uncategorisedSpend.count.toLocaleString()} rows · ${formatKES(analysis.anomalies.uncategorisedSpend.total)}`],
      ["Large transactions", analysis.anomalies.large.length.toLocaleString()],
      ["Out of hours", analysis.anomalies.outOfHours.length.toLocaleString()],
      ["Duplicate candidates", analysis.anomalies.duplicates.length.toLocaleString()],
      ["Balance samples to review", balanceGaps.toLocaleString()],
      ["Reversals", analysis.reversals.length.toLocaleString()],
      ["Cross-file duplicate rows skipped", consolidated.duplicateRows.toLocaleString()],
    ],
    columnStyles: { 0: { cellWidth: 260 }, 1: { halign: "right" } },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 116, 110);
    doc.text(`Page ${page} of ${pages}`, width - MARGIN, doc.internal.pageSize.getHeight() - 14, { align: "right" });
  }

  doc.save(`bank-consolidated-analysis-${new Date().toISOString().slice(0, 10)}.pdf`);
}
