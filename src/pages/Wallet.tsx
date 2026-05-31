// ABOUTME: Multi-provider mobile wallet dashboard showing all configured wallet providers and their transactions.
// ABOUTME: Uses the unified wallet API (trpc.wallet.*) for provider-agnostic wallet management.
import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Smartphone, Upload, ArrowUpRight, ArrowDownRight, Tag, Receipt, Wallet as WalletIcon, Landmark, Plus, Link2, BookOpen, LayoutDashboard } from "lucide-react";

export function Wallet() {
  const [tab, setTab] = useState<"overview" | "transactions" | "ledger" | "import">("overview");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [smsText, setSmsText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [smsProvider, setSmsProvider] = useState("mpesa");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [tagTxnId, setTagTxnId] = useState<number | null>(null);
  const [linkTxnId, setLinkTxnId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState({ locationId: "", categoryId: "", description: "", supplierId: "" });
  const [linkForm, setLinkForm] = useState({ sourceAccountId: "", destinationAccountId: "" });
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [ledgerForm, setLedgerForm] = useState({ locationId: "", accountId: "", ledgerDate: getLocalDateString(), openingBalance: "", closingBalance: "", notes: "", provider: "mpesa" });

  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: providers } = trpc.wallet.providers.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: categories, refetch: refetchCategories } = trpc.expenses.categories.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: feeAnalysis } = trpc.dashboard.feeAnalysis.useQuery({});
  const { data: transactions, refetch } = trpc.wallet.transactions.list.useQuery({
    provider: selectedProvider || undefined,
    dateFrom, dateTo,
  });
  const { data: stats } = trpc.wallet.transactions.stats.useQuery({
    provider: selectedProvider || undefined,
    dateFrom, dateTo,
  });
  const { data: ledgers, refetch: refetchLedger } = trpc.wallet.dailyLedger.list.useQuery({
    provider: selectedProvider || undefined,
    dateFrom, dateTo,
  });

  const importSms = trpc.wallet.transactions.importSms.useMutation({
    onSuccess: () => { setSmsText(""); setParsedPreview([]); refetch(); utils.wallet.transactions.stats.invalidate(); },
  });

  const createExpenseFromTxn = trpc.wallet.transactions.createExpenseFromTxn.useMutation({
    onSuccess: () => { setTagTxnId(null); refetch(); utils.expenses.list.invalidate(); utils.suppliers.list.invalidate(); },
  });

  const linkTopup = trpc.wallet.transactions.linkTopupToAccount.useMutation({
    onSuccess: () => { setLinkTxnId(null); setLinkForm({ sourceAccountId: "", destinationAccountId: "" }); refetch(); utils.accounts.list.invalidate(); },
  });

  const createLedger = trpc.wallet.dailyLedger.create.useMutation({
    onSuccess: () => {
      setLedgerOpen(false);
      setLedgerForm({ locationId: "", accountId: "", ledgerDate: getLocalDateString(), openingBalance: "", closingBalance: "", notes: "", provider: "mpesa" });
      refetchLedger();
    }
  });

  const previewSmsQuery = trpc.wallet.transactions.previewSms.useQuery(
    { locationId: parseInt(selectedLocation), provider: smsProvider, smsText },
    { enabled: false },
  );

  useEffect(() => {
    if (tagTxnId !== null) {
      refetchCategories();
    }
  }, [tagTxnId, refetchCategories]);

  useEffect(() => { setParsedPreview([]); }, [smsText, smsProvider, selectedLocation]);

  const handlePreviewSms = async () => {
    if (!selectedLocation || !smsText.trim()) return;
    setIsPreviewing(true);
    try {
      const result = await previewSmsQuery.refetch();
      if (result.data) { setParsedPreview(result.data); }
    } catch {
      setParsedPreview([]);
    }
    setIsPreviewing(false);
  };

  const handleImportSms = () => {
    if (!selectedLocation || !smsText.trim()) return;
    importSms.mutate({ locationId: parseInt(selectedLocation), provider: smsProvider, smsText });
  };

  const providerColors: Record<string, string> = {
    mpesa: "bg-green-600",
    airtel: "bg-red-600",
    sasapay: "bg-blue-600",
  };

  const providerIcons: Record<string, string> = {
    mpesa: "M-PESA",
    airtel: "Airtel",
    sasapay: "Sasapay",
  };

  const totalIn = parseFloat(stats?.summary?.totalIn ?? "0");
  const totalOut = parseFloat(stats?.summary?.totalOut ?? "0");
  const totalFees = parseFloat(stats?.summary?.totalFees ?? "0");
  const netFlow = totalIn - totalOut - totalFees;

  const walletTypes = ["mpesa", "wallet"];
  const walletAccounts = accounts?.filter(a => walletTypes.includes(a.type) && a.isActive && !a.deletedAt) ?? [];
  const bankAccounts = accounts?.filter(a => a.type === "bank_account" && !a.deletedAt) ?? [];

  // Ledger calculations (mirror Mpesa page pattern)
  const ledgerTxns = selectedWallet ? transactions?.filter((t: any) => {
    const wallet = walletAccounts.find(a => a.id.toString() === selectedWallet);
    return wallet && t.locationId === wallet.locationId;
  }) : transactions;
  const rangeTxns = ledgerTxns ?? [];
  const ledgerTotalIn = rangeTxns.filter((t: any) => parseFloat(t.amount) > 0).reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
  const ledgerTotalOut = rangeTxns.filter((t: any) => parseFloat(t.amount) < 0).reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount)), 0);
  const ledgerTotalFees = rangeTxns.reduce((s: number, t: any) => s + parseFloat(t.txnFee || "0"), 0);

  const handleLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLedger.mutate({
      locationId: +ledgerForm.locationId,
      provider: ledgerForm.provider,
      accountId: +ledgerForm.accountId,
      ledgerDate: ledgerForm.ledgerDate,
      openingBalance: ledgerForm.openingBalance,
      notes: ledgerForm.notes,
    });
  };

  const smsImportSection = (fullPage?: boolean) => (
    <div className={fullPage ? "space-y-6" : "space-y-4"}>
      <div className="space-y-2">
        <Label>Location</Label>
        <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
          <option value="">Select location</option>
          {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {locations && locations.length === 0 && (
          <p className="text-xs text-[#D32F2F]">No locations found for your current business. Please create a location first in Settings.</p>
        )}
        <p className="text-xs text-[#8D8A87]">Transactions will be imported to the selected location and will only be visible when viewing this business.</p>
      </div>
      <div className="space-y-2">
        <Label>Provider</Label>
        <select value={smsProvider} onChange={(e) => setSmsProvider(e.target.value)} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
          {providers?.filter((p: any) => p.features?.smsImport).map((p: any) => (
            <option key={p.code} value={p.code}>{p.displayName || p.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Paste SMS Messages</Label>
        <p className="text-xs text-[#8D8A87]">Paste multiple SMS messages. Each line should contain one transaction.</p>
        <textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={fullPage ? 12 : 8}
          className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 font-mono text-xs text-[#2D2A26]"
          placeholder="UDU9H2OPIS Confirmed. Ksh3,500.00 sent to PAUL MAKAU 0790583667 on 30/4/26 at 10:33 PM. New M-PESA balance is Ksh155.70. Transaction cost, Ksh53.00."
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handlePreviewSms} variant="outline" className="border-[#D4A854] text-[#D4A854]" disabled={!selectedLocation || !smsText.trim() || isPreviewing}>
          {isPreviewing ? "Parsing..." : "Preview"}
        </Button>
        <Button onClick={handleImportSms} disabled={!selectedLocation || !smsText.trim() || importSms.isPending}
          className="bg-[#C73E1D] hover:bg-[#C73E1D]/90">
          <Upload className="mr-2 h-4 w-4" />
          {importSms.isPending ? "Importing..." : `Import ${parsedPreview.length > 0 ? parsedPreview.length + ' Records' : 'SMS'}`}
        </Button>
      </div>
      {importSms.data && (
        <div className={`rounded-lg p-3 ${importSms.data.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-sm font-medium ${importSms.data.success ? 'text-green-700' : 'text-red-700'}`}>
            {importSms.data.success ? `Imported ${importSms.data.imported} transactions (${importSms.data.skipped} skipped)` : 'Import failed'}
          </p>
          {importSms.data.errors?.length > 0 && (
            <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
              {importSms.data.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {parsedPreview.length > 0 && (
        <div className="rounded-lg bg-[#F5EDE6] p-3">
          <p className="text-sm font-medium text-[#2D2A26]">Preview: {parsedPreview.length} transactions</p>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {parsedPreview.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-[#2D2A26]">{p.txnId} · {p.partyName || "-"}</span>
                <span className={p.direction === "in" ? "text-[#2E7D32]" : "text-[#D32F2F]"}>{p.currency || "KES"} {p.amount} · {p.txnType}</span>
              </div>
            ))}
            {parsedPreview.length > 10 && <p className="text-xs text-[#8D8A87]">... and {parsedPreview.length - 10} more</p>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2A26]">Mobile Wallet</h1>
            <p className="text-sm text-[#8D8A87]">Multi-provider wallet aggregation</p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-[#C73E1D] text-[#C73E1D]"><Upload className="mr-2 h-4 w-4" />Import SMS</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Import SMS Transactions</DialogTitle></DialogHeader>
                {smsImportSection()}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("overview")} className={`px-4 py-2 text-sm font-medium ${tab === "overview" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <LayoutDashboard className="mr-1 inline h-4 w-4"/>Overview
          </button>
          <button onClick={() => setTab("transactions")} className={`px-4 py-2 text-sm font-medium ${tab === "transactions" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <ArrowUpRight className="mr-1 inline h-4 w-4"/>Transactions
          </button>
          <button onClick={() => setTab("ledger")} className={`px-4 py-2 text-sm font-medium ${tab === "ledger" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <BookOpen className="mr-1 inline h-4 w-4"/>Daily Ledger
          </button>
          <button onClick={() => setTab("import")} className={`px-4 py-2 text-sm font-medium ${tab === "import" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Upload className="mr-1 inline h-4 w-4"/>Import
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-[#8D8A87]">Provider:</Label>
            <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="rounded-lg border border-[#E8E0D8] px-3 py-1.5 text-sm">
              <option value="">All Providers</option>
              {providers?.map((p) => <option key={p.code} value={p.code}>{p.displayName || p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-[#8D8A87]">From:</Label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-[#E8E0D8] px-3 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-[#8D8A87]">To:</Label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-[#E8E0D8] px-3 py-1.5 text-sm" />
          </div>
        </div>

        {tab === "overview" && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-[#2E7D32]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Inflows</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#2E7D32]">{formatKES(totalIn.toFixed(2))}</p>
                <p className="text-xs text-[#8D8A87]">{stats?.summary?.countIn ?? 0} transactions</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Outflows</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(totalOut.toFixed(2))}</p>
                <p className="text-xs text-[#8D8A87]">{stats?.summary?.countOut ?? 0} transactions</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(totalFees.toFixed(2))}</p>
                <p className="text-xs text-[#8D8A87]">Transaction costs</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><WalletIcon className="h-4 w-4 text-[#2D2A26]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Net Flow</span></div>
                <p className={`mt-2 font-mono text-xl font-semibold ${netFlow >= 0 ? "text-[#2E7D32]" : "text-[#D32F2F]"}`}>{formatKES(netFlow.toFixed(2))}</p>
                <p className="text-xs text-[#8D8A87]">{selectedProvider || "All providers"}</p>
              </CardContent></Card>
            </div>

            {/* Transaction Fee Analysis - from Mpesa page */}
            {feeAnalysis && (
              <Card className="mb-6 border-[#E8E0D8] bg-white">
                <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Transaction Fee Analysis</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <Card className="border-[#E8E0D8] bg-white">
                <CardHeader><CardTitle className="text-sm text-[#2D2A26]">Fees by Type</CardTitle></CardHeader>
                <CardContent>
                  {stats?.feesByType?.length ? stats.feesByType.map((ft: any) => (
                    <div key={ft.txnType} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-3">
                      <span className="text-sm text-[#2D2A26]">{ft.txnType.replace(/_/g, " ")}</span>
                      <span className="font-mono text-sm text-[#D4A854]">{formatKES(ft.totalFees)} ({ft.count} txns)</span>
                    </div>
                  )) : <p className="text-sm text-[#8D8A87]">No fees recorded</p>}
                </CardContent>
              </Card>
              <Card className="border-[#E8E0D8] bg-white">
                <CardHeader><CardTitle className="text-sm text-[#2D2A26]">Top Recipients</CardTitle></CardHeader>
                <CardContent>
                  {stats?.topRecipients?.length ? stats.topRecipients.map((r: any) => (
                    <div key={r.partyName ?? "unknown"} className="flex items-center justify-between rounded-lg bg-[#F5EDE6] px-3 py-2">
                      <span className="text-sm text-[#2D2A26]">{r.partyName}</span>
                      <span className="font-mono text-sm text-[#2D2A26]">{formatKES(r.totalAmount)} ({r.count})</span>
                    </div>
                  )) : <p className="text-sm text-[#8D8A87]">No outbound transactions</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader><CardTitle className="text-sm text-[#2D2A26]">Available Providers</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {providers?.map((p: any) => (
                    <div key={p.code} className="rounded-lg border border-[#E8E0D8] p-4">
                      <div className={`mb-2 inline-block rounded px-2 py-0.5 text-xs font-medium text-white ${providerColors[p.code] || "bg-gray-600"}`}>
                        {providerIcons[p.code] || p.displayName || p.name}
                      </div>
                      <p className="text-sm text-[#8D8A87]">{p.supportedCurrencies || "KES"}</p>
                      <p className="text-xs text-[#8D8A87]">{p.isActive ? "Active" : "Inactive"}</p>
                    </div>
                  ))}
                  {(!providers || providers.length === 0) && <p className="text-sm text-[#8D8A87]">No providers configured</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "transactions" && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase tracking-wider text-[#8D8A87]">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Party</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Fee</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions?.map((txn: any) => {
                      const amt = Math.abs(parseFloat(txn.amount));
                      const isOut = txn.direction === "out" || parseFloat(txn.amount) < 0;
                      return (
                        <tr key={txn.id} className="border-b border-[#E8E0D8] hover:bg-[#F5EDE6]/50">
                          <td className="px-4 py-3 text-sm text-[#2D2A26]">{formatDate(txn.txnDate)} {txn.txnTime}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#8D8A87]">{txn.providerTxnId || txn.txnId}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium text-white ${providerColors[txn.provider || "mpesa"] || "bg-gray-600"}`}>
                              {providerIcons[txn.provider] || txn.provider || "M-PESA"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              txn.txnType === "topup" ? "bg-[#2E7D32]/10 text-[#2E7D32]" :
                              txn.txnType === "payment" && isOut ? "bg-[#D32F2F]/10 text-[#D32F2F]" :
                              "bg-[#C73E1D]/10 text-[#C73E1D]"
                            }`}>{txn.txnType.replace(/_/g, " ")}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2D2A26]">{txn.partyName || txn.description || "-"}</td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${isOut ? "text-[#D32F2F]" : "text-[#2E7D32]"}`}>
                            {isOut ? "-" : "+"}{formatKES(amt.toFixed(2))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[#8D8A87]">{formatKES(txn.txnFee || "0")}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs ${txn.isLinked ? "text-[#2E7D32]" : "text-[#8D8A87]"}`}>
                              {txn.isLinked ? "Linked" : "Unlinked"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
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
                                        <p className="text-sm font-medium text-[#2D2A26]">{txn.providerTxnId || txn.txnId}</p>
                                        <p className="text-xs text-[#8D8A87]">Topup: {formatKES(amt.toFixed(2))} · Fee: {formatKES(txn.txnFee || "0")}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Source Bank Account</Label>
                                        <p className="text-xs text-[#8D8A87]">Select the bank account that funded this topup. The system will deduct the topup amount + fee from that account.</p>
                                        <select value={linkForm.sourceAccountId} onChange={(e) => setLinkForm(p => ({...p, sourceAccountId: e.target.value}))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                          <option value="">Select bank account</option>
                                          {bankAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {a.accountNumber ? `(${a.accountNumber})` : ""} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                                        </select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Destination Wallet</Label>
                                        <p className="text-xs text-[#8D8A87]">Select the wallet account that received this topup. The system will credit this account.</p>
                                        <select value={linkForm.destinationAccountId} onChange={(e) => setLinkForm(p => ({...p, destinationAccountId: e.target.value}))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                                          <option value="">Auto (no specific wallet)</option>
                                          {walletAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""} · Bal: {formatKES(a.currentBalance)}</option>; })}
                                        </select>
                                      </div>
                                      <Button onClick={() => linkTopup.mutate({ walletTxnId: txn.id, sourceAccountId: parseInt(linkForm.sourceAccountId), destinationAccountId: linkForm.destinationAccountId ? parseInt(linkForm.destinationAccountId) : undefined })} disabled={!linkForm.sourceAccountId || linkTopup.isPending} className="w-full bg-[#C73E1D]">
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
                                        <p className="text-sm font-medium text-[#2D2A26]">{txn.providerTxnId || txn.txnId}</p>
                                        <p className="text-xs text-[#8D8A87]">{txn.partyName} · {formatKES(amt.toFixed(2))}</p>
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
                                        walletTxnId: txn.id,
                                        locationId: parseInt(expenseForm.locationId),
                                        categoryId: parseInt(expenseForm.categoryId),
                                        description: expenseForm.description || txn.partyName || "Wallet expense",
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
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-[#8D8A87]">
                        <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-30 text-[#8D8A87]" />
                        <p>No transactions found for the selected date range.</p>
                        <p className="mt-1 text-xs text-[#8D8A87]">Import SMS messages or adjust your date filter.</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "import" && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Bulk SMS Import</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-[#8D8A87]">
                This bulk import view is designed for processing large volumes of SMS transactions. 
                Paste multiple transaction messages below, preview them, and import in a single batch.
              </p>
              {smsImportSection(true)}
            </CardContent>
          </Card>
        )}

        {tab === "ledger" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select value={selectedWallet} onChange={e => setSelectedWallet(e.target.value)} className="rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                  <option value="">All Wallets</option>
                  {walletAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}
                </select>
              </div>
              <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C73E1D]"><Plus className="mr-2 h-4 w-4" /> Add Entry</Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Add Daily Ledger</DialogTitle></DialogHeader>
                  <form onSubmit={handleLedgerSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <select value={ledgerForm.locationId} onChange={e => setLedgerForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                          <option value="">Select</option>
                          {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <select value={ledgerForm.provider} onChange={e => setLedgerForm(p => ({ ...p, provider: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                          {providers?.filter((p: any) => p.features?.smsImport).map((p: any) => (
                            <option key={p.code} value={p.code}>{p.displayName || p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Wallet</Label>
                        <select value={ledgerForm.accountId} onChange={e => setLedgerForm(p => ({ ...p, accountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required>
                          <option value="">Select wallet</option>
                          {walletAccounts.map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""}</option>; })}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={ledgerForm.ledgerDate} onChange={e => setLedgerForm(p => ({ ...p, ledgerDate: e.target.value }))} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Opening Balance</Label>
                        <Input type="number" step="0.01" value={ledgerForm.openingBalance} onChange={e => setLedgerForm(p => ({ ...p, openingBalance: e.target.value }))} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input value={ledgerForm.notes} onChange={e => setLedgerForm(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createLedger.isPending}>
                      {createLedger.isPending ? "Saving..." : "Add Ledger"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-4">
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-[#2E7D32]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Topups</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#2E7D32]">{formatKES(ledgerTotalIn.toFixed(2))}</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-[#D32F2F]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Expenditures</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D32F2F]">{formatKES(ledgerTotalOut.toFixed(2))}</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-[#D4A854]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Fees</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#D4A854]">{formatKES(ledgerTotalFees.toFixed(2))}</p>
              </CardContent></Card>
              <Card className="border-[#E8E0D8] bg-white"><CardContent className="p-4">
                <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#2D2A26]" /><span className="text-xs uppercase tracking-wider text-[#8D8A87]">Net Change</span></div>
                <p className="mt-2 font-mono text-xl font-semibold text-[#2D2A26]">{formatKES((ledgerTotalIn - ledgerTotalOut - ledgerTotalFees).toFixed(2))}</p>
              </CardContent></Card>
            </div>

            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3"><CardTitle className="font-serif text-lg text-[#2D2A26]">Ledger Entries</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase tracking-wider text-[#8D8A87]">
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 text-right font-medium">Opening</th>
                        <th className="px-4 py-3 text-right font-medium">Inflow</th>
                        <th className="px-4 py-3 text-right font-medium">Outflow</th>
                        <th className="px-4 py-3 text-right font-medium">Fees</th>
                        <th className="px-4 py-3 text-right font-medium">Closing</th>
                        <th className="px-4 py-3 text-right font-medium">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D8]">
                      {ledgers?.map((l: any) => (
                        <tr key={l.id} className="hover:bg-[#F5EDE6]/50">
                          <td className="px-4 py-3 text-sm text-[#2D2A26]">{formatDate(l.ledgerDate)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium text-white ${providerColors[l.provider || "mpesa"] || "bg-gray-600"}`}>
                              {providerIcons[l.provider] || l.provider || "M-PESA"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[#2D2A26]">{formatKES(l.openingBalance || "0")}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[#2E7D32]">{formatKES(l.totalInflow || l.totalTopups || "0")}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[#D32F2F]">{formatKES(l.totalOutflow || l.totalExpenditures || "0")}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-[#D4A854]">{formatKES(l.totalFees || "0")}</td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#2D2A26]">{formatKES(l.closingBalance || "0")}</td>
                          <td className="px-4 py-3 text-right text-sm text-[#8D8A87]">{l.transactionCount ?? 0}</td>
                        </tr>
                      ))}
                      {(!ledgers || ledgers.length === 0) && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center">
                          <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-30 text-[#8D8A87]" />
                          <p className="text-sm text-[#8D8A87]">No ledger entries found</p>
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
