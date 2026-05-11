// ABOUTME: Shows inflow and outflow share for the current report period inside the reports dashboard.
// ABOUTME: Keeps hover, click, keyboard selection, and summary text consistent with the shared report chart design.
import type { KeyboardEvent } from "react";

import { Pie, PieChart, Cell } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, formatKES } from "@/lib/utils";

import {
  type InflowOutflowChartData,
  type InflowOutflowSegmentKey,
} from "./chart-data";
import { FinancialDistributionCard } from "./FinancialDistributionCard";
import { ReportChartLegend } from "./ReportChartLegend";

type InflowOutflowPieChartProps = {
  data: InflowOutflowChartData;
  selectedKey: InflowOutflowSegmentKey | null;
  onSelect: (key: InflowOutflowSegmentKey | null) => void;
};

const handleSegmentKeyDown = (
  event: KeyboardEvent<SVGElement>,
  segmentKey: InflowOutflowSegmentKey,
  onSelect: (key: InflowOutflowSegmentKey | null) => void,
  isActive: boolean,
) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onSelect(isActive ? null : segmentKey);
};

export function InflowOutflowPieChart({
  data,
  selectedKey,
  onSelect,
}: InflowOutflowPieChartProps) {
  const chartConfig = Object.fromEntries(
    data.segments.map((segment) => [
      segment.key,
      {
        label: segment.label,
        color: segment.color,
      },
    ]),
  );

  const activeSegment = data.segments.find((segment) => segment.key === selectedKey) ?? null;
  const netPositive = Number(data.net) >= 0;

  return (
    <FinancialDistributionCard
      title="Inflow vs Outflow"
      subtitle="Current period cash movement"
      isEmpty={data.isEmpty}
      emptyMessage="No inflow or outflow data is available for the selected period."
      summary={
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-[#8D8A87]">Net</p>
          <p className={cn("font-mono text-sm font-semibold", netPositive ? "text-[#2E7D32]" : "text-[#B75D7E]")}>
            {formatKES(data.net)}
          </p>
        </div>
      }
      chart={
        <div className="relative">
          <span className="sr-only">
            Inflow totals {formatKES(data.segments.find((segment) => segment.key === "inflow")?.amount ?? "0")}.
            Outflow totals {formatKES(data.segments.find((segment) => segment.key === "outflow")?.amount ?? "0")}.
            {activeSegment ? ` ${activeSegment.label} is selected.` : ""}
          </span>
          <ChartContainer className="mx-auto aspect-square h-[240px] max-w-[240px]" config={chartConfig}>
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_, __, item) => (
                      <div className="flex min-w-[10rem] items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-muted-foreground block text-xs">
                            {item.payload.label}
                          </span>
                          <span className="block font-mono font-semibold text-[#2D2A26]">
                            {formatKES(item.payload.amount)}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-[#8D8A87]">
                          {item.payload.percent}%
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={data.segments}
                dataKey="value"
                nameKey="key"
                innerRadius={64}
                outerRadius={92}
                strokeWidth={2}
                paddingAngle={2}
              >
                {data.segments.map((segment) => {
                  const isActive = selectedKey === segment.key;
                  const isDimmed = selectedKey !== null && !isActive;

                  return (
                    <Cell
                      key={segment.key}
                      fill={segment.color}
                      stroke={isActive ? "#8E4B66" : "#ffffff"}
                      strokeWidth={isActive ? 4 : 2}
                      opacity={isDimmed ? 0.45 : 1}
                      role="button"
                      tabIndex={0}
                      aria-label={`${segment.label} ${formatKES(segment.amount)} ${segment.percent} percent`}
                      onClick={() => onSelect(isActive ? null : segment.key)}
                      onKeyDown={(event) =>
                        handleSegmentKeyDown(event, segment.key, onSelect, isActive)
                      }
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-wide text-[#8D8A87]">Movement</span>
            <span className="mt-1 text-center font-mono text-sm font-semibold text-[#2D2A26]">
              {formatKES(data.totalMovement)}
            </span>
            <span className="mt-1 text-xs text-[#8D8A87]">
              {activeSegment ? activeSegment.label : "All cashflow"}
            </span>
          </div>
        </div>
      }
      legend={
        <ReportChartLegend
          title="Inflow vs Outflow"
          items={data.segments.map((segment) => ({
            key: segment.key,
            label: segment.label,
            amount: segment.amount,
            percent: segment.percent,
            color: segment.color,
            isActive: selectedKey === segment.key,
          }))}
          onSelect={(key) =>
            onSelect(selectedKey === key ? null : (key as InflowOutflowSegmentKey))
          }
        />
      }
    />
  );
}
