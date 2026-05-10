// ABOUTME: Shows actual expense distribution by budget category under the Budget vs Actual section.
// ABOUTME: Connects category selection in the chart and legend to the highlighted budget rows in the reports page.
import type { KeyboardEvent } from "react";

import { Pie, PieChart, Cell } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, formatKES } from "@/lib/utils";

import { type BudgetActualChartData } from "./chart-data";
import { FinancialDistributionCard } from "./FinancialDistributionCard";
import { ReportChartLegend } from "./ReportChartLegend";

type BudgetActualExpensesPieChartProps = {
  data: BudgetActualChartData;
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
};

const handleCategoryKeyDown = (
  event: KeyboardEvent<SVGElement>,
  categoryId: number,
  onSelectCategory: (categoryId: number | null) => void,
  isActive: boolean,
) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onSelectCategory(isActive ? null : categoryId);
};

export function BudgetActualExpensesPieChart({
  data,
  selectedCategoryId,
  onSelectCategory,
}: BudgetActualExpensesPieChartProps) {
  const chartConfig = Object.fromEntries(
    data.segments.map((segment) => [
      segment.key,
      {
        label: segment.label,
        color: segment.color,
      },
    ]),
  );

  const activeSegment =
    data.segments.find((segment) => segment.categoryId === selectedCategoryId) ?? null;
  const positiveVariance = Number(data.totalVariance) >= 0;

  return (
    <FinancialDistributionCard
      title="Budget vs Actual Expenses"
      subtitle="Actual spend share by category"
      isEmpty={data.isEmpty}
      emptyMessage="No actual expenses are available for the selected period yet."
      summary={
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-[#8D8A87]">Variance</p>
          <p
            className={cn(
              "font-mono text-sm font-semibold",
              positiveVariance ? "text-[#2E7D32]" : "text-[#B75D7E]",
            )}
          >
            {formatKES(data.totalVariance)}
          </p>
        </div>
      }
      chart={
        <div className="relative">
          <span className="sr-only">
            Total actual expenses {formatKES(data.totalActual)} against a budget of{" "}
            {formatKES(data.totalBudgeted)}. {activeSegment ? `${activeSegment.label} is selected.` : ""}
          </span>
          <ChartContainer className="mx-auto aspect-square h-[240px] max-w-[240px]" config={chartConfig}>
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_, __, item) => (
                      <div className="min-w-[12rem] space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs">
                            {item.payload.label}
                          </span>
                          <span className="font-mono text-xs text-[#8D8A87]">
                            {item.payload.percent}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[#8D8A87]">Actual</span>
                          <span className="font-mono font-semibold text-[#2D2A26]">
                            {formatKES(item.payload.actual)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-[#8D8A87]">Budget</span>
                          <span className="font-mono text-xs text-[#2D2A26]">
                            {formatKES(item.payload.budgeted)}
                          </span>
                        </div>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={data.segments}
                dataKey="value"
                nameKey="key"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                strokeWidth={2}
              >
                {data.segments.map((segment) => {
                  const isActive = selectedCategoryId === segment.categoryId;
                  const isDimmed = selectedCategoryId !== null && !isActive;

                  return (
                    <Cell
                      key={segment.key}
                      fill={segment.color}
                      stroke={isActive ? "#8E4B66" : "#ffffff"}
                      strokeWidth={isActive ? 4 : 2}
                      opacity={isDimmed ? 0.4 : 1}
                      role="button"
                      tabIndex={0}
                      aria-label={`${segment.label} actual ${formatKES(segment.actual)} budget ${formatKES(segment.budgeted)} ${segment.percent} percent`}
                      onClick={() => onSelectCategory(isActive ? null : segment.categoryId)}
                      onKeyDown={(event) =>
                        handleCategoryKeyDown(
                          event,
                          segment.categoryId,
                          onSelectCategory,
                          isActive,
                        )
                      }
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-wide text-[#8D8A87]">Actual Spend</span>
            <span className="mt-1 text-center font-mono text-sm font-semibold text-[#2D2A26]">
              {formatKES(data.totalActual)}
            </span>
            <span className="mt-1 text-xs text-[#8D8A87]">
              {activeSegment ? activeSegment.label : "All categories"}
            </span>
          </div>
        </div>
      }
      legend={
        <ReportChartLegend
          title="Budget vs Actual Expenses"
          items={data.legendItems.map((item) => ({
            key: item.key,
            label: item.label,
            amount: item.amount,
            percent: item.percent,
            color: item.color,
            isActive: selectedCategoryId === item.key,
          }))}
          onSelect={(key) => onSelectCategory(selectedCategoryId === key ? null : Number(key))}
        />
      }
    />
  );
}
