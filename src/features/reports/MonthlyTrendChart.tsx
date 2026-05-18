// ABOUTME: Monthly trend chart combining bar graphs (net profit) with line graphs (revenue).
// ABOUTME: Uses Recharts for responsive, interactive visualization.
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn, formatKES } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export interface MonthlyData {
  month: string;
  monthName: string;
  revenue: string;
  expenses: string;
  payroll: string;
  netProfit: string;
}

type MonthlyTrendChartProps = {
  data: MonthlyData[];
  year: number;
  className?: string;
};

const chartConfig = {
  revenue: { label: "Revenue", color: "#2E7D32" },
  expenses: { label: "Expenses", color: "#D32F2F" },
  netProfit: { label: "Net Profit", color: "#C73E1D" },
  margin: { label: "Margin %", color: "#8D8A87" },
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: MonthlyData }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 font-semibold">{label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-[#2E7D32]">Revenue:</span>
          <span className="font-mono">{formatKES(data.revenue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#D32F2F]">Expenses:</span>
          <span className="font-mono">{formatKES(data.expenses)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#D4A854]">Payroll:</span>
          <span className="font-mono">{formatKES(data.payroll)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1">
          <span className="font-medium">Net Profit:</span>
          <span className={cn("font-mono font-semibold", parseFloat(data.netProfit) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]")}>
            {formatKES(data.netProfit)}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs text-[#8D8A87]">
          <span>Margin:</span>
          <span className="font-mono">
            {data.revenue && parseFloat(data.revenue) > 0
              ? ((parseFloat(data.netProfit) / parseFloat(data.revenue)) * 100).toFixed(1)
              : "0.0"}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ProfitBar(props: { x?: number; y?: number; width?: number; height?: number; value?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#2E7D32" } = props;
  const isNegative = height < 0;
  const barHeight = Math.abs(height);
  const barY = isNegative ? y : y + height - barHeight;

  return (
    <g>
      <rect
        x={x}
        y={barY}
        width={width}
        height={barHeight}
        fill={fill}
        rx={2}
        ry={2}
      />
    </g>
  );
}

export function MonthlyTrendChart({ data, year, className }: MonthlyTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={cn("border-[#E8E0D8]", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#2E7D32]" />
            Monthly Trend — {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-[#8D8A87]">
            No monthly data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((m) => ({
    ...m,
    revenueNum: parseFloat(m.revenue) || 0,
    expensesNum: parseFloat(m.expenses) || 0,
    netProfitNum: parseFloat(m.netProfit) || 0,
    marginNum: m.revenue && parseFloat(m.revenue) > 0 
      ? ((parseFloat(m.netProfit) / parseFloat(m.revenue)) * 100)
      : 0,
  }));

  const maxValue = Math.max(...chartData.map((d) => Math.max(d.revenueNum, Math.abs(d.netProfitNum), d.expensesNum)), 1);
  const yAxisMax = Math.ceil(maxValue / 10000) * 10000;

  return (
    <Card className={cn("border-[#E8E0D8]", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#2E7D32]" />
          Monthly Trend — {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-sm bg-[#2E7D32]" />
            <span className="text-[#8D8A87]">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-3 rounded-sm bg-[#D32F2F]" />
            <span className="text-[#8D8A87]">Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded-full bg-[#C73E1D]" />
            <span className="text-[#8D8A87]">Net Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded-full bg-[#8D8A87]" />
            <span className="text-[#8D8A87]">Margin %</span>
          </div>
        </div>
        <ChartContainer className="h-[320px] w-full" config={chartConfig}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-[#E8E0D8]" vertical={false} />
              <XAxis
                dataKey="monthName"
                tick={{ fill: "#8D8A87", fontSize: 11 }}
                axisLine={{ stroke: "#E8E0D8" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#8D8A87", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `KES ${(value / 1000).toFixed(0)}K`}
                domain={[0, yAxisMax]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#8D8A87", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                domain={[0, 100]}
              />
              <ChartTooltip content={<CustomTooltip />} />
              <Bar
                yAxisId="left"
                dataKey="revenueNum"
                fill="#2E7D32"
                opacity={0.6}
                radius={[2, 2, 0, 0]}
                barSize={24}
              />
              <Bar
                yAxisId="left"
                dataKey="expensesNum"
                fill="#D32F2F"
                opacity={0.6}
                radius={[2, 2, 0, 0]}
                barSize={24}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="netProfitNum"
                stroke="#C73E1D"
                strokeWidth={2}
                dot={{ fill: "#C73E1D", r: 3 }}
                activeDot={{ r: 5, fill: "#C73E1D" }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginNum"
                stroke="#8D8A87"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ fill: "#8D8A87", r: 2 }}
                activeDot={{ r: 4, fill: "#8D8A87" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {chartData.slice(0, 4).map((m) => (
            <div key={m.month} className="rounded-lg bg-[#F5EDE6] p-2 text-center">
              <p className="text-[10px] text-[#8D8A87]">{m.monthName}</p>
              <p className={cn("font-mono text-sm font-semibold", m.netProfitNum >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]")}>
                {formatKES(m.netProfit)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
