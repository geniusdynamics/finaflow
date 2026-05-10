import { useState } from "react";
import { useNavigate } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Building, Trash2, Users, CheckCircle, RotateCcw, MapPin, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";

export function Businesses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.BUSINESS_MANAGE);
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", address: "", phone: "", email: "", plan: "basic", isMultiLocation: true });
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: businesses } = trpc.businesses.list.useQuery();
  const createBiz = trpc.businesses.create.useMutation({
    onSuccess: () => {
      setOpen(false); setForm({ name: "", slug: "", address: "", phone: "", email: "", plan: "basic", isMultiLocation: true });
      utils.businesses.list.invalidate(); toast.success("Business created");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateBiz = trpc.businesses.update.useMutation({
    onSuccess: () => { setEditId(null); utils.businesses.list.invalidate(); toast.success("Business updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteBiz = trpc.businesses.delete.useMutation({
    onSuccess: () => { utils.businesses.list.invalidate(); toast.success("Business deleted"); },
  });
  const switchBiz = trpc.businesses.switch.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const resetAll = trpc.dashboard.resetAllTransactions.useMutation({
    onSuccess: (data) => { toast.success(data.message); utils.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = (b: any) => {
    setEditId(b.id);
    setEditForm({
      name: b.name || "", address: b.address || "", phone: b.phone || "", email: b.email || "",
    });
  };

  const saveEdit = (id: number) => {
    updateBiz.mutate({ id, ...editForm } as any);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Businesses</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage your business workspaces</p>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D]"><Plus className="mr-1 h-4 w-4" />New Business</Button>
              </DialogTrigger>
              <DialogContent className="bg-white">
                <DialogHeader><DialogTitle className="font-serif text-xl">Create Business</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>Slug (unique ID)</Label><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} /></div>
                  <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={form.isMultiLocation} onChange={e => setForm(p => ({ ...p, isMultiLocation: e.target.checked }))} />
                    <Label className="text-sm">Multi-location support</Label>
                  </div>
                  <Button onClick={() => createBiz.mutate(form as any)} disabled={!form.name || !form.slug || createBiz.isPending} className="w-full bg-[#2E7D32]">
                    {createBiz.isPending ? "Creating..." : "Create Business"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses?.map(b => {
            const isEditing = editId === b.id;
            const isActive = b.id === user?.currentBusinessId;
            return (
              <Card key={b.id} className={`border-[#E8E0D8] ${isActive ? "ring-2 ring-[#C73E1D]" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 font-serif text-lg">
                      <Building2 className="h-5 w-5 text-[#C73E1D]" />
                      {b.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {isActive && <span className="rounded-full bg-[#C73E1D]/10 px-2 py-0.5 text-xs text-[#C73E1D]">Active</span>}
                      {canManage && (
                        isEditing
                          ? <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                          : <Button size="sm" variant="ghost" onClick={() => startEdit(b)}><Edit3 className="h-4 w-4 text-[#8D8A87]" /></Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#8D8A87]">{b.slug} · {(b as any).plan || "free"}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="text-sm" />
                      <Input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} placeholder="Address" className="text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="text-sm" />
                        <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="text-sm" />
                      </div>
                      <Button size="sm" className="w-full bg-[#2E7D32]" onClick={() => saveEdit(b.id)} disabled={updateBiz.isPending}>
                        <Save className="mr-1 h-3 w-3" /> {updateBiz.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {b.address && <p className="text-sm text-[#2D2A26]">{b.address}</p>}
                      <div className="flex gap-2 text-xs text-[#8D8A87]">
                        {b.phone && <span>{b.phone}</span>}
                        {b.email && <span>{b.email}</span>}
                      </div>
                      {/* Branch count display */}
                      <div className="flex items-center gap-1.5 text-xs text-[#8D8A87]">
                        <MapPin className="h-3 w-3" />
                        <span>{(b as any).branchCount ?? 0} branch{(b as any).branchCount !== 1 ? "es" : ""}</span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-2 pt-2 flex-wrap">
                    {!isActive && (
                      <Button size="sm" variant="outline" onClick={() => switchBiz.mutate({ businessId: b.id })} disabled={switchBiz.isPending}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Switch
                      </Button>
                    )}
                    {isActive && user?.role === "owner" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/businesses/${b.id}/details`)}>
                          <Building className="mr-1 h-3 w-3" /> Details
                        </Button>
                        <Button
                        size="sm"
                        variant="outline"
                        className="border-[#D32F2F] text-[#D32F2F] hover:bg-[#D32F2F]/5"
                        onClick={() => {
                          if (confirm("⚠️ RESET ALL TRANSACTIONS\n\nThis will permanently delete ALL transactions in this business:\n• Sales records\n• Expenses\n• Bills & payments\n• M-PESA transactions\n• Payroll records\n• Ledger entries\n\nSetup data (branches, accounts, categories, suppliers, employees, users) will be preserved.\n\nThis action CANNOT be undone.\n\nAre you sure?")) {
                            const confirmText = prompt("Type 'RESET' to confirm deletion of all transactions in this business:");
                            if (confirmText === "RESET") resetAll.mutate();
                            else toast.info("Reset cancelled.");
                          }
                        }}
                        disabled={resetAll.isPending}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />{resetAll.isPending ? "Resetting..." : "Reset All"}
                      </Button>
                      </>)}
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this business?")) deleteBiz.mutate({ id: b.id }); }}>
                        <Trash2 className="h-4 w-4 text-[#D32F2F]" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!businesses || businesses.length === 0) && (
            <p className="col-span-full text-center text-sm text-[#8D8A87]">No businesses yet.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default Businesses;
