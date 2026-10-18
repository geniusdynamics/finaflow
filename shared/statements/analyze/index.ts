// ABOUTME: Statement analysis engine: the 13 published sheet blocks plus day-of-week, anomalies and reconciliation.
// ABOUTME: Pure functions over canonical rows; amounts stay decimal strings, averages use decimal.js.

import Decimal from "decimal.js";
import {
  absoluteAmount,
  compareAmounts,
  subtractAmounts,
  sumAmounts,
} from "../normalize/amount";
import { daysInclusive } from "../normalize/date";
import type { ParsedStatement, ParsedStatementRow } from "../types";

export interface AnalysisPeriod {
  start: string | null;
  end: string | null;
  days: number;
}

export interface AnalysisSummary {
  rowCount: number;
  totalIn: string;
  totalOut: string;
  totalFees: string;
  net: string;
  avgDailyIn: string;
  avgDailyOut: string;
  avgTransactionsPerDay: number;
  highestSingleIn: string;
  highestSingleOut: string;
  highestSingleInRef: AnalysisRowRef | null;
  highestSingleOutRef: AnalysisRowRef | null;
  mostActiveDay: { date: string; count: number } | null;
  busiestWeekday: { day: string; count: number } | null;
}

export interface AnalysisRowRef {
  externalId: string;
  date: string;
  details: string;
  amount: string;
}

export interface BalanceBreak {
  currentExternalId: string;
  nextExternalId: string;
  currentBalance: string;
  nextBalance: string;
  gap: string;
  details: string;
  reason: "same_receipt" | "bundle_leg" | "charge_in_group" | "fuliza_pair" | "unexplained";
}

export interface AnalysisBalance {
  opening: string | null;
  closing: string | null;
  highest: string | null;
  lowest: string | null;
  average: string | null;
  continuity: {
    checked: number;
    ok: number;
    explained: number;
    unexplained: number;
    samples: BalanceBreak[];
  };
}

export interface CategoryBreakdownRow {
  categoryId: number | null;
  name: string;
  count: number;
  totalIn: string;
  totalOut: string;
  shareOfOut: number;
}

export interface FeeRow {
  type: string;
  count: number;
  total: string;
}

export interface ContactRow {
  name: string;
  count: number;
  total: string;
  average: string;
}

export interface RecurringRow {
  description: string;
  type: "sent" | "received" | "mixed";
  frequency: string;
  occurrences: number;
  averageAmount: string;
  totalAmount: string;
  amountPattern: "fixed" | "variable";
  lastDate: string;
  nextExpected: string | null;
  medianIntervalDays: number;
}

export interface PeriodBreakdownRow {
  key: string;
  label: string;
  count: number;
  totalIn: string;
  totalOut: string;
  net: string;
  average: string;
}

export interface DailyBalanceRow {
  date: string;
  endBalance: string;
  highest: string;
  lowest: string;
  count: number;
}

export interface DistributionRow {
  key: string;
  label: string;
  inCount: number;
  inTotal: string;
  outCount: number;
  outTotal: string;
}

export interface ActivityRow {
  key: string;
  label: string;
  count: number;
  totalIn: string;
  totalOut: string;
  net: string;
  share: number;
}

export interface ReversalRow {
  externalId: string;
  date: string;
  time: string | null;
  details: string;
  direction: "in" | "out";
  amount: string;
  linkedExternalId: string | null;
  linkMethod: "counterparty" | "none";
}

export interface PaybillRow {
  type: "paybill" | "till";
  number: string | null;
  name: string | null;
  count: number;
  total: string;
  fees: string;
  accountReference: string | null;
}

export interface AnomalyRow {
  externalId: string;
  date: string;
  details: string;
  amount: string;
  reason: string;
}

export interface StatementAnalysis {
  period: AnalysisPeriod;
  summary: AnalysisSummary;
  balance: AnalysisBalance;
  categories: CategoryBreakdownRow[];
  fees: {
    total: string;
    count: number;
    percentOfOut: number;
    byType: FeeRow[];
    topRecipients: ContactRow[];
  };
  moneyIn: { count: number; total: string; largest: AnalysisRowRef | null; bySource: ContactRow[] };
  moneyOut: { count: number; total: string; largest: AnalysisRowRef | null; byDestination: ContactRow[] };
  financing: { drawdowns: string; repayments: string; net: string; count: number };
  topContacts: { sent: ContactRow[]; received: ContactRow[] };
  recurring: RecurringRow[];
  breakdown: { monthly: PeriodBreakdownRow[]; weekly: PeriodBreakdownRow[] };
  dailyBalance: DailyBalanceRow[];
  distribution: DistributionRow[];
  timeOfDay: { hours: ActivityRow[]; periods: ActivityRow[] };
  dayOfWeek: ActivityRow[];
  reversals: ReversalRow[];
  payBillsTills: { shortcodes: PaybillRow[]; accounts: Array<{ account: string; paybill: string | null; count: number; total: string }> };
  anomalies: {
    duplicates: AnomalyRow[];
    large: AnomalyRow[];
    outOfHours: AnomalyRow[];
    balanceBreaks: BalanceBreak[];
    uncategorisedSpend: { count: number; total: string };
  };
  reconciliation: {
    statementIn: string | null;
    statementOut: string | null;
    computedIn: string;
    computedOut: string;
    diffIn: string | null;
    diffOut: string | null;
    matches: boolean;
    duplicateCount: number;
  };
  generatedAt: string;
}

export interface AnalysisOptions {
  categoryOf?: (row: ParsedStatementRow) => { id: number | null; name: string } | null;
  duplicateCount?: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DISTRIBUTION_BUCKETS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: "lt100", label: "Under KES 100", min: 0, max: 100 },
  { key: "100-499", label: "KES 100–499", min: 100, max: 500 },
  { key: "500-999", label: "KES 500–999", min: 500, max: 1000 },
  { key: "1000-1999", label: "KES 1,000–1,999", min: 1000, max: 2000 },
  { key: "2000-4999", label: "KES 2,000–4,999", min: 2000, max: 5000 },
  { key: "5000-9999", label: "KES 5,000–9,999", min: 5000, max: 10000 },
  { key: "10000-49999", label: "KES 10,000–49,999", min: 10000, max: 50000 },
  { key: "50000-99999", label: "KES 50,000–99,999", min: 50000, max: 100000 },
  { key: "gte100000", label: "KES 100,000+", min: 100000, max: Number.POSITIVE_INFINITY },
];

const TIME_PERIODS: Array<{ key: string; label: string; from: number; to: number }> = [
  { key: "early-morning", label: "Early Morning (05:00–07:00)", from: 5, to: 7 },
  { key: "morning-rush", label: "Morning Rush (07:00–09:00)", from: 7, to: 9 },
  { key: "morning", label: "Morning (09:00–11:00)", from: 9, to: 11 },
  { key: "midday", label: "Midday (11:00–13:00)", from: 11, to: 13 },
  { key: "afternoon", label: "Afternoon (13:00–17:00)", from: 13, to: 17 },
  { key: "evening", label: "Evening (17:00–20:00)", from: 17, to: 20 },
  { key: "night", label: "Night (20:00–05:00)", from: 20, to: 29 },
];

function isCharge(row: ParsedStatementRow): boolean {
  return row.txnType === "charge" || row.rail === "charge";
}

function isFinancing(row: ParsedStatementRow): boolean {
  return row.rail === "fuliza_draw" || row.rail === "fuliza_repay";
}

function signed(row: ParsedStatementRow): string {
  return row.direction === "in" ? row.paidIn : `-${row.withdrawn}`;
}

function amountOf(row: ParsedStatementRow): string {
  return row.direction === "in" ? row.paidIn : row.withdrawn;
}

function average(total: string, count: number): string {
  if (count <= 0) return "0.00";
  return new Decimal(total).div(count).toFixed(2);
}

function percentOf(part: string, total: string): number {
  const t = new Decimal(total);
  if (t.isZero()) return 0;
  return new Decimal(part).div(t).mul(100).toDecimalPlaces(2).toNumber();
}

function ref(row: ParsedStatementRow): AnalysisRowRef {
  return { externalId: row.externalId, date: row.date, details: row.details, amount: amountOf(row) };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
  const [year, week] = key.split("-W");
  return `Week ${Number(week)} ${year}`;
}

function weekdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return WEEKDAYS[d.getUTCDay()] ?? "Unknown";
}

function hourOf(time: string | null): number | null {
  if (!time) return null;
  const hour = Number(time.slice(0, 2));
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function periodForHour(hour: number): { key: string; label: string } | null {
  for (const period of TIME_PERIODS) {
    const h = hour < 5 ? hour + 24 : hour;
    if (h >= period.from && h < period.to) return { key: period.key, label: period.label };
  }
  return null;
}

function bucketFor(amount: string): { key: string; label: string } {
  const n = Number(amount);
  for (const bucket of DISTRIBUTION_BUCKETS) {
    if (n >= bucket.min && n < bucket.max) return { key: bucket.key, label: bucket.label };
  }
  return { key: "unknown", label: "Unknown" };
}

function feeTypeLabel(details: string): string {
  const d = details.toLowerCase();
  if (d.includes("pay bill charge")) return "Pay Bill Fee";
  if (d.includes("merchant charge")) return "Merchant Payment Fee";
  if (d.includes("withdrawal charge")) return "Withdrawal Fee";
  if (d.includes("transfer of funds charge")) return "Send Money Fee";
  if (d.includes("fuliza") || d.includes("overdraw")) return "Fuliza Fee";
  return "Other Fee";
}

function contactKey(row: ParsedStatementRow): string {
  return (row.counterpartyName ?? row.details.split(" - ").pop() ?? "Unknown").trim();
}

function groupRows(rows: ParsedStatementRow[], keyOf: (row: ParsedStatementRow) => string): Map<string, ParsedStatementRow[]> {
  const map = new Map<string, ParsedStatementRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function contactRows(rows: ParsedStatementRow[], limit = 20): ContactRow[] {
  const groups = groupRows(rows, contactKey);
  return [...groups.entries()]
    .map(([name, list]) => {
      const total = sumAmounts(list.map(amountOf));
      return { name, count: list.length, total, average: average(total, list.length) };
    })
    .sort((a, b) => compareAmounts(b.total, a.total))
    .slice(0, limit);
}

function balanceContinuity(rows: ParsedStatementRow[]): AnalysisBalance["continuity"] {
  const byReceipt = new Map<string, ParsedStatementRow[]>();
  for (const row of rows) {
    const list = byReceipt.get(row.groupId) ?? [];
    list.push(row);
    byReceipt.set(row.groupId, list);
  }

  let ok = 0;
  let explained = 0;
  let unexplained = 0;
  const samples: BalanceBreak[] = [];

  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];
    const expected = new Decimal(next.balance).plus(signed(current));
    const gap = new Decimal(current.balance).minus(expected).toFixed(2);

    if (Math.abs(Number(gap)) <= 0.005) {
      ok++;
      continue;
    }

    let reason: BalanceBreak["reason"] = "unexplained";
    if (current.groupId === next.groupId) {
      reason = "same_receipt";
    } else if (isCharge(current) || isCharge(next) || isFinancing(current) || isFinancing(next)) {
      reason = "bundle_leg";
    } else {
      const groupCharges = (byReceipt.get(current.groupId) ?? []).filter(isCharge);
      if (groupCharges.some((row) => compareAmounts(row.withdrawn, absoluteAmount(gap)) === 0)) {
        reason = "charge_in_group";
      } else {
        const nearFuliza = rows
          .slice(Math.max(0, i - 2), Math.min(rows.length, i + 3))
          .some((row) => isFinancing(row) && row.date === current.date && row.time === current.time);
        if (nearFuliza) reason = "fuliza_pair";
      }
    }

    if (reason === "unexplained") {
      unexplained++;
      if (samples.length < 10) {
        samples.push({
          currentExternalId: current.externalId,
          nextExternalId: next.externalId,
          currentBalance: current.balance,
          nextBalance: next.balance,
          gap,
          details: current.details,
          reason,
        });
      }
    } else {
      explained++;
    }
  }

  return { checked: Math.max(0, rows.length - 1), ok, explained, unexplained, samples };
}

/** Structural guard for older imports that stored only a minimal analysis snapshot. */
export function isStatementAnalysis(value: unknown): value is StatementAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return Boolean(
    candidate.summary
      && candidate.balance
      && Array.isArray(candidate.categories)
      && candidate.breakdown
      && candidate.reconciliation,
  );
}

export function buildStatementAnalysis(
  statement: ParsedStatement,
  options: AnalysisOptions = {},
): StatementAnalysis {  const rows = statement.rows;
  const categoryOf = options.categoryOf ?? ((row: ParsedStatementRow) => ({
    id: null,
    name: row.categoryKey ?? "No category",
  }));

  const totalIn = sumAmounts(rows.map((row) => row.paidIn));
  const totalOut = sumAmounts(rows.map((row) => row.withdrawn));
  const totalFees = sumAmounts(rows.filter(isCharge).map((row) => row.withdrawn));
  const net = subtractAmounts(totalIn, totalOut);

  const start = statement.metadata.periodStart ?? (rows.length ? [...rows].sort((a, b) => a.date.localeCompare(b.date))[0].date : null);
  const end = statement.metadata.periodEnd ?? (rows.length ? [...rows].sort((a, b) => b.date.localeCompare(a.date))[0].date : null);
  const days = start && end ? daysInclusive(start, end) : 0;

  const operatingIn = rows.filter((row) => row.direction === "in" && !isFinancing(row));
  const operatingOut = rows.filter((row) => row.direction === "out" && !isCharge(row) && !isFinancing(row));

  const highestIn = [...rows.filter((row) => row.direction === "in")].sort((a, b) => compareAmounts(b.paidIn, a.paidIn))[0];
  const highestOut = [...operatingOut].sort((a, b) => compareAmounts(b.withdrawn, a.withdrawn))[0];

  const dayCounts = new Map<string, number>();
  const weekdayCounts = new Map<string, number>();
  for (const row of rows) {
    dayCounts.set(row.date, (dayCounts.get(row.date) ?? 0) + 1);
    const day = weekdayOf(row.date);
    weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
  }
  const mostActiveDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestWeekday = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const balances = rows.map((row) => row.balance);
  const closing = rows[0]?.balance ?? null;
  const opening = closing ? subtractAmounts(closing, net) : null;
  const highestBalance = balances.length ? balances.reduce((a, b) => (compareAmounts(a, b) >= 0 ? a : b)) : null;
  const lowestBalance = balances.length ? balances.reduce((a, b) => (compareAmounts(a, b) <= 0 ? a : b)) : null;
  const averageBalance = balances.length ? new Decimal(sumAmounts(balances)).div(balances.length).toFixed(2) : null;

  const categoryGroups = new Map<string, { id: number | null; rows: ParsedStatementRow[] }>();
  for (const row of rows) {
    const category = categoryOf(row) ?? { id: null, name: "No category" };
    const key = `${category.id ?? "none"}:${category.name}`;
    const entry = categoryGroups.get(key) ?? { id: category.id, rows: [] };
    entry.rows.push(row);
    categoryGroups.set(key, entry);
  }
  const categories: CategoryBreakdownRow[] = [...categoryGroups.entries()]
    .map(([key, entry]) => {
      const name = key.split(":").slice(1).join(":") || "No category";
      const out = sumAmounts(entry.rows.filter((row) => row.direction === "out").map((row) => row.withdrawn));
      return {
        categoryId: entry.id,
        name,
        count: entry.rows.length,
        totalIn: sumAmounts(entry.rows.map((row) => row.paidIn)),
        totalOut: out,
        shareOfOut: percentOf(out, totalOut),
      };
    })
    .sort((a, b) => compareAmounts(b.totalOut, a.totalOut));

  const chargeRows = rows.filter(isCharge);
  const feeGroups = new Map<string, ParsedStatementRow[]>();
  for (const row of chargeRows) {
    const key = feeTypeLabel(row.details);
    const list = feeGroups.get(key) ?? [];
    list.push(row);
    feeGroups.set(key, list);
  }
  const feeByType: FeeRow[] = [...feeGroups.entries()]
    .map(([type, list]) => ({ type, count: list.length, total: sumAmounts(list.map((row) => row.withdrawn)) }))
    .sort((a, b) => compareAmounts(b.total, a.total));

  const rowByExternalId = new Map(rows.map((row) => [row.externalId, row]));
  const feeRecipientGroups = new Map<string, { count: number; total: string[] }>();
  for (const charge of chargeRows) {
    const parent = charge.linkedTxnExternalId ? rowByExternalId.get(charge.linkedTxnExternalId) : undefined;
    const name = parent?.counterpartyName ?? parent?.details ?? "Unlinked charges";
    const entry = feeRecipientGroups.get(name) ?? { count: 0, total: [] };
    entry.count++;
    entry.total.push(charge.withdrawn);
    feeRecipientGroups.set(name, entry);
  }
  const feeRecipients: ContactRow[] = [...feeRecipientGroups.entries()]
    .map(([name, entry]) => {
      const total = sumAmounts(entry.total);
      return { name, count: entry.count, total, average: average(total, entry.count) };
    })
    .sort((a, b) => compareAmounts(b.total, a.total))
    .slice(0, 10);

  const operatingOutTotal = sumAmounts(operatingOut.map((row) => row.withdrawn));

  const moneyInGroups = contactRows(operatingIn);
  const moneyOutGroups = contactRows(operatingOut);

  const financingRows = rows.filter(isFinancing);
  const drawdowns = sumAmounts(rows.filter((row) => row.rail === "fuliza_draw").map((row) => row.paidIn));
  const repayments = sumAmounts(rows.filter((row) => row.rail === "fuliza_repay").map((row) => row.withdrawn));

  const recurringGroups = new Map<string, ParsedStatementRow[]>();
  for (const row of rows) {
    if (isCharge(row)) continue;
    const key = `${contactKey(row)}::${row.rail}`;
    const list = recurringGroups.get(key) ?? [];
    list.push(row);
    recurringGroups.set(key, list);
  }
  const recurring: RecurringRow[] = [...recurringGroups.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date));
      const medianInterval = Math.max(0, Math.round(median(intervals)));
      const amounts = sorted.map((row) => Number(amountOf(row)));
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const maxDeviation = Math.max(...amounts.map((value) => Math.abs(value - mean)));
      const fixed = mean > 0 && maxDeviation / mean <= 0.1;
      const directions = new Set(sorted.map((row) => row.direction));
      const frequency =
        medianInterval <= 2 ? "Daily" :
        medianInterval <= 9 ? "Weekly" :
        medianInterval <= 18 ? "Biweekly" :
        medianInterval <= 35 ? "Monthly" :
        medianInterval <= 100 ? "Quarterly" :
        medianInterval <= 380 ? "Yearly" : "Irregular";
      const total = sumAmounts(sorted.map(amountOf));
      return {
        description: sorted[0].counterpartyName ?? sorted[0].details,
        type: (directions.size > 1 ? "mixed" : sorted[0].direction === "in" ? "received" : "sent") as RecurringRow["type"],
        frequency,
        occurrences: sorted.length,
        averageAmount: average(total, sorted.length),
        totalAmount: total,
        amountPattern: (fixed ? "fixed" : "variable") as RecurringRow["amountPattern"],
        lastDate: sorted[sorted.length - 1].date,
        nextExpected: medianInterval > 0 ? addDays(sorted[sorted.length - 1].date, medianInterval) : null,
        medianIntervalDays: medianInterval,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);

  const buildPeriods = (keyOf: (row: ParsedStatementRow) => string, labelOf: (key: string) => string): PeriodBreakdownRow[] => {
    const map = new Map<string, ParsedStatementRow[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => {
        const inTotal = sumAmounts(list.map((row) => row.paidIn));
        const outTotal = sumAmounts(list.map((row) => row.withdrawn));
        return {
          key,
          label: labelOf(key),
          count: list.length,
          totalIn: inTotal,
          totalOut: outTotal,
          net: subtractAmounts(inTotal, outTotal),
          average: average(subtractAmounts(inTotal, outTotal), list.length),
        };
      });
  };

  const dailyGroups = groupRows(rows, (row) => row.date);
  const dailyBalance: DailyBalanceRow[] = [...dailyGroups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => {
      const balancesForDay = list.map((row) => row.balance);
      return {
        date,
        endBalance: list[0].balance,
        highest: balancesForDay.reduce((a, b) => (compareAmounts(a, b) >= 0 ? a : b)),
        lowest: balancesForDay.reduce((a, b) => (compareAmounts(a, b) <= 0 ? a : b)),
        count: list.length,
      };
    });

  const distributionMap = new Map<string, { label: string; inCount: number; in: string[]; outCount: number; out: string[] }>();
  for (const bucket of DISTRIBUTION_BUCKETS) {
    distributionMap.set(bucket.key, { label: bucket.label, inCount: 0, in: [], outCount: 0, out: [] });
  }
  for (const row of rows) {
    if (isCharge(row)) continue;
    const bucket = bucketFor(amountOf(row));
    const entry = distributionMap.get(bucket.key);
    if (!entry) continue;
    if (row.direction === "in") {
      entry.inCount++;
      entry.in.push(row.paidIn);
    } else {
      entry.outCount++;
      entry.out.push(row.withdrawn);
    }
  }
  const distribution: DistributionRow[] = [...distributionMap.entries()].map(([key, entry]) => ({
    key,
    label: entry.label,
    inCount: entry.inCount,
    inTotal: sumAmounts(entry.in),
    outCount: entry.outCount,
    outTotal: sumAmounts(entry.out),
  }));

  const activity = (keyOf: (row: ParsedStatementRow) => string, labelOf: (key: string) => string): ActivityRow[] => {
    const map = new Map<string, ParsedStatementRow[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => {
        const inTotal = sumAmounts(list.map((row) => row.paidIn));
        const outTotal = sumAmounts(list.map((row) => row.withdrawn));
        return {
          key,
          label: labelOf(key),
          count: list.length,
          totalIn: inTotal,
          totalOut: outTotal,
          net: subtractAmounts(inTotal, outTotal),
          share: percentOf(String(list.length), String(rows.length)),
        };
      });
  };

  const hourKeys = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const hours = activity(
    (row) => {
      const hour = hourOf(row.time);
      return hour === null ? "unknown" : String(hour).padStart(2, "0");
    },
    (key) => (key === "unknown" ? "Unknown time" : `${key}:00–${key}:59`),
  ).filter((row) => hourKeys.includes(row.key) || row.key === "unknown");

  const periods = activity(
    (row) => {
      const hour = hourOf(row.time);
      return hour === null ? "unknown" : periodForHour(hour)?.key ?? "unknown";
    },
    (key) => (key === "unknown" ? "Unknown time" : TIME_PERIODS.find((p) => p.key === key)?.label ?? key),
  );

  const dayOfWeek = activity(
    (row) => weekdayOf(row.date),
    (key) => key,
  );

  const reversals: ReversalRow[] = [];
  const usedParents = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rail !== "reversal") continue;
    let linked: ParsedStatementRow | undefined;
    for (let j = i + 1; j < rows.length; j++) {
      const candidate = rows[j];
      if (usedParents.has(candidate.externalId)) continue;
      if (candidate.direction === row.direction) continue;
      if (compareAmounts(amountOf(candidate), amountOf(row)) !== 0) continue;
      if (contactKey(candidate).toLowerCase() !== contactKey(row).toLowerCase()) continue;
      linked = candidate;
      break;
    }
    if (linked) usedParents.add(linked.externalId);
    reversals.push({
      externalId: row.externalId,
      date: row.date,
      time: row.time,
      details: row.details,
      direction: row.direction,
      amount: amountOf(row),
      linkedExternalId: linked?.externalId ?? null,
      linkMethod: linked ? "counterparty" : "none",
    });
  }

  const paybillGroups = new Map<string, ParsedStatementRow[]>();
  for (const row of rows) {
    if (row.rail !== "paybill" && row.rail !== "till") continue;
    const key = `${row.rail}:${row.counterpartyId ?? "unknown"}`;
    const list = paybillGroups.get(key) ?? [];
    list.push(row);
    paybillGroups.set(key, list);
  }
  const chargesByGroup = new Map<string, ParsedStatementRow[]>();
  for (const charge of chargeRows) {
    const list = chargesByGroup.get(charge.groupId) ?? [];
    list.push(charge);
    chargesByGroup.set(charge.groupId, list);
  }
  const paybillRows: PaybillRow[] = [...paybillGroups.entries()].map(([key, list]) => {
    const [type, number] = key.split(":");
    const fees = sumAmounts(
      list.flatMap((row) => (chargesByGroup.get(row.groupId) ?? []).map((charge) => charge.withdrawn)),
    );
    return {
      type: (type === "till" ? "till" : "paybill") as PaybillRow["type"],
      number: number === "unknown" ? null : number,
      name: list[0].counterpartyName,
      count: list.length,
      total: sumAmounts(list.map((row) => row.withdrawn)),
      fees,
      accountReference: list.find((row) => row.accountReference)?.accountReference ?? null,
    };
  }).sort((a, b) => compareAmounts(b.total, a.total));

  const accountGroups = new Map<string, { paybill: string | null; count: number; total: string[] }>();
  for (const row of rows) {
    if (row.rail !== "paybill" || !row.accountReference) continue;
    const entry = accountGroups.get(row.accountReference) ?? { paybill: row.counterpartyId, count: 0, total: [] };
    entry.count++;
    entry.total.push(row.withdrawn);
    accountGroups.set(row.accountReference, entry);
  }
  const accounts = [...accountGroups.entries()].map(([account, entry]) => ({
    account,
    paybill: entry.paybill,
    count: entry.count,
    total: sumAmounts(entry.total),
  }));

  const duplicateGroups = new Map<string, ParsedStatementRow[]>();
  for (const row of rows) {
    if (isCharge(row) || row.rail === "fuliza_draw") continue;
    const key = `${row.date}|${row.time ?? ""}|${row.amount}|${row.direction}|${row.details}`;
    const list = duplicateGroups.get(key) ?? [];
    list.push(row);
    duplicateGroups.set(key, list);
  }
  const duplicates: AnomalyRow[] = [...duplicateGroups.values()]
    .filter((list) => list.length > 1)
    .flatMap((list) => list.slice(1).map((row) => ({
      externalId: row.externalId,
      date: row.date,
      details: row.details,
      amount: row.amount,
      reason: "Duplicate candidate",
    })))
    .slice(0, 20);

  const nonChargeAmounts = rows.filter((row) => !isCharge(row)).map((row) => Number(amountOf(row))).sort((a, b) => a - b);
  const p95 = nonChargeAmounts.length ? nonChargeAmounts[Math.floor(0.95 * (nonChargeAmounts.length - 1))] : 0;
  const large: AnomalyRow[] = rows
    .filter((row) => !isCharge(row) && Number(amountOf(row)) >= p95 && p95 > 0)
    .sort((a, b) => Number(amountOf(b)) - Number(amountOf(a)))
    .slice(0, 10)
    .map((row) => ({
      externalId: row.externalId,
      date: row.date,
      details: row.details,
      amount: row.amount,
      reason: `Above p95 (${p95.toFixed(2)})`,
    }));

  const outOfHours: AnomalyRow[] = rows
    .filter((row) => {
      const hour = hourOf(row.time);
      return hour !== null && (hour >= 22 || hour < 6);
    })
    .slice(0, 20)
    .map((row) => ({
      externalId: row.externalId,
      date: row.date,
      details: row.details,
      amount: row.amount,
      reason: "Out of hours",
    }));

  const continuity = balanceContinuity(rows);

  const uncategorised = operatingOut.filter((row) => !(categoryOf(row)?.id));
  const uncategorisedSpend = {
    count: uncategorised.length,
    total: sumAmounts(uncategorised.map((row) => row.withdrawn)),
  };

  const statementSummary = statement.statementSummary;
  const diffIn = statementSummary ? subtractAmounts(totalIn, statementSummary.totalIn) : null;
  const diffOut = statementSummary ? subtractAmounts(totalOut, statementSummary.totalOut) : null;

  return {
    period: { start, end, days },
    summary: {
      rowCount: rows.length,
      totalIn,
      totalOut,
      totalFees,
      net,
      avgDailyIn: days > 0 ? new Decimal(totalIn).div(days).toFixed(2) : "0.00",
      avgDailyOut: days > 0 ? new Decimal(totalOut).div(days).toFixed(2) : "0.00",
      avgTransactionsPerDay: days > 0 ? Math.round((rows.length / days) * 10) / 10 : 0,
      highestSingleIn: highestIn ? highestIn.paidIn : "0.00",
      highestSingleOut: highestOut ? highestOut.withdrawn : "0.00",
      highestSingleInRef: highestIn ? ref(highestIn) : null,
      highestSingleOutRef: highestOut ? ref(highestOut) : null,
      mostActiveDay: mostActiveDay ? { date: mostActiveDay[0], count: mostActiveDay[1] } : null,
      busiestWeekday: busiestWeekday ? { day: busiestWeekday[0], count: busiestWeekday[1] } : null,
    },
    balance: {
      opening,
      closing,
      highest: highestBalance,
      lowest: lowestBalance,
      average: averageBalance,
      continuity,
    },
    categories,
    fees: {
      total: totalFees,
      count: chargeRows.length,
      percentOfOut: percentOf(totalFees, operatingOutTotal),
      byType: feeByType,
      topRecipients: feeRecipients,
    },
    moneyIn: {
      count: operatingIn.length,
      total: sumAmounts(operatingIn.map((row) => row.paidIn)),
      largest: operatingIn.length ? ref(operatingIn.reduce((a, b) => (compareAmounts(a.paidIn, b.paidIn) >= 0 ? a : b))) : null,
      bySource: moneyInGroups,
    },
    moneyOut: {
      count: operatingOut.length,
      total: operatingOutTotal,
      largest: operatingOut.length ? ref(operatingOut.reduce((a, b) => (compareAmounts(a.withdrawn, b.withdrawn) >= 0 ? a : b))) : null,
      byDestination: moneyOutGroups,
    },
    financing: {
      drawdowns,
      repayments,
      net: subtractAmounts(drawdowns, repayments),
      count: financingRows.length,
    },
    topContacts: {
      sent: contactRows(operatingOut),
      received: contactRows(operatingIn),
    },
    recurring,
    breakdown: {
      monthly: buildPeriods((row) => monthKey(row.date), monthLabel),
      weekly: buildPeriods((row) => weekKey(row.date), weekLabel),
    },
    dailyBalance,
    distribution,
    timeOfDay: { hours, periods },
    dayOfWeek,
    reversals,
    payBillsTills: { shortcodes: paybillRows, accounts },
    anomalies: {
      duplicates,
      large,
      outOfHours,
      balanceBreaks: continuity.samples,
      uncategorisedSpend,
    },
    reconciliation: {
      statementIn: statementSummary?.totalIn ?? null,
      statementOut: statementSummary?.totalOut ?? null,
      computedIn: totalIn,
      computedOut: totalOut,
      diffIn,
      diffOut,
      matches: Boolean(statementSummary && diffIn && diffOut && compareAmounts(diffIn, "0.00") === 0 && compareAmounts(diffOut, "0.00") === 0),
      duplicateCount: options.duplicateCount ?? 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
