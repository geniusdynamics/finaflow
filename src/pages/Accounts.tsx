import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wallet, CreditCard, Smartphone, Landmark, BookOpen, ArrowDownLeft, ArrowUpRight, Pencil, Trash2, ArrowRightLeft } from "lucide-react";

export function Accounts() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [drawingOpen, setDrawingOpen] = useState<number | null>(null);
  const [depositOpen, setDepositOpen] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: accounts, refetch } = trpc.accounts.list.useQuery();
  const { data: ledger } = trpc.accounts.ledger.useQuery(
    { accountId: selectedAccount ?? 0, limit: 50 },
    { enabled: selectedAccount !== null }
  );

  const createAccount = trpc.accounts.create.useMutation({ onSuccess: () => { setOpen(false); refetch(); } });
  const updateAccount = trpc.accounts.update.useMutation({ onSuccess: () => { setEditOpen(null); refetch(); } });
  const adjustBalance = trpc.accounts.adjustBalance.useMutation({ onSuccess: () => refetch() });
  const recordDrawing = trpc.accounts.recordDrawing.useMutation({ onSuccess: () => { setDrawingOpen(null); refetch(); } });
  const recordDeposit = trpc.accounts.recordDeposit.useMutation({ onSuccess: () => { setDepositOpen(null); refetch(); } });
  const deleteAccount = trpc.accounts.delete.useMutation({ onSuccess: () => { setSelectedAccount(null); refetch(); } });
  const transfer = trpc.accounts.transfer.useMutation({
    onSuccess: () => { setTransferOpen(false); setTransferForm({ fromAccountId: "", description: "", date: getLocalDateString(), toAccounts: [{ accountId: "", amount: "", description: "" }] }); refetch(); },
  });

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "", description: "", date: getLocalDateString(),
    toAccounts: [{ accountId: "", amount: "", description: "" }],
  });
  const totalTransferOut = transferForm.toAccounts.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  const [form, setForm] = useState({
    locationId: "", name: "", type: "cash" as "cash" | "mpesa" | "bank_account",
    accountCode: "", accountNumber: "", openingBalance: "0.00", isPaymentMethod: true,
  });
  const [editForm, setEditForm] = useState({ name: "", accountCode: "", accountNumber: "", isPaymentMethod: true, isActive: true });
  const [drawingForm, setDrawingForm] = useState({ amount: "", description: "", date: getLocalDateString() });
  const [depositForm, setDepositForm] = useState({ amount: "", description: "", date: getLocalDateString() });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount.mutate({
      locationId: parseInt(form.locationId), name: form.name, type: form.type,
      accountCode: form.accountCode || undefined, accountNumber: form.accountNumber || undefined,
      openingBalance: form.openingBalance, isPaymentMethod: form.isPaymentMethod
    });
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "cash": return <Wallet className="h-5 w-5" />;
      case "mpesa": return <Smartphone className="h-5 w-5" />;
      case "bank_account": return <Landmark className="h-5 w-5" />;
      default: return <CreditCard className="h-5 w-5" />;
    }
  };

  const getAccountColor = (type: string) => {
    switch (type) {
      case "cash": return "bg-[#2E7D32]/10 text-[#2E7D32]";
      case "mpesa": return "bg-[#C73E1D]/10 text-[#C73E1D]";
      case "bank_account": return "bg-[#D4A854]/10 text-[#D4A854]";
      default: return "bg-[#8D8A87]/10 text-[#8D8A87]";
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Accounts &amp; Ledger</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track balances, record drawings, deposits, and transfers</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-[#D4A854] text-[#D4A854]"><ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer</Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-serif text-xl">Transfer Between Accounts</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); transfer.mutate({ fromAccountId: +transferForm.fromAccountId, description: transferForm.description, date: transferForm.date, toAccounts: transferForm.toAccounts.filter(t => t.accountId && t.amount).map(t => ({ accountId: +t.accountId, amount: t.amount, description: t.description })) }); }} className="space-y-3">
                  <div className="space-y-2"><Label>From Account (Source)</Label>
                    <select value={transferForm.fromAccountId} onChange={e => setTransferForm(p => ({ ...p, fromAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                      <option value="">Select source account</option>
                      {accounts?.filter(a => a.isActive).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                    </select>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Input value={transferForm.description} onChange={e => setTransferForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Branch fund transfer" required /></div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={transferForm.date} onChange={e => setTransferForm(p => ({ ...p, date: e.target.value }))} required /></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><Label>To Accounts (Destinations)</Label><Button type="button" size="sm" variant="outline" onClick={() => setTransferForm(p => ({ ...p, toAccounts: [...p.toAccounts, { accountId: "", amount: "", description: "" }] }))}><Plus className="h-3 w-3" /></Button></div>
                    {transferForm.toAccounts.map((to, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5"><select value={to.accountId} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], accountId: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} className="w-full rounded border px-2 py-2 text-sm" required><option value="">To account</option>{accounts?.filter(a => a.isActive && a.id.toString() !== transferForm.fromAccountId).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}</select></div>
                        <div className="col-span-3"><Input type="number" step="0.01" placeholder="Amount" value={to.amount} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], amount: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} required /></div>
                        <div className="col-span-3"><Input placeholder="Note" value={to.description} onChange={e => { const arr = [...transferForm.toAccounts]; arr[i] = { ...arr[i], description: e.target.value }; setTransferForm(p => ({ ...p, toAccounts: arr })); }} /></div>
                        <div className="col-span-1">{transferForm.toAccounts.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setTransferForm(p => ({ ...p, toAccounts: p.toAccounts.filter((_, idx) => idx !== i) }))}><Trash2 className="h-3 w-3 text-[#D32F2F]" /></Button>}</div>
                      </div>
                    ))}
                    <div className="rounded bg-[#F5EDE6] p-2 text-right">
                      <span className="text-xs text-[#8D8A87]">Total Out: </span>
                      <span className="font-mono font-semibold text-sm">{formatKES(totalTransferOut.toFixed(2))}</span>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={transfer.isPending || !transferForm.fromAccountId || totalTransferOut <= 0}>
                    {transfer.isPending ? "Transferring..." : "Record Transfer"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Add Account</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Location</Label>
                    <select value={form.locationId} onChange={(e) => setForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" required>
                      <option value="">Select</option>
                      {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2"><Label>Type</Label>
                    <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value as any }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                      <option value="cash">Cash</option><option value="mpesa">M-PESA</option><option value="bank_account">Bank Account</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Cash Drawer" required /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Code</Label><Input value={form.accountCode} onChange={e => setForm(p => ({ ...p, accountCode: e.target.value }))} placeholder="CASH, MPESA, KCB" /></div>
                  <div className="space-y-2"><Label>Account Number</Label><Input value={form.accountNumber} onChange={e => setForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Opening Balance</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                    <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} className="pl-10" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90" disabled={createAccount.isPending}>
                  {createAccount.isPending ? "Creating..." : "Add Account"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-3">
            <h2 className="font-medium text-[#2D2A26]">Your Accounts</h2>
            {accounts?.map((account) => {
              const locationName = locations?.find(l => l.id === account.locationId)?.name ?? "";
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${selectedAccount === account.id ? "border-[#C73E1D] bg-[#C73E1D]/5" : "border-[#E8E0D8] bg-white hover:border-[#D4A854]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getAccountColor(account.type)}`}>
                      {getAccountIcon(account.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2D2A26] truncate">{account.name}</p>
                      <p className="text-xs text-[#8D8A87]">{account.type} {account.accountCode && `· ${account.accountCode}`} {locationName && `· ${locationName}`}</p>
                    </div>
                    <Dialog open={editOpen === account.id} onOpenChange={(v) => setEditOpen(v ? account.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditOpen(account.id); setEditForm({ name: account.name, accountCode: account.accountCode ?? "", accountNumber: account.accountNumber ?? "", isPaymentMethod: account.isPaymentMethod, isActive: account.isActive }); }}>
                          <Pencil className="h-3 w-3 text-[#8D8A87]" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Edit Account</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); updateAccount.mutate({ id: account.id, ...editForm }); }} className="space-y-3">
                          <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required /></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Code</Label><Input value={editForm.accountCode} onChange={e => setEditForm(p => ({ ...p, accountCode: e.target.value }))} /></div>
                            <div className="space-y-2"><Label>Account Number</Label><Input value={editForm.accountNumber} onChange={e => setEditForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Current Balance</Label><Input value={account.currentBalance} disabled className="bg-[#F5EDE6]" /></div>
                            <div className="space-y-2"><Label>New Balance (optional adjust)</Label><Input type="number" step="0.01" placeholder="Leave empty to keep" onBlur={e => { if (e.target.value) adjustBalance.mutate({ id: account.id, newBalance: e.target.value, reason: "Manual balance adjustment" }); }} /></div>
                          </div>
                          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateAccount.isPending}>Save Changes</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete account "${account.name}"?`)) deleteAccount.mutate({ id: account.id }); }}>
                      <Trash2 className="h-3 w-3 text-[#D32F2F]" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#8D8A87]">Balance</span>
                    <span className={`font-mono font-semibold ${parseFloat(account.currentBalance) >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>
                      {formatKES(account.currentBalance)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Dialog open={drawingOpen === account.id} onOpenChange={(v) => setDrawingOpen(v ? account.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs border-[#D32F2F] text-[#D32F2F]" onClick={e => e.stopPropagation()}><ArrowUpRight className="h-3 w-3 mr-1"/>Drawing</Button></DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Record Drawing</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); recordDrawing.mutate({ accountId: account.id, ...drawingForm }); }} className="space-y-3">
                          <div className="rounded bg-[#F5EDE6] p-3"><p className="text-sm font-medium">{account.name}</p><p className="text-xs text-[#8D8A87]">Current: {formatKES(account.currentBalance)}</p></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={drawingForm.amount} onChange={e => setDrawingForm(p => ({ ...p, amount: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Date</Label><Input type="date" value={drawingForm.date} onChange={e => setDrawingForm(p => ({ ...p, date: e.target.value }))} required /></div>
                          </div>
                          <div className="space-y-2"><Label>Description</Label><Input value={drawingForm.description} onChange={e => setDrawingForm(p => ({ ...p, description: e.target.value }))} placeholder="Owner drawing, petty cash, etc." /></div>
                          <Button type="submit" className="w-full bg-[#D32F2F]" disabled={recordDrawing.isPending}>Record Drawing</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={depositOpen === account.id} onOpenChange={(v) => setDepositOpen(v ? account.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs border-[#2E7D32] text-[#2E7D32]" onClick={e => e.stopPropagation()}><ArrowDownLeft className="h-3 w-3 mr-1"/>Deposit</Button></DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Record Deposit</DialogTitle></DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); recordDeposit.mutate({ accountId: account.id, ...depositForm }); }} className="space-y-3">
                          <div className="rounded bg-[#F5EDE6] p-3"><p className="text-sm font-medium">{account.name}</p><p className="text-xs text-[#8D8A87]">Current: {formatKES(account.currentBalance)}</p></div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={depositForm.amount} onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))} required /></div>
                            <div className="space-y-2"><Label>Date</Label><Input type="date" value={depositForm.date} onChange={e => setDepositForm(p => ({ ...p, date: e.target.value }))} required /></div>
                          </div>
                          <div className="space-y-2"><Label>Description</Label><Input value={depositForm.description} onChange={e => setDepositForm(p => ({ ...p, description: e.target.value }))} placeholder="Sales deposit, transfer in, etc." /></div>
                          <Button type="submit" className="w-full bg-[#2E7D32]" disabled={recordDeposit.isPending}>Record Deposit</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </button>
              );
            })}
            {(!accounts || accounts.length === 0) && (
              <div className="rounded-xl border border-[#E8E0D8] bg-white p-8 text-center text-sm text-[#8D8A87]">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-30" /> No accounts yet.
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedAccount ? (
              <Card className="border-[#E8E0D8] bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#2D2A26]">
                    <BookOpen className="h-5 w-5 text-[#C73E1D]" /> Ledger
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E8E0D8]">
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Ref</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Date</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Type</th>
                          <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Description</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Debit</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Credit</th>
                          <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8E0D8]">
                        {ledger?.map(entry => (
                          <tr key={entry.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-2 text-xs font-mono text-[#8D8A87]">{entry.refNo || "-"}</td>
                            <td className="py-2 text-sm text-[#2D2A26]">{formatDate(entry.entryDate)}</td>
                            <td className="py-2 text-sm capitalize text-[#2D2A26]">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${entry.transactionType === "deposit" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : entry.transactionType === "drawing" ? "bg-[#D32F2F]/10 text-[#D32F2F]" : entry.entryType === "credit" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{entry.transactionType.replace(/_/g, " ")}</span>
                            </td>
                            <td className="py-2 text-sm text-[#8D8A87]">{entry.description || "-"}</td>
                            <td className="py-2 text-right font-mono text-sm text-[#D32F2F]">{entry.entryType === "debit" ? formatKES(entry.amount) : "-"}</td>
                            <td className="py-2 text-right font-mono text-sm text-[#2E7D32]">{entry.entryType === "credit" ? formatKES(entry.amount) : "-"}</td>
                            <td className="py-2 text-right font-mono text-sm font-semibold text-[#2D2A26]">{formatKES(entry.balanceAfter)}</td>
                          </tr>
                        ))}
                        {(!ledger || ledger.length === 0) && (
                          <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]">No transactions yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-[#E8E0D8] bg-white p-12">
                <div className="text-center text-sm text-[#8D8A87]">
                  <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-20" />
                  <p>Select an account to view its ledger</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
