// ABOUTME: Pure helper for the 30-day cashflow trend chart on the dashboard.
// ABOUTME: Converts the per-day series returned by trpc.dashboard.cashflowTrend into Recharts-friendly numbers.
export type CashflowDay = {
  date: string;
  sales: string;
  expenses: string;
  net: string;
};

export type CashflowChartPoint = {
  date: string;
  label: string;
  sales: number;
  expenses: number;
  net: number;
};

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toNumber(value: string): number {
  const parsed = parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLabel(date: string): string {
  // Accepts YYYY-MM-DD. Parses as UTC to match the backend's to_char formatting.
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day)) return date;
  return `${day} ${SHORT_MONTHS[month] ?? ""}`;
}

export function buildCashflowTrendSeries(days: CashflowDay[] | undefined | null): CashflowChartPoint[] {
  if (!Array.isArray(days) || days.length === 0) return [];
  return days.map((d) => ({
    date: d.date,
    label: formatLabel(d.date),
    sales: toNumber(d.sales),
    expenses: toNumber(d.expenses),
    net: toNumber(d.net),
  }));
}

export function cashflowTrendIsEmpty(points: CashflowChartPoint[]): boolean {
  if (points.length === 0) return true;
  return points.every((p) => p.sales === 0 && p.expenses === 0);
}

export function computeCashflowYAxisMax(points: CashflowChartPoint[]): number {
  if (points.length === 0) return 1000;
  let max = 1;
  for (const p of points) {
    if (p.sales > max) max = p.sales;
    if (p.expenses > max) max = p.expenses;
    const absNet = Math.abs(p.net);
    if (absNet > max) max = absNet;
  }
  // Round up to a tidy ceiling for the y-axis.
  return Math.ceil(max / 1000) * 1000;
}
