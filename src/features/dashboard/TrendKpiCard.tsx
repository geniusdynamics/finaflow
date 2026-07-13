// ABOUTME: KPI card with trend percentage vs the prior period for the main dashboard.
// ABOUTME: Replaces the in-page KpiCard helper with a gradient background and a trend badge.
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatKES } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

export type TrendKpiCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  subtitle: string;
  /** Percent change vs prior period. Positive = good for sales/cashflow, negative = good for expenses. */
  trendPercent: number | null;
  /** Whether a positive % is good news for this KPI (sales = yes, expenses = no). */
  positiveIsGood?: boolean;
  /** Optional explicit override of the trend color (e.g. neutral KPIs). */
  trendColor?: "green" | "red" | "neutral";
  testId?: string;
};

function computeDirection(
  trendPercent: number | null,
  positiveIsGood: boolean,
): { direction: TrendDirection; color: "green" | "red" | "neutral" } {
  if (trendPercent === null || !Number.isFinite(trendPercent) || trendPercent === 0) {
    return { direction: "flat", color: "neutral" };
  }
  const isUp = trendPercent > 0;
  if (positiveIsGood) {
    return { direction: isUp ? "up" : "down", color: isUp ? "green" : "red" };
  }
  return { direction: isUp ? "down" : "up", color: isUp ? "red" : "green" };
}

const colorClasses: Record<"green" | "red" | "neutral", string> = {
  green: "bg-[#2E7D32]/10 text-[#2E7D32]",
  red: "bg-[#D32F2F]/10 text-[#D32F2F]",
  neutral: "bg-[#8D8A87]/10 text-[#8D8A87]",
};

const iconBgClasses: Record<"green" | "red" | "neutral", string> = {
  green: "bg-[#2E7D32]/10 text-[#2E7D32]",
  red: "bg-[#D32F2F]/10 text-[#D32F2F]",
  neutral: "bg-[#F5EDE6] text-[#8D8A87]",
};

const cardBgClasses: Record<"green" | "red" | "neutral", string> = {
  green: "bg-gradient-to-br from-[#2E7D32]/5 via-white to-[#2E7D32]/10",
  red: "bg-gradient-to-br from-[#D32F2F]/5 via-white to-[#D32F2F]/10",
  neutral: "bg-gradient-to-br from-[#F5EDE6] via-white to-white",
};

export function TrendKpiCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trendPercent,
  positiveIsGood = true,
  trendColor,
  testId,
}: TrendKpiCardProps) {
  const computed = computeDirection(trendPercent, positiveIsGood);
  const color = trendColor ?? computed.color;
  const direction = computed.direction;

  const trendLabel = trendPercent === null || !Number.isFinite(trendPercent)
    ? "—"
    : `${Math.abs(trendPercent).toFixed(1)}%`;

  const TrendIcon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  return (
    <Card
      data-testid={testId}
      className={cn("border-[#E8E0D8]", cardBgClasses[color])}
    >
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 sm:space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#8D8A87] sm:text-xs">
              {title}
            </p>
            <p
              data-testid={testId ? `${testId}-value` : undefined}
              className={cn(
                "font-mono text-base font-bold sm:text-2xl",
                color === "green" ? "text-[#2E7D32]" : color === "red" ? "text-[#D32F2F]" : "text-[#2D2A26]",
              )}
            >
              {formatKES(value)}
            </p>
            <p className="text-[10px] text-[#8D8A87] sm:text-xs">{subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={cn("rounded-lg p-1.5 sm:p-2", iconBgClasses[color])}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div
              data-testid={testId ? `${testId}-trend` : undefined}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:text-xs",
                colorClasses[color],
              )}
            >
              <TrendIcon className="h-3 w-3" />
              <span className="font-mono">{trendLabel}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
