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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Trash2, CheckCircle, RotateCcw, MapPin, Edit3, Save, X, Key, AlertTriangle, Shield, Database, Clock, DollarSign } from "lucide-react";
import { AllocationManagement } from "@/components/partner/AllocationManagement";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "KES", name: "Kenyan Shilling" },
  { code: "USD", name: "US Dollar" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "ZAR", name: "South African Rand" },
  { code: "MWK", name: "Malawian Kwacha" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "RWF", name: "Rwandan Franc" },
];

function DefaultCurrencySelect({ businessId }: { businessId: number }) {
  const { data: currentCurrency } = trpc.settings.get.useQuery({ key: "defaultCurrency", businessId }, { initialData: "KES" });
  const setCurrency = trpc.settings.set.useMutation({
    onSuccess: () => toast.success("Default currency updated"),
  });
  return (
    <select
      value={currentCurrency || "KES"}
      onChange={(e) => setCurrency.mutate({ key: "defaultCurrency", value: e.target.value, businessId })}
      className="w-full bg-transparent text-sm text-[#2D2A26] outline-none"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
      ))}
    </select>
  );
}

export function Businesses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const permContext = user?.permissions?.length ? user.permissions : (user?.role ?? "viewer");
  const canManage = hasPermission(permContext, PERMISSIONS.BUSINESS_MANAGE);
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<"businesses" | "allocations">("businesses");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", address: "", phone: "", email: "", plan: "basic", isMultiLocation: true });
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetAcknowledged, setResetAcknowledged] = useState(false);
  const [resetStep, setResetStep] = useState<"review" | "confirm">("review");

  const { data: businesses, refetch: refetchBusinesses } = trpc.businesses.list.useQuery();
  const { data: resetInfo, refetch: refetchResetInfo } = trpc.dashboard.resetValidation.useQuery(undefined, {
    enabled: resetDialogOpen,
  });
  const createBiz = trpc.businesses.create.useMutation({
    onSuccess: async () => {
      setOpen(false); setForm({ name: "", slug: "", address: "", phone: "", email: "", plan: "basic", isMultiLocation: true });
      await utils.businesses.list.invalidate();
      await refetchBusinesses();
      toast.success("Business created");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateBiz = trpc.businesses.update.useMutation({
    onSuccess: () => { setEditId(null); utils.businesses.list.invalidate(); toast.success("Business updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteBiz = trpc.businesses.delete.useMutation({
    onSuccess: () => { refetchBusinesses(); toast.success("Business deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const switchBiz = trpc.businesses.switch.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const resetAll = trpc.dashboard.resetAllTransactions.useMutation({
    onSuccess: (data) => {
      setResetDialogOpen(false);
      setResetConfirmText("");

      const summary = data.summary;
      const details: string[] = [];
      if (summary) {
        details.push(`${summary.totalRecordsCleared} total records cleared`);
        details.push(`${summary.tablesAffected.length} tables affected`);
        details.push(`${summary.preservedTables.length} preserved table types untouched`);
      }

      toast.success(
        <div className="space-y-1">
          <p className="font-semibold">Reset complete</p>
          {details.map((d, i) => <p key={i} className="text-sm opacity-80">{d}</p>)}
        </div>,
        { duration: 8000 },
      );
      utils.invalidate();
    },
    onError: (err) => {
      toast.error(`Reset failed: ${err.message}`);
    },
  });

  const startEdit = (b: { id: number; name?: string | null; address?: string | null; phone?: string | null; email?: string | null }) => {
    setEditId(b.id);
    setEditForm({
      name: b.name || "", address: b.address || "", phone: b.phone || "", email: b.email || "",
    });
  };

  const saveEdit = (id: number) => {
    updateBiz.mutate({ id, ...editForm });
  };

  const openResetDialog = () => {
    setResetDialogOpen(true);
    setResetConfirmText("");
    setResetAcknowledged(false);
    setResetStep("review");
    refetchResetInfo();
  };

  const executeReset = () => {
    if (resetConfirmText !== "RESET") {
      toast.error("Please type 'RESET' to confirm");
      return;
    }
    if (!resetAcknowledged) {
      toast.error("Please acknowledge the consequences of reset");
      return;
    }
    resetAll.mutate();
  };

  // Format table keys for display
  const formatTableKey = (key: string): string => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Businesses &amp; Partners</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage your business workspaces and partner allocations</p>
          </div>
          {canManage && tab === "businesses" && (
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
                  <Button onClick={() => createBiz.mutate(form)} disabled={!form.name || !form.slug || createBiz.isPending} className="w-full bg-[#2E7D32]">
                    {createBiz.isPending ? "Creating..." : "Create Business"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("businesses")} className={`px-4 py-2 text-sm font-medium ${tab === "businesses" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Building2 className="mr-1 inline h-4 w-4"/>Businesses
          </button>
          <button onClick={() => setTab("allocations")} className={`px-4 py-2 text-sm font-medium ${tab === "allocations" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Key className="mr-1 inline h-4 w-4"/>Partner Allocations
          </button>
        </div>

        {tab === "businesses" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                    <p className="text-xs text-[#8D8A87]">{b.slug} · {(b as { plan?: string }).plan || "free"}</p>
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
                        <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D8] px-3 py-2">
                          <DollarSign className="h-4 w-4 text-[#8D8A87]" />
                          <DefaultCurrencySelect businessId={b.id} />
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
                          <span>{(b as { branchCount?: number }).branchCount ?? 0} branch{(b as { branchCount?: number }).branchCount !== 1 ? "es" : ""}</span>
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
                          <Button size="sm" variant="outline" onClick={() => navigate(`/businesses/${b.id}`)}>
                            <Building2 className="mr-1 h-3 w-3" /> Overview
                          </Button>
                          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[#D32F2F] text-[#D32F2F] hover:bg-[#D32F2F]/5"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openResetDialog();
                                }}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />Reset
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl bg-white max-h-[85vh]">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#D32F2F]">
                                  <AlertTriangle className="h-6 w-6" />
                                  Reset All Transactions
                                </DialogTitle>
                                <DialogDescription className="text-[#8D8A87]">
                                  This action permanently removes all transactional data for your active business.
                                  It cannot be undone.
                                </DialogDescription>
                              </DialogHeader>

                              <ScrollArea className="max-h-[60vh] pr-4">
                                {resetInfo ? (
                                  <div className="space-y-4">
                                    {/* Pre-reset summary */}
                                    <Alert variant="destructive" className="border-[#D32F2F] bg-[#D32F2F]/5">
                                      <Database className="h-4 w-4" />
                                      <AlertTitle>Records to be cleared: {resetInfo.totalRecords}</AlertTitle>
                                      <AlertDescription>
                                        {resetInfo.validation.locationCount} location(s) affected.
                                        {resetInfo.validation.warnings.length > 0 && (
                                          <span className="block mt-1 text-xs">
                                            Warning: {resetInfo.validation.warnings.join(", ")}
                                          </span>
                                        )}
                                      </AlertDescription>
                                    </Alert>

                                    {/* Tables to be reset */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-[#2D2A26] mb-2 flex items-center gap-1">
                                        <RotateCcw className="h-4 w-4 text-[#D32F2F]" />
                                        Records that will be cleared
                                      </h4>
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(resetInfo.snapshot.tableCounts)
                                          .filter(([_key, count]) => count > 0)
                                          .sort(([, a], [, b]) => b - a)
                                          .map(([table, count]) => (
                                            <div key={table} className="flex items-center justify-between rounded-lg border border-[#E8E0D8] px-3 py-2">
                                              <span className="text-xs text-[#2D2A26]">{formatTableKey(table)}</span>
                                              <Badge variant="destructive" className="text-[10px]">{count}</Badge>
                                            </div>
                                          ))}
                                        {Object.entries(resetInfo.snapshot.tableCounts).filter(([_key, count]) => count > 0).length === 0 && (
                                          <p className="col-span-2 text-sm text-[#8D8A87]">No records found to reset.</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Preserved tables */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-[#2D2A26] mb-2 flex items-center gap-1">
                                        <Shield className="h-4 w-4 text-[#2E7D32]" />
                                        Records that will be preserved
                                      </h4>
                                      <div className="flex flex-wrap gap-1">
                                        {[
                                          "Business profile & settings",
                                          "User accounts & permissions",
                                          "Locations & branches",
                                          "Suppliers & their info",
                                          "Employees & their info",
                                          "Expense categories",
                                          "System accounts (Cash, Bank, M-PESA)",
                                          "Chart of Accounts",
                                          "Payment methods",
                                          "Documents & logos",
                                          "API keys & webhooks",
                                          "Partner allocations",
                                          "Audit log (regulatory)",
                                        ].map((item) => (
                                          <Badge key={item} variant="outline" className="bg-[#2E7D32]/5 text-[#2E7D32] border-[#2E7D32]/20 text-[10px]">
                                            <CheckCircle className="mr-1 h-3 w-3" />
                                            {item}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Confirmation section */}
                                    {resetStep === "review" ? (
                                      <div className="rounded-lg border border-[#C73E1D]/30 bg-[#C73E1D]/5 p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-[#C73E1D]">
                                          <AlertTriangle className="h-5 w-5" />
                                          <span className="text-sm font-semibold">Step 1 of 2: Review Complete</span>
                                        </div>
                                        <p className="text-xs text-[#8D8A87]">
                                          Review the records above carefully. All transactional data will be permanently removed.
                                          System configuration, accounts, and reference data will be preserved.
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                              setResetDialogOpen(false);
                                              setResetConfirmText("");
                                              setResetAcknowledged(false);
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            variant="outline"
                                            className="flex-1 border-[#C73E1D] text-[#C73E1D] hover:bg-[#C73E1D]/5"
                                            onClick={() => setResetStep("confirm")}
                                          >
                                            Continue to Confirmation
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Level 1: Type RESET */}
                                        <div className="rounded-lg border border-[#D32F2F]/30 bg-[#D32F2F]/5 p-4 space-y-3">
                                          <Label className="text-sm font-semibold text-[#D32F2F] flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            Step 2 of 2: Final Confirmation
                                          </Label>
                                          <p className="text-xs text-[#8D8A87]">
                                            This action <strong>cannot be undone</strong>. All transactions, bills, expenses,
                                            sales, debts, payroll records, and ledger entries will be permanently deleted.
                                          </p>
                                          <p className="text-xs text-[#8D8A87]">
                                            The following <strong>will be preserved</strong>: business settings, user accounts,
                                            locations, suppliers, employees, expense categories, system accounts,
                                            Chart of Accounts, payment methods, documents, API keys, partner allocations, and audit logs.
                                          </p>
                                          <div>
                                            <Label className="text-sm font-semibold text-[#D32F2F] flex items-center gap-1">
                                              Type <span className="font-mono bg-[#D32F2F]/10 px-1.5 py-0.5 rounded text-sm">RESET</span> to confirm
                                            </Label>
                                            <Input
                                              value={resetConfirmText}
                                              onChange={(e) => setResetConfirmText(e.target.value)}
                                              placeholder='Type "RESET" to confirm'
                                              className="mt-2 border-[#D32F2F]/50 focus:border-[#D32F2F]"
                                              autoFocus
                                            />
                                          </div>
                                          {/* Level 2: Acknowledge consequences */}
                                          <div className="flex items-start gap-2 rounded-lg border border-[#D32F2F]/20 bg-white p-3">
                                            <input
                                              type="checkbox"
                                              id="reset-acknowledge"
                                              checked={resetAcknowledged}
                                              onChange={(e) => setResetAcknowledged(e.target.checked)}
                                              className="mt-0.5 h-4 w-4 accent-[#D32F2F]"
                                            />
                                            <label htmlFor="reset-acknowledge" className="text-xs text-[#2D2A26] leading-relaxed">
                                              I acknowledge that this will permanently delete all transactional data including
                                              invoices, expenses, sales records, bank transactions, debts, and payroll entries.
                                              Account balances and opening balances will be reset to zero.
                                              This action cannot be reversed.
                                            </label>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E0D8]">
                                           <Button
                                             variant="outline"
                                             onClick={() => {
                                               setResetDialogOpen(false);
                                               setResetConfirmText("");
                                               setResetAcknowledged(false);
                                             }}
                                           >
                                             Cancel
                                           </Button>
                                           <Button
                                             variant="outline"
                                             onClick={() => setResetStep("review")}
                                           >
                                             Back to Review
                                           </Button>
                                          <Button
                                            className="bg-[#D32F2F] hover:bg-[#B71C1C] text-white"
                                            onClick={executeReset}
                                            disabled={resetConfirmText !== "RESET" || !resetAcknowledged || resetAll.isPending || !resetInfo?.hasRecordsToReset}
                                          >
                                            {resetAll.isPending ? (
                                              <>
                                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                                Resetting...
                                              </>
                                            ) : (
                                              <>
                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                Execute Reset
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="text-center text-[#8D8A87]">
                                      <Clock className="mx-auto h-8 w-8 mb-2 animate-spin" />
                                      <p className="text-sm">Analyzing current data...</p>
                                    </div>
                                  </div>
                                )}
                              </ScrollArea>

                            </DialogContent>
                          </Dialog>
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
        )}

        {tab === "allocations" && <AllocationManagement />}
      </div>
    </Layout>
  );
}

export default Businesses;
