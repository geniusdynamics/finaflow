// ABOUTME: Renders the shared report page header with filter controls and tab navigation.
// ABOUTME: Contains only route-level state management and common UI elements for the reports dashboard.
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ReportsToolbar } from "./ReportsToolbar";
import { BookOpen, Receipt } from "lucide-react";

export function ReportsPageShell() {
  const [tab, setTab] = useState<"operations" | "financial">("operations");

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Financial Intelligence</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">P&L, Budget vs Actual, COGS, Cash Flow Forecasting</p>
          </div>
          <ReportsToolbar />
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
      </div>
    </Layout>
  );
}
