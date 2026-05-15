// ABOUTME: Displays operational analytics including P&L summary, monthly trends, cash flow, budgeting, and export tools.
// ABOUTME: Organised into Overview and Budgeting sub-tabs for a compact view on mobile and desktop.
import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { cn, formatKES } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, PiggyBank, Receipt, TrendingUp, TrendingDown, PieChart, ArrowUpRight, ArrowDownRight, AlertTriangle, Target, Wallet, Download, FileSpreadsheet, Smartphone, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { InflowOutflowPieChart } from "./InflowOutflowPieChart";
import {
  buildBudgetActualChartData,
  buildInflowOutflowChartData,
  getVisibleBudgetRows,
} from "./chart-data";
import { BudgetActualExpensesPieChart } from "./BudgetActualExpensesPieChart";
import { useReportExports } from "./useReportExports";

export function OperationsReportsPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [opsTab, setOpsTab] = useState<"overview" | "budgeting">("overview");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [cogsOpen, setCogsOpen] = useState(false);
  const [selectedFlowKey, setSelectedFlowKey] = useState<"inflow" | "outflow" | null>(null);
  const [selectedBudgetCategoryId, setSelectedBudgetCategoryId] = useState<number | null>(null);
  const [budgetForm, setBudgetForm] = useState({ categoryId: "", amount: "" });
  const [cogsForm, setCogsForm] = useState({ target: "35", alert: "38" });
  const queryClient = useQueryClient();

  const { data: locations } = trpc.locations.list.useQuery();
  const plQuery = trpc.reports.plStatement.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const plMonthlyQuery = trpc.reports.plMonthly.useQuery({ year, locationId: branchFilter ? +branchFilter : undefined });
  const comparativeQuery = trpc.reports.plComparative.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const bvaQuery = trpc.reports.budgetVsActual.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const cashFlowQuery = trpc.reports.cashFlowForecast.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const cogsQuery = trpc.reports.cogsAnalysis.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const cogsTargetQuery = trpc.reports.getCogsTarget.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const { data: categories } = trpc.expenses.categories.useQuery();

  const { data: salesData } = trpc.dailySales.list.useQuery({
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month).padStart(2, "0")}-31`,
    locationId: branchFilter ? +branchFilter : undefined,
  });
  const { data: expenseData } = trpc.expenses.list.useQuery({
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month).padStart(2, "0")}-31`,
    locationId: branchFilter ? +branchFilter : undefined,
  });
  const { data: mpesaData } = trpc.mpesa.list.useQuery({
    dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(month).padStart(2, "0")}-31`,
    locationId: branchFilter ? +branchFilter : undefined,
  });

  const pl = plQuery.data;
  const plMonthly = plMonthlyQuery.data;
  const comparative = comparativeQuery.data;
  const bva = bvaQuery.data;
  const cashFlow = cashFlowQuery.data;
  const cogs = cogsQuery.data;
  const cogsTarget = cogsTargetQuery.data;

  const { exportSales, exportExpenses, exportMpesa, exportConsolidated } = useReportExports({
    salesData: salesData ?? [],
    expenseData: expenseData ?? [],
    mpesaData: mpesaData ?? [],
    locations: locations ?? [],
    categories: categories ?? [],
    pl,
    year,
    month,
  });

  const setBudget = trpc.reports.setBudget.useMutation({
    onSuccess: () => { toast.success("Budget set"); queryClient.invalidateQueries({ queryKey: ["reports.budgetVsActual"] }); setBudgetOpen(false); },
  });
  const setCogsT = trpc.reports.setCogsTarget.useMutation({
    onSuccess: () => { toast.success("COGS target updated"); queryClient.invalidateQueries({ queryKey: ["reports.cogsAnalysis"] }); setCogsOpen(false); },
  });

  const queriesLoading = plQuery.isLoading || bvaQuery.isLoading || cogsQuery.isLoading || cashFlowQuery.isLoading;
  const queriesError = plQuery.error ?? bvaQuery.error ?? cogsQuery.error ?? cashFlowQuery.error;

  useEffect(() => {
    if (cogsTarget) {
      setCogsForm({ target: cogsTarget.targetFoodCostPercent, alert: cogsTarget.alertThresholdPercent });
    }
  }, [cogsTarget]);

  const inflowOutflowData = useMemo(
    () =>
      buildInflowOutflowChartData({
        revenue: pl?.revenue ?? "0",
        cogs: pl?.cogs ?? "0",
        expenses: pl?.expenses ?? "0",
        payroll: pl?.payroll ?? "0",
      }),
    [pl],
  );
  const budgetActualData = useMemo(
    () =>
      bva
        ? buildBudgetActualChartData(bva)
        : {
            segments: [],
            legendItems: [],
            totalBudgeted: "0.00",
            totalActual: "0.00",
            totalVariance: "0.00",
            isEmpty: true,
          },
    [bva],
  );
  const activeSelectedBudgetCategoryId = useMemo(
    () =>
      budgetActualData.legendItems.some((item: any) => item.key === selectedBudgetCategoryId)
        ? selectedBudgetCategoryId
        : null,
    [budgetActualData.legendItems, selectedBudgetCategoryId],
  );
  const visibleBudgetRows = useMemo(
    () => getVisibleBudgetRows(bva?.categories ?? [], activeSelectedBudgetCategoryId),
    [activeSelectedBudgetCategoryId, bva],
  );

  const resetChartSelections = () => {
    setSelectedFlowKey(null);
    setSelectedBudgetCategoryId(null);
  };
  const budgetSectionTotals = bva ?? {
    categories: [],
    totalBudgeted: budgetActualData.totalBudgeted,
    totalActual: budgetActualData.totalActual,
    totalVariance: budgetActualData.totalVariance,
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Overview | Budgeting */}
      <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
        <button onClick={() => setOpsTab("overview")} className={`px-4 py-2 text-sm font-medium ${opsTab === "overview" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <BarChart3 className="mr-1 inline h-4 w-4" /> Overview
        </button>
        <button onClick={() => setOpsTab("budgeting")} className={`px-4 py-2 text-sm font-medium ${opsTab === "budgeting" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
          <PiggyBank className="mr-1 inline h-4 w-4" /> Budgeting
        </button>
      </div>

      {opsTab === "overview" && (
      <div className="space-y-6 mt-6">
          {queriesError && (
            <div className="rounded-lg border border-red-300/30 bg-red-500/5 p-4 text-sm text-red-600" role="alert">
              <p className="font-medium">Some report data could not be loaded</p>
              <p className="mt-1 text-gray-500">{queriesError.message}</p>
            </div>
          )}

          {!queriesLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-green-600" />
                    <span className="text-xs uppercase text-gray-500">Revenue</span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-green-600">{formatKES(pl?.revenue ?? "0")}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-orange-600" />
                    <span className="text-xs uppercase text-gray-500">COGS</span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-orange-600">{formatKES(pl?.cogs ?? "0")}</p>
                  <p className="text-xs text-gray-500">Margin: {pl?.grossMargin ?? "0"}%</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-xs uppercase text-gray-500">Expenses</span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-red-600">{formatKES(pl?.expenses ?? "0")}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-yellow-600" />
                    <span className="text-xs uppercase text-gray-500">Payroll</span>
                  </div>
                  <p className="mt-2 font-mono text-xl font-semibold text-yellow-600">{formatKES(pl?.payroll ?? "0")}</p>
                </CardContent>
              </Card>
              <Card className={`border-gray-200 ${parseFloat(pl?.netProfit ?? "0") >= 0 ? "bg-green-500/5" : "bg-red-500/5"}`} >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {parseFloat(pl?.netProfit ?? "0") >= 0 ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                    <span className="text-xs uppercase text-gray-500">Net Profit</span>
                  </div>
                  <p className={`mt-2 font-mono text-xl font-semibold ${parseFloat(pl?.netProfit ?? "0") >= 0 ? "text-green-600" : "text-red-600"}`}>{formatKES(pl?.netProfit ?? "0")}</p>
                  <p className="text-xs text-gray-500">Margin: {pl?.netMargin ?? "0"}%</p>
                </CardContent>
              </Card>
            </div>
          )}
          {queriesLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
              <span className="ml-3 text-sm text-gray-500">Loading report data...</span>
            </div>
          )}

          {comparative && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" /> Year over Year comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-[#F5EDE6] p-4">
                    <p className="text-xs uppercase text-gray-500">{comparative.thisYear.label}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Revenue:</span> <span className="font-mono font-semibold text-green-600">{formatKES(comparative.thisYear.sales)}</span></div>
                      <div><span className="text-gray-500">Expenses:</span> <span className="font-mono font-semibold text-red-600">{formatKES(comparative.thisYear.expenses)}</span></div>
                      <div><span className="text-gray-500">Payroll:</span> <span className="font-mono font-semibold text-yellow-600">{formatKES(comparative.thisYear.payroll)}</span></div>
                      <div><span className="text-gray-500">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.thisYear.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatKES(comparative.thisYear.netProfit)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">{comparative.lastYear.label}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Revenue:</span> <span className="font-mono font-semibold text-green-600">{formatKES(comparative.lastYear.sales)}</span></div>
                      <div><span className="text-gray-500">Expenses:</span> <span className="font-mono font-semibold text-red-600">{formatKES(comparative.lastYear.expenses)}</span></div>
                      <div><span className="text-gray-500">Payroll:</span> <span className="font-mono font-semibold text-yellow-600">{formatKES(comparative.lastYear.payroll)}</span></div>
                      <div><span className="text-gray-500">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.lastYear.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatKES(comparative.lastYear.netProfit)}</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <MonthlyTrendChart data={plMonthly ?? []} year={year} />

          {cashFlow && (
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-yellow-600" /> 30-Day Cash Flow Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">{cashFlow.period}</p>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-green-500/5 p-3 text-center">
                    <p className="text-xs text-gray-500">Projected Revenue</p>
                    <p className="font-mono text-lg font-semibold text-green-600">{formatKES(cashFlow.projectedInflows)}</p>
                    <p className="text-xs text-gray-500">KES {formatKES(cashFlow.dailyAvgRevenue)}/day avg</p>
                  </div>
                  <div className="rounded-lg bg-orange-500/5 p-3 text-center">
                    <p className="text-xs text-gray-500">Bills Due</p>
                    <p className="font-mono text-lg font-semibold text-orange-600">{formatKES(cashFlow.billsDue.total)}</p>
                    <p className="text-xs text-gray-500">{cashFlow.billsDue.count} bills</p>
                  </div>
                  <div className="rounded-lg bg-yellow-500/5 p-3 text-center">
                    <p className="text-xs text-gray-500">Recurring Due</p>
                    <p className="font-mono text-lg font-semibold text-yellow-600">{formatKES(cashFlow.recurringDue.total)}</p>
                    <p className="text-xs text-gray-500">{cashFlow.recurringDue.count} recurring</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${parseFloat(cashFlow.netProjected) >= 0 ? "bg-green-500/5" : "bg-red-500/5"}`}>
                    <p className="text-xs text-gray-500">Net Projected</p>
                    <p className={`font-mono text-lg font-semibold ${parseFloat(cashFlow.netProjected) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatKES(cashFlow.netProjected)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" /> Export Data — {new Date(year, month - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <button onClick={exportSales} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10"><Receipt className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Export Sales</p>
                    <p className="text-xs text-gray-500">{salesData?.length ?? 0} records</p>
                  </div>
                  <Download className="ml-auto h-4 w-4 text-gray-500" />
                </button>
                <button onClick={exportExpenses} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10"><ExpensesIcon className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Export Expenses</p>
                    <p className="text-xs text-gray-500">{expenseData?.length ?? 0} records</p>
                  </div>
                  <Download className="ml-auto h-4 w-4 text-gray-500" />
                </button>
                <button onClick={exportMpesa} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-600/10"><Smartphone className="h-5 w-5 text-orange-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Export M-PESA</p>
                    <p className="text-xs text-gray-500">{mpesaData?.length ?? 0} records</p>
                  </div>
                  <Download className="ml-auto h-4 w-4 text-gray-500" />
                </button>
                <button onClick={exportConsolidated} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-600/10"><FileSpreadsheet className="h-5 w-5 text-yellow-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Consolidated Report</p>
                    <p className="text-xs text-gray-500">All data combined</p>
                  </div>
                  <Download className="ml-auto h-4 w-4 text-gray-500" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      )}

      {opsTab === "budgeting" && (
      <div className="space-y-6 mt-6">
          <Card className="border-gray-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-600" /> Cost Analysis
              </CardTitle>
              <Dialog open={cogsOpen} onOpenChange={setCogsOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline">
                  <Target className="h-3 w-3 mr-1" />Set Target
                </Button></DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Set COGS Target</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); setCogsT.mutate({ locationId: branchFilter ? +branchFilter : undefined, targetFoodCostPercent: cogsForm.target, alertThresholdPercent: cogsForm.alert }); }} className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500">Target Cost %</label>
                      <Input type="number" step="0.1" value={cogsForm.target} onChange={e => setCogsForm(p => ({ ...p, target: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Alert Threshold %</label>
                      <Input type="number" step="0.1" value={cogsForm.alert} onChange={e => setCogsForm(p => ({ ...p, alert: e.target.value }))} />
                    </div>
                    <Button type="submit" className="w-full bg-orange-600" disabled={setCogsT.isPending}>Save Target</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {cogs && (
                <div className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="font-mono text-lg font-semibold text-green-600">{formatKES(cogs.revenue)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">COGS (Purchases)</p>
                      <p className="font-mono text-lg font-semibold text-orange-600">{formatKES(cogs.cogs)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Cost Analysis</p>
                      <p className={`font-mono text-lg font-semibold ${cogs.status === "critical" ? "text-red-600" : cogs.status === "warning" ? "text-orange-600" : "text-green-600"}`}>
                        {cogs.foodCostPercent}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-3 rounded-full bg-[#F5EDE6] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(100, parseFloat(cogs.foodCostPercent))}%`,
                        backgroundColor: cogs.status === "critical" ? "#D32F2F" : cogs.status === "warning" ? "#ED6C02" : "#2E7D32",
                      }} />
                    </div>
                    <span className="text-xs text-gray-500">Target: {cogs.targetPercent}% | Alert: {cogs.alertPercent}%</span>
                  </div>
                  {cogs.isAlert && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> Cost is above your alert threshold! Consider reviewing supplier prices or portion controls.
                    </div>
                  )}
                </div>
              )}
              {!cogs && <p className="text-sm text-gray-500">No data available.</p>}
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-gray-500" /> Budget vs Actual — {new Date(year, month - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
              </CardTitle>
              <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Set Budget</Button></DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Set Budget</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); setBudget.mutate({ categoryId: +budgetForm.categoryId, year, month, amount: budgetForm.amount, locationId: branchFilter ? +branchFilter : undefined }); }} className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500">Category</label>
                      <select value={budgetForm.categoryId} onChange={e => setBudgetForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                        <option value="">Select</option>
                        {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Amount (KES)</label>
                      <Input type="number" step="0.01" value={budgetForm.amount} onChange={e => setBudgetForm(p => ({ ...p, amount: e.target.value }))} required />
                    </div>
                    <Button type="submit" className="w-full bg-orange-600" disabled={setBudget.isPending}>Save Budget</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>Total Budgeted: <span className="font-mono font-semibold">{formatKES(budgetSectionTotals.totalBudgeted)}</span></span>
                    <span>Total Actual: <span className="font-mono font-semibold">{formatKES(budgetSectionTotals.totalActual)}</span></span>
                    <span>Variance: <span className={`font-mono font-semibold ${parseFloat(budgetSectionTotals.totalVariance) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatKES(budgetSectionTotals.totalVariance)}</span></span>
                  </div>
                  {activeSelectedBudgetCategoryId !== null ? (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedBudgetCategoryId(null)}>
                      Clear filter
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <InflowOutflowPieChart
                    data={inflowOutflowData}
                    selectedKey={selectedFlowKey}
                    onSelect={setSelectedFlowKey}
                  />
                  <BudgetActualExpensesPieChart
                    data={budgetActualData}
                    selectedCategoryId={activeSelectedBudgetCategoryId}
                    onSelectCategory={setSelectedBudgetCategoryId}
                  />
                </div>
                {visibleBudgetRows.length > 0 ? (
                  visibleBudgetRows.map(cat => (
                    <div
                      key={cat.categoryId}
                      className={cn(
                        "space-y-1 rounded-xl p-2 transition-all",
                        cat.isSelected && "bg-pink-50",
                        cat.isDimmed && "opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.categoryColor ?? "#C73E1D" }} />
                          <span className="font-medium">{cat.categoryName}</span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-gray-500">B: {formatKES(cat.budgeted)}</span>
                          <span className={cat.isOverBudget ? "text-red-600 font-semibold" : "text-green-600"}>A: {formatKES(cat.actual)}</span>
                          <span className={parseFloat(cat.variance) >= 0 ? "text-green-600" : "text-red-600"}>V: {cat.variancePercent}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-[#F5EDE6] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${Math.min(100, parseFloat(cat.budgeted) > 0 ? (parseFloat(cat.actual) / parseFloat(cat.budgeted)) * 100 : 0)}%`,
                          backgroundColor: cat.isOverBudget ? "#D32F2F" : "#2E7D32",
                        }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No budgets set for this period. Click "Set Budget" to start tracking.</p>
                )}
              </div>
            </CardContent>
          </Card>
      </div>
      )}
    </div>
  );
}
