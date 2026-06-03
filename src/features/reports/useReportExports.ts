// ABOUTME: Centralized hook providing CSV download formatting and export actions for financial report data.
// ABOUTME: Accepts report data and filter state, returns memoized export handlers with consistent file naming.
import { useCallback } from "react";
import { toast } from "sonner";

export interface ExportParams {
  salesData: SalesRecord[];
  expenseData: ExpenseRecord[];
  walletTxns: WalletTxn[];
  locations: LocationRecord[];
  categories: CategoryRecord[];
  suppliers: SupplierRecord[];
  pl: PlRecord | undefined;
  year: number;
  month: number;
}

interface SalesRecord {
  saleDate: string;
  paymentMethod: string;
  grossSales?: string;
  netSales: string;
  taxAmount?: string;
  discountAmount?: string;
  receiptNo?: string;
  recordedBy?: string;
  locationId: number;
}

interface ExpenseRecord {
  expenseDate: string;
  expenseNumber?: string | null;
  description: string;
  paymentMethod: string;
  amount: string;
  categoryId?: number | null;
  supplierId?: number | null;
  locationId: number;
  id: number;
}

interface WalletTxn {
  txnDate: string;
  providerTxnId?: string | null;
  txnId?: string;
  provider?: string;
  txnType: string;
  description?: string | null;
  partyName?: string | null;
  amount: string;
  txnFee?: string;
  balance?: string | null;
  currency?: string;
  direction?: string;
  walletTag?: string;
  linkedSupplierId?: number | null;
  linkedExpenseId?: number | null;
  locationId?: number;
  isReconciled?: boolean;
  status?: string;
}

interface LocationRecord {
  id: number;
  name: string;
}

interface CategoryRecord {
  id: number;
  name: string;
}

interface SupplierRecord {
  id: number;
  name: string;
}

interface PlRecord {
  revenue?: string;
  cogs?: string;
  expenses?: string;
  payroll?: string;
  netProfit?: string;
}

export function useReportExports(params: ExportParams) {
  const { salesData, expenseData, walletTxns, locations, categories, suppliers, pl, year, month } = params;

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
    const rows = salesData.map((s: SalesRecord) => [
      s.saleDate,
      locations?.find((l: LocationRecord) => l.id === s.locationId)?.name ?? "",
      s.paymentMethod,
      s.grossSales ?? "",
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
    const rows = expenseData.map((e: ExpenseRecord) => [
      e.expenseDate,
      locations?.find((l: LocationRecord) => l.id === e.locationId)?.name ?? "",
      e.expenseNumber ?? "",
      e.description,
      categories?.find((c: CategoryRecord) => c.id === e.categoryId)?.name ?? "",
      "",
      e.paymentMethod,
      e.amount,
      "",
    ]);
    downloadCSV(`expenses-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${expenseData.length} expense records`);
  }, [expenseData, locations, categories, year, month]);

  const exportWalletTxns = useCallback(() => {
    if (!walletTxns?.length) {
      toast.error("No wallet transaction data to export");
      return;
    }

    const resolveSupplierName = (txn: WalletTxn) => {
      if (!txn.linkedSupplierId) return "";
      const supplier = suppliers?.find((s: SupplierRecord) => s.id === txn.linkedSupplierId);
      return supplier?.name ?? "";
    };

    const resolveExpenseCategory = (txn: WalletTxn) => {
      if (!txn.linkedExpenseId) return "";
      const expense = expenseData?.find((e: ExpenseRecord) => e.id === txn.linkedExpenseId);
      if (!expense || !expense.categoryId) return "";
      const cat = categories?.find((c: CategoryRecord) => c.id === expense.categoryId);
      return cat?.name ?? "";
    };

    const headers = ["Date", "Txn ID", "Provider", "Type", "Description", "Party Name", "Amount", "Fee", "Balance", "Currency", "Direction", "Wallet Tag", "Expense Category", "Location", "Status"];
    const rows = walletTxns.map((t: WalletTxn) => {
      const amt = Math.abs(parseFloat(t.amount));
      const isOut = t.direction === "out" || parseFloat(t.amount) < 0;
      const displayAmount = isOut ? `-${amt.toFixed(2)}` : amt.toFixed(2);
      return [
        t.txnDate,
        t.providerTxnId ?? t.txnId ?? "",
        t.provider ?? "mpesa",
        t.txnType,
        t.description ?? "",
        t.partyName ?? "",
        displayAmount,
        t.txnFee ?? "",
        t.balance ?? "",
        t.currency ?? "KES",
        t.direction ?? (isOut ? "out" : "in"),
        resolveSupplierName(t),
        resolveExpenseCategory(t),
        locations?.find((l: LocationRecord) => l.id === t.locationId)?.name ?? "",
        t.isReconciled ? "Reconciled" : t.status === "completed" ? "Completed" : (t.status ?? "Pending"),
      ];
    });
    downloadCSV(`wallet-txns-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
    toast.success(`Exported ${walletTxns.length} wallet transaction records`);
  }, [walletTxns, expenseData, locations, categories, suppliers, year, month]);

  const exportConsolidated = useCallback(() => {
    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
    const headers = ["Category", "Item", "Amount", "Period"];
    const rows: string[][] = [];
    rows.push(["REVENUE", "Total Sales", pl?.revenue ?? "0", periodLabel]);
    rows.push(["COGS", "Cost of Goods Sold", pl?.cogs ?? "0", periodLabel]);
    rows.push(["EXPENSES", "Total Expenses", pl?.expenses ?? "0", periodLabel]);
    rows.push(["PAYROLL", "Total Payroll", pl?.payroll ?? "0", periodLabel]);
    rows.push(["NET", "Net Profit", pl?.netProfit ?? "0", periodLabel]);
    (expenseData ?? []).forEach((e: ExpenseRecord) => rows.push(["EXPENSE_DETAIL", e.description, e.amount, periodLabel]));
    (salesData ?? []).forEach((s: SalesRecord) => rows.push(["SALE_DETAIL", `${s.paymentMethod} sales`, s.netSales, periodLabel]));
    downloadCSV(`consolidated-${periodLabel}.csv`, headers, rows);
    toast.success("Consolidated report exported");
  }, [salesData, expenseData, pl, year, month]);

  return { exportSales, exportExpenses, exportWalletTxns, exportConsolidated };
}
