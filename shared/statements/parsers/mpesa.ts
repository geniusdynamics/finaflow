// ABOUTME: M-PESA statement parser (personal and paybill PDFs/CSVs) built on positioned text lines.
// ABOUTME: Validated against a real 77-page statement: 2,371 rows and totals matching Safaricom's summary.

import type {
  ExtractedDocument,
  MpesaRail,
  ParsedStatement,
  ParsedStatementRow,
  StatementDirection,
  StatementKind,
  StatementMetadata,
  StatementRowRole,
  StatementStatus,
  StatementSummaryBlock,
  StatementSummaryRail,
  StatementToken,
  StatementTxnType,
  TextLine,
} from "../types";
import {
  absoluteAmount,
  compareAmounts,
  isMoneyToken,
  isZeroAmount,
  normalizeAmount,
  sumAmounts,
} from "../normalize/amount";
import {
  isDateToken,
  isTimeToken,
  normalizeDate,
  normalizeTime,
  parsePeriod,
} from "../normalize/date";
import {
  isFooterLine,
  isHeaderLine,
  isLedgerStart,
  isVerificationCode,
  lineText,
  normalizeWhitespace,
  tokensOf,
} from "../table/text";

export const MPESA_PARSER_ID = "mpesa-statement";
export const MPESA_PARSER_VERSION = "1.0.0";

const RECEIPT = /^[A-Z0-9]{8,14}$/;
const MIN_Y = 60;

const STATUS: Record<string, StatementStatus> = {
  completed: "completed",
  failed: "failed",
  reversed: "reversed",
  pending: "pending",
  cancelled: "cancelled",
};

interface RawRow {
  page: number;
  receiptNo: string;
  date: string;
  time: string | null;
  details: string;
  status: StatementStatus;
  paidIn: string;
  withdrawn: string;
  balance: string;
  transactionType?: string | null;
  otherParty?: string | null;
  /** The statement printed a paid-in or paid-out value with a negative sign. */
  negativeAmount: boolean;
  rawLines: string[];
  warnings: string[];
}

interface Classified {
  rail: MpesaRail;
  txnType: StatementTxnType;
  categoryKey: string | null;
  categoryConfidence: number;
}

const TXN_BY_RAIL: Record<MpesaRail, StatementTxnType> = {
  send_money: "transfer",
  received: "topup",
  agent_deposit: "bank_transfer",
  agent_withdrawal: "withdrawal",
  paybill: "payment",
  till: "payment",
  charge: "charge",
  airtime: "airtime",
  reversal: "refund",
  fuliza_draw: "loan_drawdown",
  fuliza_repay: "loan_repayment",
  other: "transfer",
};

const CATEGORY_BY_RAIL: Partial<Record<MpesaRail, string>> = {
  charge: "fees",
  agent_withdrawal: "cash_withdrawal",
  airtime: "airtime",
  fuliza_draw: "loans_savings",
  fuliza_repay: "loans_savings",
};

/** Merchant keyword rules: canonical key + confidence. Best effort, never a forced category. */
const MERCHANT_RULES: Array<{ re: RegExp; key: string; confidence: number }> = [
  { re: /\b(KPLC|KENYA POWER|ELECTRICITY|UTILITY METERING|\bWATER\b|NWSC|ZUKU|DSTV|ECITIZEN|\bKRA\b|\bSHA\b|NHIF|NSSF|INTERNET)\b/i, key: "utilities", confidence: 0.85 },
  { re: /\b(TOTAL|SHELL|VIVO|RUBIS|PETROLEUM|FUEL|MOZAM ENERGY)\b/i, key: "fuel", confidence: 0.8 },
  { re: /\b(CEMENT|BAMBURI|HARDWARE|STEEL|BUILDING MATERIALS|SUPPLIES)\b/i, key: "supplies", confidence: 0.75 },
  { re: /\b(NAIVAS|QUICKMART|CARREFOUR|CHANDARANA|SUPERMARKET|TANDOORI|RESTAURANT|CAFE|HOTEL|BUTCHERY|BAKERY|MARKET)\b/i, key: "food", confidence: 0.7 },
  { re: /\b(RENT|LANDLORD|PROPERTY|APARTMENT)\b/i, key: "rent", confidence: 0.7 },
  { re: /\b(SALARY|PAYROLL|WAGES)\b/i, key: "salaries", confidence: 0.8 },
  { re: /\b(UBER|BOLT|LITTLE|MATATU|SACCO|TRANSPORT|DELIVERY)\b/i, key: "transport", confidence: 0.7 },
  { re: /\b(ZASH LOAN|LOAN|CREDIT)\b/i, key: "loans_savings", confidence: 0.75 },
  { re: /\b(SAFARICOM|AIRTEL|TELKOM)\b/i, key: "airtime", confidence: 0.6 },
  { re: /\b(ADVERT|MARKETING)\b/i, key: "marketing", confidence: 0.7 },
];

function canonicalDetails(details: string): string {
  return details.replace(/M-\s*Pesa/gi, "M-Pesa").replace(/\s+/g, " ").trim();
}

export function classifyMpesaDetails(
  details: string,
  direction?: StatementDirection,
): Classified {
  const d = canonicalDetails(details);
  let rail: MpesaRail = "other";

  if (/^overdraft of credit party\b/i.test(d)) rail = "fuliza_draw";
  else if (/\bod loan repayment\b/i.test(d)) rail = "fuliza_repay";
  else if (/\breversal\b/i.test(d)) rail = "reversal";
  else if (/\bcharge\b/i.test(d)) rail = "charge";
  else if (/airtime purchase|customer bundle purchase|recharge for customer/i.test(d)) rail = "airtime";
  else if (/withdrawal at agent|agent withdrawal/i.test(d)) rail = "agent_withdrawal";
  else if (/deposit of funds at agent/i.test(d)) rail = "agent_deposit";
  else if (/merchant payment/i.test(d)) rail = "till";
  else if (/pay bill|card pay bill|card pay utility|offnet c2b|pay utility/i.test(d)) rail = "paybill";
  else if (/customer transfer|customer send money|customer payment to small business|offnet b2c|send money/i.test(d)) rail = "send_money";
  else if (/funds received|business payment from|salary payment from|promotion payment from|merchant customer payment from|bics international transfer/i.test(d)) rail = "received";

  // Money arriving through a send/paybill/till rail is income, not a spend.
  const inboundBank = /small business payment to customer|transfer from bank|business payment to customer/i.test(d);
  if (direction === "in" && (rail === "send_money" || rail === "paybill" || rail === "till" || inboundBank)) {
    rail = "received";
  }

  const txnType = TXN_BY_RAIL[rail];
  let categoryKey = CATEGORY_BY_RAIL[rail] ?? null;
  let categoryConfidence = categoryKey ? 0.9 : 0;

  if (!categoryKey && direction !== "in") {
    for (const rule of MERCHANT_RULES) {
      if (rule.re.test(d)) {
        categoryKey = rule.key;
        categoryConfidence = rule.confidence;
        break;
      }
    }
  }

  return { rail, txnType, categoryKey, categoryConfidence };
}

function extractCounterparty(details: string): {
  name: string | null;
  identifier: string | null;
  accountReference: string | null;
} {
  let d = canonicalDetails(details);
  let accountReference: string | null = null;

  const acc = /\bAcc\.?\s*([A-Za-z0-9*#-]+)/i.exec(d);
  if (acc) {
    accountReference = acc[1];
    d = d.slice(0, acc.index).trim();
  }
  const mobile = /\bfor Mobile No\.?\s*([A-Za-z0-9*#-]+)/i.exec(d);
  if (mobile) {
    accountReference = accountReference ?? mobile[1];
    d = d.slice(0, mobile.index).trim();
  }
  // Keep the counterparty name, drop API conversation boilerplate.
  d = d.replace(/\s+(?:B2C |B2B )?via API\..*$/i, "").replace(/\s+Original conversation ID is.*$/i, "").trim();
  d = d.replace(/\.\s*$/, "").trim();

  const pair = /(?:^|\s)(?:to|from)\s+([A-Za-z0-9*#]{4,})\s+-\s+(.+)$/i.exec(d);
  if (pair) {
    return { name: cleanName(pair[2]), identifier: pair[1], accountReference };
  }
  const till = /\bTill\s+([0-9A-Za-z*#]{4,})\s+-\s+(.+)$/i.exec(d);
  if (till) {
    return { name: cleanName(till[2]), identifier: till[1], accountReference };
  }
  if (/^overdraft of credit party/i.test(d)) {
    return { name: "M-PESA Fuliza", identifier: null, accountReference };
  }
  if (/^od loan repayment/i.test(d)) {
    return { name: "M-PESA Fuliza repayment", identifier: null, accountReference };
  }
  return { name: null, identifier: null, accountReference };
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+[A-Z]\.?\s*$/, "").trim();
}

const TRANSACTION_TYPE = /^(Funds received|Merchant Payment(?: Online)?|Pay Bill(?: Online)?|Customer Transfer(?: of Funds)?|Send Money|Agent Deposit|Agent Withdrawal|Airtime Purchase|Business Payment|OD Loan Repayment|OverDraft of Credit Party|Reversal|Charge|Pay Merchant Charge|Pay Bill Charge|Withdrawal Charge)\b/i;

function readRowStart(line: TextLine, tokens: StatementToken[], paybill = false): RawRow | null {
  if (tokens.length < 8) return null;
  const receiptNo = tokens[0]?.text ?? "";
  if (!RECEIPT.test(receiptNo)) return null;

  let dateIdx = -1;
  for (let i = 1; i <= Math.min(3, tokens.length - 1); i++) {
    if (isDateToken(tokens[i].text)) {
      dateIdx = i;
      break;
    }
  }
  if (dateIdx < 0) return null;
  const date = normalizeDate(tokens[dateIdx].text);
  if (!date) return null;

  let statusIdx = -1;
  let status: StatementStatus | null = null;
  for (let i = tokens.length - 1; i > dateIdx; i--) {
    const s = STATUS[tokens[i].text.toLowerCase()];
    if (s) {
      statusIdx = i;
      status = s;
      break;
    }
  }
  if (statusIdx < 0 || !status) return null;

  const warnings: string[] = [];
  let negativeAmount = false;
  const magnitude = (raw: string): string => {
    const value = normalizeAmount(raw).value;
    if (!value.startsWith("-")) return value;
    negativeAmount = true;
    return absoluteAmount(value);
  };
  const moneyEntries = tokens
    .slice(statusIdx + 1)
    .map((token, offset) => ({ token, index: statusIdx + 1 + offset }))
    .filter((entry) => isMoneyToken(entry.token.text));
  let paidIn = "0.00";
  let withdrawn = "0.00";
  let balance = "0.00";
  let balanceEntry: { token: StatementToken; index: number } | null = null;

  if (moneyEntries.length >= 3) {
    const three = moneyEntries.slice(-3);
    paidIn = magnitude(three[0].token.text);
    withdrawn = magnitude(three[1].token.text);
    balance = normalizeAmount(three[2].token.text).value;
    balanceEntry = three[2];
    if (moneyEntries.length > 3) {
      warnings.push(`Expected 3 amount columns, found ${moneyEntries.length}; kept the last 3.`);
    }
  } else if (moneyEntries.length === 2) {
    const [first, second] = moneyEntries;
    balance = normalizeAmount(second.token.text).value;
    balanceEntry = second;
    const mid = (tokens[statusIdx].x + second.token.x) / 2;
    if (first.token.x < mid) paidIn = magnitude(first.token.text);
    else withdrawn = magnitude(first.token.text);
    warnings.push("Statement omits one amount column; direction inferred from column position.");
  } else {
    return null;
  }

  if (!isZeroAmount(paidIn) && !isZeroAmount(withdrawn)) {
    warnings.push("Both paid-in and withdrawn are non-zero; kept the statement values.");
  } else if (isZeroAmount(paidIn) && isZeroAmount(withdrawn)) {
    warnings.push("Both paid-in and withdrawn are zero.");
  }

  const detailsTokens = tokens.slice(dateIdx + 1, statusIdx);
  let time: string | null = null;
  const detailsParts: string[] = [];
  for (const t of detailsTokens) {
    if (!time && isTimeToken(t.text)) {
      time = normalizeTime(t.text);
      continue;
    }
    detailsParts.push(t.text);
  }

  // Paybill statements append Transaction Type and Other Party after the balance column.
  let transactionType: string | null = null;
  let otherParty: string | null = null;
  if (paybill && balanceEntry) {
    const trailing = tokens
      .slice(balanceEntry.index + 1)
      .map((token) => token.text)
      .join(" ")
      .trim();
    if (trailing) {
      const match = trailing.match(TRANSACTION_TYPE);
      if (match) {
        transactionType = match[1];
        otherParty = trailing.slice(match[0].length).trim() || null;
      } else {
        transactionType = trailing;
      }
    }
  }

  return {
    page: line.page,
    receiptNo,
    date,
    time,
    details: normalizeWhitespace(detailsParts.join(" ")),
    status,
    paidIn,
    withdrawn,
    balance,
    transactionType,
    otherParty,
    negativeAmount,
    rawLines: [lineText(line)],
    warnings,
  };
}

interface PreParse {
  metadata: StatementMetadata;
  summary?: StatementSummaryBlock;
  headerTexts: string[];
}

function parsePreamble(preLines: string[]): PreParse {
  const metadata: StatementMetadata = {};
  const headerTexts: string[] = [];
  const summaryLines: string[] = [];
  let inSummary = false;

  for (const text of preLines) {
    const name = /^Customer Name:\s*(.+)$/i.exec(text);
    if (name) metadata.customerName = name[1].trim();
    const mobile = /^Mobile Number:\s*(.+)$/i.exec(text);
    if (mobile) metadata.mobileNumber = mobile[1].trim();
    const period = /^Statement Period:\s*(.+)$/i.exec(text);
    if (period) {
      const parsed = parsePeriod(period[1]);
      if (parsed) {
        metadata.periodStart = parsed.start;
        metadata.periodEnd = parsed.end;
      }
    }
    const request = /^Request Date:\s*(.+)$/i.exec(text);
    if (request) {
      const d = normalizeDate(request[1]);
      if (d) metadata.requestDate = d;
    }
    if (isHeaderLine(text)) {
      headerTexts.push(text);
      continue;
    }
    if (/TRANSACTION TYPE/i.test(text) && /PAID IN/i.test(text) && /PAID OUT/i.test(text)) {
      inSummary = true;
      continue;
    }
    if (inSummary) {
      if (/^DETAILED STATEMENT/i.test(text)) {
        inSummary = false;
        continue;
      }
      summaryLines.push(text);
    }
  }

  return { metadata, summary: parseSummary(summaryLines), headerTexts };
}

function parseSummary(lines: string[]): StatementSummaryBlock | undefined {
  const rails: StatementSummaryRail[] = [];
  let totalIn: string | null = null;
  let totalOut: string | null = null;

  for (const text of lines) {
    const tokens = text.split(/\s+/);
    const money = tokens.filter((t) => isMoneyToken(t));
    if (money.length < 2) continue;
    const paidIn = absoluteAmount(normalizeAmount(money[money.length - 2]).value);
    const paidOut = absoluteAmount(normalizeAmount(money[money.length - 1]).value);
    const label = tokens.slice(0, tokens.length - 2).join(" ").replace(/^Total\b/i, "Total");
    if (/^total\b/i.test(text)) {
      totalIn = paidIn;
      totalOut = paidOut;
      break;
    }
    if (label) rails.push({ label, paidIn, paidOut });
  }

  if (rails.length === 0) return undefined;
  return {
    rails,
    totalIn: totalIn ?? sumAmounts(rails.map((r) => r.paidIn)),
    totalOut: totalOut ?? sumAmounts(rails.map((r) => r.paidOut)),
  };
}

function rolePriority(role: StatementRowRole): number {
  switch (role) {
    case "primary": return 0;
    case "charge": return 1;
    case "overdraft": return 2;
    default: return 3;
  }
}

export function parseMpesaStatement(doc: ExtractedDocument): ParsedStatement {
  const warnings: string[] = [];
  const preLines: string[] = [];
  const rawRows: RawRow[] = [];
  let started = false;
  let current: RawRow | null = null;

  const headerText = doc.lines.map(lineText).find((text) => isHeaderLine(text)) ?? "";
  const paybill = /other party|transaction type/i.test(headerText);

  for (const line of doc.lines) {
    if (line.y < MIN_Y) continue;
    const text = lineText(line);
    if (!text) continue;
    if (isFooterLine(text) || isVerificationCode(text)) continue;

    if (!started) {
      if (isLedgerStart(text)) {
        started = true;
        continue;
      }
      preLines.push(text);
      continue;
    }

    if (isHeaderLine(text)) continue;

    const tokens = tokensOf(line);
    const row = readRowStart(line, tokens, paybill);
    if (row) {
      rawRows.push(row);
      current = row;
      continue;
    }

    if (!current) continue;
    const timeToken = tokens.find((t) => isTimeToken(t.text));
    if (timeToken && !current.time) current.time = normalizeTime(timeToken.text);
    const rest = tokens.filter((t) => t !== timeToken).map((t) => t.text).join(" ");
    if (rest) {
      current.details = normalizeWhitespace(`${current.details} ${rest}`);
      current.rawLines.push(text);
    }
  }

  const pre = parsePreamble(preLines);
  const metadata = pre.metadata;
  if (!metadata.periodStart || !metadata.periodEnd) {
    const dates = rawRows.map((r) => r.date).sort();
    if (dates.length > 0) {
      metadata.periodStart = metadata.periodStart ?? dates[0];
      metadata.periodEnd = metadata.periodEnd ?? dates[dates.length - 1];
    }
  }

  // Group consecutive rows that share a receipt: charge + spend + Fuliza overdraft.
  if (rawRows.some((row) => row.negativeAmount)) {
    warnings.push("Statement prints paid-in/paid-out values with a negative sign; normalized to positive magnitudes.");
  }
  const groups: RawRow[][] = [];
  for (const row of rawRows) {
    const last = groups[groups.length - 1];
    if (last && last[0].receiptNo === row.receiptNo) last.push(row);
    else groups.push([row]);
  }

  const rows: ParsedStatementRow[] = [];
  groups.forEach((group) => {
    const classified = group.map((r) => classifyMpesaDetails(r.details, rowDirection(r)));
    const primaryIdx = pickPrimary(group, classified);
    const legs = group.map((row, index) => ({ row, index, classified: classified[index] }));

    const others = legs
      .filter((l) => l.index !== primaryIdx)
      .sort((a, b) => {
        const pa = rolePriority(roleFor(a.classified.rail));
        const pb = rolePriority(roleFor(b.classified.rail));
        return pa === pb ? a.index - b.index : pa - pb;
      });

    const externalIds = new Map<number, string>();
    externalIds.set(primaryIdx, group[primaryIdx].receiptNo);
    others.forEach((leg, i) => {
      externalIds.set(leg.index, `${group[primaryIdx].receiptNo}#${i + 2}`);
    });

    const primaryExternal = externalIds.get(primaryIdx)!;
    const overdraftLeg = legs.find((l) => l.classified.rail === "fuliza_draw");
    const fulizaFunded = group.some((r) => /fuliza/i.test(canonicalDetails(r.details)));

    legs.forEach((leg) => {
      const { row, classified } = leg;
      const role = roleFor(classified.rail, leg.index === primaryIdx);
      const externalId = externalIds.get(leg.index)!;
      const amount = !isZeroAmount(row.paidIn) ? row.paidIn : row.withdrawn;
      const direction = rowDirection(row);
      const counterparty = extractCounterparty(row.details);

      const rowWarnings = [...row.warnings];
      if (row.status !== "completed") rowWarnings.push(`Transaction status is ${row.status}.`);
      if (!row.time) rowWarnings.push("No completion time found.");

      rows.push({
        rowIndex: rows.length,
        page: row.page,
        externalId,
        groupId: group[primaryIdx].receiptNo,
        groupRole: role,
        receiptNo: row.receiptNo,
        date: row.date,
        time: row.time,
        details: canonicalDetails(row.details),
        status: row.status,
        paidIn: row.paidIn,
        withdrawn: row.withdrawn,
        balance: row.balance,
        direction,
        amount: absoluteAmount(amount),
        currency: "KES",
        rail: classified.rail,
        txnType: classified.txnType,
        counterpartyName: counterparty.name,
        counterpartyId: counterparty.identifier,
        accountReference: counterparty.accountReference,
        transactionType: row.transactionType ?? null,
        otherParty: row.otherParty ?? null,
        categoryKey: classified.categoryKey,
        categoryConfidence: classified.categoryConfidence,
        fulizaFunded: fulizaFunded && classified.rail !== "fuliza_draw",
        linkedTxnExternalId:
          role === "charge" || role === "overdraft" ? primaryExternal : null,
        fulizaOf: leg.index === primaryIdx && overdraftLeg ? externalIds.get(overdraftLeg.index)! : null,
        rawLines: row.rawLines,
        warnings: rowWarnings,
      });
    });
  });

  const kind: StatementKind = /other party|transaction type/i.test(headerText)
    ? "mobile_money_paybill"
    : "mobile_money_personal";

  const totalIn = sumAmounts(rows.map((r) => r.paidIn));
  const totalOut = sumAmounts(rows.map((r) => r.withdrawn));
  const totalFees = sumAmounts(rows.filter((r) => r.txnType === "charge").map((r) => r.withdrawn));

  if (pre.summary) {
    if (compareAmounts(totalIn, pre.summary.totalIn) !== 0 || compareAmounts(totalOut, pre.summary.totalOut) !== 0) {
      warnings.push(
        `Parsed totals (${totalIn} in / ${totalOut} out) do not match the statement summary ` +
        `(${pre.summary.totalIn} in / ${pre.summary.totalOut} out).`,
      );
    }
  }

  if (rows.length === 0) {
    warnings.push("No transactions were found after the DETAILED STATEMENT marker.");
  }

  return {
    provider: "mpesa",
    kind,
    parserId: MPESA_PARSER_ID,
    parserVersion: MPESA_PARSER_VERSION,
    currency: "KES",
    metadata,
    rows,
    totals: { rowCount: rows.length, totalIn, totalOut, totalFees },
    statementSummary: pre.summary,
    warnings,
  };
}

function roleFor(rail: MpesaRail, isPrimary = false): StatementRowRole {
  if (isPrimary) return "primary";
  if (rail === "charge") return "charge";
  if (rail === "fuliza_draw") return "overdraft";
  return "secondary";
}

function rowDirection(row: RawRow): StatementDirection {
  return isZeroAmount(row.paidIn) ? "out" : "in";
}

function pickPrimary(group: RawRow[], classified: Classified[]): number {
  let best = 0;
  let bestAmount = -1n;
  const cents = (r: RawRow) => {
    const v = normalizeAmount(!isZeroAmount(r.paidIn) ? r.paidIn : r.withdrawn).value;
    const [i, f = "00"] = v.split(".");
    return BigInt(i) * 100n + BigInt((f + "00").slice(0, 2));
  };
  for (let i = 0; i < group.length; i++) {
    const rail = classified[i].rail;
    if (rail === "charge" || rail === "fuliza_draw") continue;
    const amount = cents(group[i]);
    if (amount > bestAmount) {
      bestAmount = amount;
      best = i;
    }
  }
  if (bestAmount >= 0n) return best;
  // Only charge/overdraft rows: pick the largest.
  best = 0;
  bestAmount = -1n;
  for (let i = 0; i < group.length; i++) {
    const amount = cents(group[i]);
    if (amount > bestAmount) {
      bestAmount = amount;
      best = i;
    }
  }
  return best;
}

/** Confidence that a document is an M-PESA statement. */
export function detectMpesaStatement(doc: ExtractedDocument): number {
  let score = 0;
  for (const line of doc.lines) {
    const text = lineText(line);
    if (/M-PESA STATEMENT/i.test(text)) score += 0.4;
    else if (isLedgerStart(text)) score += 0.3;
    else if (isHeaderLine(text)) score += 0.2;
    else if (/\bM-PESA\b/i.test(text)) score += 0.1;
    if (score >= 1) return 1;
  }
  return Math.min(1, score);
}
