import { useState } from "react";
import { useNavigate } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Pencil, Trash2, Building2, Wallet, ChevronLeft, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function Locations() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", address: "", phone: "", email: "" });
  const [editForm, setEditForm] = useState({ name: "", slug: "", address: "", phone: "", email: "", isActive: true, defaultMpesaAccountId: "", defaultCashAccountId: "" });

  const navigate = useNavigate();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();

  const utils = trpc.useUtils();
  const createLoc = trpc.locations.create.useMutation({ onSuccess: () => { setOpen(false); setForm({ name: "", slug: "", address: "", phone: "", email: "" }); utils.locations.list.invalidate(); } });
  const updateLoc = trpc.locations.update.useMutation({ onSuccess: () => { setEditOpen(null); utils.locations.list.invalidate(); } });
  const deleteLoc = trpc.locations.delete.useMutation({ onSuccess: () => utils.locations.list.invalidate() });

  const { data: settings } = trpc.settings.list.useQuery();
  const enforceAssigned = settings?.["enforceLocationAssignment"] === "true";
  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => { utils.settings.list.invalidate(); toast.success("Setting updated"); },
    onError: (err) => toast.error(err.message),
  });
  const assignOwnerToAll = trpc.locations.assignOwnerToAll.useMutation({
    onSuccess: (data) => { toast.success(`Owner assigned to all ${data.locationCount} branches`); utils.locations.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLoc.mutate({ name: form.name, slug: form.slug, address: form.address || undefined, phone: form.phone || undefined, email: form.email || undefined });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => navigate("/businesses")} className="mb-1 flex items-center gap-1 text-xs text-[#8D8A87] hover:text-[#C73E1D]">
              <ChevronLeft className="h-3 w-3" />
              Back to Businesses
            </button>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Branches & Locations</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage business branches, HQ, and default wallets</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#C73E1D]"><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader><DialogTitle className="font-serif text-xl">Add New Branch</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Nyali Branch" required /></div>
                  <div className="space-y-2"><Label>Slug *</Label><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="nyali" required /></div>
                </div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Physical address" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="07xx xxx xxx" /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                </div>
                <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createLoc.isPending}>{createLoc.isPending ? "Creating..." : "Add Branch"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#C73E1D]" />
              <div>
                <p className="text-sm font-medium text-[#2D2A26]">Enforce Location Assignment</p>
                <p className="text-xs text-[#8D8A87]">When enabled, users can only record entries for their assigned location</p>
              </div>
            </div>
            <Switch
              checked={enforceAssigned}
              onCheckedChange={(checked) => setSetting.mutate({ key: "enforceLocationAssignment", value: checked ? "true" : "false" })}
              disabled={setSetting.isPending}
            />
          </CardContent>
        </Card>

        <Card className="border-[#2E7D32] bg-white">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[#2E7D32]" />
              <div>
                <p className="text-sm font-medium text-[#2D2A26]">Assign Owner to All Branches</p>
                <p className="text-xs text-[#8D8A87]">Automatically grant the business owner access to every branch location</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#2E7D32] text-[#2E7D32]"
              onClick={() => assignOwnerToAll.mutate({})}
              disabled={assignOwnerToAll.isPending}
            >
              <Shield className="mr-1 h-3 w-3" /> {assignOwnerToAll.isPending ? "Assigning..." : "Assign to All"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {locations?.map(loc => {
            const mpesaAcct = accounts?.find(a => a.id === loc.defaultMpesaAccountId);
            const cashAcct = accounts?.find(a => a.id === loc.defaultCashAccountId);
            const locAccounts = accounts?.filter(a => a.locationId === loc.id && !a.deletedAt) ?? [];
            return (
              <Card key={loc.id} className="border-[#E8E0D8]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 font-serif text-lg">
                      <Building2 className="h-5 w-5 text-[#C73E1D]" />
                      {loc.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Dialog open={editOpen === loc.id} onOpenChange={v => setEditOpen(v ? loc.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => setEditForm({
                            name: loc.name, slug: loc.slug, address: loc.address ?? "", phone: loc.phone ?? "", email: loc.email ?? "",
                            isActive: loc.isActive, defaultMpesaAccountId: loc.defaultMpesaAccountId?.toString() ?? "", defaultCashAccountId: loc.defaultCashAccountId?.toString() ?? ""
                          })}><Pencil className="h-3 w-3" /></Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                          <DialogHeader><DialogTitle className="font-serif text-xl">Edit Branch</DialogTitle></DialogHeader>
                          <form onSubmit={e => { e.preventDefault(); updateLoc.mutate({ id: loc.id, ...editForm, defaultMpesaAccountId: editForm.defaultMpesaAccountId ? +editForm.defaultMpesaAccountId : undefined, defaultCashAccountId: editForm.defaultCashAccountId ? +editForm.defaultCashAccountId : undefined }); }} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required /></div><div className="space-y-2"><Label>Slug</Label><Input value={editForm.slug} onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))} required /></div></div>
                            <div className="space-y-2"><Label>Address</Label><Input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} /></div>
                            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div><div className="space-y-2"><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div></div>
                            <div className="space-y-2"><Label>Default Wallet</Label>
                              <select value={editForm.defaultMpesaAccountId} onChange={e => setEditForm(p => ({ ...p, defaultMpesaAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                                <option value="">Select wallet</option>
                                {locAccounts.filter(a => a.type === "wallet").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2"><Label>Default Cash Account</Label>
                              <select value={editForm.defaultCashAccountId} onChange={e => setEditForm(p => ({ ...p, defaultCashAccountId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                                <option value="">Select cash account</option>
                                {locAccounts.filter(a => a.type === "cash").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-2"><input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" /><Label className="mb-0">Active</Label></div>
                            <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateLoc.isPending}>Save Changes</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete branch "${loc.name}"?`)) deleteLoc.mutate({ id: loc.id }); }}>
                        <Trash2 className="h-3 w-3 text-[#D32F2F]" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loc.address && <p className="text-sm text-[#8D8A87]"><MapPin className="mr-1 inline h-3 w-3" />{loc.address}</p>}
                  {loc.phone && <p className="text-sm text-[#8D8A87]">{loc.phone}</p>}
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Default Accounts</p>
                    <div className="flex gap-2">
                      {mpesaAcct ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#C73E1D]/10 px-2 py-1 text-xs text-[#C73E1D]"><Wallet className="h-3 w-3" />{mpesaAcct.name}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#8D8A87]"><Wallet className="h-3 w-3" />No wallet</span>
                      )}
                      {cashAcct ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#2E7D32]/10 px-2 py-1 text-xs text-[#2E7D32]"><Wallet className="h-3 w-3" />{cashAcct.name}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#8D8A87]"><Wallet className="h-3 w-3" />No cash account</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Accounts ({locAccounts.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {locAccounts.map(a => (
                        <span key={a.id} className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.type === "wallet" ? "bg-[#C73E1D]/10 text-[#C73E1D]" : a.type === "cash" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D4A854]/10 text-[#D4A854]"}`}>
                          {a.name} · {a.currentBalance}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!locations || locations.length === 0) && (
            <div className="col-span-full rounded-xl border border-[#E8E0D8] bg-white p-12 text-center text-sm text-[#8D8A87]">
              <Building2 className="mx-auto mb-3 h-12 w-12 opacity-20" />
              <p>No branches yet. Add your first location.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
