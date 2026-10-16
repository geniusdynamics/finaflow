// ABOUTME: Pure billing math for subscriptions: due-date advancing, Wallos-parity cost normalization, cycle progress, and month projections.
// ABOUTME: No database or external dependencies; money math uses decimal.js and dates are plain YYYY-MM-DD strings plus Date objects.
import { d, Decimal } from "./decimal";

export type CycleUnit = "day" | "week" | "month" | "year";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_PROJECTION_MONTHS = 12;
const MAX_SCHEDULE_ADVANCES = 100_000;

type DateParts = { year: number; month: number; day: number };

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDateKey(value: string): DateParts {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) {
    throw new Error(`Invalid date key: ${String(value)}`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date key: ${value}`);
  }
  return { year, month, day };
}

function formatYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function formatDateParts({ year, month, day }: DateParts): string {
  return `${formatYearMonth(year, month)}-${String(day).padStart(2, "0")}`;
}

function toEpochDays({ year, month, day }: DateParts): number {
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function fromEpochDays(epochDays: number): string {
  const date = new Date(epochDays * MS_PER_DAY);
  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got: ${String(value)}`);
  }
}

// Default "today" uses the local calendar date, matching how due dates are displayed.
function localTodayKey(): string {
  const now = new Date();
  return formatDateParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

function resolveToday(today?: string): string {
  const key = today ?? localTodayKey();
  parseDateKey(key);
  return key;
}

// Adds `count` cycle units to a YYYY-MM-DD date.
// Month/year clamping is forward-only from the given due date (no anchor preservation):
// 2026-01-31 + 1 month -> 2026-02-28; advancing again from there -> 2026-03-28.
export function advanceDueDate(due: string, unit: CycleUnit, count: number): string {
  assertPositiveInteger(count, "count");
  const start = parseDateKey(due);
  if (unit === "day" || unit === "week") {
    const days = unit === "day" ? count : count * 7;
    return fromEpochDays(toEpochDays(start) + days);
  }
  const monthsToAdd = unit === "month" ? count : unit === "year" ? count * 12 : 0;
  if (monthsToAdd === 0) {
    throw new Error(`Unknown cycle unit: ${String(unit)}`);
  }
  const totalMonths = start.year * 12 + (start.month - 1) + monthsToAdd;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return formatDateParts({
    year,
    month,
    day: Math.min(start.day, daysInMonth(year, month)),
  });
}

// nextDueAfter = advanceDueDate(nextDueDate, unit, count)
export function nextDueAfter(nextDueDate: string, unit: CycleUnit, count: number): string {
  return advanceDueDate(nextDueDate, unit, count);
}

// Validate a money input string: finite decimal greater than zero. Returns the Decimal.
export function parsePositiveAmount(value: string, label = "amount"): Decimal {
  let parsed: Decimal;
  try {
    parsed = d(value);
  } catch {
    throw new Error(`Invalid ${label}: expected a decimal number`);
  }
  if (!parsed.isFinite() || parsed.lte(0)) {
    throw new Error(`Invalid ${label}: must be greater than zero`);
  }
  return parsed;
}

// Whole days from `today` until `due` (due - today); negative means overdue, 0 means day-of.
export function daysBetween(due: string, today: string): number {
  return toEpochDays(parseDateKey(due)) - toEpochDays(parseDateKey(today));
}

// Wallos-parity monthly normalization (stats_calculations.php getPricePerMonth):
//   day: amount * 30 / count; week: amount * 4.35 / count;
//   month: amount / count; year: amount / (12 * count).
// Rounded to 2dp ROUND_HALF_UP. `count` must be an integer >= 1.
export function monthlyNormalized(amount: string, unit: CycleUnit, count: number): Decimal {
  assertPositiveInteger(count, "count");
  const value = d(amount);
  switch (unit) {
    case "day":
      return value.times(30).div(count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    case "week":
      return value.times(4.35).div(count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    case "month":
      return value.div(count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    case "year":
      return value.div(12 * count).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    default:
      throw new Error(`Unknown cycle unit: ${String(unit)}`);
  }
}

// yearly = rounded monthly * 12, rounded again to 2dp.
export function yearlyNormalized(amount: string, unit: CycleUnit, count: number): Decimal {
  return monthlyNormalized(amount, unit, count)
    .times(12)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Wallos parity (list_subscriptions.php getSubscriptionProgress): cycleDays =
// day: count, week: 7 * count, month: 30 * count, year: 365 * count. Whole cycles
// are walked back from nextDueDate until the window [cycleStart, nextDueDate)
// contains today; progress = clamp(floor(daysSinceCycleStart / cycleDays * 100), 0, 100).
// Today before the window start => 0; one-time purchases => 0.
export function cycleProgress(
  nextDueDate: string,
  unit: CycleUnit,
  count: number,
  today?: string,
  isOneTime?: boolean,
): number {
  if (isOneTime) {
    return 0;
  }
  assertPositiveInteger(count, "count");
  const cycleDays =
    unit === "day"
      ? count
      : unit === "week"
        ? count * 7
        : unit === "month"
          ? count * 30
          : unit === "year"
            ? count * 365
            : 0;
  if (cycleDays <= 0) {
    throw new Error(`Unknown cycle unit: ${String(unit)}`);
  }
  const currentEpoch = toEpochDays(parseDateKey(resolveToday(today)));
  const nextDueEpoch = toEpochDays(parseDateKey(nextDueDate));
  const daysUntilDue = nextDueEpoch - currentEpoch;
  // A stale (past) due date keeps a single cycle window; its raw progress
  // exceeds 100 and is clamped below. A future due date may be many cycles
  // away, so whole cycles are walked back until the window contains today.
  const cyclesBack = daysUntilDue > 0 ? Math.max(1, Math.ceil(daysUntilDue / cycleDays)) : 1;
  const cycleStartEpoch = nextDueEpoch - cyclesBack * cycleDays;
  if (currentEpoch < cycleStartEpoch) {
    return 0;
  }
  const daysSinceCycleStart = currentEpoch - cycleStartEpoch;
  const progress = Math.floor((daysSinceCycleStart / cycleDays) * 100);
  return Math.min(100, Math.max(0, progress));
}

// True when an active subscription is past its due date (day-of is not overdue).
export function isOverdue(nextDueDate: string, status: string, today?: string): boolean {
  if (status.toLowerCase() !== "active") {
    return false;
  }
  return daysBetween(nextDueDate, resolveToday(today)) < 0;
}

// True when 0 <= days until due <= notifyDaysBefore; notifyDaysBefore <= 0 means day-of only.
export function isDueSoon(nextDueDate: string, notifyDaysBefore: number, today?: string): boolean {
  const windowDays = notifyDaysBefore > 0 ? notifyDaysBefore : 0;
  const daysUntilDue = daysBetween(nextDueDate, resolveToday(today));
  return daysUntilDue >= 0 && daysUntilDue <= windowDays;
}

export type SubscriptionSchedule = {
  id: number;
  amount: string;
  currency: string;
  cycleUnit: CycleUnit;
  cycleCount: number;
  isOneTime?: boolean;
  nextDueDate: string; // YYYY-MM-DD
  status: "active" | "paused" | "cancelled" | "expired";
  cancellationDate?: string | null; // stop projecting beyond this date (inclusive of that cycle if due <= cancellationDate)
};

export type MonthProjection = {
  month: string;
  total: Decimal;
  perCurrency: Record<string, Decimal>;
};

// Projects real due dates from nextDueDate forward into month buckets starting at the
// month containing `today`, at most `months` buckets (hard cap 12). One-time and
// paused/cancelled/expired subs never contribute; a cancellationDate stops the
// schedule after the last cycle due on or before it. Subs already past due start at
// their first future cycle. `total` sums amounts through the optional `convert`
// callback (default identity); `perCurrency` keeps raw amounts per currency code.
export function projectMonths(
  subs: SubscriptionSchedule[],
  months: number,
  today: string,
  convert?: (amount: Decimal, currency: string) => Decimal,
): MonthProjection[] {
  const todayParts = parseDateKey(today);
  const requested = Number.isFinite(months) ? Math.floor(months) : 12;
  const span = Math.min(MAX_PROJECTION_MONTHS, requested);
  if (span < 1) {
    return [];
  }
  const toBase = convert ?? ((amount: Decimal): Decimal => amount);

  const projections: MonthProjection[] = [];
  const byMonth = new Map<string, MonthProjection>();
  for (let i = 0; i < span; i++) {
    const totalMonths = todayParts.year * 12 + (todayParts.month - 1) + i;
    const month = formatYearMonth(Math.floor(totalMonths / 12), (totalMonths % 12) + 1);
    const entry: MonthProjection = { month, total: d("0"), perCurrency: {} };
    projections.push(entry);
    byMonth.set(month, entry);
  }

  const todayEpoch = toEpochDays(todayParts);

  for (const sub of subs) {
    if (sub.isOneTime || sub.status !== "active") {
      continue;
    }
    assertPositiveInteger(sub.cycleCount, "cycleCount");
    const cutoffEpoch = sub.cancellationDate
      ? toEpochDays(parseDateKey(sub.cancellationDate))
      : null;

    // Past-due subs still contribute: walk real due dates forward until one falls
    // on or after today, i.e. the first future cycle.
    let dueKey = sub.nextDueDate;
    let advances = 0;
    while (toEpochDays(parseDateKey(dueKey)) < todayEpoch) {
      dueKey = advanceDueDate(dueKey, sub.cycleUnit, sub.cycleCount);
      if (++advances > MAX_SCHEDULE_ADVANCES) {
        throw new Error(`Subscription ${sub.id} schedule does not converge`);
      }
    }

    while (true) {
      const entry = byMonth.get(dueKey.slice(0, 7));
      if (!entry) {
        break;
      }
      const dueEpoch = toEpochDays(parseDateKey(dueKey));
      if (cutoffEpoch !== null && dueEpoch > cutoffEpoch) {
        break;
      }
      const raw = d(sub.amount);
      entry.perCurrency[sub.currency] = (entry.perCurrency[sub.currency] ?? d("0")).plus(raw);
      entry.total = entry.total.plus(toBase(raw, sub.currency));
      dueKey = advanceDueDate(dueKey, sub.cycleUnit, sub.cycleCount);
    }
  }

  return projections;
}
