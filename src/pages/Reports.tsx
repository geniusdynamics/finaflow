import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart3, TrendingUp, TrendingDown, PieChart, ArrowUpRight, ArrowDownRight, AlertTriangle, Target, Wallet, Receipt, Landmark, Plus, Trash2, Download, FileSpreadsheet, Smartphone, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [cogsOpen, setCogsOpen] = useState(false);

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: pl } = trpc.reports.plStatement.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const { data: plMonthly } = trpc.reports.plMonthly.useQuery({ year, locationId: branchFilter ? +branchFilter : undefined });
  const { data: comparative } = trpc.reports.plComparative.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const { data: bva } = trpc.reports.budgetVsActual.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const { data: cashFlow } = trpc.reports.cashFlowForecast.useQuery({ locationId: branchFilter ? +branchFilter : undefined });
  const { data: cogs } = trpc.reports.cogsAnalysis.useQuery({ year, month, locationId: branchFilter ? +branchFilter : undefined });
  const { data: categories } = trpc.expenses.categories.useQuery();
  const { data: cogsTarget } = trpc.reports.getCogsTarget.useQuery({ locationId: branchFilter ? +branchFilter : undefined });

  const setBudget = trpc.reports.setBudget.useMutation({
    onSuccess: () => { toast.success("Budget set"); utils.reports.budgetVsActual.invalidate(); setBudgetOpen(false); },
  });
  const deleteBudget = trpc.reports.deleteBudget.useMutation({
    onSuccess: () => { toast.success("Budget removed"); utils.reports.budgetVsActual.invalidate(); },
  });
  const setCogsT = trpc.reports.setCogsTarget.useMutation({
    onSuccess: () => { toast.success("COGS target updated"); utils.reports.cogsAnalysis.invalidate(); setCogsOpen(false); },
  });
  const utils = trpc.useUtils();

  const [budgetForm, setBudgetForm] = useState({ categoryId: "", amount: "" });
  const [cogsForm, setCogsForm] = useState({
    target: cogsTarget?.targetFoodCostPercent ?? "35",
    alert: cogsTarget?.alertThresholdPercent ?? "38",
  });

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

  const maxMonthVal = useMemo(() => Math.max(...(plMonthly?.map(m => parseFloat(m.netProfit)) ?? [0]), 0), [plMonthly]);
  const minMonthVal = useMemo(() => Math.min(...(plMonthly?.map(m => parseFloat(m.netProfit)) ?? [0]), 0), [plMonthly]);

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
            <select value={year} onChange={e => setYear(+e.target.value)} className="rounded border px-3 py-2 text-sm">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={e => setMonth(+e.target.value)} className="rounded border px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleDateString("en-KE", { month: "short" })}</option>)}
            </select>
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="rounded border px-3 py-2 text-sm">
              <option value="">All Branches</option>
              {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        {/* P&L Summary Cards */}
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

        {/* Comparative: This Month vs Last */}
        {comparative && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#C73E1D]"/> Month-over-Month Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-[#F5EDE6] p-4">
                  <p className="text-xs uppercase text-[#8D8A87]">{comparative.current.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#8D8A87]">Revenue:</span> <span className="font-mono font-semibold text-[#2E7D32]">{formatKES(comparative.current.revenue)}</span></div>
                    <div><span className="text-[#8D8A87]">Expenses:</span> <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(comparative.current.expenses)}</span></div>
                    <div><span className="text-[#8D8A87]">Payroll:</span> <span className="font-mono font-semibold text-[#D4A854]">{formatKES(comparative.current.payroll)}</span></div>
                    <div><span className="text-[#8D8A87]">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.current.netProfit) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(comparative.current.netProfit)}</span></div>
                  </div>
                </div>
                <div className="rounded-lg border border-[#E8E0D8] p-4">
                  <p className="text-xs uppercase text-[#8D8A87]">{comparative.previous.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-[#8D8A87]">Revenue:</span> <span className="font-mono font-semibold text-[#2E7D32]">{formatKES(comparative.previous.revenue)}</span></div>
                    <div><span className="text-[#8D8A87]">Expenses:</span> <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(comparative.previous.expenses)}</span></div>
                    <div><span className="text-[#8D8A87]">Payroll:</span> <span className="font-mono font-semibold text-[#D4A854]">{formatKES(comparative.previous.payroll)}</span></div>
                    <div><span className="text-[#8D8A87]">Net:</span> <span className={`font-mono font-semibold ${parseFloat(comparative.previous.netProfit) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(comparative.previous.netProfit)}</span></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly P&L Chart (CSS bar chart) */}
        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#2E7D32]"/> Monthly Trend — {year}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {plMonthly?.map(m => {
                const net = parseFloat(m.netProfit);
                const rev = parseFloat(m.revenue);
                const maxAbs = Math.max(Math.abs(maxMonthVal), Math.abs(minMonthVal), 1);
                const barH = Math.min(100, Math.max(4, (Math.abs(net) / maxAbs) * 100));
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-[#8D8A87]">{formatKES(Math.abs(net).toFixed(0))}</span>
                    <div className="w-full flex justify-center">
                      <div className="w-full max-w-8 rounded-t" style={{
                        height: `${barH}%`,
                        backgroundColor: net >= 0 ? "#2E7D32" : "#D32F2F",
                        opacity: 0.7 + (rev > 0 ? 0.3 : 0),
                      }} />
                    </div>
                    <span className="text-[10px] text-[#8D8A87]">{m.monthName}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
            {bva && bva.categories.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#8D8A87]">
                  <span>Total Budgeted: <span className="font-mono font-semibold">{formatKES(bva.totalBudgeted)}</span></span>
                  <span>Total Actual: <span className="font-mono font-semibold">{formatKES(bva.totalActual)}</span></span>
                  <span>Variance: <span className={`font-mono font-semibold ${parseFloat(bva.totalVariance) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(bva.totalVariance)}</span></span>
                </div>
                {bva.categories.map(cat => (
                  <div key={cat.categoryId} className="space-y-1">
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
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8D8A87]">No budgets set for this period. Click "Set Budget" to start tracking.</p>
            )}
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
    </Layout>
  );
}
