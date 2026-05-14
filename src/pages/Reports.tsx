// ABOUTME: Renders the financial reporting dashboard with P&L, cash flow, budget tracking, and export tools.
// ABOUTME: Coordinates report queries and interactive chart views for the selected period and branch context.
import { useMemo, useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { cn, formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, TrendingDown, PieChart, ArrowUpRight, ArrowDownRight, AlertTriangle, Target, Wallet, Receipt, Landmark, Plus, Download, FileSpreadsheet, Smartphone, BookOpen, Scale, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getCurrentBusinessId } from "@/hooks/useAuth";
import { BudgetActualExpensesPieChart } from "@/features/reports/BudgetActualExpensesPieChart";
import { InflowOutflowPieChart } from "@/features/reports/InflowOutflowPieChart";
import { MonthlyTrendChart } from "@/features/reports/MonthlyTrendChart";
import {
  buildBudgetActualChartData,
  buildInflowOutflowChartData,
  getVisibleBudgetRows,
} from "@/features/reports/chart-data";

export function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [tab, setTab] = useState<"operations" | "financial">("operations");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [cogsOpen, setCogsOpen] = useState(false);
  const [selectedFlowKey, setSelectedFlowKey] = useState<"inflow" | "outflow" | null>(null);
  const [selectedBudgetCategoryId, setSelectedBudgetCategoryId] = useState<number | null>(null);

  const { data: locations, error: locationsErr } = trpc.locations.list.useQuery();
  const plQuery = trpc.reports.plStatement.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const plMonthlyQuery = trpc.reports.plMonthly.useQuery({ year, locationId: branchFilter ? +branchFilter : undefined });
  const comparativeQuery = trpc.reports.plComparative.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const bvaQuery = trpc.reports.budgetVsActual.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const cashFlowQuery = trpc.reports.cashFlowForecast.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const cogsQuery = trpc.reports.cogsAnalysis.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const { data: categories, error: categoriesErr } = trpc.expenses.categories.useQuery();
  const cogsTargetQuery = trpc.reports.getCogsTarget.useQuery({ locationId: branchFilter ? +branchFilter : undefined });

  // Financial Reports queries
  const [businessId] = useState(() => getCurrentBusinessId() || 1);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  
  const incomeStatementMutation = trpc.reports.incomeStatement.useMutation();
  const balanceSheetMutation = trpc.reports.balanceSheet.useMutation();
  const trialBalanceMutation = trpc.reports.trialBalance.useMutation();
  const assetRegisterMutation = trpc.reports.assetRegister.useMutation();

  const [incomeStatementData, setIncomeStatementData] = useState<any>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [trialBalanceData, setTrialBalanceData] = useState<any>(null);
  const [assetRegisterData, setAssetRegisterData] = useState<any>(null);
  const [financialTab, setFinancialTab] = useState("income");

  const generateIncomeStatement = async () => {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    try {
      const result = await incomeStatementMutation.mutateAsync({ businessId, startDate, endDate });
      setIncomeStatementData(result);
    } catch (e: any) {
      toast.error(`Failed to generate Income Statement: ${e?.message || "Unknown error"}`);
    }
  };

  const generateBalanceSheet = async () => {
    try {
      const result = await balanceSheetMutation.mutateAsync({ businessId, asOfDate: reportDate });
      setBalanceSheetData(result);
    } catch (e: any) {
      toast.error(`Failed to generate Balance Sheet: ${e?.message || "Unknown error"}`);
    }
  };

  const generateTrialBalance = async () => {
    try {
      const result = await trialBalanceMutation.mutateAsync({ businessId, asOfDate: reportDate });
      setTrialBalanceData(result);
    } catch (e: any) {
      toast.error(`Failed to generate Trial Balance: ${e?.message || "Unknown error"}`);
    }
  };

  const generateAssetRegister = async () => {
    try {
      const result = await assetRegisterMutation.mutateAsync({ businessId });
      setAssetRegisterData(result);
    } catch (e: any) {
      toast.error(`Failed to generate Asset Register: ${e?.message || "Unknown error"}`);
    }
  };

  const pl = plQuery.data;
  const plMonthly = plMonthlyQuery.data;
  const comparative = comparativeQuery.data;
  const bva = bvaQuery.data;
  const cashFlow = cashFlowQuery.data;
  const cogs = cogsQuery.data;
  const cogsTarget = cogsTargetQuery.data;

  const setBudget = trpc.reports.setBudget.useMutation({
    onSuccess: () => { toast.success("Budget set"); utils.reports.budgetVsActual.invalidate(); setBudgetOpen(false); },
  });
  const setCogsT = trpc.reports.setCogsTarget.useMutation({
    onSuccess: () => { toast.success("COGS target updated"); utils.reports.cogsAnalysis.invalidate(); setCogsOpen(false); },
  });
  const utils = trpc.useUtils();

  const [budgetForm, setBudgetForm] = useState({ categoryId: "", amount: "" });
  const [cogsForm, setCogsForm] = useState({
    target: "35",
    alert: "38",
  });

  const queriesLoading = plQuery.isLoading || bvaQuery.isLoading || cogsQuery.isLoading || cashFlowQuery.isLoading;
  const queriesError = plQuery.error ?? bvaQuery.error ?? cogsQuery.error ?? cashFlowQuery.error;

  useEffect(() => {
    if (cogsTarget) {
      setCogsForm({ target: cogsTarget.targetFoodCostPercent, alert: cogsTarget.alertThresholdPercent });
    }
  }, [cogsTarget]);

  // Data for export
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

  // CSV export helpers
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSales = () => {
    if (!salesData?.length) { toast.error("No sales data to export"); return; }
    const headers = ["Date", "Location", "Payment Method", "Gross Sales", "Net Sales", "Tax", "Discount", "Receipt No", "Recorded By"];
    const rows = salesData.map(s => [
      s.saleDate, locations?.find(l => l.id === s.locationId)?.name ?? "",
      s.paymentMethod, s.grossSales, s.netSales, s.taxAmount ?? "", s.discountAmount ?? "", s.receiptNo ?? "", s.recordedBy ?? "",
    ]);
    downloadCSV(`sales-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${salesData.length} sales records`);
  };

  const exportExpenses = () => {
    if (!expenseData?.length) { toast.error("No expense data to export"); return; }
    const headers = ["Date", "Location", "ExpNo", "Description", "Category", "Supplier", "Method", "Amount", "Account"];
    const rows = expenseData.map(e => [
      e.expenseDate, locations?.find(l => l.id === e.locationId)?.name ?? "",
      e.expenseNumber ?? "", e.description,
      categories?.find(c => c.id === e.categoryId)?.name ?? "",
      "", e.paymentMethod, e.amount, "",
    ]);
    downloadCSV(`expenses-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${expenseData.length} expense records`);
  };

  const exportMpesa = () => {
    if (!mpesaData?.length) { toast.error("No M-PESA data to export"); return; }
    const headers = ["Date", "Txn ID", "Type", "Description", "Party Name", "Amount", "Fee", "Balance", "Location", "Status"];
    const rows = mpesaData.map(t => [
      t.txnDate, t.txnId, t.txnType, t.description ?? "", t.partyName ?? "",
      t.amount, t.txnFee ?? "", t.balance ?? "", locations?.find(l => l.id === t.locationId)?.name ?? "", t.isReconciled ? "Reconciled" : "Pending",
    ]);
    downloadCSV(`mpesa-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${mpesaData.length} M-PESA records`);
  };

  const exportConsolidated = () => {
    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
    const headers = ["Category", "Item", "Amount", "Period"];
    const rows: string[][] = [];
    rows.push(["REVENUE", "Total Sales", pl?.revenue ?? "0", periodLabel]);
    rows.push(["COGS", "Cost of Goods Sold", pl?.cogs ?? "0", periodLabel]);
    rows.push(["EXPENSES", "Total Expenses", pl?.expenses ?? "0", periodLabel]);
    rows.push(["PAYROLL", "Total Payroll", pl?.payroll ?? "0", periodLabel]);
    rows.push(["NET", "Net Profit", pl?.netProfit ?? "0", periodLabel]);
    (expenseData ?? []).forEach(e => rows.push(["EXPENSE_DETAIL", e.description, e.amount, periodLabel]));
    (salesData ?? []).forEach(s => rows.push(["SALE_DETAIL", `${s.paymentMethod} sales`, s.netSales, periodLabel]));
    downloadCSV(`consolidated-${periodLabel}.csv`, headers, rows);
    toast.success("Consolidated report exported");
  };

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
      budgetActualData.legendItems.some(item => item.key === selectedBudgetCategoryId)
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
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Financial Intelligence</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">P&L, Budget vs Actual, COGS, Cash Flow Forecasting</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={year} onChange={e => { setYear(+e.target.value); resetChartSelections(); }} className="rounded border px-3 py-2 text-sm">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={e => { setMonth(+e.target.value); resetChartSelections(); }} className="rounded border px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleDateString("en-KE", { month: "short" })}</option>)}
            </select>
            <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); resetChartSelections(); }} className="rounded border px-3 py-2 text-sm">
              <option value="">All Branches</option>
              {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs for Reports */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("operations")} className={`px-4 py-2 text-sm font-medium ${tab === "operations" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Receipt className="mr-1 inline h-4 w-4" /> Operations
          </button>
          <button onClick={() => setTab("financial")} className={`px-4 py-2 text-sm font-medium ${tab === "financial" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <BookOpen className="mr-1 inline h-4 w-4" /> Financial Reports
          </button>
        </div>

        {tab === "operations" && (
          <div className="space-y-6">
            {/* Loading / Error Banner */}
            {queriesError && (
              <div className="rounded-lg border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-4 text-sm text-[#D32F2F]" role="alert">
                <p className="font-medium">Some report data could not be loaded</p>
                <p className="mt-1 text-[#8D8A87]">{queriesError.message}</p>
              </div>
            )}

            {/* P&L Summary Cards */}
            {queriesLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C73E1D] border-t-transparent" />
                <span className="ml-3 text-sm text-[#8D8A87]">Loading report data...</span>
              </div>
            )}
            {!queriesLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="border-[#E8E0D8]"><CardContent className="p-4">
                <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-[#2E7D32]"/><span className="text-xs uppercase text-[#8D8A87]">Revenue</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#2E7D32]">{formatKES(pl?.revenue ?? "0")}</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8]"><CardContent className="p-4">
                <div className="flex items-center gap-2"><PieChart className="h-4 w-4 text-[#ED6C02]"/><span className="text-xs uppercase text-[#8D8A87]">COGS</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#ED6C02]">{formatKES(pl?.cogs ?? "0")}</p>
                <p className="text-xs text-[#8D8A87]">Margin: {pl?.grossMargin ?? "0"}%</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8]"><CardContent className="p-4">
                <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-[#D32F2F]"/><span className="text-xs uppercase text-[#8D8A87]">Expenses</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(pl?.expenses ?? "0")}</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8]"><CardContent className="p-4">
                <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-[#D4A854]"/><span className="text-xs uppercase text-[#8D8A87]">Payroll</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(pl?.payroll ?? "0")}</p>
              </CardContent></Card>
              <Card className={`border-[#E8E0D8] ${parseFloat(pl?.netProfit ?? "0") >= 0 ? "bg-[#2E7D32]/5" : "bg-[#D32F2F]/5"}`}><CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {parseFloat(pl?.netProfit ?? "0") >= 0 ? <ArrowUpRight className="h-4 w-4 text-[#2E7D32]"/> : <ArrowDownRight className="h-4 w-4 text-[#D32F2F]"/>}
                  <span className="text-xs uppercase text-[#8D8A87]">Net Profit</span>
                </div>
                <p className={`mt-2 font-mono text-xl font-semibold ${parseFloat(pl?.netProfit ?? "0") >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(pl?.netProfit ?? "0")}</p>
                <p className="text-xs text-[#8D8A87]">Margin: {pl?.netMargin ?? "0"}%</p>
              </CardContent></Card>
            </div>
            )}

            {/* Comparative: This Month vs Last */}
            {comparative && (
              <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#C73E1D]"/> Month-over-Month Comparison</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-[#F5EDE6] p-4">
                      <p className="text-xs uppercase text-[#8D8A87]">{comparative.thisYear.label}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-[#8D8A87]">Revenue:</span> <span className="font-mono font-semibold text-[#2E7D32]">{formatKES(comparative.thisYear.sales)}</span></div>
                        <div><span className="text-[#8D8A87]">Expenses:</span> <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(comparative.thisYear.expenses)}</span></div>
                        <div><span className="text-[#8D8A87]">Payroll:</span> <span className="font-mono font-semibold text-[#D4A854]">{formatKES(comparative.thisYear.payroll)}</span></div>
                        <div><span className="text-[#8D8A87]">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.thisYear.netProfit) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(comparative.thisYear.netProfit)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#E8E0D8] p-4">
                      <p className="text-xs uppercase text-[#8D8A87]">{comparative.lastYear.label}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-[#8D8A87]">Revenue:</span> <span className="font-mono font-semibold text-[#2E7D32]">{formatKES(comparative.lastYear.sales)}</span></div>
                        <div><span className="text-[#8D8A87]">Expenses:</span> <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(comparative.lastYear.expenses)}</span></div>
                        <div><span className="text-[#8D8A87]">Payroll:</span> <span className="font-mono font-semibold text-[#D4A854]">{formatKES(comparative.lastYear.payroll)}</span></div>
                        <div><span className="text-[#8D8A87]">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.lastYear.netProfit) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(comparative.lastYear.netProfit)}</span></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly P&L Chart */}
            <MonthlyTrendChart data={plMonthly ?? []} year={year} />

            {/* COGS / Food Cost */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><Target className="h-5 w-5 text-[#ED6C02]"/> Food Cost Analysis</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setCogsOpen(true)}><Target className="h-3 w-3 mr-1"/>Set Target</Button>
            </CardHeader>
              <CardContent>
                {cogs && (
                  <div className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="text-center"><p className="text-xs text-[#8D8A87]">Revenue</p><p className="font-mono text-lg font-semibold text-[#2E7D32]">{formatKES(cogs.revenue)}</p></div>
                      <div className="text-center"><p className="text-xs text-[#8D8A87]">COGS (Purchases)</p><p className="font-mono text-lg font-semibold text-[#ED6C02]">{formatKES(cogs.cogs)}</p></div>
                      <div className="text-center"><p className="text-xs text-[#8D8A87]">Food Cost %</p>
                        <p className={`font-mono text-lg font-semibold ${cogs.status === "critical" ? "text-[#D32F2F]" : cogs.status === "warning" ? "text-[#ED6C02]" : "text-[#2E7D32]"}`}>
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
                      <span className="text-xs text-[#8D8A87]">Target: {cogs.targetPercent}% | Alert: {cogs.alertPercent}%</span>
                    </div>
                    {cogs.isAlert && (
                      <div className="flex items-center gap-2 rounded-lg bg-[#D32F2F]/10 p-3 text-sm text-[#D32F2F]">
                        <AlertTriangle className="h-4 w-4 shrink-0"/> Food cost is above your alert threshold! Consider reviewing supplier prices or portion controls.
                      </div>
                    )}
                  </div>
                )}
                {!cogs && <p className="text-sm text-[#8D8A87]">No data available.</p>}
              </CardContent>
            </Card>

            {/* Cash Flow Forecast */}
            {cashFlow && (
              <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-[#D4A854]"/> 30-Day Cash Flow Forecast</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-[#8D8A87] mb-3">{cashFlow.period}</p>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="rounded-lg bg-[#2E7D32]/5 p-3 text-center">
                      <p className="text-xs text-[#8D8A87]">Projected Revenue</p>
                      <p className="font-mono text-lg font-semibold text-[#2E7D32]">{formatKES(cashFlow.projectedInflows)}</p>
                      <p className="text-xs text-[#8D8A87]">KES {formatKES(cashFlow.dailyAvgRevenue)}/day avg</p>
                    </div>
                    <div className="rounded-lg bg-[#ED6C02]/5 p-3 text-center">
                      <p className="text-xs text-[#8D8A87]">Bills Due</p>
                      <p className="font-mono text-lg font-semibold text-[#ED6C02]">{formatKES(cashFlow.billsDue.total)}</p>
                      <p className="text-xs text-[#8D8A87]">{cashFlow.billsDue.count} bills</p>
                    </div>
                    <div className="rounded-lg bg-[#D4A854]/5 p-3 text-center">
                      <p className="text-xs text-[#8D8A87]">Recurring Due</p>
                      <p className="font-mono text-lg font-semibold text-[#D4A854]">{formatKES(cashFlow.recurringDue.total)}</p>
                      <p className="text-xs text-[#8D8A87]">{cashFlow.recurringDue.count} recurring</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${parseFloat(cashFlow.netProjected) >= 0 ? "bg-[#2E7D32]/5" : "bg-[#D32F2F]/5"}`}>
                      <p className="text-xs text-[#8D8A87]">Net Projected</p>
                      <p className={`font-mono text-lg font-semibold ${parseFloat(cashFlow.netProjected) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(cashFlow.netProjected)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Budget vs Actual */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg flex items-center gap-2"><Target className="h-5 w-5 text-[#8D8A87]"/> Budget vs Actual — {new Date(year, month - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}</CardTitle>
              <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1"/>Set Budget</Button></DialogTrigger>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Set Budget</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); setBudget.mutate({ categoryId: +budgetForm.categoryId, year, month, amount: budgetForm.amount, locationId: branchFilter ? +branchFilter : undefined }); }} className="space-y-3">
                    <div>
                      <label className="text-sm text-[#8D8A87]">Category</label>
                      <select value={budgetForm.categoryId} onChange={e => setBudgetForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                        <option value="">Select</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-[#8D8A87]">Amount (KES)</label>
                      <Input type="number" step="0.01" value={budgetForm.amount} onChange={e => setBudgetForm(p => ({ ...p, amount: e.target.value }))} required />
                    </div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={setBudget.isPending}>Save Budget</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#8D8A87]">
                      <span>Total Budgeted: <span className="font-mono font-semibold">{formatKES(budgetSectionTotals.totalBudgeted)}</span></span>
                      <span>Total Actual: <span className="font-mono font-semibold">{formatKES(budgetSectionTotals.totalActual)}</span></span>
                      <span>Variance: <span className={`font-mono font-semibold ${parseFloat(budgetSectionTotals.totalVariance) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(budgetSectionTotals.totalVariance)}</span></span>
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
                          cat.isSelected && "bg-[#FAF3F7]",
                          cat.isDimmed && "opacity-60",
                        )}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.categoryColor ?? "#C73E1D" }} />
                            <span className="font-medium">{cat.categoryName}</span>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span className="text-[#8D8A87]">B: {formatKES(cat.budgeted)}</span>
                            <span className={cat.isOverBudget ? "text-[#D32F2F] font-semibold" : "text-[#2E7D32]"}>A: {formatKES(cat.actual)}</span>
                            <span className={parseFloat(cat.variance) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}>V: {cat.variancePercent}%</span>
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
                    <p className="text-sm text-[#8D8A87]">No budgets set for this period. Click "Set Budget" to start tracking.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Data Export Section */}
            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#2E7D32]"/> Export Data — {new Date(year, month - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <button onClick={exportSales} className="flex items-center gap-3 rounded-lg border border-[#E8E0D8] p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2E7D32]/10"><Receipt className="h-5 w-5 text-[#2E7D32]" /></div>
                    <div><p className="text-sm font-medium text-[#2D2A26]">Export Sales</p><p className="text-xs text-[#8D8A87]">{salesData?.length ?? 0} records</p></div>
                    <Download className="ml-auto h-4 w-4 text-[#8D8A87]" />
                  </button>
                  <button onClick={exportExpenses} className="flex items-center gap-3 rounded-lg border border-[#E8E0D8] p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D32F2F]/10"><TrendingDown className="h-5 w-5 text-[#D32F2F]" /></div>
                    <div><p className="text-sm font-medium text-[#2D2A26]">Export Expenses</p><p className="text-xs text-[#8D8A87]">{expenseData?.length ?? 0} records</p></div>
                    <Download className="ml-auto h-4 w-4 text-[#8D8A87]" />
                  </button>
                  <button onClick={exportMpesa} className="flex items-center gap-3 rounded-lg border border-[#E8E0D8] p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C73E1D]/10"><Smartphone className="h-5 w-5 text-[#C73E1D]" /></div>
                    <div><p className="text-sm font-medium text-[#2D2A26]">Export M-PESA</p><p className="text-xs text-[#8D8A87]">{mpesaData?.length ?? 0} records</p></div>
                    <Download className="ml-auto h-4 w-4 text-[#8D8A87]" />
                  </button>
                  <button onClick={exportConsolidated} className="flex items-center gap-3 rounded-lg border border-[#E8E0D8] p-3 text-left hover:bg-[#F5EDE6] transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D4A854]/10"><FileSpreadsheet className="h-5 w-5 text-[#D4A854]" /></div>
                    <div><p className="text-sm font-medium text-[#2D2A26]">Consolidated Report</p><p className="text-xs text-[#8D8A87]">All data combined</p></div>
                    <Download className="ml-auto h-4 w-4 text-[#8D8A87]" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* COGS Target Dialog */}
            {cogsOpen && (
              <Dialog open={cogsOpen} onOpenChange={setCogsOpen}>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Set COGS Target</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); setCogsT.mutate({ locationId: branchFilter ? +branchFilter : undefined, targetFoodCostPercent: cogsForm.target, alertThresholdPercent: cogsForm.alert }); }} className="space-y-3">
                    <div><label className="text-sm text-[#8D8A87]">Target Food Cost %</label><Input type="number" step="0.1" value={cogsForm.target} onChange={e => setCogsForm(p => ({ ...p, target: e.target.value }))} /></div>
                    <div><label className="text-sm text-[#8D8A87]">Alert Threshold %</label><Input type="number" step="0.1" value={cogsForm.alert} onChange={e => setCogsForm(p => ({ ...p, alert: e.target.value }))} /></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={setCogsT.isPending}>Save Target</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {tab === "financial" && (
          <div className="space-y-6">
            <Tabs value={financialTab} onValueChange={setFinancialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="income" className="text-xs"><FileText className="h-3 w-3 mr-1" />Income</TabsTrigger>
                <TabsTrigger value="balance" className="text-xs"><Scale className="h-3 w-3 mr-1" />Balance</TabsTrigger>
                <TabsTrigger value="trial" className="text-xs"><BookOpen className="h-3 w-3 mr-1" />Trial</TabsTrigger>
                <TabsTrigger value="assets" className="text-xs"><Building2 className="h-3 w-3 mr-1" />Assets</TabsTrigger>
              </TabsList>

              {/* Income Statement */}
              <TabsContent value="income" className="space-y-4">
                <Card className="border-[#E8E0D8]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-serif text-lg">Income Statement (P&L)</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={generateIncomeStatement} disabled={incomeStatementMutation.isPending}>
                        {incomeStatementMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {incomeStatementData ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-2">
                          <h3 className="font-serif text-lg">Income Statement</h3>
                          <p className="text-sm text-[#8D8A87]">Year {year}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between font-medium border-b pb-1">
                            <span>Revenue</span>
                            <span className="font-mono text-[#2E7D32]">{formatKES(incomeStatementData.totalRevenue)}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1 pl-4 text-sm">
                            <span>Less: Cost of Goods Sold</span>
                            <span className="font-mono text-[#D32F2F]">({formatKES(incomeStatementData.totalCOGS)})</span>
                          </div>
                          <div className="flex justify-between font-semibold border-b pb-1">
                            <span>Gross Profit</span>
                            <span className="font-mono">{formatKES(incomeStatementData.grossProfit)}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1">
                            <span>Operating Expenses</span>
                            <span className="font-mono text-[#D32F2F]">({formatKES(incomeStatementData.totalExpenses)})</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg border-t pt-2 bg-[#F5EDE6] px-2 -mx-2">
                            <span>Net Income</span>
                            <span className={`font-mono ${parseFloat(incomeStatementData.netIncome) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                              {formatKES(incomeStatementData.netIncome)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#8D8A87]">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Generate" to create Income Statement</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Balance Sheet */}
              <TabsContent value="balance" className="space-y-4">
                <Card className="border-[#E8E0D8]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-serif text-lg">Balance Sheet</CardTitle>
                    <div className="flex gap-2">
                      <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
                      <Button size="sm" variant="outline" onClick={generateBalanceSheet} disabled={balanceSheetMutation.isPending}>
                        {balanceSheetMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {balanceSheetData ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-2">
                          <h3 className="font-serif text-lg">Balance Sheet</h3>
                          <p className="text-sm text-[#8D8A87]">As of {reportDate}</p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-[#2E7D32]">ASSETS</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Current Assets</span>
                                <span className="font-mono">{formatKES(balanceSheetData.assets?.current?.reduce((s: number, i: any) => s + parseFloat(i.amount.replace(/,/g, '') || 0), 0) || "0")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Fixed Assets</span>
                                <span className="font-mono">{formatKES(balanceSheetData.assets?.fixed?.reduce((s: number, i: any) => s + parseFloat(i.amount.replace(/,/g, '') || 0), 0) || "0")}</span>
                              </div>
                              <div className="flex justify-between font-semibold border-t pt-1">
                                <span>Total Assets</span>
                                <span className="font-mono">{balanceSheetData.assets?.total || "0"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-[#D32F2F]">LIABILITIES + EQUITY</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Liabilities</span>
                                <span className="font-mono">{balanceSheetData.liabilities?.total || "0"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Equity</span>
                                <span className="font-mono">{balanceSheetData.equity?.total || "0"}</span>
                              </div>
                              <div className="flex justify-between font-semibold border-t pt-1">
                                <span>Total</span>
                                <span className="font-mono">{balanceSheetData.totalLiabilitiesAndEquity || "0"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {balanceSheetData.balanceCheck === false && (
                          <div className="mt-4 rounded-lg bg-[#D32F2F]/10 p-3 text-sm text-[#D32F2F]">
                            ⚠️ Balance sheet does not balance! Total Assets ≠ Total Liabilities + Equity
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#8D8A87]">
                        <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Generate" to create Balance Sheet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Trial Balance */}
              <TabsContent value="trial" className="space-y-4">
                <Card className="border-[#E8E0D8]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-serif text-lg">Trial Balance</CardTitle>
                    <div className="flex gap-2">
                      <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
                      <Button size="sm" variant="outline" onClick={generateTrialBalance} disabled={trialBalanceMutation.isPending}>
                        {trialBalanceMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {trialBalanceData ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-2">
                          <h3 className="font-serif text-lg">Trial Balance</h3>
                          <p className="text-sm text-[#8D8A87]">As of {reportDate}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2">Account</th>
                                <th className="text-right py-2">Debit</th>
                                <th className="text-right py-2">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trialBalanceData.accounts?.map((acc: any, idx: number) => (
                                <tr key={idx} className="border-b">
                                  <td className="py-1">{acc.accountName}</td>
                                  <td className="text-right font-mono">{acc.debit !== "0.00" ? formatKES(acc.debit) : ""}</td>
                                  <td className="text-right font-mono">{acc.credit !== "0.00" ? formatKES(acc.credit) : ""}</td>
                                </tr>
                              ))}
                              <tr className="font-semibold border-t-2">
                                <td className="py-2">TOTALS</td>
                                <td className="text-right font-mono">{formatKES(trialBalanceData.totalDebits)}</td>
                                <td className="text-right font-mono">{formatKES(trialBalanceData.totalCredits)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {trialBalanceData.isBalanced ? (
                          <div className="mt-2 text-center text-sm text-[#2E7D32]">✓ Trial Balance is balanced</div>
                        ) : (
                          <div className="mt-2 text-center text-sm text-[#D32F2F]">✗ Trial Balance does not balance!</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#8D8A87]">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Generate" to create Trial Balance</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Asset Register */}
              <TabsContent value="assets" className="space-y-4">
                <Card className="border-[#E8E0D8]">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-serif text-lg">Fixed Asset Register</CardTitle>
                    <Button size="sm" variant="outline" onClick={generateAssetRegister} disabled={assetRegisterMutation.isPending}>
                      {assetRegisterMutation.isPending ? "Generating..." : "Generate"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {assetRegisterData ? (
                      <div className="space-y-4">
                        <div className="text-center border-b pb-2">
                          <h3 className="font-serif text-lg">Fixed Asset Register</h3>
                          <p className="text-sm text-[#8D8A87]">All Fixed Assets</p>
                        </div>
                        {assetRegisterData.assets?.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-[#F5EDE6]">
                                  <th className="text-left py-2 px-2">Asset</th>
                                  <th className="text-right py-2 px-2">Purchase Price</th>
                                  <th className="text-right py-2 px-2">Accum. Deprec.</th>
                                  <th className="text-right py-2 px-2">Book Value</th>
                                  <th className="text-center py-2 px-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assetRegisterData.assets?.map((asset: any, idx: number) => (
                                  <tr key={idx} className="border-b">
                                    <td className="py-2 px-2">
                                      <div className="font-medium">{asset.name}</div>
                                      <div className="text-xs text-[#8D8A87]">{asset.purchaseDate}</div>
                                    </td>
                                    <td className="text-right font-mono py-2 px-2">{asset.purchasePrice}</td>
                                    <td className="text-right font-mono py-2 px-2 text-[#D32F2F]">({asset.accumulatedDepreciation})</td>
                                    <td className="text-right font-mono font-semibold py-2 px-2">{asset.currentBookValue}</td>
                                    <td className="text-center py-2 px-2">
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        asset.status === "active" ? "bg-[#2E7D32]/10 text-[#2E7D32]" :
                                        asset.status === "disposed" ? "bg-[#ED6C02]/10 text-[#ED6C02]" :
                                        "bg-[#8D8A87]/10 text-[#8D8A87]"
                                      }`}>
                                        {asset.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="font-semibold border-t-2 bg-[#F5EDE6]">
                                  <td className="py-2 px-2">TOTALS</td>
                                  <td className="text-right font-mono py-2 px-2">{assetRegisterData.totals?.totalCost}</td>
                                  <td className="text-right font-mono py-2 px-2">({assetRegisterData.totals?.totalAccumulatedDepreciation})</td>
                                  <td className="text-right font-mono py-2 px-2">{assetRegisterData.totals?.totalBookValue}</td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-[#8D8A87]">
                            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No fixed assets found</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#8D8A87]">
                        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Generate" to create Asset Register</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </Layout>
  );
}
