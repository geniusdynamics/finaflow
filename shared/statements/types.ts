// ABOUTME: Canonical types shared by statement extractors, parsers, analysis and exports.
// ABOUTME: Pure TypeScript with no runtime dependencies so the same core runs in Node and the browser.

export type StatementProvider = "mpesa" | "airtel_money" | "sasapay" | "bank";

export type StatementKind =
  | "mobile_money_personal"
  | "mobile_money_paybill"
  | "bank_account"
  | "unknown";

export type StatementDirection = "in" | "out";

export type StatementStatus =
  | "completed"
  | "failed"
  | "reversed"
  | "pending"
  | "cancelled";

/** Wallet transaction classes used by the app. Mirrors api/lib/mobile-wallet/provider-interface.ts. */
export type StatementTxnType =
  | "payment"
  | "disbursement"
  | "transfer"
  | "topup"
  | "withdrawal"
  | "airtime"
  | "utility"
  | "bank_transfer"
  | "refund"
  | "charge"
  | "loan_drawdown"
  | "loan_repayment";

export type MpesaRail =
  | "send_money"
  | "received"
  | "agent_deposit"
  | "agent_withdrawal"
  | "paybill"
  | "till"
  | "charge"
  | "airtime"
  | "reversal"
  | "fuliza_draw"
  | "fuliza_repay"
  | "other";

/** Bank-statement rails. Kept separate so bank profiles can add their own without changing M-PESA. */
export type BankRail =
  | "bank_transfer"
  | "cash_deposit"
  | "cash_withdrawal"
  | "cheque"
  | "interest"
  | "salary"
  | "standing_order"
  | "loan";

export type StatementRail = MpesaRail | BankRail;

export interface TextCell {
  text: string;
  /** Horizontal position in PDF points. */
  x: number;
  width?: number;
  height?: number;
}

export interface TextLine {
  page: number;
  /** Vertical position in PDF points, descending within a page. */
  y: number;
  cells: TextCell[];
}

/** Output of an extractor: text lines with positions, in page order. */
export interface ExtractedDocument {
  pages: number;
  lines: TextLine[];
  charCount: number;
}

export interface StatementToken {
  text: string;
  x: number;
}

export type StatementRowRole = "primary" | "charge" | "overdraft" | "secondary";

export interface ParsedStatementRow {
  /** Position in the parsed document, starting at 0 (PDF order). */
  rowIndex: number;
  page: number;
  /** Stable identity for import/dedupe: receipt for the primary row, receipt#n for other legs. */
  externalId: string;
  /** The receipt number printed on the statement (shared by all legs of one event). */
  groupId: string;
  groupRole: StatementRowRole;
  receiptNo: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM:SS, null when the statement omits the time. */
  time: string | null;
  details: string;
  status: StatementStatus;
  /** Positive decimal strings, 2dp. */
  paidIn: string;
  withdrawn: string;
  balance: string;
  direction: StatementDirection;
  /** Positive decimal string, 2dp — the side that moved (paidIn or withdrawn). */
  amount: string;
  currency: string;
  rail: StatementRail;
  txnType: StatementTxnType;
  counterpartyName: string | null;
  counterpartyId: string | null;
  accountReference: string | null;
  /** Paybill statements: the printed Transaction Type and Other Party columns. */
  transactionType?: string | null;
  otherParty?: string | null;
  /** Canonical category key suggestion (mapped to a business category later). */
  categoryKey: string | null;
  /** Confidence of the category suggestion, 0..1. */
  categoryConfidence: number;
  /** True when the spend was funded by Fuliza. */
  fulizaFunded: boolean;
  /** Charge → parent; overdraft → the Fuliza spend it financed. */
  linkedTxnExternalId: string | null;
  /** On a Fuliza spend: externalId of its overdraft leg. */
  fulizaOf: string | null;
  rawLines: string[];
  warnings: string[];
}

export interface StatementSummaryRail {
  label: string;
  paidIn: string;
  paidOut: string;
}

export interface StatementSummaryBlock {
  rails: StatementSummaryRail[];
  totalIn: string;
  totalOut: string;
}

export interface StatementMetadata {
  customerName?: string;
  mobileNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  requestDate?: string;
  /** Bank statements: institution, account identity and printed opening/closing balances. */
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  productName?: string;
  openingBalance?: string;
  closingBalance?: string;
}

export interface ParsedStatement {
  provider: StatementProvider;
  kind: StatementKind;
  parserId: string;
  parserVersion: string;
  currency: string;
  metadata: StatementMetadata;
  rows: ParsedStatementRow[];
  /** Row order in the source. M-PESA is newest-first; KCB is oldest-first. Defaults to "desc". */
  order?: "asc" | "desc";
  /** Totals computed from the parsed rows. */
  totals: {
    rowCount: number;
    totalIn: string;
    totalOut: string;
    totalFees: string;
  };
  /** Safaricom's own SUMMARY table, when the statement has one. */
  statementSummary?: StatementSummaryBlock;
  warnings: string[];
}

export interface StatementParser {
  id: string;
  version: string;
  provider: StatementProvider;
  displayName: string;
  /** 0..1 confidence that this parser understands the document. */
  detect(doc: ExtractedDocument, meta?: { fileName?: string }): number;
  parse(doc: ExtractedDocument): ParsedStatement;
}
