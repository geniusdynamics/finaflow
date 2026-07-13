// ABOUTME: Main dashboard page — assembles the new dashboard feature sub-components.
// ABOUTME: Reads from trpc.dashboard.summary, alerts, and cashflowTrend and lays out the cards top-down.
import { useState } from "react";
import { Link } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatKES, getLocalDateString } from "@/lib/utils";
import { hasAnyPermission, hasPermission, PERMISSIONS } from "@/lib/permissions";
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
import {
  CashPositionCard,
  CashflowTrendCard,
  MobileWalletSummaryCard,
  TrendKpiCard,
  BillsPipelineCard,
  TodayStrip,
} from "@/features/dashboard";

export function Dashboard() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const userPerms = user?.permissions ?? [];
  const permContext = userPerms.length > 0 ? userPerms : role;
  const canSales = hasAnyPermission(permContext, [PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW_OWN]);
  const canExpenses = hasAnyPermission(permContext, [PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE]);
  const canBills = hasAnyPermission(permContext, [PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE]);
  const canWallet = hasAnyPermission(permContext, [PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_IMPORT]);
  const canPayroll = hasAnyPermission(permContext, [PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS]);
  const canAccounts = hasAnyPermission(permContext, [PERMISSIONS.ACCOUNTS_VIEW, PERMISSIONS.ACCOUNTS_MANAGE]);
  const canViewBills = hasPermission(permContext, PERMISSIONS.BILLS_VIEW);

  const [dateRange, setDateRange] = useState(() => ({
    from: getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    to: getLocalDateString(),
  }));

  const { data: summary } = trpc.dashboard.summary.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });
  const { data: alerts } = trpc.dashboard.alerts.useQuery();
  const { data: cashflowTrend } = trpc.dashboard.cashflowTrend.useQuery({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const netCashflow = summary ? parseFloat(summary.netCashflow) : 0;
  const previousSales = summary ? parseFloat(summary.previousPeriodTotals?.totalSales ?? "0") : 0;
  const currentSales = summary ? parseFloat(summary.totalSales) : 0;
  const previousExpenses = summary ? parseFloat(summary.previousPeriodTotals?.totalExpenses ?? "0") : 0;
  const currentExpenses = summary ? parseFloat(summary.totalExpenses) : 0;

  const safePct = (current: number, previous: number): number | null => {
    if (!Number.isFinite(previous) || previous === 0) {
      if (current === 0) return 0;
      return null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const salesTrend = safePct(currentSales, previousSales);
  const expensesTrend = safePct(currentExpenses, previousExpenses);

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

        {/* Featured Cash Position */}
        {canAccounts && <CashPositionCard position={summary?.cashPosition} />}

        {/* KPI row with trend % */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TrendKpiCard
            testId="kpi-total-sales"
            title="Total Sales"
            value={summary?.totalSales ?? "0"}
            icon={TrendingUp}
            subtitle="Revenue in period"
            trendPercent={salesTrend}
            positiveIsGood
          />
          <TrendKpiCard
            testId="kpi-total-expenses"
            title="Total Expenses"
            value={summary?.totalExpenses ?? "0"}
            icon={TrendingDown}
            subtitle="Costs in period"
            trendPercent={expensesTrend}
            positiveIsGood={false}
          />
          <TrendKpiCard
            testId="kpi-net-cashflow"
            title="Net Cashflow"
            value={Math.abs(netCashflow).toFixed(2)}
            icon={netCashflow >= 0 ? ArrowUpRight : ArrowDownRight}
            subtitle={netCashflow >= 0 ? "Profit" : "Loss"}
            trendPercent={safePct(netCashflow, currentSales - currentExpenses - (netCashflow))}
            positiveIsGood
          />
          <TrendKpiCard
            testId="kpi-bills-due"
            title="Bills Due"
            value={summary?.totalBillsDue ?? "0"}
            icon={AlertTriangle}
            subtitle="Outstanding payables"
            trendPercent={null}
            trendColor="neutral"
          />
        </div>

        {/* Today strip + 30-day cashflow trend */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TodayStrip />
          </div>
          <div className="lg:col-span-2">
            <CashflowTrendCard days={cashflowTrend?.days} />
          </div>
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
                {canSales && <QuickActionLink to="/daily-sales" icon={<Receipt className="h-4 w-4" />} label="Record Daily Sales" />}
                {canExpenses && <QuickActionLink to="/expenses" icon={<TrendingDown className="h-4 w-4" />} label="Log Expense" />}
                {canBills && <QuickActionLink to="/bills" icon={<AlertTriangle className="h-4 w-4" />} label="Record Bill Payment" />}
                {canWallet && <QuickActionLink to="/wallet" icon={<Wallet className="h-4 w-4" />} label="Import Mobile Wallet" />}
                {canPayroll && <QuickActionLink to="/payroll" icon={<Users className="h-4 w-4" />} label="Process Payroll" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unified bills pipeline */}
        {canViewBills && (
          <BillsPipelineCard
            overdue={alerts?.overdueBills ?? []}
            upcoming7={alerts?.upcomingBills7 ?? []}
            upcoming30={alerts?.upcomingBills30 ?? []}
          />
        )}

        {/* M-PESA + Mobile Wallet summaries (symmetric pair) */}
        <div className="grid gap-6 lg:grid-cols-2">
          {summary?.mpesa && (
            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg text-[#2D2A26]">
                  M-PESA Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-gradient-to-br from-[#2E7D32]/5 to-[#2E7D32]/10 p-4">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Inflows</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-[#2E7D32]">
                      {formatKES(summary.mpesa.totalIn)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gradient-to-br from-[#D32F2F]/5 to-[#D32F2F]/10 p-4">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Outflows</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-[#D32F2F]">
                      {formatKES(summary.mpesa.totalOut)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gradient-to-br from-[#D4A854]/5 to-[#D4A854]/10 p-4">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Transaction Fees</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-[#D4A854]">
                      {formatKES(summary.mpesa.totalFees)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canWallet && <MobileWalletSummaryCard wallet={summary?.wallet} />}
        </div>
      </div>
    </Layout>
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
