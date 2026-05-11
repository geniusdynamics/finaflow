import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Phone, Mail, CreditCard, TrendingDown, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

export function Suppliers() {
  const [open, setOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: suppliers, refetch } = trpc.suppliers.list.useQuery();
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
  const createBill = trpc.suppliers.createBill.useMutation({
    onSuccess: () => { setBillOpen(false); utils.suppliers.list.invalidate(); if (selectedSupplier) utils.suppliers.statement.invalidate({ id: selectedSupplier }); toast.success("Bill added"); },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    name: "", phone: "", email: "", contactPerson: "", kraPin: "",
    paymentTermsDays: "30", creditLimit: "", currentBalance: "", notes: "",
  });
  const [balanceAdj, setBalanceAdj] = useState({ adjustment: "", reason: "" });
  const [billForm, setBillForm] = useState({
    supplierId: 0, locationId: "", billNumber: "", description: "", amount: "", issueDate: getLocalDateString(), dueDate: "",
  });

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
            <p className="mt-1 text-sm text-[#8D8A87]">Manage vendors and track credit balances</p>
          </div>
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
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
                  {/* Add Bill button when selected */}
                  {selectedSupplier === supplier.id && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={(e) => {
                        e.stopPropagation();
                        setBillForm({ supplierId: supplier.id, locationId: "", billNumber: "", description: "", amount: "", issueDate: getLocalDateString(), dueDate: "" });
                        setBillOpen(true);
                      }}>
                        <FileText className="mr-1 h-3 w-3" /> Add Bill
                      </Button>
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

        {/* Add Bill Dialog */}
        <Dialog open={billOpen} onOpenChange={setBillOpen}>
          <DialogContent className="bg-white">
            <DialogHeader><DialogTitle className="font-serif text-xl">Add Bill for {suppliers?.find(s => s.id === billForm.supplierId)?.name}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              createBill.mutate({
                supplierId: billForm.supplierId,
                locationId: +billForm.locationId,
                billNumber: billForm.billNumber || undefined,
                description: billForm.description,
                amount: billForm.amount,
                issueDate: billForm.issueDate,
                dueDate: billForm.dueDate,
              });
            }} className="space-y-3">
              <div><Label>Location</Label>
                <select value={billForm.locationId} onChange={e => setBillForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                  <option value="">Select</option>
                  {trpc.locations.list.useQuery()?.data?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bill Number <span className="text-[#8D8A87] font-normal">(optional)</span></Label><Input value={billForm.billNumber} onChange={e => setBillForm(p => ({ ...p, billNumber: e.target.value }))} placeholder="Auto: BILL-0001" /></div>
                <div><Label>Amount</Label><Input type="number" step="0.01" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} required /></div>
              </div>
              <div><Label>Description</Label><Input value={billForm.description} onChange={e => setBillForm(p => ({ ...p, description: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Issue Date</Label><Input type="date" value={billForm.issueDate} onChange={e => setBillForm(p => ({ ...p, issueDate: e.target.value }))} required /></div>
                <div><Label>Due Date</Label><Input type="date" value={billForm.dueDate} onChange={e => setBillForm(p => ({ ...p, dueDate: e.target.value }))} required /></div>
              </div>
              <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createBill.isPending}>{createBill.isPending ? "Saving..." : "Add Bill"}</Button>
            </form>
          </DialogContent>
        </Dialog>

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
                    {supplierStatement.payments?.map((pay: any) => (
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
      </div>
    </Layout>
  );
}
