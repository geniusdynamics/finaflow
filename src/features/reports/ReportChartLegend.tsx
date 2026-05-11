// ABOUTME: Renders interactive legend rows for report charts with keyboard-friendly buttons.
// ABOUTME: Mirrors slice selection state so chart interactions remain accessible outside the SVG surface.
import { cn, formatKES } from "@/lib/utils";

export type ReportChartLegendItem = {
  key: string | number;
  label: string;
  amount: string;
  percent: string;
  color: string;
  isActive: boolean;
};

type ReportChartLegendProps = {
  title: string;
  items: ReportChartLegendItem[];
  onSelect: (key: string | number) => void;
};

export function ReportChartLegend({ title, items, onSelect }: ReportChartLegendProps) {
  return (
    <div aria-label={`${title} legend`} className="space-y-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-label={`${item.label}: ${formatKES(item.amount)} (${item.percent} percent)`}
          aria-pressed={item.isActive}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
            item.isActive
              ? "border-[#D6A0B6] bg-[#FAF3F7]"
              : "border-transparent bg-[#FCFAF7] hover:border-[#E8E0D8] hover:bg-white",
          )}
          onClick={() => onSelect(item.key)}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[#2D2A26]">{item.label}</span>
            <span className="block text-xs text-[#8D8A87]">{item.percent}% of total</span>
          </span>
          <span className="text-right font-mono text-xs font-semibold text-[#2D2A26]">
            {formatKES(item.amount)}
          </span>
        </button>
      ))}
    </div>
  );
}
