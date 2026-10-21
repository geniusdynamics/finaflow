// ABOUTME: Stats & analytics section for Subscriptions — KPI cards, category/branch donuts,
// ABOUTME: 12-month trends & forecast with budget line, and the upcoming/cancellations panels.
// ABOUTME: Self-contained: fetches subscriptions.stats and renders it (Wallos stats screen parity).
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Cell, Pie, PieChart, Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { Loader2, AlertTriangle, CalendarClock, TrendingUp } from "lucide-react";

const SEGMENT_COLORS = ["#C73E1D", "#6B4FA8", "#2E7D32", "#ED6C02", "#D4A854", "#8D8A87", "#D32F2F"];

function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount == null) return "—";
  const value = Number(amount);
  return `${currency} ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border-[#E8E0D8] bg-white">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-[#8D8A87]">{label}</p>
        <p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-[#8D8A87]">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DonutCard({
  title,
  segments,
  currency,
}: {
  title: string;
  segments: { key: string; label: string; monthly: string }[];
  currency: string;
}) {
  const data = segments
    .filter((s) => Number(s.monthly) > 0)
    .map((s, i) => ({
      key: s.key,
      label: s.label,
      value: Number(s.monthly),
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartConfig = Object.fromEntries(data.map((d) => [d.key, { label: d.label, color: d.color }])) as ChartConfig;

  return (
    <Card className="border-[#E8E0D8] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg text-[#2D2A26]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#8D8A87]">No data yet.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <ChartContainer className="mx-auto aspect-square h-[180px] max-w-[180px]" config={chartConfig}>
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="key" innerRadius={48} outerRadius={72} strokeWidth={2} paddingAngle={2}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="min-w-[140px] flex-1 space-y-1.5">
              {data.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate text-[#2D2A26]">{d.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[#8D8A87]">
                    {formatMoney(d.value.toFixed(2), currency)}
                    {total > 0 && <span className="ml-1 text-[10px]">({Math.round((d.value / total) * 100)}%)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SubscriptionStats() {
  const { data, isLoading, isError, refetch } = trpc.subscriptions.stats.useQuery({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-start gap-3 p-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Failed to load subscription stats</p>
            <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#C73E1D] hover:underline">
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currency = data.baseCurrency;
  const kpi = data.kpis;
  const forecastData = data.projection.map((p) => ({
    month: p.month,
    total: Number(p.total),
    budget: p.budget != null ? Number(p.budget) : null,
  }));

  return (
    <div className="space-y-6" data-testid="subscription-stats">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Subscriptions" value={String(kpi.activeCount)} hint={`${kpi.pausedCancelledCount} paused/cancelled`} />
        <KpiCard label="Monthly Cost" value={formatMoney(kpi.monthlyTotal, currency)} />
        <KpiCard label="Yearly Cost" value={formatMoney(kpi.yearlyTotal, currency)} />
        <KpiCard label="Cost per Day" value={formatMoney(kpi.costPerDay, currency)} />
        <KpiCard label="Avg Monthly Sub Cost" value={formatMoney(kpi.averageMonthly, currency)} />
        <KpiCard
          label="Most Expensive"
          value={kpi.mostExpensive ? formatMoney(kpi.mostExpensive.monthly, currency) : "—"}
          hint={kpi.mostExpensive ? `${kpi.mostExpensive.name} (${kpi.mostExpensive.currency} ${kpi.mostExpensive.amount})` : undefined}
        />
        <KpiCard
          label="Cheapest"
          value={kpi.cheapest ? formatMoney(kpi.cheapest.monthly, currency) : "—"}
          hint={kpi.cheapest ? `${kpi.cheapest.name} (${kpi.cheapest.currency} ${kpi.cheapest.amount})` : undefined}
        />
        <KpiCard label="Amount Due This Month" value={formatMoney(kpi.dueThisMonth, currency)} />
      </div>

      {/* Savings */}
      <Card className="border-[#2E7D32]/30 bg-[#2E7D32]/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-[#2E7D32]">Paused / Cancelled Savings</p>
            <p className="text-xs text-[#8D8A87]">What inactive subscriptions would have cost</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-[#8D8A87]">Monthly</p>
              <p className="font-mono text-sm font-semibold text-[#2E7D32]">{formatMoney(kpi.savingsMonthly, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-[#8D8A87]">Yearly</p>
              <p className="font-mono text-sm font-semibold text-[#2E7D32]">{formatMoney(kpi.savingsYearly, currency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split donuts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DonutCard
          title="Category Split"
          currency={currency}
          segments={data.categorySplit.map((s) => ({
            key: String(s.categoryId ?? "none"),
            label: s.categoryName ?? "Uncategorized",
            monthly: s.monthly,
          }))}
        />
        <DonutCard
          title="Branch Split"
          currency={currency}
          segments={data.branchSplit.map((s) => ({
            key: String(s.locationId ?? "main"),
            label: s.branchName ?? "Whole business",
            monthly: s.monthly,
          }))}
        />
      </div>

      {/* Trends & Forecast */}
      <Card className="border-[#E8E0D8] bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
            <TrendingUp className="h-5 w-5 text-[#C73E1D]" /> Trends &amp; Forecast (Next 12 Months)
          </CardTitle>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-[#8D8A87]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C73E1D]" /> Projected spend
            </span>
            <span className="flex items-center gap-1.5 text-[#8D8A87]">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-[#D4A854]" /> Budget
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span className="rounded-lg border border-[#E8E0D8] px-3 py-1.5">
              <span className="text-xs text-[#8D8A87]">Heaviest month: </span>
              <span className="font-medium text-[#2D2A26]">
                {data.heaviestMonth ? `${data.heaviestMonth.month} (${formatMoney(data.heaviestMonth.total, currency)})` : "—"}
              </span>
            </span>
            <span className={`rounded-lg border px-3 py-1.5 ${data.monthsOverBudget > 0 ? "border-[#D32F2F]/40 bg-[#D32F2F]/5" : "border-[#E8E0D8]"}`}>
              <span className="text-xs text-[#8D8A87]">Months over budget (next 12): </span>
              <span className={`font-medium ${data.monthsOverBudget > 0 ? "text-[#D32F2F]" : "text-[#2D2A26]"}`}>{data.monthsOverBudget}</span>
            </span>
          </div>
          <ChartContainer
            className="h-[260px] w-full min-w-0"
            config={{ total: { label: "Projected spend", color: "#C73E1D" }, budget: { label: "Budget", color: "#D4A854" } }}
          >
            <ComposedChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8D8A87", fontSize: 10 }} axisLine={{ stroke: "#E8E0D8" }} tickLine={false} minTickGap={16} />
              <YAxis tick={{ fill: "#8D8A87", fontSize: 10 }} axisLine={false} tickLine={false} />
              <ChartTooltip cursor={{ fill: "#F5EDE6" }} content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="#C73E1D" opacity={0.75} radius={[2, 2, 0, 0]} barSize={14} />
              <Line type="monotone" dataKey="budget" stroke="#D4A854" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Upcoming + cancellations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
              <CalendarClock className="h-5 w-5 text-[#ED6C02]" /> Upcoming (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#8D8A87]">Nothing due in the next 30 days.</p>
            ) : (
              <div className="space-y-2">
                {data.upcoming.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-2.5">
                    <div>
                      <p className="text-sm font-medium text-[#2D2A26]">{u.name}</p>
                      <p className="text-xs text-[#8D8A87]">
                        {u.nextDueDate} · {u.daysUntilDue === 0 ? "due today" : `in ${u.daysUntilDue} days`}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-[#2D2A26]">{formatMoney(u.amount, u.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg text-[#2D2A26]">Upcoming Cancellations (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingCancellations.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#8D8A87]">No cancellations scheduled.</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingCancellations.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-2.5">
                    <p className="text-sm font-medium text-[#2D2A26]">{c.name}</p>
                    <span className="text-xs text-[#D32F2F]">ends {c.cancellationDate}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
