// eslint-disable react-refresh/only-export-components
import { useState, useRef, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Receipt, Tag, Pencil, X, AlertCircle, Camera, FileText, Download, Printer, Wallet, TrendingUp, Filter, BookOpen, RotateCcw } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { ExpenseCategorySelector } from "@/components/ExpenseCategorySelector";
import { toast } from "sonner";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type PeriodFilter = "overall" | "today" | "this_week" | "this_month" | "this_year" | "custom";
type CategoryMode = "system" | "link";

export function formatLocationBalance(balance: string | number | null | undefined): string {
  return formatKES(balance ?? 0);
}

function getPeriodDates(period: PeriodFilter, customFrom?: string, customTo?: string) {
  const now = new Date();
  const today = getLocalDateString(now);
  switch (period) {
    case "today": return { dateFrom: today, dateTo: today };
    case "this_week": {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      return { dateFrom: getLocalDateString(start), dateTo: today };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: getLocalDateString(start), dateTo: today };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: getLocalDateString(start), dateTo: today };
    }
    case "custom": return { dateFrom: customFrom ?? today, dateTo: customTo ?? today };
    default: return {};
  }
}

/** Maps payment method to allowed account type values in the DB */
const PAYMENT_METHOD_ACCOUNT_TYPES: Record<string, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFundingAccounts(paymentMethod: string, allAccounts: any[] | undefined): any[] {
  const allowedTypes = PAYMENT_METHOD_ACCOUNT_TYPES[paymentMethod] ?? [];
  return (allAccounts ?? []).filter(a => allowedTypes.includes(a.type) && !a.deletedAt);
}

export function Expenses() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.EXPENSES_MANAGE);

  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<number | null>(null);
  const [tab, setTab] = useState<"expenses" | "categories">("expenses");

  // Filters
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("overall");
  const [customFrom, setCustomFrom] = useState(getLocalDateString());
  const [customTo, setCustomTo] = useState(getLocalDateString());

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: categories, refetch: refetchCats, isLoading: catsLoading, error: catsError } = trpc.expenses.categories.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: coa } = trpc.chartOfAccounts.list.useQuery(
    { businessId: user?.currentBusinessId ?? 0 },
    { enabled: !!user?.currentBusinessId }
  );
  const { data: bills } = trpc.bills.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();

  // Dashboard data
  const { data: accountBalances } = trpc.dashboard.accountBalances.useQuery();
  const { data: prevDayIncome } = trpc.dashboard.previousDayIncome.useQuery({});

  // Build query filters
  const dateRange = useMemo(() => getPeriodDates(periodFilter, customFrom, customTo), [periodFilter, customFrom, customTo]);
  const expenseFilters = useMemo(() => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f: any = {};
    if (branchFilter) f.locationId = +branchFilter;
    if (periodFilter !== "overall" && dateRange.dateFrom) {
      f.dateFrom = dateRange.dateFrom;
      f.dateTo = dateRange.dateTo;
    }
    return f;
  }, [branchFilter, periodFilter, dateRange]);

  const { data: expenses, refetch } = trpc.expenses.list.useQuery(expenseFilters);

  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => { toast.success("Expense added successfully"); setOpen(false); resetForm(); refetch(); },
    onError: (err) => toast.error(err.message || "Failed to add expense"),
  });
  const createCat = trpc.expenses.createCategory.useMutation({
    onSuccess: () => { toast.success("Category added"); setCatOpen(false); setCatForm({ name: "", description: "", color: "#C73E1D", accountingClass: "operating_expense", defaultAccountId: "", mode: "system" }); refetchCats(); },
    onError: (err) => toast.error(err.message || "Failed to add category"),
  });
  const updateCat = trpc.expenses.updateCategory.useMutation({
    onSuccess: () => { setEditCat(null); refetchCats(); toast.success("Category updated"); },
    onError: (err) => toast.error(err.message || "Failed to update category"),
  });
  const deleteCat = trpc.expenses.deleteCategory.useMutation({
    onSuccess: () => { refetchCats(); toast.success("Category deleted"); },
    onError: (err) => toast.error(err.message || "Failed to delete category"),
  });
  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Expense deleted"); },
    onError: (err) => toast.error(err.message || "Failed to delete expense"),
  });
  const reverseExpense = trpc.expenses.reverse.useMutation({
    onSuccess: () => { refetch(); toast.success("Expense reversed"); },
    onError: (err) => toast.error(err.message || "Failed to reverse expense"),
  });

  const [form, setForm] = useState({
    locationId: "", categoryIds: [] as number[], supplierId: "", amount: "", description: "",
    expenseDate: getLocalDateString(), paymentMethod: "cash" as const,
    accountId: "", billId: "",
  });
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#C73E1D", accountingClass: "operating_expense", defaultAccountId: "", mode: "system" as CategoryMode });
  const [attachments, setAttachments] = useState<{ imageData: string; mimeType: string; caption: string }[]>([]);
  const todayDate = getLocalDateString();

  const selectedBillId = form.billId ? +form.billId : undefined;
  const { data: billItems } = trpc.bills.getItems.useQuery(
    { billId: selectedBillId! },
    { enabled: !!selectedBillId }
  );

  const getCategoriesFromBillItems = (items: typeof billItems): number[] => {
    if (!items || items.length === 0) return [];
    const uniqueCategories = [...new Set(items.map(item => item.categoryId).filter(Boolean))];
    return uniqueCategories as number[];
  };

  const photosEnabled = settings?.photosExpenses !== "false";
  const selectedSupplier = suppliers?.find(s => s.id.toString() === form.supplierId);
  const selectedBill = bills?.find(b => b.id.toString() === form.billId);
  const itemCategories = billItems ? getCategoriesFromBillItems(billItems) : [];
  const hasMultiCategoryItems = !!form.billId && !!billItems && billItems.length > 0 && itemCategories.length > 1;

  const groupBillItemsByCategory = (items: NonNullable<typeof billItems>): Map<number | null | undefined, NonNullable<typeof billItems>> => {
    const grouped = new Map<number | null | undefined, NonNullable<typeof billItems>>();
    if (!items) return grouped;
    for (const item of items) {
      const catId = item.categoryId;
      if (!grouped.has(catId)) {
        grouped.set(catId, []);
      }
      const existing = grouped.get(catId);
      if (existing) existing.push(item);
    }
    return grouped;
  };

  useEffect(() => {
    if (!form.billId || !selectedBill) return;

    let categoryIds: number[] = [];

    if (selectedBill.categoryId) {
      categoryIds = [selectedBill.categoryId];
    } else if (billItems && billItems.length > 0) {
      categoryIds = getCategoriesFromBillItems(billItems);
    }

    if (categoryIds.length === 0 && selectedSupplier?.autoCategoryId) {
      categoryIds = [selectedSupplier.autoCategoryId];
    }

    setForm(p => ({
      ...p,
      supplierId: selectedBill.supplierId ? String(selectedBill.supplierId) : p.supplierId,
      categoryIds: categoryIds.length > 0 ? categoryIds : p.categoryIds,
    }));
  }, [form.billId, selectedBill, billItems, selectedSupplier?.autoCategoryId]);
  useEffect(() => {
    if (!form.billId && form.categoryIds.length === 0 && selectedSupplier?.autoCategoryId) {
      setForm((previous) => ({
        ...previous,
        categoryIds: [selectedSupplier.autoCategoryId].filter((id): id is number => id !== null),
      }));
    }
  }, [form.billId, form.categoryIds, selectedSupplier?.autoCategoryId]);

  // Auto-detect funding source: when payment method changes and only one matching account exists
  useEffect(() => {
    const matches = getFundingAccounts(form.paymentMethod, accounts);
    if (matches.length === 1) {
      setForm(p => ({ ...p, accountId: String(matches[0].id) }));
    } else if (form.accountId) {
      const stillValid = matches.some(a => String(a.id) === form.accountId);
      if (!stillValid) {
        setForm(p => ({ ...p, accountId: "" }));
      }
    }
  }, [form.paymentMethod, accounts]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: { imageData: string; mimeType: string; caption: string }[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is too large (max 5MB)`); continue; }
      const base64 = await fileToBase64(file);
      newAttachments.push({ imageData: base64, mimeType: file.type, caption: file.name });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const resetForm = () => {
    setForm({ locationId: "", categoryIds: [], supplierId: "", amount: "", description: "", expenseDate: getLocalDateString(), paymentMethod: "cash", accountId: "", billId: "" });
    setAttachments([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.locationId) { toast.error("Please select a location"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Please enter a valid amount"); return; }
    if (!form.description.trim()) { toast.error("Please enter a description"); return; }
    if (form.expenseDate > todayDate) { toast.error("Expense date cannot be in the future"); return; }

    const hasBillWithItems = form.billId && billItems && billItems.length > 0;
    const itemCategories = hasBillWithItems ? getCategoriesFromBillItems(billItems) : [];
    const hasMultiCategoryItems = hasBillWithItems && itemCategories.length > 1;
    const billHasOwnCategory = !!selectedBill?.categoryId;

    if (form.categoryIds.length === 0) {
      if (hasBillWithItems) {
        // Bill has items - allow proceeding (will create expense with items)
      } else if (form.billId) {
        toast.error("The selected bill has no items. Please add items to the bill or select a category manually.");
        return;
      } else {
        toast.error("Please select at least one category");
        return;
      }
    }

    if (hasMultiCategoryItems && !billHasOwnCategory) {
      const grouped = groupBillItemsByCategory(billItems);
      const expenseItems = Array.from(grouped.entries()).flatMap(([categoryId, items]) => {
        return items.map(item => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          categoryId: categoryId ? Number(categoryId) : form.categoryIds[0],
          notes: undefined as string | undefined,
        }));
      });

      const totalAmount = expenseItems.reduce((sum, item) => sum + parseFloat(String(item.totalPrice)), 0);

      toast.info("Creating expense with line items...");

      createExpense.mutate({
        locationId: +form.locationId,
        categoryId: form.categoryIds[0],
        supplierId: form.supplierId ? +form.supplierId : undefined,
        amount: totalAmount.toFixed(2),
        description: form.description,
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        accountId: form.accountId ? +form.accountId : undefined,
        billId: form.billId ? +form.billId : undefined,
        attachments: photosEnabled ? attachments : undefined,
        items: expenseItems,
      });
      return;
    }

    if (hasBillWithItems && billItems && billItems.length > 0) {
      const expenseItems = billItems.map(item => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        categoryId: item.categoryId ? Number(item.categoryId) : form.categoryIds[0],
        notes: undefined as string | undefined,
      }));

      createExpense.mutate({
        locationId: +form.locationId,
        categoryId: form.categoryIds[0],
        supplierId: form.supplierId ? +form.supplierId : undefined,
        amount: form.amount,
        description: form.description,
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        accountId: form.accountId ? +form.accountId : undefined,
        billId: form.billId ? +form.billId : undefined,
        attachments: photosEnabled ? attachments : undefined,
        items: expenseItems,
      });
      return;
    }

    const primaryCategoryId = form.categoryIds[0] ?? 0;
    createExpense.mutate({
      locationId: +form.locationId, categoryId: primaryCategoryId, supplierId: form.supplierId ? +form.supplierId : undefined,
      amount: form.amount, description: form.description, expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod, accountId: form.accountId ? +form.accountId : undefined,
      billId: form.billId ? +form.billId : undefined, attachments: photosEnabled ? attachments : undefined,
    });
  };

  const handleCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error("Category name is required"); return; }
    if (catForm.mode === "link" && !catForm.defaultAccountId) { toast.error("Please select a default expense account"); return; }
    createCat.mutate({
      name: catForm.name, description: catForm.description, color: catForm.color,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accountingClass: catForm.accountingClass as any,
      defaultAccountId: catForm.mode === "link" && catForm.defaultAccountId ? +catForm.defaultAccountId : undefined,
    });
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) ?? 0;

  // Export to CSV
  const tableRef = useRef<HTMLDivElement>(null);
  const handleExport = () => {
    if (!expenses?.length) { toast.error("No data to export"); return; }
    const headers = ["Date", "ExpNo", "Description", "Category", "Supplier", "Method", "Amount"];
    const rows = expenses.map(exp => {
      const cat = categories?.find(c => c.id === exp.categoryId);
      const sup = suppliers?.find(s => s.id === exp.supplierId);
      return [
        formatDate(exp.expenseDate), exp.expenseNumber ?? "-", exp.description,
        cat?.name ?? "-", sup?.name ?? "-", exp.paymentMethod, exp.amount,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!tableRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Expenses Report</title>
      <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}tr:nth-child(even){background:#fafafa}.right{text-align:right}</style>
      </head><body><h2>Expenses Report</h2><p>Generated: ${new Date().toLocaleDateString("en-KE")}</p>
      ${tableRef.current.innerHTML}</body></html>`);
    printWindow.document.close(); printWindow.print();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Section tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("expenses")} className={`px-4 py-2 text-sm font-medium ${tab === "expenses" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Receipt className="mr-1 inline h-4 w-4"/>Expenses
          </button>
          <button onClick={() => setTab("categories")} className={`px-4 py-2 text-sm font-medium ${tab === "categories" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <BookOpen className="mr-1 inline h-4 w-4"/>Categories
          </button>
        </div>

        {tab === "expenses" && (
        <>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Expenses</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track all business expenditures</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
              <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Add Expense</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <LocationSelector
                      locations={locations}
                      userLocationId={user?.locationId}
                      value={form.locationId}
                      onChange={v => setForm(p => ({ ...p, locationId: v }))}
                      enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                      required
                    />
                  </div>
                  {!hasMultiCategoryItems && (
                    <div>
                      <ExpenseCategorySelector
                        categories={categories}
                        value={form.categoryIds[0]?.toString() ?? ""}
                        onChange={v => setForm(p => ({ ...p, categoryIds: v ? [parseInt(v)] : [] }))}
                        label={<>Category {form.billId && selectedBill?.categoryId && <span className="text-xs text-[#2E7D32] font-normal">(from bill)</span>}</>}
                        hint={form.billId ? (selectedBill?.categoryId ? "Category from linked bill." : (selectedSupplier?.autoCategoryId ? "Using supplier default." : undefined)) : undefined}
                      />
                    </div>
                  )}
                </div>

                {hasMultiCategoryItems && billItems && billItems.length > 0 && (
                  <div className="rounded-lg border border-[#D4A854] bg-[#FDF8F3] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-[#2D2A26]">Bill Items — select categories for expenses:</p>
                      <span className="text-xs text-[#8D8A87]">{form.categoryIds.length} of {itemCategories.length} selected</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {billItems.map(item => {
                        const cat = categories?.find(c => c.id === item.categoryId);
                        const isSelected = item.categoryId && form.categoryIds.includes(item.categoryId);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.categoryId) {
                                const newCategories = isSelected
                                  ? form.categoryIds.filter(id => id !== item.categoryId)
                                  : [...form.categoryIds, item.categoryId];
                                setForm(p => ({ ...p, categoryIds: newCategories }));
                              }
                            }}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-[#2E7D32] text-white"
                                : "bg-white border border-[#E8E0D8] text-[#2D2A26] hover:border-[#D4A854]"
                            }`}
                          >
                            {cat ? cat.name : "No cat"}
                            <span className={`font-mono ${isSelected ? "text-white/80" : "text-[#8D8A87]"}`}>{formatKES(item.totalPrice)}</span>
                            {isSelected && <span className="text-white/70">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-[#8D8A87]">Click categories to toggle. Each selected category creates a separate expense.</p>
                  </div>
                )}

                {hasMultiCategoryItems && form.categoryIds.length === 0 && (
                  <p className="text-xs text-[#C73E1D]">Please select at least one category from the bill items above.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount</Label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                      <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="pl-10" required />
                    </div>
                  </div>
                  <div><Label>Payment Method</Label>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                      <option value="cash">Cash</option><option value="wallet">Wallet</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option>
                    </select>
                  </div>
                </div>
                <div><Label>Funding Source</Label>
                  <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                    <option value="">Auto-detect</option>
                    {getFundingAccounts(form.paymentMethod, accounts)?.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name}{loc ? ` (${loc})` : ""}</option>; })}
                  </select>
                </div>
                <div><Label>Supplier {form.billId ? <span className="text-xs text-[#2E7D32] font-normal">(from bill)</span> : ""}</Label>
                  <select value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value, billId: "" }))} className="w-full rounded border px-3 py-2 text-sm" disabled={!!form.billId}>
                    <option value="">{form.billId ? "Auto-filled from bill" : "Optional"}</option>{suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {selectedSupplier && (
                  <div className="rounded-lg bg-[#F5EDE6] p-2 text-xs text-[#2D2A26]">
                    <span className="font-medium">Balance owed:</span> {formatKES(selectedSupplier.currentBalance)}
                    <span className="mx-2 text-[#8D8A87]">|</span>
                    <span className="font-medium">Total paid:</span> {formatKES(selectedSupplier.totalPaid)}
                  </div>
                )}
                <div><Label>Link to Bill <span className="text-[#8D8A87] font-normal">(optional)</span></Label>
                  <select value={form.billId} onChange={e => setForm(p => ({ ...p, billId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                    <option value="">{form.supplierId ? "No bill (for this supplier)" : "No bill"}</option>
                    {bills?.filter(b => b.status !== "paid" && b.status !== "cancelled" && (!form.supplierId || b.supplierId?.toString() === form.supplierId)).map(b => (
                      <option key={b.id} value={b.id}>{b.billNumber ?? `BILL-${String(b.id).padStart(4,"0")}`} · {b.description} · Bal: {formatKES(b.balanceDue)}</option>
                    ))}
                  </select>
                  {selectedBill && (
                    <p className="mt-1 text-xs text-[#2E7D32]">
                      Paying this expense will reduce bill balance from {formatKES(selectedBill.balanceDue)} to {formatKES(Math.max(0, parseFloat(selectedBill.balanceDue) - (parseFloat(form.amount) || 0)).toFixed(2))}
                    </p>
                  )}
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required /></div>
                <div><Label>Date</Label><Input type="date" value={form.expenseDate} max={todayDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))} required /></div>
                {photosEnabled && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Attach Photos</Label>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="relative h-16 w-16 rounded-lg border border-[#E8E0D8] overflow-hidden">
                          <img src={att.imageData} alt="" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 rounded-bl bg-[#D32F2F] p-0.5 text-white"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#8D8A87] text-[#8D8A87] hover:border-[#C73E1D] hover:text-[#C73E1D]">
                        <Plus className="h-5 w-5" /><input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFile} />
                      </label>
                    </div>
                    <p className="text-xs text-[#8D8A87]">Tap + to take a photo or select from gallery. Max 5MB each.</p>
                  </div>
                )}
                <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createExpense.isPending}>{createExpense.isPending ? "Saving..." : "Add Expense"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dashboard Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Total Expenses</span></div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#D32F2F]">{formatKES(totalExpenses.toFixed(2))}</p>
              <p className="text-xs text-[#8D8A87] mt-1">{expenses?.length ?? 0} entries</p>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#2E7D32]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Account Balances</span></div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#2E7D32]">{formatKES(accountBalances?.totalBalance ?? "0")}</p>
              <p className="text-xs text-[#8D8A87] mt-1">Across all branches</p>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Prev. Day Income</span></div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#D4A854]">{formatKES(prevDayIncome?.totalIncome ?? "0")}</p>
              <p className="text-xs text-[#8D8A87] mt-1">{prevDayIncome?.date ? formatDate(prevDayIncome.date) : "Yesterday"}</p>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-[#8D8A87]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Categories</span></div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#2D2A26]">{categories?.length ?? 0}</p>
              <p className="text-xs text-[#8D8A87] mt-1">Active categories</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-Branch Breakdown */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          {locations?.map(loc => {
            const locBalance = accountBalances?.byLocation[loc.id] ?? 0;
            const locIncome = prevDayIncome?.byBranch.find(b => b.locationId === loc.id)?.total ?? "0";
            return (
              <Card key={loc.id} className="border-[#E8E0D8] bg-white">
                <CardContent className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F5EDE6] text-xs font-bold text-[#C73E1D]">
                      {loc.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#2D2A26]">{loc.name}</p>
                      <div className="flex gap-3 text-[10px] text-[#8D8A87]">
                        <span>Bal: <span className="font-mono font-semibold text-[#2E7D32]">{formatLocationBalance(locBalance)}</span></span>
                        <span>Inc: <span className="font-mono font-semibold text-[#D4A854]">{formatKES(locIncome)}</span></span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 text-[#8D8A87]"><Filter className="h-4 w-4" /><span className="text-xs font-medium uppercase">Filters</span></div>
              <div>
                <Label className="text-xs text-[#8D8A87]">Branch</Label>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="w-40 rounded border px-3 py-2 text-sm">
                  <option value="">All Branches</option>
                  {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-[#8D8A87]">Period</Label>
                <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as PeriodFilter)} className="w-40 rounded border px-3 py-2 text-sm">
                  <option value="overall">Overall</option>
                  <option value="today">Today</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="this_year">This Year</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {periodFilter === "custom" && (
                <>
                  <div><Label className="text-xs text-[#8D8A87]">From</Label><Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-36" /></div>
                  <div><Label className="text-xs text-[#8D8A87]">To</Label><Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-36" /></div>
                </>
              )}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExport}><Download className="mr-1 h-3 w-3" />Export</Button>
                <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="mr-1 h-3 w-3" />Print</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        </>
        )}

        {tab === "categories" && (
        <>
        {/* Categories - Tag Style */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-[#2D2A26]">Expense Categories</h2>
            {canManage && (
              <Dialog open={catOpen} onOpenChange={setCatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-[#2E7D32] text-[#2E7D32]"><Plus className="mr-1 h-3 w-3" />Add</Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Add Category</DialogTitle></DialogHeader>
                  <form onSubmit={handleCat} className="space-y-3">
                    <div><Label>Name</Label><Input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} required /></div>
                    <div><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} /></div>
                    <div><Label>Color</Label><div className="flex items-center gap-2"><input type="color" value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color: e.target.value }))} className="h-10 w-10 rounded border p-0.5" /><span className="text-xs text-[#8D8A87]">{catForm.color}</span></div></div>
                    <div>
                      <Label>Classification</Label>
                      <select value={catForm.accountingClass} onChange={e => setCatForm(p => ({ ...p, accountingClass: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="operating_expense">Operating Expense</option>
                        <option value="admin_expense">Administrative Expense</option>
                        <option value="cogs">Cost of Goods Sold</option>
                        <option value="marketing">Marketing Expense</option>
                        <option value="depreciation">Depreciation</option>
                        <option value="other">Other Expense</option>
                      </select>
                    </div>
                    <div>
                      <Label>Accounting Mode</Label>
                      <select value={catForm.mode} onChange={e => setCatForm(p => ({ ...p, mode: e.target.value as CategoryMode, defaultAccountId: e.target.value === "link" ? p.defaultAccountId : "" }))} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="system">Let the system manage the backing account</option>
                        <option value="link">Link an existing chart account</option>
                      </select>
                      <p className="mt-1 text-xs text-[#8D8A87]">Simple mode creates or reuses the backing expense account automatically.</p>
                    </div>
                    <div>
                      <Label>Default Expense Account</Label>
                      <select value={catForm.defaultAccountId} onChange={e => setCatForm(p => ({ ...p, defaultAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required={catForm.mode === "link"} disabled={catForm.mode !== "link"}>
                        <option value="">{catForm.mode === "link" ? "Select expense account..." : "System managed"}</option>
                        {coa?.grouped?.expense?.map(a => <option key={a.id} value={a.id}>{a.accountCode} - {a.name}</option>)}
                      </select>
                    </div>
                    <Button type="submit" className="w-full bg-[#2E7D32]" disabled={createCat.isPending}>{createCat.isPending ? "Adding..." : "Add Category"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {catsLoading && <p className="text-sm text-[#8D8A87]">Loading categories...</p>}
            {catsError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>Error: {catsError.message}</span>
              </div>
            )}
            {!catsLoading && !catsError && categories?.length === 0 && <p className="text-sm text-[#8D8A87]">No categories yet.</p>}
            {categories?.map(c => (
              <div key={c.id} className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:shadow" style={{ backgroundColor: (c.color ?? "#C73E1D") + "20", color: c.color ?? "#C73E1D", border: `1px solid ${(c.color ?? "#C73E1D")}40` }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#C73E1D" }}></span>
                <span>{c.name}</span>
                {editCat === c.id ? (
                  <>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <select value={c.accountingClass ?? "operating_expense"} onChange={e => updateCat.mutate({ id: c.id, accountingClass: e.target.value as any })} className="w-28 rounded border px-1 py-0.5 text-[10px]">
                      <option value="operating_expense">Operating</option>
                      <option value="admin_expense">Admin</option>
                      <option value="cogs">COGS</option>
                      <option value="marketing">Marketing</option>
                      <option value="other">Other</option>
                    </select>
                    <input type="color" value={c.color ?? "#C73E1D"} onChange={e => updateCat.mutate({ id: c.id, color: e.target.value })} className="h-5 w-5 rounded p-0" />
                    <button onClick={() => setEditCat(null)}><X className="h-3 w-3" /></button>
                  </>
                ) : (
                  <>
                    {canManage && <button onClick={() => setEditCat(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="h-2.5 w-2.5" /></button>}
                    {canManage && <button onClick={() => { if (confirm("Delete?")) deleteCat.mutate({ id: c.id }); }} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-2.5 w-2.5" /></button>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        </>
        )}

        {tab === "expenses" && (
        <>
        {/* Expenses Table */}
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-lg">Expense Records</CardTitle>
              <span className="text-xs text-[#8D8A87]">{expenses?.length ?? 0} records</span>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E0D8]">
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Date</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Ref</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Description</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Category</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Branch</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Method</th>
                    <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Amount</th>
                    <th className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-[#8D8A87]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D8]">
                  {expenses?.map(exp => {
                    const cat = categories?.find(c => c.id === exp.categoryId);
                    const sup = suppliers?.find(s => s.id === exp.supplierId);
                    const loc = locations?.find(l => l.id === exp.locationId);
                    const linkedBill = bills?.find(b => b.id === exp.billId);
                    return (
                      <tr key={exp.id} className="hover:bg-[#F5EDE6]/50">
                        <td className="py-3 text-xs text-[#8D8A87]">{formatDate(exp.expenseDate)}</td>
                        <td className="py-3 text-xs font-mono text-[#8D8A87]">{exp.expenseNumber ?? "-"}</td>
                        <td className="py-3 text-sm font-medium text-[#2D2A26]">
                          <div className="flex items-center gap-1 flex-wrap">
                            {exp.description}
                            {linkedBill && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#ED6C02]/10 px-1.5 py-0 text-[10px] text-[#ED6C02]">
                                <FileText className="h-2.5 w-2.5" />{linkedBill.billNumber ?? `BILL-${String(linkedBill.id).padStart(4,"0")}`}
                              </span>
                            )}
                            {exp.mpesaTxnId && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#2E7D32]/10 px-1.5 py-0 text-[10px] text-[#2E7D32]">
                                M-PESA: {exp.mpesaTxnId}
                              </span>
                            )}
                          </div>
                          {sup && <span className="text-xs text-[#8D8A87]">{sup.name}</span>}
                        </td>
                        <td className="py-3">
                          {cat && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: (cat.color ?? "#C73E1D") + "20", color: cat.color ?? "#C73E1D" }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color ?? "#C73E1D" }}></span>
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-[#8D8A87]">{loc?.name ?? "-"}</td>
                        <td className="py-3 text-xs capitalize text-[#8D8A87]">{exp.paymentMethod.replace(/_/g, " ")}</td>
                        <td className="py-3 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(exp.amount)}</td>
                        <td className="py-3 text-center">
                          {canManage && !exp.reversedAt && <Button size="sm" variant="ghost" onClick={() => { const reason = prompt("Reason for reversal", "Correction"); if (reason) reverseExpense.mutate({ id: exp.id, reason }); }}><RotateCcw className="h-4 w-4 text-[#ED6C02]" /></Button>}
                          {canManage && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteExpense.mutate({ id: exp.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>}
                        </td>
                      </tr>
                    );
                  })}
                  {(!expenses || expenses.length === 0) && (
                    <tr><td colSpan={8} className="py-8 text-center text-sm text-[#8D8A87]">
                      <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />No expenses found.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </Layout>
  );
}
