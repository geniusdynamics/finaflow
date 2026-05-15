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
import { Plus, Trash2, Receipt, Tag, Pencil, X, AlertCircle, Camera, FileText, Download, Printer, Wallet, TrendingUp, Filter } from "lucide-react";
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

export function Expenses() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.EXPENSES_MANAGE);

  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<number | null>(null);

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
    onSuccess: () => { toast.success("Category added"); setCatOpen(false); setCatForm({ name: "", description: "", color: "#C73E1D", accountingClass: "operating_expense", defaultAccountId: "" }); refetchCats(); },
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

  const [form, setForm] = useState({
    locationId: "", categoryId: "", supplierId: "", amount: "", description: "",
    expenseDate: getLocalDateString(), paymentMethod: "cash" as const,
    accountId: "", billId: "",
  });
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#C73E1D", accountingClass: "operating_expense", defaultAccountId: "" });
  const [attachments, setAttachments] = useState<{ imageData: string; mimeType: string; caption: string }[]>([]);
  const todayDate = getLocalDateString();

  const photosEnabled = settings?.photosExpenses !== "false";
  const selectedSupplier = suppliers?.find(s => s.id.toString() === form.supplierId);
  const selectedBill = bills?.find(b => b.id.toString() === form.billId);

  // When a bill is selected, auto-fill the supplier from that bill
  useEffect(() => {
    if (form.billId && selectedBill && selectedBill.supplierId) {
      setForm(p => ({ ...p, supplierId: String(selectedBill.supplierId) }));
    }
  }, [form.billId]);

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
    setForm({ locationId: "", categoryId: "", supplierId: "", amount: "", description: "", expenseDate: getLocalDateString(), paymentMethod: "cash", accountId: "", billId: "" });
    setAttachments([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.locationId) { toast.error("Please select a location"); return; }
    if (!form.categoryId) { toast.error("Please select a category"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Please enter a valid amount"); return; }
    if (!form.description.trim()) { toast.error("Please enter a description"); return; }
    if (form.expenseDate > todayDate) { toast.error("Expense date cannot be in the future"); return; }
    createExpense.mutate({
      locationId: +form.locationId, categoryId: +form.categoryId, supplierId: form.supplierId ? +form.supplierId : undefined,
      amount: form.amount, description: form.description, expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod, accountId: form.accountId ? +form.accountId : undefined,
      billId: form.billId ? +form.billId : undefined, attachments: photosEnabled ? attachments : undefined,
    });
  };

  const handleCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error("Category name is required"); return; }
    if (!catForm.defaultAccountId) { toast.error("Please select a default expense account"); return; }
    createCat.mutate({
      name: catForm.name, description: catForm.description, color: catForm.color,
      accountingClass: catForm.accountingClass as any,
      defaultAccountId: +catForm.defaultAccountId,
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
                  <div><Label>Location</Label>
                    <select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                      <option value="">Select</option>{locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div><Label>Category {form.billId && <span className="text-xs text-[#2E7D32] font-normal">(from bill)</span>}</Label>
                    <select value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required={!form.billId} disabled={!!form.billId}>
                      <option value="">{catsLoading ? "Loading..." : categories?.length ? "Select" : "No categories"}</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {form.billId && <p className="mt-1 text-xs text-[#2E7D32]">Category is determined by the linked bill.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount</Label>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                      <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="pl-10" required />
                    </div>
                  </div>
                  <div><Label>Payment Method</Label>
                    <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                      <option value="cash">Cash</option><option value="mpesa">M-PESA</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option>
                    </select>
                  </div>
                </div>
                <div><Label>Funding Source</Label>
                  <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                    <option value="">Auto-detect</option>
                    {accounts?.filter(a => a.isPaymentMethod)?.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name}{loc ? ` (${loc})` : ""}</option>; })}
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
        <div className="grid gap-4 sm:grid-cols-2">
          {locations?.map(loc => {
            const locBalance = accountBalances?.byLocation[loc.id] ?? 0;
            const locIncome = prevDayIncome?.byBranch.find(b => b.locationId === loc.id)?.total ?? "0";
            return (
              <Card key={loc.id} className="border-[#E8E0D8] bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#2D2A26]">{loc.name}</p>
                    <div className="mt-1 flex gap-4">
                        <span className="text-xs text-[#8D8A87]">Balance: <span className="font-mono font-semibold text-[#2E7D32]">{formatLocationBalance(locBalance)}</span></span>
                      <span className="text-xs text-[#8D8A87]">Income: <span className="font-mono font-semibold text-[#D4A854]">{formatKES(locIncome)}</span></span>
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
                      <Label>Default Expense Account</Label>
                      <select value={catForm.defaultAccountId} onChange={e => setCatForm(p => ({ ...p, defaultAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                        <option value="">Select expense account...</option>
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
      </div>
    </Layout>
  );
}
