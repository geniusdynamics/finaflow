import { useState, useEffect, useRef } from "react";
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
import { Plus, CreditCard, AlertTriangle, CheckCircle, Clock, Trash2, Package, Search, Camera, Calendar, Repeat, FileText, RotateCcw, OctagonX } from "lucide-react";
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

/** Maps payment method to allowed account type values in the DB */
const PAYMENT_METHOD_ACCOUNT_TYPES: Record<string, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

interface FundingAccount {
  id: number;
  type: string;
  deletedAt?: string | null;
  locationId?: number | null;
  name?: string;
}

function getFundingAccounts(paymentMethod: string, allAccounts: FundingAccount[] | undefined, locationId?: number): FundingAccount[] {
  const allowedTypes = PAYMENT_METHOD_ACCOUNT_TYPES[paymentMethod] ?? [];
  return (allAccounts ?? []).filter(a => allowedTypes.includes(a.type) && !a.deletedAt && (!locationId || a.locationId === locationId));
}

export function Bills() {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const canCreate = hasPermission(role, PERMISSIONS.BILLS_CREATE);
  const canPay = hasPermission(role, PERMISSIONS.BILLS_PAY);

  const [open, setOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState<number | null>(null);
  const [itemsOpen, setItemsOpen] = useState<number | null>(null);

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: categories } = trpc.expenses.categories.useQuery();
  const { data: bills } = trpc.bills.list.useQuery({});
  const { data: recurring } = trpc.bills.listRecurring.useQuery({});
  const { data: billsSummary } = trpc.dashboard.billsSummary.useQuery();
  const { data: billItemsData } = trpc.bills.getItems.useQuery(
    { billId: itemsOpen ?? 0 }, { enabled: itemsOpen !== null }
  );

  const utils = trpc.useUtils();

  const selectedBillForItems = itemsOpen ? bills?.find(b => b.id === itemsOpen) : null;
  const itemsTotal = billItemsData?.reduce((sum, item) => sum + parseFloat(String(item.totalPrice)), 0) ?? 0;
  const billAmount = selectedBillForItems ? parseFloat(selectedBillForItems.amount) : 0;
  const remainingAmount = billAmount - itemsTotal;
  const isOverBudget = remainingAmount < 0;

  const createBill = trpc.bills.create.useMutation({ onSuccess: () => { setOpen(false); utils.bills.list.invalidate(); } });
  const createRecurring = trpc.bills.createRecurring.useMutation({ onSuccess: () => { setRecurringOpen(false); utils.bills.listRecurring.invalidate(); } });
  const deleteRecurring = trpc.bills.deleteRecurring.useMutation({ onSuccess: () => { utils.bills.listRecurring.invalidate(); utils.bills.list.invalidate(); } });
  const recordPayment = trpc.bills.recordPayment.useMutation({ 
    onSuccess: () => { 
      setPaymentOpen(null); 
      setPaymentError(null);
      utils.bills.list.invalidate();
      utils.bills.getSupplierSummary.invalidate();
      toast.success("Payment recorded successfully");
    },
    onError: (e) => {
      const msg = e.message;
      setPaymentError(msg);
      toast.error(msg, { duration: 6000 });
    }
  });
  const addItem = trpc.bills.addItem.useMutation({ onSuccess: () => { utils.bills.getItems.invalidate(); utils.bills.list.invalidate(); } });
  const deleteItem = trpc.bills.deleteItem.useMutation({ onSuccess: () => { utils.bills.getItems.invalidate(); utils.bills.list.invalidate(); } });
  const deleteBill = trpc.bills.delete.useMutation({ onSuccess: () => utils.bills.list.invalidate() });
  const reverseBill = trpc.bills.reverse.useMutation({
    onSuccess: () => { utils.bills.list.invalidate(); toast.success("Bill reversed"); },
    onError: (e) => toast.error(`Reverse failed: ${e.message}`),
  });

  const [form, setForm] = useState({
    locationId: "",
    supplierId: "",
    categoryId: "",
    billNumber: "",
    description: "",
    amount: "",
    issueDate: "",
    dueDate: "",
  });
  const [recForm, setRecForm] = useState({
    locationId: "",
    supplierId: "",
    categoryId: "",
    description: "",
    amount: "",
    frequency: "monthly" as const,
    nextDueDate: "",
  });
  const [payForm, setPayForm] = useState({ paymentMethod: "wallet" as const, amount: "", paymentDate: getLocalDateString(), reference: "", accountId: "" });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const todayDate = getLocalDateString();

  // Auto-detect funding source when payment dialog opens or payment method changes
  useEffect(() => {
    const bill = bills?.find(b => b.id === paymentOpen);
    if (!bill) return;
    const matches = getFundingAccounts(payForm.paymentMethod, accounts, bill.locationId);
    if (matches.length === 1) {
      setPayForm(p => ({ ...p, accountId: String(matches[0].id) }));
    } else if (payForm.accountId) {
      const stillValid = matches.some(a => String(a.id) === payForm.accountId);
      if (!stillValid) {
        setPayForm(p => ({ ...p, accountId: "" }));
      }
    }
  }, [paymentOpen, payForm.paymentMethod, accounts, bills]);

  // Item form with autocomplete
  const [itemForm, setItemForm] = useState({ itemName: "", quantity: "1", unitPrice: "", totalPrice: "", categoryId: "", notes: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<{ imageData: string; mimeType: string; caption: string }[]>([]);

  const { data: settings } = trpc.settings.list.useQuery();
  const photosEnabled = settings?.photosBills !== "false";

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

  const { data: suggestions } = trpc.bills.searchMasterItems.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 && showSuggestions }
  );

  // Load master item details when user types exact name
  const { data: matchedMasterItem } = trpc.bills.getMasterItem.useQuery(
    { name: itemForm.itemName },
    { enabled: itemForm.itemName.length >= 2 }
  );

  // Auto-fill from master item when exact match found
  useEffect(() => {
    if (matchedMasterItem && itemForm.unitPrice === "") {
      setItemForm(p => ({
        ...p,
        unitPrice: matchedMasterItem.lastUnitPrice ?? "",
        categoryId: matchedMasterItem.lastCategoryId?.toString() ?? "",
      }));
    }
  }, [matchedMasterItem]);

  const handleItemNameChange = (value: string) => {
    setItemForm(p => ({ ...p, itemName: value }));
    setSearchQuery(value);
    setShowSuggestions(value.length >= 2);
    setSelectedSuggestion(0);
  };

  const selectSuggestion = (s: { name: string; lastUnitPrice: string | null; lastCategoryId: number | null }) => {
    setItemForm(p => ({
      ...p,
      itemName: s.name,
      unitPrice: s.lastUnitPrice ?? "",
      categoryId: s.lastCategoryId?.toString() ?? "",
    }));
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemsOpen) return;
    const qty = parseFloat(itemForm.quantity) || 1;
    const price = parseFloat(itemForm.unitPrice) || 0;
    const itemTotal = qty * price;

    if (billAmount > 0 && itemsTotal + itemTotal > billAmount) {
      toast.error(`Item total (${formatKES(itemTotal)}) would exceed bill amount (${formatKES(billAmount)}). Remaining: ${formatKES(remainingAmount)}`);
      return;
    }

    addItem.mutate({
      billId: itemsOpen,
      itemName: itemForm.itemName,
      quantity: qty.toString(),
      unitPrice: price.toFixed(2),
      totalPrice: itemTotal.toFixed(2),
      categoryId: itemForm.categoryId ? +itemForm.categoryId : undefined,
      notes: itemForm.notes,
    });
    setItemForm({ itemName: "", quantity: "1", unitPrice: "", totalPrice: "", categoryId: "", notes: "" });
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); createBill.mutate({ locationId: +form.locationId, supplierId: form.supplierId ? +form.supplierId : undefined, categoryId: form.categoryId ? +form.categoryId : undefined, billNumber: form.billNumber || undefined, description: form.description, amount: form.amount, issueDate: form.issueDate, dueDate: form.dueDate, attachments: photosEnabled ? attachments : undefined }); };
  const handleRecurring = (e: React.FormEvent) => { e.preventDefault(); createRecurring.mutate({ locationId: +recForm.locationId, supplierId: recForm.supplierId ? +recForm.supplierId : undefined, categoryId: recForm.categoryId ? +recForm.categoryId : undefined, description: recForm.description, amount: recForm.amount, frequency: recForm.frequency, nextDueDate: recForm.nextDueDate }); };
  const handlePayment = (billId: number) => (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    if (payForm.paymentDate > todayDate) {
      toast.error("Payment date cannot be in the future");
      return;
    }
    recordPayment.mutate({ billId, paymentMethod: payForm.paymentMethod, amount: payForm.amount, paymentDate: payForm.paymentDate, reference: payForm.reference, accountId: payForm.accountId ? +payForm.accountId : undefined });
  };

  const getStatusStyle = (s: string) => { switch(s){ case "paid": return "text-[#2E7D32] bg-[#2E7D32]/10"; case "overdue": return "text-[#D32F2F] bg-[#D32F2F]/10"; case "partial": return "text-[#ED6C02] bg-[#ED6C02]/10"; default: return "text-[#8D8A87] bg-[#8D8A87]/10"; } };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Bills & Payables</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage bills, partial payments, and line items</p>
          </div>
          {canCreate && (
            <div className="flex gap-2">
              <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-[#D4A854] text-[#D4A854]"><Plus className="mr-2 h-4 w-4" /> Recurring</Button></DialogTrigger>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-serif text-xl">Add Recurring Bill</DialogTitle></DialogHeader>
                  <form onSubmit={handleRecurring} className="space-y-3">
                    <div>
                      <LocationSelector
                         locations={locations}
                         userLocationId={user?.locationId}
                         value={recForm.locationId}
                         onChange={v => setRecForm(p => ({...p, locationId: v}))}
                         enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                         required
                       />
                    </div>
                    <div><Label>Description</Label><Input value={recForm.description} onChange={e => setRecForm(p => ({...p, description: e.target.value}))} placeholder="e.g. Rent, License" required /></div>
                    <div><ExpenseCategorySelector categories={categories} value={recForm.categoryId} onChange={v => setRecForm(p => ({...p, categoryId: v}))} label="Default Category" placeholder="Optional" /></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Amount</Label><Input type="number" step="0.01" value={recForm.amount} onChange={e => setRecForm(p => ({...p, amount: e.target.value}))} required /></div><div><Label>Frequency</Label><select value={recForm.frequency} onChange={e => setRecForm(p => ({...p, frequency: e.target.value as "daily" | "weekly" | "monthly" | "quarterly" | "annually"}))} className="w-full rounded border px-3 py-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select></div></div>
                    <div><Label>Next Due</Label><Input type="date" value={recForm.nextDueDate} onChange={e => setRecForm(p => ({...p, nextDueDate: e.target.value}))} required /></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createRecurring.isPending}>{createRecurring.isPending ? "Saving..." : "Add Recurring"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button className="bg-[#C73E1D]"><Plus className="mr-2 h-4 w-4" /> Add Bill</Button></DialogTrigger>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-serif text-xl">Add Bill</DialogTitle></DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3"><div>
                      <LocationSelector
                        locations={locations}
                        userLocationId={user?.locationId}
                        value={form.locationId}
                        onChange={v => setForm(p => ({...p, locationId: v}))}
                        enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                        required
                      />
                    </div><div><Label>Supplier</Label><select value={form.supplierId} onChange={e => setForm(p => ({...p, supplierId: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm"><option value="">Optional</option>{suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
                    <div><ExpenseCategorySelector categories={categories} value={form.categoryId} onChange={v => setForm(p => ({...p, categoryId: v}))} label="Category" placeholder="Use supplier/default logic" /></div>
                    <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Bill Number <span className="text-[#8D8A87] font-normal">(optional)</span></Label><Input value={form.billNumber} onChange={e => setForm(p => ({...p, billNumber: e.target.value}))} placeholder="Auto: BILL-0001" /></div>
                      <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Issue Date</Label><Input type="date" value={form.issueDate} onChange={e => setForm(p => ({...p, issueDate: e.target.value}))} required /></div><div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm(p => ({...p, dueDate: e.target.value}))} required /></div></div>
                    {photosEnabled && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Attach Photos</Label>
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((att, idx) => (
                            <div key={idx} className="relative h-16 w-16 rounded-lg border border-[#E8E0D8] overflow-hidden">
                              <img src={att.imageData} alt="" className="h-full w-full object-cover" />
                              <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 rounded-bl bg-[#D32F2F] p-0.5 text-white">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#8D8A87] text-[#8D8A87] hover:border-[#C73E1D] hover:text-[#C73E1D]">
                            <Plus className="h-5 w-5" />
                            <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handleFile} />
                          </label>
                        </div>
                        <p className="text-xs text-[#8D8A87]">Tap + to take a photo or select from gallery. Max 5MB each.</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createBill.isPending}>{createBill.isPending ? "Saving..." : "Add Bill"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Bills Dashboard */}
        {billsSummary && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-[#E8E0D8] bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#ED6C02]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Bills This Week</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#ED6C02]">{formatKES(billsSummary.bills.week.total)}</p>
                <p className="text-xs text-[#8D8A87] mt-1">{billsSummary.bills.week.count} bills outstanding</p>
              </CardContent>
            </Card>
            <Card className="border-[#E8E0D8] bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Bills This Month</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(billsSummary.bills.month.total)}</p>
                <p className="text-xs text-[#8D8A87] mt-1">{billsSummary.bills.month.count} bills outstanding</p>
              </CardContent>
            </Card>
            <Card className="border-[#E8E0D8] bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><Repeat className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Recurring Week</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(billsSummary.recurring.week.total)}</p>
                <p className="text-xs text-[#8D8A87] mt-1">{billsSummary.recurring.week.count} upcoming</p>
              </CardContent>
            </Card>
            <Card className="border-[#E8E0D8] bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#8D8A87]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Recurring Month</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#2D2A26]">{formatKES(billsSummary.recurring.month.total)}</p>
                <p className="text-xs text-[#8D8A87] mt-1">{billsSummary.recurring.month.count} upcoming</p>
              </CardContent>
            </Card>
          </div>
        )}

        {recurring && recurring.length > 0 && (
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Recurring Bills</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Description</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Freq</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Amount</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Next Due</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Action</th></tr></thead>
              <tbody className="divide-y">{recurring.map(r => <tr key={r.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-sm font-medium">{r.description}</td><td className="py-2 text-sm capitalize text-[#8D8A87]">{r.frequency}</td><td className="py-2 text-right font-mono text-sm">{formatKES(r.amount)}</td><td className="py-2 text-sm text-[#ED6C02]">{formatDate(r.nextDueDate)}</td><td className="py-2 text-right"><div className="flex items-center justify-end gap-1">{canCreate && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this recurring bill template?")) deleteRecurring.mutate({ id: r.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]"/></Button>}</div></td></tr>)}</tbody>
            </table></div></CardContent>
          </Card>
        )}

        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Outstanding Bills</CardTitle></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">#</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Description</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Supplier</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Due</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Total</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Paid</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Balance</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Actions</th></tr></thead>
            <tbody className="divide-y">{bills?.map(bill => (
              <tr key={bill.id} className="hover:bg-[#F5EDE6]/50">
                <td className="py-3 text-xs font-mono text-[#8D8A87]">{bill.billNumber ?? `BILL-${String(bill.id).padStart(4,"0")}`}</td>
                <td className="py-3 text-sm font-medium">{bill.description}</td>
                <td className="py-3 text-sm text-[#8D8A87]">{suppliers?.find(s => s.id === bill.supplierId)?.name ?? "-"}</td>
                <td className="py-3 text-sm">{formatDate(bill.dueDate)}</td>
                <td className="py-3 text-right font-mono text-sm">{formatKES(bill.amount)}</td>
                <td className="py-3 text-right font-mono text-sm text-[#2E7D32]">{formatKES(bill.amountPaid)}</td>
                <td className="py-3 text-right font-mono text-sm font-semibold text-[#D32F2F]">{formatKES(bill.balanceDue)}</td>
                <td className="py-3 text-center"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(bill.status)}`}>{bill.status === "paid" ? <CheckCircle className="h-3 w-3"/> : bill.status === "overdue" ? <AlertTriangle className="h-3 w-3"/> : <Clock className="h-3 w-3"/>}{bill.status}</span></td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canCreate && <Button size="sm" variant="ghost" onClick={() => setItemsOpen(itemsOpen === bill.id ? null : bill.id)}><Package className="h-4 w-4 text-[#D4A854]"/></Button>}
                    {canPay && bill.status !== "paid" && (
                      <Dialog open={paymentOpen === bill.id} onOpenChange={v => { setPaymentOpen(v ? bill.id : null); setPaymentError(null); }}>
                        <DialogTrigger asChild><Button size="sm" variant="outline" className="border-[#C73E1D] text-[#C73E1D]" onClick={() => { setPayForm({ paymentMethod: "wallet" as const, amount: "", paymentDate: getLocalDateString(), reference: "", accountId: "" }); setPaymentError(null); }}>Pay</Button></DialogTrigger>
                        <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Record Payment</DialogTitle></DialogHeader>
                          <form onSubmit={handlePayment(bill.id)} className="space-y-3">
                            <div className="rounded bg-[#F5EDE6] p-3"><p className="text-sm font-medium">{bill.description}</p><p className="text-xs text-[#8D8A87]">Supplier: {suppliers?.find(s => s.id === bill.supplierId)?.name ?? "-"} · Balance: {formatKES(bill.balanceDue)}</p></div>
                            <div className="grid grid-cols-2 gap-3"><div><Label>Amount</Label><Input type="number" step="0.01" max={parseFloat(bill.balanceDue)} value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} required /></div><div><Label>Method</Label><select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({...p, paymentMethod: e.target.value as "cash" | "wallet" | "bank_transfer" | "card"}))} className="w-full rounded border px-3 py-2 text-sm"><option value="cash">Cash</option><option value="wallet">Wallet</option><option value="bank_transfer">Bank</option><option value="card">Card</option></select></div></div>
                            <div><Label>Payment Date</Label><Input type="date" value={payForm.paymentDate} max={todayDate} onChange={e => setPayForm(p => ({ ...p, paymentDate: e.target.value }))} required /></div>
                            <div className="grid grid-cols-2 gap-3"><div><Label>Funding Source</Label><select value={payForm.accountId} onChange={e => setPayForm(p => ({...p, accountId: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm"><option value="">Auto-detect</option>{getFundingAccounts(payForm.paymentMethod, accounts, bill.locationId)?.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name}{loc ? ` (${loc})` : ""}</option>; })}</select></div><div><Label>Reference</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({...p, reference: e.target.value}))} placeholder="Reference code"/></div></div>
                            {paymentError && (
                              <div role="alert" className="flex items-start gap-2 rounded-md border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-3 text-sm text-[#D32F2F]">
                                <OctagonX className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                  <p className="font-medium">Payment failed</p>
                                  <p className="mt-0.5 text-xs opacity-80">{paymentError}</p>
                                </div>
                              </div>
                            )}
                            <Button type="submit" className="w-full bg-[#C73E1D]" disabled={recordPayment.isPending}>{recordPayment.isPending ? "Processing..." : "Record Payment"}</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                    {canCreate && !bill.reversedAt && <Button size="sm" variant="ghost" onClick={() => { const reason = prompt("Reason for reversal", "Correction"); if (reason) reverseBill.mutate({ id: bill.id, reason }); }}><RotateCcw className="h-4 w-4 text-[#ED6C02]"/></Button>}
                    {canCreate && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this bill?")) deleteBill.mutate({ id: bill.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]"/></Button>}
                  </div>
                </td>
              </tr>
            ))}{(!bills || bills.length === 0) && <tr><td colSpan={8} className="py-8 text-center text-sm text-[#8D8A87]"><CreditCard className="mx-auto mb-2 h-8 w-8 opacity-30"/>No bills yet.</td></tr>}</tbody>
          </table></div>
        </CardContent></Card>

        {itemsOpen && (
          <Card className="border-[#D4A854]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Bill Items: {bills?.find(b => b.id === itemsOpen)?.description}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto mb-4"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Item</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Qty</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Unit Price</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Total</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Category</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]"></th></tr></thead>
                <tbody className="divide-y">{billItemsData?.map(item => <tr key={item.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-sm">{item.itemName}</td><td className="py-2 text-right font-mono text-sm">{item.quantity}</td><td className="py-2 text-right font-mono text-sm">{formatKES(item.unitPrice)}</td><td className="py-2 text-right font-mono text-sm font-semibold">{formatKES(item.totalPrice)}</td><td className="py-2 text-right text-xs">{categories?.find(c => c.id === item.categoryId)?.name ?? "-"}</td><td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => deleteItem.mutate({ id: item.id })}><Trash2 className="h-3 w-3 text-[#D32F2F]"/></Button></td></tr>)}{(!billItemsData || billItemsData.length === 0) && <tr><td colSpan={6} className="py-4 text-center text-sm text-[#8D8A87]">No items yet.</td></tr>}</tbody>
              </table></div>
              {selectedBillForItems && (
                <div className={`mt-3 flex justify-end gap-6 rounded p-3 ${isOverBudget ? "bg-red-50 border border-red-200" : itemsTotal > 0 ? "bg-green-50 border border-green-200" : ""}`}>
                  <div className="text-right">
                    <p className="text-xs text-[#8D8A87]">Bill Amount</p>
                    <p className="font-mono font-semibold">{formatKES(billAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#8D8A87]">Items Total</p>
                    <p className="font-mono font-semibold">{formatKES(itemsTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#8D8A87]">Remaining</p>
                    <p className={`font-mono font-semibold flex items-center gap-1 ${isOverBudget ? "text-red-600" : itemsTotal >= billAmount ? "text-green-600" : ""}`}>
                      {isOverBudget && <AlertTriangle className="h-3 w-3" />}
                      {isOverBudget ? `OVER by ${formatKES(Math.abs(remainingAmount))}` : formatKES(remainingAmount)}
                    </p>
                  </div>
                </div>
              )}
              {canCreate && (
                <form onSubmit={handleAddItem} className="space-y-3">
                  <div className="relative">
                    <Label className="text-xs">Item Name</Label>
                    <div className="relative">
                      <Input value={itemForm.itemName} onChange={e => handleItemNameChange(e.target.value)} required placeholder="Start typing e.g. spinach, cooking oil..." />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8D8A87]" />
                    </div>
                    {/* Autocomplete dropdown */}
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div ref={suggestionRef} className="absolute z-10 mt-1 w-full rounded-md border border-[#E8E0D8] bg-white shadow-lg">
                        {suggestions.map((s, i) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-[#F5EDE6] ${i === selectedSuggestion ? "bg-[#F5EDE6]" : ""}`}
                          >
                            <span className="font-medium">{s.name}</span>
                            {s.lastUnitPrice && <span className="ml-2 text-xs text-[#8D8A87]">Last price: {formatKES(s.lastUnitPrice)}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 items-end">
                    <div><Label className="text-xs">Qty</Label><Input type="number" step="0.001" value={itemForm.quantity} onChange={e => setItemForm(p => ({...p, quantity: e.target.value}))} required /></div>
                    <div><Label className="text-xs">Unit Price</Label><Input type="number" step="0.01" value={itemForm.unitPrice} onChange={e => setItemForm(p => ({...p, unitPrice: e.target.value}))} required /></div>
                    <div><ExpenseCategorySelector categories={categories} value={itemForm.categoryId} onChange={v => setItemForm(p => ({...p, categoryId: v}))} label={<span className="text-xs">Category</span>} placeholder="Select" /></div>
                    <Button type="submit" className="bg-[#C73E1D]" disabled={addItem.isPending}><Plus className="h-4 w-4"/></Button>
                  </div>
                  {matchedMasterItem && (
                    <p className="text-xs text-[#2E7D32]">Using remembered price for &quot;{matchedMasterItem.name}&quot; · Used {matchedMasterItem.usageCount} times before</p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
