import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Key, Trash2, Plus, Copy, CheckCircle, Webhook, Send, Clock, AlertCircle } from "lucide-react";

export function Integrations() {
  const [keyOpen, setKeyOpen] = useState(false);
  const [hookOpen, setHookOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", scopes: ["read"] as string[] });
  const [hookForm, setHookForm] = useState({ name: "", url: "", events: ["bill.overdue"] as string[], secret: "" });
  const [selectedHook, setSelectedHook] = useState<number | null>(null);

  const { data: keys, refetch: refetchKeys } = trpc.integrations.listKeys.useQuery();
  const { data: hooks, refetch: refetchHooks } = trpc.integrations.listWebhooks.useQuery();
  const { data: deliveries } = trpc.integrations.listDeliveries.useQuery(
    { webhookId: selectedHook ?? 0, limit: 50 },
    { enabled: selectedHook !== null }
  );

  const createKey = trpc.integrations.createKey.useMutation({
    onSuccess: (data) => { setNewKey(data.key); setKeyOpen(false); setKeyForm({ name: "", scopes: ["read"] }); refetchKeys(); toast.success("API key created — copy it now!"); },
    onError: (err) => toast.error(err.message),
  });
  const revokeKey = trpc.integrations.revokeKey.useMutation({ onSuccess: () => { refetchKeys(); toast.success("Key revoked"); } });
  const deleteKey = trpc.integrations.deleteKey.useMutation({ onSuccess: () => { refetchKeys(); toast.success("Key deleted"); } });

  const createHook = trpc.integrations.createWebhook.useMutation({
    onSuccess: () => { setHookOpen(false); setHookForm({ name: "", url: "", events: ["bill.overdue"], secret: "" }); refetchHooks(); toast.success("Webhook created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateHook = trpc.integrations.updateWebhook.useMutation({ onSuccess: () => refetchHooks() });
  const deleteHook = trpc.integrations.deleteWebhook.useMutation({ onSuccess: () => { refetchHooks(); toast.success("Webhook deleted"); } });

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Integrations</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">API Keys, Webhooks, and external connections</p>
          </div>
        </div>

        {/* API Keys */}
        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg flex items-center gap-2"><Key className="h-5 w-5 text-[#D4A854]"/> API Keys</CardTitle>
          <Dialog open={keyOpen} onOpenChange={setKeyOpen}><DialogTrigger asChild><Button size="sm" className="bg-[#C73E1D]"><Plus className="mr-1 h-3 w-3" />New Key</Button></DialogTrigger>
            <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Create API Key</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createKey.mutate(keyForm); }} className="space-y-3">
                <div><Label>Name</Label><Input value={keyForm.name} onChange={e => setKeyForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. POS Integration" required /></div>
                <div><Label>Scopes</Label>
                  <div className="flex flex-wrap gap-2">
                    {["read", "write", "sales", "expenses", "webhooks"].map(s => (
                      <label key={s} className="flex items-center gap-1 rounded-full border border-[#E8E0D8] px-3 py-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={keyForm.scopes.includes(s)} onChange={e => {
                          setKeyForm(p => ({ ...p, scopes: e.target.checked ? [...p.scopes, s] : p.scopes.filter(x => x !== s) }));
                        }} /> {s}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createKey.isPending}>Generate Key</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
          <CardContent>
            {newKey && (
              <div className="mb-4 rounded-lg bg-[#F5EDE6] p-3">
                <p className="text-xs text-[#8D8A87]">Your API key (copy now — shown once):</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-2 py-1 text-xs font-mono text-[#2D2A26]">{newKey}</code>
                  <Button size="sm" variant="ghost" onClick={copyKey}>{copied ? <CheckCircle className="h-4 w-4 text-[#2E7D32]" /> : <Copy className="h-4 w-4" />}</Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {keys?.map(k => (
                <div key={k.id} className={`flex items-center justify-between rounded-lg border p-3 ${k.isActive ? "border-[#E8E0D8]" : "border-[#8D8A87]/30 opacity-50"}`}>
                  <div><p className="text-sm font-medium">{k.name}</p><p className="text-xs text-[#8D8A87]">{k.keyPrefix}*** • {k.scopes ? JSON.parse(JSON.stringify(k.scopes)).join(", ") : "read"}</p></div>
                  <div className="flex gap-1">
                    {k.isActive && <Button size="sm" variant="ghost" onClick={() => revokeKey.mutate({ id: k.id })}><AlertCircle className="h-4 w-4 text-[#ED6C02]" /></Button>}
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this key?")) deleteKey.mutate({ id: k.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                  </div>
                </div>
              ))}
              {(!keys || keys.length === 0) && <p className="text-sm text-[#8D8A87]">No API keys yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="border-[#E8E0D8]"><CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-lg flex items-center gap-2"><Webhook className="h-5 w-5 text-[#8D8A87]"/> Webhooks</CardTitle>
          <Dialog open={hookOpen} onOpenChange={setHookOpen}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" />Add Webhook</Button></DialogTrigger>
            <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Add Webhook</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createHook.mutate({ name: hookForm.name, url: hookForm.url, events: hookForm.events as any, secret: hookForm.secret || undefined }); }} className="space-y-3">
                <div><Label>Name</Label><Input value={hookForm.name} onChange={e => setHookForm(p => ({ ...p, name: e.target.value }))} required /></div>
                <div><Label>URL</Label><Input value={hookForm.url} onChange={e => setHookForm(p => ({ ...p, url: e.target.value }))} placeholder="https://hooks.slack.com/..." required /></div>
                <div><Label>Events</Label>
                  <div className="flex flex-wrap gap-2">
                    {["bill.overdue", "bill.paid", "sale.recorded", "expense.created", "payroll.processed", "low.balance"].map(ev => (
                      <label key={ev} className="flex items-center gap-1 rounded-full border border-[#E8E0D8] px-3 py-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={hookForm.events.includes(ev)} onChange={e => {
                          setHookForm(p => ({ ...p, events: e.target.checked ? [...p.events, ev] : p.events.filter(x => x !== ev) }));
                        }} /> {ev}
                      </label>
                    ))}
                  </div>
                </div>
                <div><Label>Secret (optional)</Label><Input value={hookForm.secret} onChange={e => setHookForm(p => ({ ...p, secret: e.target.value }))} placeholder="For HMAC signature" /></div>
                <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createHook.isPending}>Save Webhook</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hooks?.map(h => (
                <div key={h.id} className={`rounded-lg border p-3 ${h.isActive ? "border-[#E8E0D8]" : "border-[#8D8A87]/30 opacity-50"}`}>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-[#8D8A87]">{h.url}</p></div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedHook(h.id === selectedHook ? null : h.id)}><Clock className="h-4 w-4 text-[#8D8A87]" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => updateHook.mutate({ id: h.id, isActive: !h.isActive })}>{h.isActive ? "Pause" : "Enable"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteHook.mutate({ id: h.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(h.events as string[]).map(e => <span key={e} className="rounded bg-[#F5EDE6] px-1.5 py-0.5 text-[10px] text-[#8D8A87]">{e}</span>)}
                  </div>
                  {selectedHook === h.id && deliveries && (
                    <div className="mt-2 rounded bg-[#F5EDE6] p-2">
                      <p className="text-xs font-medium text-[#8D8A87]">Recent Deliveries</p>
                      {deliveries.map(d => (
                        <div key={d.id} className="mt-1 flex items-center gap-2 text-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${d.status === "success" ? "bg-[#2E7D32]" : "bg-[#D32F2F]"}`} />
                          <span>{d.event}</span>
                          <span className="text-[#8D8A87]">{d.statusCode ?? "-"}</span>
                        </div>
                      ))}
                      {deliveries.length === 0 && <p className="text-xs text-[#8D8A87]">No deliveries yet</p>}
                    </div>
                  )}
                </div>
              ))}
              {(!hooks || hooks.length === 0) && <p className="text-sm text-[#8D8A87]">No webhooks configured.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
