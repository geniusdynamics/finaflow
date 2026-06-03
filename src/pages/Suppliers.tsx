import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { skipToken } from "@tanstack/react-query";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Phone, Mail, CreditCard, TrendingDown, AlertTriangle, FileText, TrendingUp, Search, Trash2, Target, Package, CheckCircle, OctagonX } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { ExpenseCategorySelector } from "@/components/ExpenseCategorySelector";
import { toast } from "sonner";

const PAYMENT_METHOD_ACCOUNT_TYPES: Record<string, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFundingAccounts(paymentMethod: string, allAccounts: any[], supplierBillLocationId?: number): any[] {
  const allowedTypes = PAYMENT_METHOD_ACCOUNT_TYPES[paymentMethod] ?? [];
  return allAccounts.filter(a => allowedTypes.includes(a.type) && !a.deletedAt && (!supplierBillLocationId || a.locationId === supplierBillLocationId));
}

function PaySupplierDialog({ open, supplier, bills, accounts, payForm, setPayForm, paymentError, isPending, todayDate, onClose, onSubmit }: {
  open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supplier: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bills: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accounts: any[];
  payForm: { paymentMethod: "cash" | "wallet" | "bank_transfer" | "card"; amount: string; paymentDate: string; reference: string; accountId: string };
  setPayForm: React.Dispatch<React.SetStateAction<{ paymentMethod: "cash" | "wallet" | "bank_transfer" | "card"; amount: string; paymentDate: string; reference: string; accountId: string }>>;
  paymentError: string | null;
  isPending: boolean;
  todayDate: string;
  onClose: () => void;
  onSubmit: (billId: number) => void;
}) {
  const [selectedPayBillId, setSelectedPayBillId] = useState("");
  const pendingBills = bills?.filter(b => b.supplierId === supplier?.id && b.status !== "paid") ?? [];

  useEffect(() => { if (!open) setSelectedPayBillId(() => ""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle className="font-serif text-xl">Record Payment</DialogTitle></DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedPayBillId) { toast.error("Please select a bill"); return; }
          onSubmit(+selectedPayBillId);
        }} className="space-y-3">
          <div className="rounded bg-[#F5EDE6] p-3">
            <p className="text-sm font-medium">{supplier?.name}</p>
            <p className="text-xs text-[#8D8A87]">Total Balance: {formatKES(supplier?.currentBalance ?? "0")}</p>
          </div>
          <div><Label>Bill</Label>
            <select value={selectedPayBillId} onChange={e => setSelectedPayBillId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" required>
              <option value="">Select a bill...</option>
              {pendingBills.map(b => (
                <option key={b.id} value={b.id}>{b.billNumber ?? 'BILL-'+String(b.id).padStart(4,'0')} - {formatKES(b.balanceDue)} - {b.description}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount: e.target.value}))} required /></div>
            <div><Label>Method</Label>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}              <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({...p, paymentMethod: e.target.value as any}))} className="w-full rounded border px-3 py-2 text-sm">
                <option value="cash">Cash</option><option value="wallet">Wallet</option><option value="bank_transfer">Bank</option><option value="card">Card</option>
              </select>
            </div>
          </div>
          <div><Label>Payment Date</Label><Input type="date" value={payForm.paymentDate} max={todayDate} onChange={e => setPayForm(p => ({ ...p, paymentDate: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Funding Source</Label>
              <select value={payForm.accountId} onChange={e => setPayForm(p => ({...p, accountId: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm">
                <option value="">Auto-detect</option>
                {getFundingAccounts(payForm.paymentMethod, accounts, pendingBills[0]?.locationId).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div><Label>Reference</Label><Input value={payForm.reference} onChange={e => setPayForm(p => ({...p, reference: e.target.value}))} placeholder="Reference code"/></div>
          </div>
          {paymentError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-3 text-sm text-[#D32F2F]">
              <OctagonX className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Payment failed</p>
                <p className="mt-0.5 text-xs opacity-80">{paymentError}</p>
              </div>
            </div>
          )}
          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={isPending}>{isPending ? "Processing..." : "Record Payment"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Suppliers() {
  const [tab, setTab] = useState<"suppliers" | "prices">("suppliers");
  const [open, setOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: suppliers, refetch } = trpc.suppliers.list.useQuery();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: categories } = trpc.expenses.categories.useQuery();
  const { data: bills } = trpc.bills.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();
  const { data: supplierStatement } = trpc.suppliers.statement.useQuery(
    { id: selectedSupplier ?? 0 },
    { enabled: selectedSupplier !== null }
  );
  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      await utils.suppliers.list.invalidate();
      await refetch();
      toast.success("Supplier added");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateBalance = trpc.suppliers.updateBalance.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); if (selectedSupplier) utils.suppliers.statement.invalidate({ id: selectedSupplier }); },
  });
  const createBill = trpc.bills.create.useMutation({
    onSuccess: () => { setBillOpen(false); utils.bills.list.invalidate(); utils.suppliers.list.invalidate(); if (selectedSupplier) utils.suppliers.statement.invalidate({ id: selectedSupplier }); toast.success("Bill added"); },
    onError: (err) => toast.error(err.message),
  });
  const recordPayment = trpc.bills.recordPayment.useMutation({
    onSuccess: () => {
      setPayOpen(null);
      setPaymentError(null);
      utils.bills.list.invalidate();
      utils.suppliers.list.invalidate();
      if (selectedSupplier) utils.suppliers.statement.invalidate({ id: selectedSupplier });
      toast.success("Payment recorded successfully");
    },
    onError: (e) => {
      setPaymentError(e.message);
      toast.error(e.message, { duration: 6000 });
    },
  });

  // Price Intelligence state and queries
  const [searchItem, setSearchItem] = useState("");
  const [selectedSupplierForPrices, setSelectedSupplierForPrices] = useState<string>("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ itemName: "", expectedPrice: "", variancePercent: "10", supplierId: "" });

  const { data: items } = trpc.supplierPrices.allItems.useQuery(selectedSupplierForPrices ? { supplierId: +selectedSupplierForPrices } : undefined);
  const { data: history } = trpc.supplierPrices.history.useQuery(
    searchItem ? { itemName: searchItem, limit: 50 } : skipToken
  );
  const { data: alerts } = trpc.supplierPrices.checkAlerts.useQuery();
  const { data: rules } = trpc.supplierPrices.listRules.useQuery();

  const createRule = trpc.supplierPrices.createRule.useMutation({
    onSuccess: () => { toast.success("Alert rule created"); setRuleOpen(false); setRuleForm({ itemName: "", expectedPrice: "", variancePercent: "10", supplierId: "" }); utils.supplierPrices.listRules.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteRule = trpc.supplierPrices.deleteRule.useMutation({
    onSuccess: () => { toast.success("Rule deleted"); utils.supplierPrices.listRules.invalidate(); },
  });

  const [form, setForm] = useState({
    name: "", phone: "", email: "", contactPerson: "", kraPin: "",
    paymentTermsDays: "30", creditLimit: "", currentBalance: "", notes: "",
  });
  const [balanceAdj, setBalanceAdj] = useState({ adjustment: "", reason: "" });
  const [billForm, setBillForm] = useState({
    supplierId: 0, locationId: "", categoryId: "", billNumber: "", description: "", amount: "", issueDate: getLocalDateString(), dueDate: "",
  });

  const [payForm, setPayForm] = useState<{ paymentMethod: "cash" | "wallet" | "bank_transfer" | "card"; amount: string; paymentDate: string; reference: string; accountId: string }>({ paymentMethod: "wallet", amount: "", paymentDate: getLocalDateString(), reference: "", accountId: "" });
  const todayDate = getLocalDateString();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSupplier.mutate({
      name: form.name, phone: form.phone || undefined, email: form.email || undefined,
      contactPerson: form.contactPerson || undefined, kraPin: form.kraPin || undefined,
      paymentTermsDays: parseInt(form.paymentTermsDays) || 30,
      creditLimit: form.creditLimit || undefined,
      currentBalance: form.currentBalance || undefined,
      notes: form.notes || undefined,
    });
  };

  const totalOwed = suppliers?.reduce((sum, s) => sum + parseFloat(s.currentBalance), 0) ?? 0;
  const overdueSuppliers = suppliers?.filter((s) => parseFloat(s.currentBalance) > 0) ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Suppliers</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage vendors, track balances, and monitor price trends</p>
          </div>
          {tab === "suppliers" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
                <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Add Supplier</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>KRA PIN</Label><Input value={form.kraPin} onChange={(e) => setForm((p) => ({ ...p, kraPin: e.target.value }))} /></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Payment Terms (days)</Label><Input type="number" value={form.paymentTermsDays} onChange={(e) => setForm((p) => ({ ...p, paymentTermsDays: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Credit Limit</Label><Input type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Opening Balance (what they already owe you)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                      <Input type="number" step="0.01" value={form.currentBalance} onChange={(e) => setForm((p) => ({ ...p, currentBalance: e.target.value }))} className="pl-10" placeholder="Amount currently owed" />
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                  <Button type="submit" className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90" disabled={createSupplier.isPending}>
                    {createSupplier.isPending ? "Saving..." : "Add Supplier"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {tab === "prices" && (
            <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
              <DialogTrigger asChild><Button className="bg-[#C73E1D]"><Plus className="mr-1 h-4 w-4" />Add Alert Rule</Button></DialogTrigger>
              <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl flex items-center gap-2"><Target className="h-5 w-5 text-[#ED6C02]"/>Price Alert Rule</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createRule.mutate({ itemName: ruleForm.itemName, expectedPrice: ruleForm.expectedPrice, variancePercent: ruleForm.variancePercent, supplierId: ruleForm.supplierId ? +ruleForm.supplierId : undefined }); }} className="space-y-3">
                  <div><Label>Supplier</Label><select value={ruleForm.supplierId} onChange={e => setRuleForm(p => ({ ...p, supplierId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm"><option value="">Any</option>{suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><Label>Item Name</Label><Input value={ruleForm.itemName} onChange={e => setRuleForm(p => ({ ...p, itemName: e.target.value }))} placeholder="e.g. Chicken Breast" required /></div>
                  <div className="grid grid-cols-2 gap-3"><div><Label>Expected Price</Label><Input type="number" step="0.01" value={ruleForm.expectedPrice} onChange={e => setRuleForm(p => ({ ...p, expectedPrice: e.target.value }))} required /></div><div><Label>Variance %</Label><Input type="number" value={ruleForm.variancePercent} onChange={e => setRuleForm(p => ({ ...p, variancePercent: e.target.value }))} /></div></div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createRule.isPending}>Save Rule</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("suppliers")} className={`px-4 py-2 text-sm font-medium ${tab === "suppliers" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Users className="mr-1 inline h-4 w-4"/>Suppliers
          </button>
          <button onClick={() => setTab("prices")} className={`px-4 py-2 text-sm font-medium ${tab === "prices" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <TrendingUp className="mr-1 inline h-4 w-4"/>Price Intelligence
          </button>
        </div>

        {tab === "suppliers" && (
          <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#8D8A87]" />
                <span className="text-xs uppercase tracking-wider text-[#8D8A87]">Suppliers</span>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#2D2A26]">{suppliers?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-[#D32F2F]" />
                <span className="text-xs uppercase tracking-wider text-[#8D8A87]">Total Owed</span>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#D32F2F]">{formatKES(totalOwed)}</p>
            </CardContent>
          </Card>
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#ED6C02]" />
                <span className="text-xs uppercase tracking-wider text-[#8D8A87]">With Balance</span>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#ED6C02]">{overdueSuppliers.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers?.map((supplier) => {
            const balance = parseFloat(supplier.currentBalance);
            return (
              <Card key={supplier.id} className={`border-[#E8E0D8] bg-white cursor-pointer transition-all hover:shadow-md ${selectedSupplier === supplier.id ? 'ring-2 ring-[#C73E1D]' : ''}`}>
                <CardContent className="p-5" onClick={() => setSelectedSupplier(supplier.id)}>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-[#2D2A26]">{supplier.name}</h3>
                      {supplier.contactPerson && <p className="text-xs text-[#8D8A87]">Contact: {supplier.contactPerson}</p>}
                    </div>
                    <div className={`rounded-full px-2 py-1 text-xs font-medium ${balance > 0 ? 'bg-[#D32F2F]/10 text-[#D32F2F]' : 'bg-[#2E7D32]/10 text-[#2E7D32]'}`}>
                      {balance > 0 ? 'Owed' : 'Clear'}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[#8D8A87]">
                    {supplier.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
                    {supplier.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {supplier.email}</p>}
                    {supplier.kraPin && <p className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> KRA: {supplier.kraPin}</p>}
                  </div>
                  <div className="mt-3 border-t border-[#E8E0D8] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8D8A87]">Balance</span>
                      <span className={`font-mono text-sm font-semibold ${balance > 0 ? 'text-[#D32F2F]' : 'text-[#2E7D32]'}`}>{formatKES(supplier.currentBalance)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[#8D8A87]">Terms: {supplier.paymentTermsDays} days</span>
                      {supplier.creditLimit && <span className="font-mono text-xs text-[#ED6C02]">Limit: {formatKES(supplier.creditLimit)}</span>}
                    </div>
                  </div>
                  {/* Add Bill and Pay buttons when selected */}
                  {selectedSupplier === supplier.id && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={(e) => {
                        e.stopPropagation();
                        setBillForm({ supplierId: supplier.id, locationId: "", categoryId: "", billNumber: "", description: "", amount: "", issueDate: getLocalDateString(), dueDate: "" });
                        setBillOpen(true);
                      }}>
                        <FileText className="mr-1 h-3 w-3" /> Add Bill
                      </Button>
                      {balance > 0 && (
                        <Button size="sm" variant="outline" className="flex-1 border-[#C73E1D] text-[#C73E1D] text-xs" onClick={(e) => {
                          e.stopPropagation();
                          setPayOpen(supplier.id);
                          setPayForm({ paymentMethod: "wallet", amount: "", paymentDate: getLocalDateString(), reference: "", accountId: "" });
                          setPaymentError(null);
                        }}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Pay
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(!suppliers || suppliers.length === 0) && (
            <div className="col-span-full py-12 text-center text-sm text-[#8D8A87]">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-30" /> No suppliers added yet.
            </div>
          )}
        </div>

        {/* Add Bill Dialog - unified with main bills page */}
        <Dialog open={billOpen} onOpenChange={setBillOpen}>
          <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif text-xl">Add Bill for {suppliers?.find(s => s.id === billForm.supplierId)?.name}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              createBill.mutate({
                supplierId: billForm.supplierId,
                locationId: +billForm.locationId,
                categoryId: billForm.categoryId ? +billForm.categoryId : undefined,
                billNumber: billForm.billNumber || undefined,
                description: billForm.description,
                amount: billForm.amount,
                issueDate: billForm.issueDate,
                dueDate: billForm.dueDate,
              });
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3"><div>
                <LocationSelector
                  locations={locations}
                  userLocationId={user?.locationId}
                  value={billForm.locationId}
                  onChange={v => setBillForm(p => ({...p, locationId: v}))}
                  enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                  required
                />
              </div><div><Label>Supplier</Label>
                <select value={billForm.supplierId} className="w-full rounded border bg-gray-100 px-3 py-2 text-sm" disabled>
                  <option value={billForm.supplierId}>{suppliers?.find(s => s.id === billForm.supplierId)?.name}</option>
                </select>
              </div></div>
              <div><ExpenseCategorySelector categories={categories} value={billForm.categoryId} onChange={v => setBillForm(p => ({...p, categoryId: v}))} label="Category" placeholder="Use supplier/default logic" /></div>
              <div><Label>Description</Label><Input value={billForm.description} onChange={e => setBillForm(p => ({ ...p, description: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bill Number <span className="text-[#8D8A87] font-normal">(optional)</span></Label><Input value={billForm.billNumber} onChange={e => setBillForm(p => ({ ...p, billNumber: e.target.value }))} placeholder="Auto: BILL-0001" /></div>
                <div><Label>Amount</Label><Input type="number" step="0.01" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Issue Date</Label><Input type="date" value={billForm.issueDate} onChange={e => setBillForm(p => ({ ...p, issueDate: e.target.value }))} required /></div><div><Label>Due Date</Label><Input type="date" value={billForm.dueDate} onChange={e => setBillForm(p => ({ ...p, dueDate: e.target.value }))} required /></div></div>
              <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createBill.isPending}>{createBill.isPending ? "Saving..." : "Add Bill"}</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pay Supplier Dialog */}
        <PaySupplierDialog
          open={payOpen !== null}
          supplier={payOpen ? suppliers?.find(s => s.id === payOpen) ?? null : null}
          bills={bills ?? []}
          accounts={accounts ?? []}
          payForm={payForm}
          setPayForm={setPayForm}
          paymentError={paymentError}
          isPending={recordPayment.isPending}
          todayDate={todayDate}
          onClose={() => { setPayOpen(null); setPaymentError(null); }}
          onSubmit={(billId) => {
            if (payForm.paymentDate > todayDate) {
              toast.error("Payment date cannot be in the future");
              return;
            }
            recordPayment.mutate({ billId, paymentMethod: payForm.paymentMethod, amount: payForm.amount, paymentDate: payForm.paymentDate, reference: payForm.reference, accountId: payForm.accountId ? +payForm.accountId : undefined });
          }}
        />

        {selectedSupplier && supplierStatement && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#2D2A26]">
                Statement: {suppliers?.find((s) => s.id === selectedSupplier)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg bg-[#F5EDE6] p-4">
                <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Adjust Balance</h4>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                    <Input type="number" step="0.01" value={balanceAdj.adjustment} onChange={(e) => setBalanceAdj((p) => ({ ...p, adjustment: e.target.value }))} className="pl-10" placeholder="Positive = add, Negative = reduce" />
                  </div>
                  <Input className="flex-1" value={balanceAdj.reason} onChange={(e) => setBalanceAdj((p) => ({ ...p, reason: e.target.value }))} placeholder="Reason for adjustment" />
                  <Button onClick={() => updateBalance.mutate({ id: selectedSupplier, adjustment: balanceAdj.adjustment, reason: balanceAdj.reason })} disabled={!balanceAdj.adjustment || updateBalance.isPending}>Adjust</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-[#E8E0D8]">
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Type</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Ref</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Description</th>
                    <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Date</th>
                    <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Amount</th>
                    <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Balance</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#E8E0D8]">
                    {supplierStatement.bills?.map((bill) => (
                      <tr key={`bill-${bill.id}`} className="hover:bg-[#F5EDE6]/50">
                        <td className="py-2 text-xs"><span className="rounded-full bg-[#ED6C02]/10 px-2 py-0.5 text-[#ED6C02]">Bill</span></td>
                        <td className="py-2 text-xs font-mono text-[#8D8A87]">{bill.billNumber ?? `BILL-${String(bill.id).padStart(4,"0")}`}</td>
                        <td className="py-2 text-sm text-[#2D2A26]">{bill.description}</td>
                        <td className="py-2 text-xs text-[#8D8A87]">{formatDate(bill.issueDate)}</td>
                        <td className="py-2 text-right font-mono text-sm text-[#D32F2F]">{formatKES(bill.amount)}</td>
                        <td className="py-2 text-right font-mono text-sm text-[#D32F2F]">{formatKES(bill.balanceDue)}</td>
                      </tr>
                    ))}
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                    {supplierStatement.payments?.map((pay: any) => (
                      <tr key={`pay-${pay.id}`} className="hover:bg-[#F5EDE6]/50">
                        <td className="py-2 text-xs"><span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-[#2E7D32]">Payment</span></td>
                        <td className="py-2 text-xs font-mono text-[#8D8A87]">{pay.billNumber ?? "-"}</td>
                        <td className="py-2 text-sm text-[#2D2A26]">Payment {pay.reference ? `(${pay.reference})` : ""}</td>
                        <td className="py-2 text-xs text-[#8D8A87]">{formatDate(pay.paymentDate)}</td>
                        <td className="py-2 text-right font-mono text-sm text-[#2E7D32]">{formatKES(pay.amount)}</td>
                        <td className="py-2 text-right font-mono text-sm text-[#2E7D32]">-</td>
                      </tr>
                    ))}
                    {(!supplierStatement.bills?.length && !supplierStatement.payments?.length) && (
                      <tr><td colSpan={6} className="py-6 text-center text-sm text-[#8D8A87]">No transactions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
        </>
        )}

        {tab === "prices" && (
          <>
            {alerts && alerts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-[#D32F2F] flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Price Alerts ({alerts.length})</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {alerts.map((alert, i) => (
                    <Card key={i} className="border-[#D32F2F]/20 bg-[#D32F2F]/5"><CardContent className="p-3">
                      <p className="text-sm font-medium text-[#2D2A26]">{alert.itemName}</p>
                      <p className="text-xs text-[#8D8A87]">{alert.message}</p>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            )}

            <Card className="border-[#E8E0D8]"><CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-60"><Label className="text-xs text-[#8D8A87]">Search Item</Label>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8D8A87]"/><Input value={searchItem} onChange={e => setSearchItem(e.target.value)} placeholder="Search for an item..." className="pl-10" /></div>
                </div>
                <div><Label className="text-xs text-[#8D8A87]">Supplier</Label>
                  <select value={selectedSupplierForPrices} onChange={e => setSelectedSupplierForPrices(e.target.value)} className="w-48 rounded border px-3 py-2 text-sm">
                    <option value="">All Suppliers</option>{suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </CardContent></Card>

            <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Package className="h-5 w-5 text-[#C73E1D]"/>Tracked Items</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b">
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Item</th>
                      <th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Supplier</th>
                      <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Latest</th>
                      <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Previous</th>
                      <th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Avg</th>
                      <th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Change</th>
                      <th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Purchases</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {items?.map((item, i) => (
                        <tr key={i} className="hover:bg-[#F5EDE6]/50">
                          <td className="py-3 text-sm font-medium text-[#2D2A26]">{item.itemName}</td>
                          <td className="py-3 text-xs text-[#8D8A87]">{item.supplierName}</td>
                          <td className="py-3 text-right font-mono text-sm">{formatKES(item.latestPrice)}</td>
                          <td className="py-3 text-right font-mono text-xs text-[#8D8A87]">{formatKES(item.previousPrice)}</td>
                          <td className="py-3 text-right font-mono text-xs text-[#8D8A87]">{formatKES(item.averagePrice)}</td>
                          <td className="py-3 text-center">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${item.isIncrease ? "bg-[#D32F2F]/10 text-[#D32F2F]" : "bg-[#2E7D32]/10 text-[#2E7D32]"}`}>
                              {item.isIncrease ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
                              {item.isIncrease ? "+" : ""}{item.changePercent}%
                            </span>
                          </td>
                          <td className="py-3 text-center text-xs text-[#8D8A87]">{item.purchases}</td>
                        </tr>
                      ))}
                      {(!items || items.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]">No price data yet. Create bills with items to start tracking.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {rules && rules.length > 0 && (
              <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Target className="h-5 w-5 text-[#ED6C02]"/>Alert Rules</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rules.map(rule => (
                      <div key={rule.id} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-3">
                        <div>
                          <p className="text-sm font-medium">{rule.itemName}</p>
                          <p className="text-xs text-[#8D8A87]">Expected: {formatKES(rule.expectedPrice ?? "0")} | Variance: {rule.variancePercent}%</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this rule?")) deleteRule.mutate({ id: rule.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {searchItem && history && history.length > 0 && (
              <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Price History for "{searchItem}"</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Date</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Item</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Price</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Qty</th></tr></thead>
                      <tbody className="divide-y">{history.map(h => (
                        <tr key={h.id} className="hover:bg-[#F5EDE6]/50"><td className="py-2 text-xs text-[#8D8A87]">{h.priceDate}</td><td className="py-2 text-sm">{h.itemName}</td><td className="py-2 text-right font-mono text-sm">{formatKES(h.unitPrice)}</td><td className="py-2 text-right text-xs text-[#8D8A87]">{h.quantity}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
