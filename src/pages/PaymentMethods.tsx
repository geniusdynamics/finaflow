import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Tag, CheckCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";

export function PaymentMethods() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.SETTINGS_MANAGE);
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", color: "#C73E1D", sortOrder: "0" });

  const { data: methods, refetch } = trpc.paymentMethods.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: locations } = trpc.locations.list.useQuery();

  const createM = trpc.paymentMethods.create.useMutation({
    onSuccess: () => { setOpen(false); setForm({ name: "", code: "", color: "#C73E1D", sortOrder: "0" }); refetch(); toast.success("Payment method added"); },
    onError: (err) => toast.error(err.message),
  });
  const updateM = trpc.paymentMethods.update.useMutation({
    onSuccess: () => { setEditId(null); refetch(); toast.success("Updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteM = trpc.paymentMethods.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Deleted"); },
  });
  const assignToLoc = trpc.paymentMethods.assignToLocation.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Assigned"); },
  });
  const updateLocLink = trpc.paymentMethods.updateLocationLink.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Account link updated"); },
  });
  const removeFromLoc = trpc.paymentMethods.removeFromLocation.useMutation({
    onSuccess: () => { utils.paymentMethods.byLocation.invalidate(); toast.success("Removed"); },
  });

  const [tagLocId, setTagLocId] = useState<string>("");
  const { data: locMethods } = trpc.paymentMethods.byLocation.useQuery(
    { locationId: +tagLocId },
    { enabled: !!tagLocId }
  );

  // Track account selections for methods being added
  const [assignAccountMap, setAssignAccountMap] = useState<Record<number, string>>({});

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Payment Methods</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Configure how customers pay. Account linking happens at the branch level.</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Dialog open={tagOpen} onOpenChange={setTagOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Tag className="mr-1 h-4 w-4" /> Tag to Branches</Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Assign Payment Methods to Branches</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Select Branch</Label>
                      <select value={tagLocId} onChange={e => setTagLocId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="">Select branch</option>
                        {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    {tagLocId && methods && methods.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-[#8D8A87]">Toggle methods ON for this branch, then pick the account to credit when sales are recorded.</p>
                        {methods.filter(m => !m.deletedAt).map(m => {
                          const isActive = locMethods?.some(lm => lm.id === m.id);
                          const activeJunction = locMethods?.find(lm => lm.id === m.id);
                          const currentAcctId = activeJunction?.linkedAccountId;
                          const currentAcctName = activeJunction?.linkedAccountName;
                          return (
                            <div key={m.id} className="rounded-lg border border-[#E8E0D8] p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: m.color ?? "#C73E1D" }} />
                                  <span className="text-sm font-medium">{m.name}</span>
                                  <span className="text-xs text-[#8D8A87]">({m.code})</span>
                                </div>
                                {isActive ? (
                                  <Button size="sm" variant="ghost" onClick={() => removeFromLoc.mutate({ locationId: +tagLocId, paymentMethodId: m.id })}>
                                    <CheckCircle className="h-4 w-4 text-[#2E7D32]" />
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => {
                                    const acctId = assignAccountMap[m.id] ? +assignAccountMap[m.id] : undefined;
                                    assignToLoc.mutate({ locationId: +tagLocId, paymentMethodId: m.id, linkedAccountId: acctId });
                                  }}>
                                    Add
                                  </Button>
                                )}
                              </div>
                              {/* Account selector — shown when adding or when already active */}
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-3 w-3 text-[#8D8A87]" />
                                  <select
                                    value={isActive ? (currentAcctId ?? "") : (assignAccountMap[m.id] ?? "")}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (isActive) {
                                        // Update existing assignment
                                        updateLocLink.mutate({
                                          locationId: +tagLocId,
                                          paymentMethodId: m.id,
                                          linkedAccountId: val ? +val : undefined,
                                        });
                                      } else {
                                        // Just store in local state for when we click Add
                                        setAssignAccountMap(p => ({ ...p, [m.id]: val }));
                                      }
                                    }}
                                    className="flex-1 rounded border border-[#E8E0D8] px-2 py-1 text-xs"
                                  >
                                    <option value="">Link to account (optional)</option>
                                    {accounts?.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}
                                  </select>
                                </div>
                                {isActive && currentAcctName && (
                                  <p className="mt-1 text-[10px] text-[#2E7D32]">Linked to: {currentAcctName}</p>
                                )}
                                {!isActive && !assignAccountMap[m.id] && (
                                  <p className="mt-1 text-[10px] text-[#D4A854]">Select an account before adding — sales will auto-ledger to this account</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#C73E1D]"><Plus className="mr-1 h-4 w-4" /> Add Method</Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Add Payment Method</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); createM.mutate({ name: form.name, code: form.code, color: form.color, sortOrder: +form.sortOrder }); }} className="space-y-3">
                    <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Visa Card" required /></div>
                    <div><Label>Code (unique ID)</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="e.g. visa_card" required /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Color</Label><div className="flex items-center gap-2"><input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="h-10 w-10 rounded border p-0.5" /><span className="text-xs text-[#8D8A87]">{form.color}</span></div></div>
                      <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: e.target.value }))} /></div>
                    </div>
                    <Button type="submit" className="w-full bg-[#2E7D32]" disabled={createM.isPending}>{createM.isPending ? "Adding..." : "Add Payment Method"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {methods?.filter(m => !m.deletedAt).map(m => {
            const isEditing = editId === m.id;
            return (
              <Card key={m.id} className="border-[#E8E0D8]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: m.color ?? "#C73E1D" }} />
                      <CardTitle className="font-serif text-base">{m.name}</CardTitle>
                    </div>
                    {m.isActive ? <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">Active</span> : <span className="rounded-full bg-[#8D8A87]/10 px-2 py-0.5 text-xs text-[#8D8A87]">Inactive</span>}
                  </div>
                  <p className="text-xs text-[#8D8A87]">Code: {m.code} · Order: {m.sortOrder}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-[#8D8A87]">Account linking happens at the branch level. Open "Tag to Branches" to assign.</p>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input defaultValue={m.name} onChange={e => updateM.mutate({ id: m.id, name: e.target.value })} className="text-sm" />
                      <div className="flex gap-2">
                        <input type="color" defaultValue={m.color ?? "#C73E1D"} onChange={e => updateM.mutate({ id: m.id, color: e.target.value })} className="h-8 w-10 rounded border p-0.5" />
                        <Button size="sm" onClick={() => setEditId(null)}>Done</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {canManage && <Button size="sm" variant="ghost" onClick={() => setEditId(m.id)}><Pencil className="h-3 w-3" /></Button>}
                      {canManage && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteM.mutate({ id: m.id }); }}><Trash2 className="h-3 w-3 text-[#D32F2F]" /></Button>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {(!methods || methods.filter(m => !m.deletedAt).length === 0) && (
            <p className="col-span-full text-center text-sm text-[#8D8A87]">No payment methods yet. Add your first to start recording sales.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
