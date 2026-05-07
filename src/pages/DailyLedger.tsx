import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, ArrowUpRight, ArrowDownRight, Smartphone } from "lucide-react";

export function DailyLedger() {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(getLocalDateString());
  const [dateTo, setDateTo] = useState(getLocalDateString());
  const [selectedWallet, setSelectedWallet] = useState<string>("");

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const mpesaAccounts = accounts?.filter(a => a.type === "mpesa" && a.isActive && !a.deletedAt) ?? [];

  const { data: ledgers, refetch } = trpc.dailyLedger.list.useQuery(
    { dateFrom, dateTo, accountId: selectedWallet ? +selectedWallet : undefined }
  );
  const { data: mpesaTxns } = trpc.mpesa.list.useQuery(
    { dateFrom, dateTo }
  );
  // Filter txns for selected wallet if we have a selected one
  const walletTxns = selectedWallet ? mpesaTxns?.filter(t => {
    const wallet = mpesaAccounts.find(a => a.id.toString() === selectedWallet);
    return wallet && t.locationId === wallet.locationId;
  }) : mpesaTxns;

  const rangeTxns = walletTxns ?? [];

  const createLedger = trpc.dailyLedger.create.useMutation({ onSuccess: () => { setOpen(false); refetch(); } });

  const [form, setForm] = useState({ locationId: "", accountId: "", ledgerDate: getLocalDateString(), openingBalance: "", closingBalance: "", notes: "" });

  const totalIn = rangeTxns.filter(t => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOut = rangeTxns.filter(t => parseFloat(t.amount) < 0).reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const totalFees = rangeTxns.reduce((s, t) => s + parseFloat(t.txnFee || "0"), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLedger.mutate({
      locationId: +form.locationId,
      accountId: +form.accountId,
      ledgerDate: form.ledgerDate,
      openingBalance: form.openingBalance,
      closingBalance: form.closingBalance || (parseFloat(form.openingBalance || "0") + totalIn - totalOut - totalFees).toFixed(2),
      notes: form.notes,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Daily M-PESA Ledger</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track wallet balances per day</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] px-2 py-1">
              <Label className="text-xs text-[#8D8A87] whitespace-nowrap">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 border-0 p-0 text-sm" />
              <Label className="text-xs text-[#8D8A87] whitespace-nowrap">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 border-0 p-0 text-sm" />
            </div>
            <select value={selectedWallet} onChange={e => setSelectedWallet(e.target.value)} className="rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
              <option value="">All Wallets</option>
              {mpesaAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}
            </select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D]"><Plus className="mr-2 h-4 w-4" /> Add Entry</Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader><DialogTitle className="font-serif text-xl">Add Daily Ledger</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Location</Label><select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required><option value="">Select</option>{locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>M-PESA Wallet</Label><select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required><option value="">Select wallet</option>{mpesaAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}</select></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.ledgerDate} onChange={e => setForm(p => ({ ...p, ledgerDate: e.target.value }))} required /></div>
                    <div className="space-y-2"><Label>Opening</Label><Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} required /></div>
                    <div className="space-y-2"><Label>Closing</Label><Input type="number" step="0.01" value={form.closingBalance} onChange={e => setForm(p => ({ ...p, closingBalance: e.target.value }))} placeholder="Auto" /></div>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createLedger.isPending}>{createLedger.isPending ? "Saving..." : "Add Ledger"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-[#2E7D32]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Topups</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#2E7D32]">{formatKES(totalIn)}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Expenditures</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(totalOut)}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(totalFees)}</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8]"><CardContent className="p-4">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#2D2A26]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Net Change</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#2D2A26]">{formatKES(totalIn - totalOut - totalFees)}</p>
          </CardContent></Card>
        </div>

        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Ledger Entries</CardTitle></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Date</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Wallet</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Opening</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Topups</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Expend</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Fees</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Closing</th></tr></thead>
            <tbody className="divide-y">{ledgers?.map(l => {
              const acct = accounts?.find(a => a.id === l.accountId);
              return (
                <tr key={l.id} className="hover:bg-[#F5EDE6]/50">
                  <td className="py-3 text-sm">{formatDate(l.ledgerDate)}</td>
                  <td className="py-3 text-sm">{acct?.name ?? "Unknown"}</td>
                  <td className="py-3 text-right font-mono text-sm">{formatKES(l.openingBalance)}</td>
                  <td className="py-3 text-right font-mono text-sm text-[#2E7D32]">{formatKES(l.totalTopups)}</td>
                  <td className="py-3 text-right font-mono text-sm text-[#D32F2F]">{formatKES(l.totalExpenditures)}</td>
                  <td className="py-3 text-right font-mono text-sm text-[#D4A854]">{formatKES(l.totalFees)}</td>
                  <td className="py-3 text-right font-mono text-sm font-semibold">{formatKES(l.closingBalance)}</td>
                </tr>
              );
            })}{(!ledgers || ledgers.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]"><BookOpen className="mx-auto mb-2 h-8 w-8 opacity-30"/>No ledger entries.</td></tr>}</tbody>
          </table></div></CardContent>
        </Card>
      </div>
    </Layout>
  );
}
