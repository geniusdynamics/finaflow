import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, AlertTriangle, Plus, Trash2, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export function SupplierPrices() {
  const [searchItem, setSearchItem] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ itemName: "", expectedPrice: "", variancePercent: "10", supplierId: "" });

  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: items } = trpc.supplierPrices.allItems.useQuery(selectedSupplier ? { supplierId: +selectedSupplier } : undefined);
  const { data: history } = trpc.supplierPrices.history.useQuery(
    searchItem ? { itemName: searchItem, limit: 50 } : undefined,
    { enabled: searchItem.length > 0 }
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
  const utils = trpc.useUtils();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Supplier Price Intelligence</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track price trends, detect changes, set alerts</p>
          </div>
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
        </div>

        {/* Price Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-[#D32F2F] flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Price Alerts ({alerts.length})</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert, i) => (
                <Card key={i} className="border-[#D32F2F]/20 bg-[#D32F2F]/5"><CardContent className="p-3">
                  <p className="text-sm font-medium text-[#2D2A26]">{alert.itemName}</p>
                  <p className="text-xs text-[#8D8A87]">{alert.message}</p>
                </CardContent></Card>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="border-[#E8E0D8]"><CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-60"><Label className="text-xs text-[#8D8A87]">Search Item</Label>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8D8A87]"/><Input value={searchItem} onChange={e => setSearchItem(e.target.value)} placeholder="Search for an item..." className="pl-10" /></div>
            </div>
            <div><Label className="text-xs text-[#8D8A87]">Supplier</Label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-48 rounded border px-3 py-2 text-sm">
                <option value="">All Suppliers</option>{suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </CardContent></Card>

        {/* Price Items Grid */}
        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="font-serif text-lg">Tracked Items</CardTitle></CardHeader>
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

        {/* Alert Rules */}
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

        {/* Price History Detail */}
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
      </div>
    </Layout>
  );
}
