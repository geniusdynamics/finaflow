// ABOUTME: Admin dashboard for wallet provider monitoring, configuration, exchange rate management, and health checks.
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RefreshCw, Activity, Smartphone, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";

const PROVIDER_COLORS: Record<string, string> = {
  mpesa: "bg-[#25B266]",
  airtel_money: "bg-[#E30613]",
  sasapay: "bg-[#00A651]",
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  mpesa: <Smartphone className="h-5 w-5" />,
  airtel_money: <Smartphone className="h-5 w-5" />,
  sasapay: <Wallet className="h-5 w-5" />,
};

export function WalletAdmin() {
  const [tab, setTab] = useState<"providers" | "rates" | "currencies">("providers");
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ fromCurrency: "USD", toCurrency: "KES", rate: "" });
  const utils = trpc.useUtils();

  const { data: health, refetch: refetchHealth } = trpc.walletManagement.providers.health.useQuery({});
  const { data: providers } = trpc.walletManagement.providers.list.useQuery();
  const { data: rates, refetch: refetchRates } = trpc.walletManagement.rates.latest.useQuery({});
  const { data: currencies } = trpc.walletManagement.currencies.list.useQuery();
  const _createCurrency = trpc.walletManagement.currencies.create.useMutation({ onSuccess: () => utils.walletManagement.currencies.list.invalidate() });
  const toggleCurrency = trpc.walletManagement.currencies.toggle.useMutation({ onSuccess: () => utils.walletManagement.currencies.list.invalidate() });

  const syncRates = trpc.walletManagement.rates.sync.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Exchange rates synced successfully");
        refetchRates();
      } else {
        toast.error(`Sync failed: ${res.error}`);
      }
    },
  });

  const manualUpdateRate = trpc.walletManagement.rates.manualUpdate.useMutation({
    onSuccess: () => {
      toast.success("Rate updated successfully");
      refetchRates();
      setRateDialogOpen(false);
      setRateForm({ fromCurrency: "USD", toCurrency: "KES", rate: "" });
    },
    onError: (err) => { toast.error(err.message); },
  });

  const _configureProvider = trpc.walletManagement.providers.configure.useMutation({
    onSuccess: () => {
      toast.success("Provider configured");
      refetchHealth();
    },
    onError: (err) => { toast.error(err.message); },
  });

  const testConnection = trpc.walletManagement.providers.testConnection.useMutation({
    onSuccess: (res) => {
      if (res.success) { toast.success(`Connection OK`); } else { toast.error(`Connection failed: ${res.error}`); }
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2A26]">Wallet Management</h1>
            <p className="text-sm text-[#8D8A87]">Provider configuration, exchange rates, and system monitoring</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchHealth()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#E8E0D8] pb-4">
          {(["providers", "rates", "currencies"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-[#C73E1D] text-white" : "bg-[#F5EDE6] text-[#2D2A26] hover:bg-[#E8E0D8]"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "providers" && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}              {health?.map((h: any) => (
                <Card key={h.provider} className="border-[#E8E0D8]">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${PROVIDER_COLORS[h.provider] || "bg-gray-500"}`}>
                        {PROVIDER_ICONS[h.provider] || <Activity className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-[#2D2A26]">{h.displayName}</p>
                        <p className="text-xs text-[#8D8A87]">{h.provider}</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${h.features?.initiatePayment ? "bg-[#2E7D32]" : "bg-[#D4A854]"}`} />
                        <span className="text-xs text-[#8D8A87]">{h.features?.initiatePayment ? "API" : "SMS"}</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-[#8D8A87]">
                      <p>Currencies: {(h.supportedCurrencies || []).join(", ")}</p>
                      <p>Last txn: {h.lastTransactionDate || "No transactions"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {Object.entries(h.features || {}).filter(([, v]) => v).map(([k]) => (
                        <span key={k} className="rounded bg-[#F5EDE6] px-1.5 py-0.5 text-[10px] text-[#8D8A87]">{k}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!health || health.length === 0) && (
                <p className="col-span-full text-sm text-[#8D8A87]">No providers registered</p>
              )}
            </div>

            <Card className="border-[#E8E0D8]">
              <CardHeader><CardTitle className="text-sm">Available Providers</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                  {providers?.map((p: any) => (
                    <div key={p.code} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] p-3">
                      <div>
                        <p className="text-sm font-medium text-[#2D2A26]">{p.displayName || p.name} ({p.code})</p>
                        <p className="text-xs text-[#8D8A87]">{p.supportedCurrencies} · {p.isActive ? "Active" : "Inactive"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {}} className="text-xs">Configure</Button>
                        <Button size="sm" variant="outline" onClick={() => testConnection.mutate({ provider: p.code, locationId: 0 })} className="gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Test
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!providers || providers.length === 0) && <p className="text-sm text-[#8D8A87]">No providers found</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "rates" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#2D2A26]">Exchange Rates</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => syncRates.mutate()} disabled={syncRates.isPending} className="gap-1 bg-[#C73E1D]">
                  <RefreshCw className="h-4 w-4" /> Sync Rates
                </Button>
                <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">Manual Rate</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Set Exchange Rate</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-[#8D8A87]">From Currency</Label>
                          <select value={rateForm.fromCurrency} onChange={(e) => setRateForm(f => ({ ...f, fromCurrency: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                            {currencies?.map((c: any) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-[#8D8A87]">To Currency</Label>
                          <select value={rateForm.toCurrency} onChange={(e) => setRateForm(f => ({ ...f, toCurrency: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                            {currencies?.map((c: any) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8D8A87]">Exchange Rate</Label>
                        <Input type="number" step="0.000001" value={rateForm.rate} onChange={(e) => setRateForm(f => ({ ...f, rate: e.target.value }))} className="font-mono" />
                        <p className="text-xs text-[#8D8A87]">e.g. 0.00750000 for USD/KES</p>
                      </div>
                      <Button onClick={() => manualUpdateRate.mutate({
                        fromCurrency: rateForm.fromCurrency,
                        toCurrency: rateForm.toCurrency,
                        rate: rateForm.rate,
                      })} disabled={!rateForm.rate} className="w-full bg-[#C73E1D]">
                        Save Rate
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card className="border-[#E8E0D8]">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase text-[#8D8A87]">
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium">Rate</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                    {rates?.map((r: any) => (
                      <tr key={`${r.fromCurrency}-${r.toCurrency}`} className="border-b border-[#E8E0D8] hover:bg-[#F5EDE6]/50">
                        <td className="px-4 py-3 text-sm font-medium text-[#2D2A26]">{r.fromCurrency}</td>
                        <td className="px-4 py-3 text-sm text-[#2D2A26]">{r.toCurrency}</td>
                        <td className="px-4 py-3 font-mono text-sm text-[#C73E1D]">{r.rate}</td>
                        <td className="px-4 py-3 text-xs capitalize text-[#8D8A87]">{r.source || "manual"}</td>
                        <td className="px-4 py-3 text-xs text-[#8D8A87]">{r.validFrom ? new Date(r.validFrom).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))}
                    {(!rates || rates.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#8D8A87]">No exchange rates configured</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "currencies" && (
          <Card className="border-[#E8E0D8]">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase text-[#8D8A87]">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Decimals</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                  {currencies?.map((c: any) => (
                    <tr key={c.code} className="border-b border-[#E8E0D8] hover:bg-[#F5EDE6]/50">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-[#2D2A26]">{c.code}</td>
                      <td className="px-4 py-3 text-sm text-[#2D2A26]">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-[#8D8A87]">{c.symbol}</td>
                      <td className="px-4 py-3 text-sm text-[#8D8A87]">{c.decimalPlaces}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleCurrency.mutate({ code: c.code, isActive: !c.isActive })}
                          disabled={c.isDefault}
                          className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border ${
                            c.isActive
                              ? "border-[#2E7D32] bg-[#2E7D32]/10 text-[#2E7D32]"
                              : "border-[#8D8A87] bg-transparent text-[#8D8A87]"
                          } ${c.isDefault ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                        >
                          {c.isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {c.isActive ? "Active" : "Inactive"}
                        </button>
                        {c.isDefault && <span className="ml-1 text-[10px] text-[#8D8A87]">(default)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
