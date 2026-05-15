// ABOUTME: Centralized hook providing CSV download formatting and export actions for financial report data.
// ABOUTME: Accepts report data and filter state, returns memoized export handlers with consistent file naming.
import { useCallback } from "react";
import { toast } from "sonner";

export interface ExportParams {
  salesData: any[];
  expenseData: any[];
  mpesaData: any[];
  locations: any[];
  categories: any[];
  pl: any;
  year: number;
  month: number;
}

export function useReportExports(params: ExportParams) {
  const { salesData, expenseData, mpesaData, locations, categories, pl, year, month } = params;

  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSales = useCallback(() => {
    if (!salesData?.length) {
      toast.error("No sales data to export");
      return;
    }
    const headers = ["Date", "Location", "Payment Method", "Gross Sales", "Net Sales", "Tax", "Discount", "Receipt No", "Recorded By"];
    const rows = salesData.map((s: any) => [
      s.saleDate,
      locations?.find((l: any) => l.id === s.locationId)?.name ?? "",
      s.paymentMethod,
      s.grossSales,
      s.netSales,
      s.taxAmount ?? "",
      s.discountAmount ?? "",
      s.receiptNo ?? "",
      s.recordedBy ?? "",
    ]);
    downloadCSV(`sales-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${salesData.length} sales records`);
  }, [salesData, locations, year, month]);

  const exportExpenses = useCallback(() => {
    if (!expenseData?.length) {
      toast.error("No expense data to export");
      return;
    }
    const headers = ["Date", "Location", "ExpNo", "Description", "Category", "Supplier", "Method", "Amount", "Account"];
    const rows = expenseData.map((e: any) => [
      e.expenseDate,
      locations?.find((l: any) => l.id === e.locationId)?.name ?? "",
      e.expenseNumber ?? "",
      e.description,
      categories?.find((c: any) => c.id === e.categoryId)?.name ?? "",
      "",
      e.paymentMethod,
      e.amount,
      "",
    ]);
    downloadCSV(`expenses-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${expenseData.length} expense records`);
  }, [expenseData, locations, categories, year, month]);

  const exportMpesa = useCallback(() => {
    if (!mpesaData?.length) {
      toast.error("No M-PESA data to export");
      return;
    }
    const headers = ["Date", "Txn ID", "Type", "Description", "Party Name", "Amount", "Fee", "Balance", "Location", "Status"];
    const rows = mpesaData.map((t: any) => [
      t.txnDate,
      t.txnId,
      t.txnType,
      t.description ?? "",
      t.partyName ?? "",
      t.amount,
      t.txnFee ?? "",
      t.balance ?? "",
      locations?.find((l: any) => l.id === t.locationId)?.name ?? "",
      t.isReconciled ? "Reconciled" : "Pending",
    ]);
    downloadCSV(`mpesa-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${mpesaData.length} M-PESA records`);
  }, [mpesaData, locations, year, month]);

  const exportConsolidated = useCallback(() => {
    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
    const headers = ["Category", "Item", "Amount", "Period"];
    const rows: string[][] = [];
    rows.push(["REVENUE", "Total Sales", pl?.revenue ?? "0", periodLabel]);
    rows.push(["COGS", "Cost of Goods Sold", pl?.cogs ?? "0", periodLabel]);
    rows.push(["EXPENSES", "Total Expenses", pl?.expenses ?? "0", periodLabel]);
    rows.push(["PAYROLL", "Total Payroll", pl?.payroll ?? "0", periodLabel]);
    rows.push(["NET", "Net Profit", pl?.netProfit ?? "0", periodLabel]);
    (expenseData ?? []).forEach((e: any) => rows.push(["EXPENSE_DETAIL", e.description, e.amount, periodLabel]));
    (salesData ?? []).forEach((s: any) => rows.push(["SALE_DETAIL", `${s.paymentMethod} sales`, s.netSales, periodLabel]));
    downloadCSV(`consolidated-${periodLabel}.csv`, headers, rows);
    toast.success("Consolidated report exported");
  }, [salesData, expenseData, pl, year, month]);

  return { exportSales, exportExpenses, exportMpesa, exportConsolidated };
}
