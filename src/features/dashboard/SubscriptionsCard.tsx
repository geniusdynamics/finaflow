// ABOUTME: Dashboard card summarising upcoming subscription renewals ("Due this week").
// ABOUTME: Presentational only — data is computed by the Dashboard page and passed in as props.
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, ArrowRight } from "lucide-react";

export type DueSubscription = {
  id: number;
  name: string;
  amount: string;
  currency: string;
  nextDueDate: string;
  daysUntilDue: number;
};

type SubscriptionsCardProps = {
  dueThisWeek: DueSubscription[];
  activeCount: number;
  monthlyTotal: string;
  currency: string;
};

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  const formatted = value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

export function SubscriptionsCard({ dueThisWeek, activeCount, monthlyTotal, currency }: SubscriptionsCardProps) {
  if (activeCount === 0) return null;

  const dueTotal = dueThisWeek.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <Card className="border-[#E8E0D8] bg-white" data-testid="subscriptions-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
          <Repeat className="h-5 w-5 text-[#6B4FA8]" />
          Subscriptions
        </CardTitle>
        <Link to="/subscriptions" className="flex items-center gap-1 text-xs font-medium text-[#C73E1D] hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#2D2A26]" data-testid="subscriptions-due-this-week">
          <span className="font-medium">Due this week: {dueThisWeek.length}</span>
          <span className="text-[#8D8A87]">·</span>
          <span className="font-mono font-semibold text-[#6B4FA8]">{formatMoney(dueTotal.toFixed(2), currency)}</span>
          <span className="text-[#8D8A87]">·</span>
          <span className="text-xs text-[#8D8A87]">{activeCount} active · {formatMoney(monthlyTotal, currency)}/mo</span>
        </div>
        {dueThisWeek.length > 0 ? (
          <div className="mt-3 space-y-2">
            {dueThisWeek.slice(0, 3).map((sub) => (
              <div
                key={sub.id}
                className={`flex items-center justify-between rounded-lg border p-2.5 ${
                  sub.daysUntilDue < 0
                    ? "border-[#D32F2F]/40 bg-[#D32F2F]/5"
                    : sub.daysUntilDue === 0
                      ? "border-[#6B4FA8]/40 bg-[#6B4FA8]/5"
                      : "border-[#E8E0D8] bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#2D2A26]">{sub.name}</p>
                  <p className={`text-xs ${sub.daysUntilDue < 0 ? "font-semibold text-[#D32F2F]" : "text-[#8D8A87]"}`}>
                    {sub.daysUntilDue < 0
                      ? `OVERDUE ${Math.abs(sub.daysUntilDue)}d`
                      : sub.daysUntilDue === 0
                        ? "Due today"
                        : `in ${sub.daysUntilDue} days`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-[#2D2A26]">
                  {formatMoney(sub.amount, sub.currency)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#8D8A87]">No renewals due in the next 7 days.</p>
        )}
      </CardContent>
    </Card>
  );
}
