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
import { Smartphone, Upload, ArrowUpRight, ArrowDownRight, Tag, Receipt, Wallet as WalletIcon, Landmark, Plus } from "lucide-react";

export function Wallet() {
  const [tab, setTab] = useState<"overview" | "transactions" | "ledger">("overview");
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
  const [previewed, setPreviewed] = useState(false);

  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: providers } = trpc.wallet.providers.list.useQuery();
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

  const previewSmsQuery = trpc.wallet.transactions.previewSms.useQuery(
    { locationId: parseInt(selectedLocation), provider: smsProvider, smsText },
    { enabled: false },
  );

  const handlePreviewSms = async () => {
    if (!selectedLocation || !smsText.trim()) return;
    setIsPreviewing(true);
    try {
      const result = await previewSmsQuery.refetch();
      if (result.data) { setParsedPreview(result.data); setPreviewed(true); }
    } catch {
      setParsedPreview([]);
    }
    setIsPreviewing(false);
  };

  useEffect(() => { setParsedPreview([]); setPreviewed(false); }, [smsText, smsProvider, selectedLocation]);

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

  const handleImportSms = () => {
    if (!selectedLocation || !smsText.trim()) return;
    importSms.mutate({ locationId: parseInt(selectedLocation), provider: smsProvider, smsText });
  };

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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
                      <option value="">Select location</option>
                      {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
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
                    <Label>SMS Text</Label>
                    <p className="text-xs text-[#8D8A87]">Paste multiple SMS messages. Each line should contain one transaction.</p>
                    <textarea value={smsText} onChange={(e) => setSmsText(e.target.value)} rows={8} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 font-mono text-xs text-[#2D2A26]" placeholder="UDU9H2OPIS Confirmed. Ksh3,500.00 sent to PAUL MAKAU 0790583667 on 30/4/26 at 10:33 PM. New M-PESA balance is Ksh155.70. Transaction cost, Ksh53.00." />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePreviewSms} variant="outline" className="border-[#D4A854] text-[#D4A854]" disabled={!selectedLocation || !smsText.trim() || isPreviewing}>
                      {isPreviewing ? "Parsing..." : "Preview"}
                    </Button>
                    <Button onClick={handleImportSms} disabled={!selectedLocation || !smsText.trim() || !previewed || importSms.isPending} className="flex-1 bg-[#C73E1D]">
                      <Upload className="mr-2 h-4 w-4" />
                      {importSms.isPending ? "Importing..." : `Import ${parsedPreview.length > 0 ? parsedPreview.length + ' Records' : 'SMS'}`}
                    </Button>
                  </div>
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
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {["overview", "transactions", "ledger"].map((t) => (
            <button key={t} onClick={() => setTab(t as any)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-[#C73E1D] text-white" : "bg-[#F5EDE6] text-[#2D2A26] hover:bg-[#E8E0D8]"}`}>
              {t === "overview" ? "Overview" : t === "transactions" ? "Transactions" : "Daily Ledger"}
            </button>
          ))}
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
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Party</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Fee</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions?.map((txn: any) => {
                      const amt = Math.abs(parseFloat(txn.amount));
                      const isOut = txn.direction === "out" || parseFloat(txn.amount) < 0;
                      return (
                        <tr key={txn.id} className="border-b border-[#E8E0D8] hover:bg-[#F5EDE6]/50">
                          <td className="px-4 py-3 text-sm text-[#2D2A26]">{formatDate(txn.txnDate)} {txn.txnTime}</td>
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
                        </tr>
                      );
                    })}
                    {(!transactions || transactions.length === 0) && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8D8A87]">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "ledger" && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardContent className="p-0">
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
                  <tbody>
                    {ledgers?.map((l: any) => (
                      <tr key={l.id} className="border-b border-[#E8E0D8] hover:bg-[#F5EDE6]/50">
                        <td className="px-4 py-3 text-sm text-[#2D2A26]">{formatDate(l.ledgerDate)}</td>
                        <td className="px-4 py-3"><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium text-white ${providerColors[l.provider || "mpesa"] || "bg-gray-600"}`}>{providerIcons[l.provider] || l.provider || "M-PESA"}</span></td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-[#2D2A26]">{formatKES(l.openingBalance || "0")}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-[#2E7D32]">{formatKES(l.totalInflow || l.totalTopups || "0")}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-[#D32F2F]">{formatKES(l.totalOutflow || l.totalExpenditures || "0")}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-[#D4A854]">{formatKES(l.totalFees || "0")}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#2D2A26]">{formatKES(l.closingBalance || "0")}</td>
                        <td className="px-4 py-3 text-right text-sm text-[#8D8A87]">{l.transactionCount ?? 0}</td>
                      </tr>
                    ))}
                    {(!ledgers || ledgers.length === 0) && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8D8A87]">No ledger entries found</td></tr>
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
