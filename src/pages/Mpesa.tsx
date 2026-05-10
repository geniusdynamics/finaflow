import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Smartphone, Upload, ArrowUpRight, ArrowDownRight, Tag, Receipt, Wallet, Landmark, Link2 } from "lucide-react";

export function Mpesa() {
  const [smsText, setSmsText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [tagTxnId, setTagTxnId] = useState<number | null>(null);
  const [linkTxnId, setLinkTxnId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState({ locationId: "", categoryId: "", description: "", supplierId: "" });
  const [linkForm, setLinkForm] = useState({ sourceAccountId: "", destinationAccountId: "" });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: categories, refetch: refetchCategories } = trpc.expenses.categories.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: transactions, refetch } = trpc.mpesa.list.useQuery(
    dateFrom && dateTo ? { dateFrom, dateTo } : {}
  );
  const { data: stats } = trpc.mpesa.stats.useQuery(
    dateFrom && dateTo ? { dateFrom, dateTo } : {}
  );
  const { data: feeAnalysis } = trpc.dashboard.feeAnalysis.useQuery({});

  const importSms = trpc.mpesa.importSms.useMutation({
    onSuccess: () => { setParsedPreview([]); setSmsText(""); refetch(); utils.mpesa.stats.invalidate(); },
  });
  const createExpenseFromTxn = trpc.mpesa.createExpenseFromTxn.useMutation({
    onSuccess: () => { 
      setTagTxnId(null); 
      refetch(); 
      utils.expenses.list.invalidate(); 
      utils.suppliers.list.invalidate(); 
    },
  });
  const linkTopup = trpc.mpesa.linkTopupToAccount.useMutation({
    onSuccess: () => { 
      setLinkTxnId(null); 
      setLinkForm({ sourceAccountId: "", destinationAccountId: "" }); 
      refetch(); 
      utils.accounts.list.invalidate(); 
    },
  });

  // Ensure categories are loaded when dialog opens
  useEffect(() => {
    if (tagTxnId !== null) {
      refetchCategories();
    }
  }, [tagTxnId, refetchCategories]);

  const handlePreview = async () => {
    const { parseMpesaSmsBulk } = await import("@/lib/mpesa-parser");
    const parsed = parseMpesaSmsBulk(smsText);
    setParsedPreview(parsed);
  };

  const handleImport = () => {
    if (!selectedLocation || !smsText) return;
    importSms.mutate({ locationId: parseInt(selectedLocation), smsText });
  };

  const totalIn = stats?.summary?.totalIn ? parseFloat(stats.summary.totalIn) : 0;
  const totalOut = stats?.summary?.totalOut ? parseFloat(stats.summary.totalOut) : 0;
  const totalFees = stats?.summary?.totalFees ? parseFloat(stats.summary.totalFees) : 0;

  // Get bank accounts only for topup linking
  const bankAccounts = accounts?.filter(a => a.type === "bank_account" && !a.deletedAt) ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">M-PESA Transactions</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Import SMS, tag transactions, analyze fees</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] px-2 py-1">
              <span className="text-xs text-[#8D8A87]">From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 w-32 border-0 p-0 text-sm outline-none" />
              <span className="text-xs text-[#8D8A87]">To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 w-32 border-0 p-0 text-sm outline-none" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-[#8D8A87] hover:text-[#C73E1D]">Clear</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
            <div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-[#2E7D32]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Inflows</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#2E7D32]">{formatKES(totalIn)}</p>
            <p className="text-xs text-[#8D8A87]">{stats?.summary?.countIn ?? 0} transactions</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
            <div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Outflows</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(totalOut)}</p>
            <p className="text-xs text-[#8D8A87]">{stats?.summary?.countOut ?? 0} transactions</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(totalFees)}</p>
            <p className="text-xs text-[#8D8A87]">Transaction costs</p>
          </CardContent></Card>
          <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
            <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#2D2A26]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Net Flow</span></div>
            <p className="mt-2 font-mono text-xl font-semibold text-[#2D2A26]">{formatKES(totalIn - totalOut - totalFees)}</p>
            <p className="text-xs text-[#8D8A87]">After fees</p>
          </CardContent></Card>
        </div>

        {/* SMS Import */}
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">SMS Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                <option value="">Select location</option>
                {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Paste M-PESA SMS Messages</Label>
              <p className="text-xs text-[#8D8A87]">Paste multiple SMS messages. Each line should contain one transaction.</p>
              <textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={8}
                className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 font-mono text-xs text-[#2D2A26]"
                placeholder="UDU9H2OPIS Confirmed. Ksh3,500.00 sent to PAUL MAKAU 0790583667 on 30/4/26 at 10:33 PM. New M-PESA balance is Ksh155.70. Transaction cost, Ksh53.00."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePreview} variant="outline" className="border-[#D4A854] text-[#D4A854]">Preview</Button>
              <Button onClick={handleImport} disabled={!smsText || !selectedLocation || importSms.isPending}
                className="bg-[#C73E1D] hover:bg-[#C73E1D]/90">
                <Upload className="mr-2 h-4 w-4" />
                {importSms.isPending ? "Importing..." : `Import ${parsedPreview.length > 0 ? parsedPreview.length + ' Records' : 'SMS'}`}
              </Button>
            </div>
            {parsedPreview.length > 0 && (
              <div className="rounded-lg bg-[#F5EDE6] p-3">
                <p className="text-sm font-medium text-[#2D2A26]">Preview: {parsedPreview.length} transactions</p>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {parsedPreview.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-[#2D2A26]">{p.txnId} · {p.partyName}</span>
                      <span className={p.direction === "in" ? "text-[#2E7D32]" : "text-[#D32F2F]"}>KES {p.amount} · {p.txnType}</span>
                    </div>
                  ))}
                  {parsedPreview.length > 10 && <p className="text-xs text-[#8D8A87]">... and {parsedPreview.length - 10} more</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Fee Analysis */}
        {feeAnalysis && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Transaction Fee Analysis</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {feeAnalysis.feesByType?.map((ft: { txnType: string; totalFees: string; count: number }) => (
                  <div key={ft.txnType} className="rounded-lg border border-[#E8E0D8] p-3">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">{ft.txnType}</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-[#D32F2F]">{formatKES(ft.totalFees)}</p>
                    <p className="text-xs text-[#8D8A87]">{ft.count} txns</p>
                  </div>
                ))}
              </div>
              {feeAnalysis.topRecipients && feeAnalysis.topRecipients.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-medium text-[#2D2A26]">Top Recipients by Fees</h4>
                  <div className="space-y-1">
                    {feeAnalysis.topRecipients.slice(0, 5).map((r: { partyName: string | null; totalFees: string; count: number }) => (
                      <div key={r.partyName ?? "unknown"} className="flex items-center justify-between rounded-lg bg-[#F5EDE6] px-3 py-2">
                        <span className="text-sm text-[#2D2A26]">{r.partyName}</span>
                        <span className="font-mono text-sm text-[#D32F2F]">{formatKES(r.totalFees)} ({r.count} txns)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transactions List */}
        <Card className="border-[#E8E0D8] bg-white">
          <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Transaction History</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#E8E0D8]">
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Date</th>
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">ID</th>
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Type</th>
                  <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Party</th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Amount</th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Fee</th>
                  <th className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Status</th>
                  <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-[#E8E0D8]">
                  {transactions?.map((txn) => {
                    const isOut = parseFloat(txn.amount) < 0;
                    return (
                      <tr key={txn.id} className="hover:bg-[#F5EDE6]/50">
                        <td className="py-3 text-sm text-[#2D2A26]">{formatDate(txn.txnDate)} {txn.txnTime}</td>
                        <td className="py-3 font-mono text-xs text-[#8D8A87]">{txn.txnId}</td>
                        <td className="py-3 text-sm capitalize text-[#2D2A26]">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                            txn.txnType === "topup" ? "bg-[#2E7D32]/10 text-[#2E7D32]" :
                            txn.txnType === "expense" ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                            "bg-[#8D8A87]/10 text-[#8D8A87]"
                          }`}>{txn.txnType.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-3 text-sm text-[#2D2A26]">{txn.partyName || txn.description}</td>
                        <td className={`py-3 text-right font-mono text-sm font-semibold ${isOut ? "text-[#D32F2F]" : "text-[#2E7D32]"}`}>
                          {formatKES(Math.abs(parseFloat(txn.amount)))}
                        </td>
                        <td className="py-3 text-right font-mono text-xs text-[#8D8A87]">{formatKES(txn.txnFee)}</td>
                        <td className="py-3 text-center">{txn.isLinked ? <span className="text-xs text-[#2E7D32]">Linked</span> : <span className="text-xs text-[#8D8A87]">Unlinked</span>}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Link topup to bank account */}
                            {!txn.isLinked && txn.txnType === "topup" && (
                              <Dialog open={linkTxnId === txn.id} onOpenChange={(v) => setLinkTxnId(v ? txn.id : null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-[#D4A854] text-[#D4A854]"><Link2 className="h-3 w-3" /></Button>
                                </DialogTrigger>
                                <DialogContent className="bg-white">
                                  <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Link Topup to Bank Account</DialogTitle></DialogHeader>
                                  <div className="space-y-4">
                                    <div className="rounded-lg bg-[#F5EDE6] p-3">
                                      <p className="text-sm font-medium text-[#2D2A26]">{txn.txnId}</p>
                                      <p className="text-xs text-[#8D8A87]">Topup: {formatKES(Math.abs(parseFloat(txn.amount)))} · Fee: {formatKES(txn.txnFee)}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Source Bank Account</Label>
                                      <p className="text-xs text-[#8D8A87]">Select the bank account that funded this M-PESA topup. The system will deduct the topup amount + fee from that account.</p>
                                      <select value={linkForm.sourceAccountId} onChange={(e) => setLinkForm(p => ({...p, sourceAccountId: e.target.value}))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                        <option value="">Select bank account</option>
                                        {bankAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {a.accountNumber ? `(${a.accountNumber})` : ""} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                                      </select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Destination M-PESA Wallet</Label>
                                      <p className="text-xs text-[#8D8A87]">Select the M-PESA wallet/account that received this topup. The system will credit this account.</p>
                                      <select value={linkForm.destinationAccountId} onChange={(e) => setLinkForm(p => ({...p, destinationAccountId: e.target.value}))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                        <option value="">Auto (no specific wallet)</option>
                                        {accounts?.filter(a => a.type === "mpesa" && a.isActive && !a.deletedAt).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                                      </select>
                                    </div>
                                    <Button onClick={() => linkTopup.mutate({ mpesaTxnId: txn.id, sourceAccountId: parseInt(linkForm.sourceAccountId), destinationAccountId: linkForm.destinationAccountId ? parseInt(linkForm.destinationAccountId) : undefined })} disabled={!linkForm.sourceAccountId || linkTopup.isPending} className="w-full bg-[#C73E1D]">
                                      <Landmark className="mr-2 h-4 w-4" />
                                      {linkTopup.isPending ? "Linking..." : "Record Bank Outflow & Link"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            {/* Tag expense */}
                            {!txn.isLinked && isOut && (
                              <Dialog open={tagTxnId === txn.id} onOpenChange={(v) => setTagTxnId(v ? txn.id : null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-[#D4A854] text-[#D4A854]"><Tag className="h-3 w-3" /></Button>
                                </DialogTrigger>
                                <DialogContent className="bg-white">
                                  <DialogHeader><DialogTitle className="font-serif text-xl text-[#2D2A26]">Tag Transaction as Expense</DialogTitle></DialogHeader>
                                  <div className="space-y-4">
                                    <div className="rounded-lg bg-[#F5EDE6] p-3">
                                      <p className="text-sm font-medium text-[#2D2A26]">{txn.txnId}</p>
                                      <p className="text-xs text-[#8D8A87]">{txn.partyName} · {formatKES(Math.abs(parseFloat(txn.amount)))}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Expense Category *</Label>
                                      <select value={expenseForm.categoryId} onChange={(e) => setExpenseForm((p) => ({ ...p, categoryId: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" required>
                                        <option value="">{categories && categories.length > 0 ? "Select category" : "Loading categories..."}</option>
                                        {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                      </select>
                                      {categories && categories.length === 0 && (
                                        <p className="text-xs text-[#D32F2F]">No categories found. Please create categories in the Expenses page first.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Description</Label>
                                      <Input value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} placeholder={txn.partyName || "Expense description"} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Link to Supplier</Label>
                                      <select value={expenseForm.supplierId} onChange={(e) => setExpenseForm((p) => ({ ...p, supplierId: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                        <option value="">Select (optional)</option>
                                        {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                      </select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Location *</Label>
                                      <select value={expenseForm.locationId} onChange={(e) => setExpenseForm((p) => ({ ...p, locationId: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" required>
                                        <option value="">Select</option>
                                        {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                      </select>
                                    </div>
                                    <Button onClick={() => createExpenseFromTxn.mutate({
                                      mpesaTxnId: txn.id,
                                      locationId: parseInt(expenseForm.locationId),
                                      categoryId: parseInt(expenseForm.categoryId),
                                      description: expenseForm.description || txn.partyName || "M-PESA expense",
                                      supplierId: expenseForm.supplierId ? parseInt(expenseForm.supplierId) : undefined,
                                    })} disabled={!expenseForm.categoryId || !expenseForm.locationId || createExpenseFromTxn.isPending}
                                      className="w-full bg-[#C73E1D] hover:bg-[#C73E1D]/90">
                                      <Receipt className="mr-2 h-4 w-4" />
                                      {createExpenseFromTxn.isPending ? "Creating..." : "Create Expense & Link"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!transactions || transactions.length === 0) && (
                    <tr><td colSpan={8} className="py-8 text-center text-sm text-[#8D8A87]"><Smartphone className="mx-auto mb-2 h-8 w-8 opacity-30" /> No M-PESA transactions imported yet.</td></tr>
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
