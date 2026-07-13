// ABOUTME: Featured "Cash Position" hero card for the main dashboard.
// ABOUTME: Shows total cash on hand with a horizontal stacked bar breaking down by account type.
import { Card, CardContent } from "@/components/ui/card";
import { formatKES } from "@/lib/utils";
import { Landmark, Wallet, CreditCard, Banknote, PiggyBank } from "lucide-react";
import type { CashPosition } from "./cash-position";

type CashPositionCardProps = {
  position: CashPosition | undefined;
};

const TYPE_META: Record<"cash" | "bank" | "wallet" | "other", { label: string; color: string; bg: string; icon: typeof Landmark }> = {
  cash: { label: "Cash", color: "#2E7D32", bg: "bg-[#2E7D32]", icon: Banknote },
  bank: { label: "Bank", color: "#1565C0", bg: "bg-[#1565C0]", icon: Landmark },
  wallet: { label: "Wallet", color: "#C73E1D", bg: "bg-[#C73E1D]", icon: Wallet },
  other: { label: "Other", color: "#D4A854", bg: "bg-[#D4A854]", icon: PiggyBank },
};

export function CashPositionCard({ position }: CashPositionCardProps) {
  const safe: CashPosition = position ?? {
    total: "0",
    byType: { cash: "0", bank: "0", wallet: "0", other: "0" },
  };
  const totalNum = parseFloat(safe.total) || 0;
  const isNegative = totalNum < 0;
  const entries = (["cash", "bank", "wallet", "other"] as const)
    .map((key) => ({
      key,
      amount: parseFloat(safe.byType[key]) || 0,
      ...TYPE_META[key],
    }))
    .filter((entry) => entry.amount > 0);

  // Build stacked-bar segments. Each entry gets a width as a percent of the
  // absolute total. When the total is zero or negative, fall back to a flat bar.
  const absTotal = Math.max(Math.abs(totalNum), entries.reduce((s, e) => s + e.amount, 0), 1);

  return (
    <Card
      data-testid="cash-position-card"
      className="relative overflow-hidden border-[#E8E0D8] bg-gradient-to-br from-[#2E7D32]/5 via-white to-[#2E7D32]/10"
    >
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#8D8A87] sm:text-xs">
              Cash Position
            </p>
            <p
              data-testid="cash-position-total"
              className={`mt-1 font-mono text-3xl font-bold sm:text-4xl ${
                isNegative ? "text-[#D32F2F]" : "text-[#2D2A26]"
              }`}
            >
              {formatKES(Math.abs(totalNum))}
            </p>
            <p className="mt-1 text-xs text-[#8D8A87]">
              Total cash on hand across all branches
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2E7D32]/10 text-[#2E7D32]">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        {/* Stacked horizontal bar */}
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-[#F5EDE6]"
          role="img"
          aria-label="Cash position breakdown by account type"
        >
          {entries.length === 0 ? (
            <div className="h-full w-full bg-[#E8E0D8]" />
          ) : (
            entries.map((entry) => (
              <div
                key={entry.key}
                data-testid={`cash-position-bar-${entry.key}`}
                className={entry.bg}
                style={{ width: `${(entry.amount / absTotal) * 100}%` }}
                title={`${entry.label}: ${formatKES(entry.amount)}`}
              />
            ))
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((key) => {
            const meta = TYPE_META[key];
            const amount = parseFloat(safe.byType[key]) || 0;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${meta.bg}`} />
                <span className="text-[#8D8A87]">{meta.label}</span>
                <span className="font-mono font-medium text-[#2D2A26]">
                  {formatKES(amount)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
