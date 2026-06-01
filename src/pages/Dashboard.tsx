import { useState } from "react";
import { Link } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatDate, getLocalDateString, formatKES } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ChevronRight,
  Receipt,
  CreditCard,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Dashboard() {
  const [dateRange, setDateRange] = useState(() => ({
    from: getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    to: getLocalDateString(),
  }));

  const { data: summary } = trpc.dashboard.summary.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: alerts } = trpc.dashboard.alerts.useQuery();

  const netCashflow = summary ? parseFloat(summary.totalSales) - parseFloat(summary.totalExpenses) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-[#8D8A87]">
              Overview of your business cashflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
              className="rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]"
            />
            <span className="text-[#8D8A87]">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
              className="rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26]"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Sales"
            value={summary?.totalSales ?? "0"}
            icon={<TrendingUp className="h-5 w-5 text-[#2E7D32]" />}
            trend="positive"
            subtitle="Revenue in period"
          />
          <KpiCard
            title="Total Expenses"
            value={summary?.totalExpenses ?? "0"}
            icon={<TrendingDown className="h-5 w-5 text-[#D32F2F]" />}
            trend="negative"
            subtitle="Costs in period"
          />
          <KpiCard
            title="Net Cashflow"
            value={Math.abs(netCashflow).toFixed(2)}
            icon={
              netCashflow >= 0 ? (
                <ArrowUpRight className="h-5 w-5 text-[#2E7D32]" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-[#D32F2F]" />
              )
            }
            trend={netCashflow >= 0 ? "positive" : "negative"}
            subtitle={netCashflow >= 0 ? "Profit" : "Loss"}
          />
          <KpiCard
            title="Bills Due"
            value={summary?.totalBillsDue ?? "0"}
            icon={<AlertTriangle className="h-5 w-5 text-[#ED6C02]" />}
            trend="neutral"
            subtitle="Outstanding payables"
          />
          <KpiCard
            title="Unpaid Sales"
            value={summary?.totalUnpaidSales ?? "0"}
            icon={<Receipt className="h-5 w-5 text-[#D4A854]" />}
            trend="neutral"
            subtitle="Credit sales not yet collected"
          />
        </div>

        {/* Account Balances & Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#2D2A26]">
                Account Balances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary?.accounts?.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          account.type === "cash"
                            ? "bg-[#2E7D32]/10"
                            : account.type === "wallet"
                            ? "bg-[#C73E1D]/10"
                            : "bg-[#D4A854]/10"
                        }`}
                      >
                        {account.type === "cash" ? (
                          <Wallet className="h-4 w-4 text-[#2E7D32]" />
                        ) : account.type === "wallet" ? (
                          <Wallet className="h-4 w-4 text-[#C73E1D]" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-[#D4A854]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#2D2A26]">
                          {account.name}
                        </p>
                        <p className="text-xs uppercase text-[#8D8A87]">
                          {account.type}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        parseFloat(account.currentBalance) >= 0
                          ? "text-[#2E7D32]"
                          : "text-[#D32F2F]"
                      }`}
                    >
                      {formatKES(account.currentBalance)}
                    </span>
                  </div>
                ))}
                {(!summary?.accounts || summary.accounts.length === 0) && (
                  <p className="text-center py-8 text-sm text-[#8D8A87]">
                    No accounts set up yet. Go to Accounts to create your first account.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#2D2A26]">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <QuickActionLink to="/daily-sales" icon={<Receipt className="h-4 w-4" />} label="Record Daily Sales" />
                <QuickActionLink to="/expenses" icon={<TrendingDown className="h-4 w-4" />} label="Log Expense" />
                <QuickActionLink to="/bills" icon={<AlertTriangle className="h-4 w-4" />} label="Record Bill Payment" />
                <QuickActionLink to="/wallet" icon={<Wallet className="h-4 w-4" />} label="Import Mobile Wallet" />
                <QuickActionLink to="/payroll" icon={<Users className="h-4 w-4" />} label="Process Payroll" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {alerts && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Overdue Bills */}
            {alerts.overdueBills.length > 0 && (
              <Card className="border-[#D32F2F]/30 bg-[#D32F2F]/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#D32F2F]">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Bills ({alerts.overdueBills.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alerts.overdueBills.slice(0, 5).map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between rounded-lg bg-white p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#2D2A26]">
                            {bill.description}
                          </p>
                          <p className="text-xs text-[#8D8A87]">
                            Due: {formatDate(bill.dueDate)}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold text-[#D32F2F]">
                          {formatKES(bill.balanceDue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Bills */}
            {alerts.upcomingBills7.length > 0 && (
              <Card className="border-[#ED6C02]/30 bg-[#ED6C02]/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#ED6C02]">
                    <AlertTriangle className="h-5 w-5" />
                    Due Within 7 Days ({alerts.upcomingBills7.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alerts.upcomingBills7.slice(0, 5).map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between rounded-lg bg-white p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#2D2A26]">
                            {bill.description}
                          </p>
                          <p className="text-xs text-[#8D8A87]">
                            Due: {formatDate(bill.dueDate)}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold text-[#ED6C02]">
                          {formatKES(bill.balanceDue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* M-PESA Summary */}
        {summary?.mpesa && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#2D2A26]">
                M-PESA Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-[#2E7D32]/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Inflows</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#2E7D32]">
                    {formatKES(summary.mpesa.totalIn)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#D32F2F]/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Outflows</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#D32F2F]">
                    {formatKES(summary.mpesa.totalOut)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#D4A854]/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Transaction Fees</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-[#D4A854]">
                    {formatKES(summary.mpesa.totalFees)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function KpiCard({
  title,
  value,
  icon,
  trend,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: "positive" | "negative" | "neutral";
  subtitle: string;
}) {
  return (
    <Card className="border-[#E8E0D8] bg-white">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 sm:space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-[#8D8A87]">
              {title}
            </p>
            <p
              className={`font-mono text-base sm:text-2xl font-bold ${
                trend === "positive"
                  ? "text-[#2E7D32]"
                  : trend === "negative"
                  ? "text-[#D32F2F]"
                  : "text-[#2D2A26]"
              }`}
            >
              {formatKES(value)}
            </p>
            <p className="text-[10px] sm:text-xs text-[#8D8A87]">{subtitle}</p>
          </div>
          <div className="rounded-lg bg-[#F5EDE6] p-1.5 sm:p-2 shrink-0">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-[#E8E0D8] p-3 text-sm font-medium text-[#2D2A26] transition-colors hover:bg-[#F5EDE6]"
    >
      <span className="text-[#8D8A87]">{icon}</span>
      {label}
      <ChevronRight className="ml-auto h-4 w-4 text-[#8D8A87]" />
    </Link>
  );
}
