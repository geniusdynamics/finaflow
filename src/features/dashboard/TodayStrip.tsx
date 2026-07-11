// ABOUTME: Compact "Today" anchor strip for the main dashboard.
// ABOUTME: Shows yesterday's income and today's pending payments in a two-up row.
import { Card, CardContent } from "@/components/ui/card";
import { formatKES, getLocalDateString } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { CalendarCheck, Clock } from "lucide-react";

export function TodayStrip() {
  const today = getLocalDateString();
  const { data: previousDayIncome } = trpc.dashboard.previousDayIncome.useQuery({});
  const { data: dailyPayments } = trpc.dashboard.dailyPayments.useQuery({ date: today });

  const yesterdayTotal = previousDayIncome?.totalIncome ?? "0";
  const yesterdayDate = previousDayIncome?.date ?? "";

  const billsToday = dailyPayments?.billPayments?.length ?? 0;
  const payrollToday = dailyPayments?.payroll?.length ?? 0;
  const pendingToday = billsToday + payrollToday;
  const pendingAmount = (dailyPayments?.billPayments ?? []).reduce(
    (s, b) => s + (parseFloat(b.balanceDue) || 0),
    0,
  );

  return (
    <div
      data-testid="today-strip"
      className="grid gap-3 sm:grid-cols-2"
    >
      <Card className="border-[#E8E0D8] bg-gradient-to-br from-[#2E7D32]/5 via-white to-white">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2E7D32]/10 text-[#2E7D32]">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#8D8A87] sm:text-xs">
              Yesterday's Income
            </p>
            <p className="mt-0.5 truncate font-mono text-base font-bold text-[#2D2A26] sm:text-lg">
              {formatKES(yesterdayTotal)}
            </p>
            {yesterdayDate && (
              <p className="text-[10px] text-[#8D8A87]">{yesterdayDate}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E8E0D8] bg-gradient-to-br from-[#ED6C02]/5 via-white to-white">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ED6C02]/10 text-[#ED6C02]">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#8D8A87] sm:text-xs">
              Pending Today
            </p>
            <p className="mt-0.5 truncate font-mono text-base font-bold text-[#2D2A26] sm:text-lg">
              {pendingToday} {pendingToday === 1 ? "item" : "items"}
            </p>
            <p className="text-[10px] text-[#8D8A87]">
              {pendingAmount > 0
                ? `${formatKES(pendingAmount)} due`
                : billsToday + payrollToday === 0
                ? "No payments scheduled"
                : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
