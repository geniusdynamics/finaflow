// ABOUTME: Renders the financial reporting dashboard with P&L, cash flow, budget tracking, and export tools.
// ABOUTME: Coordinates report queries and interactive chart views for the selected period and branch context.
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Receipt, BookOpen } from "lucide-react";
import { OperationsReportsPanel } from "@/features/reports/OperationsReportsPanel";
import { FinancialReportsPanel } from "@/features/reports/FinancialReportsPanel";

export function Reports() {
  const [tab, setTab] = useState<"operations" | "financial">("operations");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<string>("");

  const { data: locations } = trpc.locations.list.useQuery();

  const resetChartSelections = () => {};

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

        {tab === "operations" ? <OperationsReportsPanel /> : <FinancialReportsPanel year={year} />}
      </div>
    </Layout>
  );
}
