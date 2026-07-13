// ABOUTME: 30-day cashflow trend chart for the main dashboard.
// ABOUTME: Uses Recharts ComposedChart with sales bars, expenses bars, and a net line.
import { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { cn, formatKES } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import {
  buildCashflowTrendSeries,
  cashflowTrendIsEmpty,
  computeCashflowYAxisMax,
  type CashflowDay,
} from "./cashflow-trend-data";

const chartConfig = {
  sales: { label: "Sales", color: "#2E7D32" },
  expenses: { label: "Expenses", color: "#D32F2F" },
  net: { label: "Net", color: "#C73E1D" },
};

type CashflowTrendCardProps = {
  days: CashflowDay[] | undefined;
  className?: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const seriesMap: Record<string, { value: number; color: string }> = {};
  for (const p of payload) {
    seriesMap[p.dataKey] = { value: p.value, color: chartConfig[p.dataKey as keyof typeof chartConfig]?.color ?? "#2D2A26" };
  }
  return (
    <div className="rounded-lg border border-[#E8E0D8] bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[#2D2A26]">{label}</p>
      <div className="space-y-1">
        {(["sales", "expenses", "net"] as const).map((key) => {
          const entry = seriesMap[key];
          if (!entry) return null;
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[#8D8A87]">{chartConfig[key].label}</span>
              </span>
              <span className="font-mono font-medium text-[#2D2A26]">
                {formatKES(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CashflowTrendCard({ days, className }: CashflowTrendCardProps) {
  const data = useMemo(() => buildCashflowTrendSeries(days), [days]);
  const isEmpty = cashflowTrendIsEmpty(data);
  const yAxisMax = useMemo(() => computeCashflowYAxisMax(data), [data]);

  return (
    <Card data-testid="cashflow-trend-card" className={cn("border-[#E8E0D8]", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
          <TrendingUp className="h-5 w-5 text-[#C73E1D]" />
          30-Day Cashflow Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#2E7D32]" />
            <span className="text-[#8D8A87]">Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-[#D32F2F]" />
            <span className="text-[#8D8A87]">Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[#C73E1D]" />
            <span className="text-[#8D8A87]">Net</span>
          </div>
        </div>
        {isEmpty ? (
          <div className="flex h-48 items-center justify-center text-sm text-[#8D8A87]">
            No cashflow activity in the selected period
          </div>
        ) : (
          <ChartContainer className="h-[260px] w-full min-w-0 sm:aspect-auto [&_.recharts-surface]:!overflow-visible" config={chartConfig}>
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E7D32" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2E7D32" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8D8A87", fontSize: 10 }}
                  axisLine={{ stroke: "#E8E0D8" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "#8D8A87", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `KES ${(value / 1000).toFixed(0)}K`}
                  domain={[0, yAxisMax]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F5EDE6" }} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#2E7D32"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#2E7D32" }}
                />
                <Bar
                  dataKey="expenses"
                  fill="#D32F2F"
                  opacity={0.55}
                  radius={[2, 2, 0, 0]}
                  barSize={6}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#C73E1D"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#C73E1D" }}
                />
              </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
