// ABOUTME: CSV export for statement transactions: UTF-8 BOM, RFC-4180 quoting, stable column order.
// ABOUTME: Shared by the server API, the app download and the public browser converter.

export type CsvDateFormat = "iso" | "dd-mmm-yyyy" | "dd/mm/yyyy";
export type CsvSortOrder = "asc" | "desc";

export interface ExportTransaction {
  receiptNo: string;
  date: string;
  time: string | null;
  details: string;
  status: string;
  paidIn: string;
  withdrawn: string;
  balance: string;
  direction?: "in" | "out";
  txnType?: string;
  transactionType?: string | null;
  otherParty?: string | null;
  rail?: string;
  groupId?: string;
  counterpartyName?: string | null;
  counterpartyId?: string | null;
  accountReference?: string | null;
  categoryName?: string | null;
}

export interface CsvOptions {
  excludeCharges?: boolean;
  sortOrder?: CsvSortOrder;
  dateFormat?: CsvDateFormat;
  maskPii?: boolean;
  /** Append Transaction Type / Other Party columns (paybill statements). */
  paybillColumns?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(date: string, time: string | null, format: CsvDateFormat): string {
  const [year, month, day] = date.split("-");
  const clock = time ?? "";
  if (format === "iso") return `${date}${clock ? ` ${clock}` : ""}`;
  const m = MONTHS[Number(month) - 1] ?? month;
  if (format === "dd-mmm-yyyy") return `${day} ${m} ${year}${clock ? ` ${clock}` : ""}`;
  return `${day}/${month}/${year}${clock ? ` ${clock}` : ""}`;
}

function maskPii(value: string): string {
  return value
    .replace(/\b(\d{3})\d{3,6}(\d{2,4})\b/g, "$1***$2")
    .replace(/\b(\d{4})\d{4,6}(\d{2})\b/g, "$1***$2");
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isCharge(row: ExportTransaction): boolean {
  return row.txnType === "charge" || /(^|\s)charge\b/i.test(row.details);
}

/** Builds a CSV document (without BOM; add it at the download/response edge). */
export function buildStatementCsv(rows: ExportTransaction[], options: CsvOptions = {}): string {
  let selected = [...rows];
  if (options.excludeCharges) selected = selected.filter((row) => !isCharge(row));

  if (options.sortOrder) {
    selected.sort((a, b) => {
      const ak = `${a.date}T${a.time ?? "00:00:00"}`;
      const bk = `${b.date}T${b.time ?? "00:00:00"}`;
      return options.sortOrder === "asc" ? ak.localeCompare(bk) : bk.localeCompare(ak);
    });
  }

  const header = [
    "Receipt No",
    "Completion Time",
    "Details",
    "Transaction Status",
    "Paid In",
    "Withdrawn",
    "Balance",
  ];
  if (options.paybillColumns) header.push("Transaction Type", "Other Party");

  const lines = [header.map(escapeCsv).join(",")];

  for (const row of selected) {
    const details = options.maskPii ? maskPii(row.details) : row.details;
    const values = [
      row.receiptNo,
      formatDate(row.date, row.time, options.dateFormat ?? "iso"),
      details,
      row.status,
      row.paidIn,
      row.withdrawn,
      row.balance,
    ];
    if (options.paybillColumns) {
      values.push(row.transactionType ?? row.txnType ?? "", row.otherParty ?? row.counterpartyName ?? "");
    }
    lines.push(values.map((value) => escapeCsv(String(value ?? ""))).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}

/** CSV bytes with a UTF-8 BOM so Excel and Google Sheets keep names intact. */
export function statementCsvBytes(rows: ExportTransaction[], options: CsvOptions = {}): Uint8Array {
  const csv = buildStatementCsv(rows, options);
  return new TextEncoder().encode(`\uFEFF${csv}`);
}
