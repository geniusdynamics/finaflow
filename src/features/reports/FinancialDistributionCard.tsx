// ABOUTME: Wraps report distribution charts in a consistent dashboard-style card.
// ABOUTME: Aligns chart, summary, legend, and empty states for the reports module visuals.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FinancialDistributionCardProps = {
  title: string;
  subtitle?: string;
  summary: ReactNode;
  chart: ReactNode;
  legend: ReactNode;
  isEmpty: boolean;
  emptyMessage: string;
  className?: string;
};

export function FinancialDistributionCard({
  title,
  subtitle,
  summary,
  chart,
  legend,
  isEmpty,
  emptyMessage,
  className,
}: FinancialDistributionCardProps) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-sm", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#2D2A26]">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-[#8D8A87]">{subtitle}</p> : null}
        </div>
        <div className="shrink-0">{summary}</div>
      </div>

      {isEmpty ? (
        <div className="mt-4 rounded-xl border border-dashed border-[#E8E0D8] bg-[#FAF7F3] p-6 text-sm text-[#8D8A87]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div className="min-w-0">{chart}</div>
          <div className="min-w-0">{legend}</div>
        </div>
      )}
    </section>
  );
}
