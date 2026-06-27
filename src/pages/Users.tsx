import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, KeyRound, Users as UsersIcon, ShieldCheck, Save, RotateCcw, Building2, RefreshCw, History, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

const PERMISSION_LABELS: Record<string, string> = {
  "sales:view": "Sales View",
  "sales:create": "Sales Create",
  "expenses:view": "Expenses View",
  "expenses:create": "Expenses Create",
  "expenses:manage": "Expenses Manage",
  "bills:view": "Bills View",
  "bills:create": "Bills Create",
  "bills:pay": "Bills Pay",
  "suppliers:view": "Suppliers View",
  "suppliers:manage": "Suppliers Manage",
  "supplier_prices:view": "Supplier Prices View",
  "accounts:view": "Accounts View",
  "accounts:manage": "Accounts Manage",
  "payroll:view": "Payroll View",
  "payroll:process": "Payroll Process",
  "mpesa:view": "M-PESA View",
  "mpesa:import": "M-PESA Import",
  "reports:view": "Reports View",
  "users:manage": "Users Manage",
  "settings:manage": "Settings Manage",
  "feedback:manage": "Feedback Manage",
  "business:manage": "Business Manage",
  "inquiry:view": "Inquiry View",
  "api_keys:manage": "API Keys Manage",
  "webhooks:manage": "Webhooks Manage",
  "partner:view": "Partner View",
  "po:view": "Purchase Orders View",
  "po:manage": "Purchase Orders Manage",
  "calendar:view": "Calendar View",
  "budget:manage": "Budget Manage",
  "cogs:manage": "COGS Manage",
  "alerts:config": "Alerts Config",
  "ledger:view": "Ledger View",
  "dashboard:view": "Dashboard View",
  "transactions:reset": "Reset Transactions",
  "debts:view": "Debts View",
  "debts:manage": "Debts Manage",
  "wallet:import": "Wallet Import",
  "wallet:admin": "Wallet Admin",
  "payment_methods:view": "Payment Methods View",
  "payment_methods:manage": "Payment Methods Manage",
  "expense_categories:manage": "Expense Categories Manage",
};

const ROLE_ORDER = ["owner", "admin", "manager", "employee", "viewer"] as const;
const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", manager: "Manager", employee: "Employee", viewer: "Viewer" };

const PERMISSION_GROUPS = [
  { label: "Sales", keys: [PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE] },
  { label: "Expenses", keys: [PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_MANAGE] },
  { label: "Bills", keys: [PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY] },
  { label: "Suppliers", keys: [PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.SUPPLIER_PRICES_VIEW] },
  { label: "Accounts", keys: [PERMISSIONS.ACCOUNTS_VIEW, PERMISSIONS.ACCOUNTS_MANAGE] },
  { label: "Payroll", keys: [PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS] },
  { label: "M-PESA", keys: [PERMISSIONS.MPESA_VIEW, PERMISSIONS.MPESA_IMPORT] },
  { label: "Reports", keys: [PERMISSIONS.REPORTS_VIEW] },
  { label: "Calendar", keys: [PERMISSIONS.CALENDAR_VIEW] },
  { label: "Ledger", keys: [PERMISSIONS.LEDGER_VIEW] },
  { label: "Dashboard", keys: [PERMISSIONS.DASHBOARD_VIEW] },
  { label: "Users", keys: [PERMISSIONS.USERS_MANAGE] },
  { label: "Settings", keys: [PERMISSIONS.SETTINGS_MANAGE] },
  { label: "Business", keys: [PERMISSIONS.BUSINESS_MANAGE, PERMISSIONS.INQUIRY_VIEW] },
  { label: "Operations", keys: [PERMISSIONS.PURCHASE_ORDERS_VIEW, PERMISSIONS.PURCHASE_ORDERS_MANAGE, PERMISSIONS.BUDGET_MANAGE, PERMISSIONS.COGS_MANAGE, PERMISSIONS.ALERTS_CONFIG] },
  { label: "Integrations", keys: [PERMISSIONS.API_KEYS_MANAGE, PERMISSIONS.WEBHOOKS_MANAGE, PERMISSIONS.PARTNER_VIEW] },
  { label: "Wallet", keys: [PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_IMPORT, PERMISSIONS.WALLET_ADMIN] },
  { label: "Debts", keys: [PERMISSIONS.DEBTS_VIEW, PERMISSIONS.DEBTS_MANAGE] },
  { label: "Payment Methods", keys: [PERMISSIONS.PAYMENT_METHODS_VIEW, PERMISSIONS.PAYMENT_METHODS_MANAGE] },
  { label: "Expense Categories", keys: [PERMISSIONS.EXPENSE_CATEGORIES_MANAGE] },
  { label: "Other", keys: [PERMISSIONS.FEEDBACK_MANAGE, PERMISSIONS.RESET_TRANSACTIONS] },
];

export function Users() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.USERS_MANAGE);

  const [tab, setTab] = useState<"users" | "businesses" | "permissions" | "metrics">("users");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [passOpen, setPassOpen] = useState<number | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<{ id: number; name: string } | null>(null);
  const [deleteBlockedFor, setDeleteBlockedFor] = useState<{ id: number; name: string; message: string } | null>(null);

  const { data: users } = trpc.permissions.listUsers.useQuery();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: statusMetrics } = trpc.users.getStatusMetrics.useQuery(undefined, { enabled: canManage });

  const utils = trpc.useUtils();
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => { toast.success("User created"); setOpen(false); resetForm(); utils.permissions.listUsers.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to create user"),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success("User updated");
      setEditOpen(null);
      utils.permissions.listUsers.invalidate();
      if (variables.role) utils.permissions.verifyRoleSync.invalidate({ userId: variables.id });
    },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      setDeleteConfirmFor(null);
      setDeleteBlockedFor(null);
      utils.permissions.listUsers.invalidate();
      utils.users.getStatusMetrics.invalidate();
    },
    onError: (err) => {
      const data = err.data as { code?: string; target?: { id?: number; name?: string }; message?: string } | undefined;
      if (data?.code === "USER_DELETION_BLOCKED") {
        setDeleteConfirmFor(null);
        setDeleteBlockedFor({
          id: data.target?.id ?? 0,
          name: data.target?.name ?? "this user",
          message: data.message ?? err.message,
        });
        return;
      }
      toast.error(err.message || "Failed to delete user");
    },
  });
  const disableUser = trpc.users.disable.useMutation({
    onSuccess: () => {
      toast.success("User disabled");
      setDeleteBlockedFor(null);
      utils.permissions.listUsers.invalidate();
      utils.users.getStatusMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to disable user"),
  });
  const enableUser = trpc.users.enable.useMutation({
    onSuccess: () => {
      toast.success("User enabled");
      utils.permissions.listUsers.invalidate();
      utils.users.getStatusMetrics.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to enable user"),
  });
  const changePassword = trpc.users.changePassword.useMutation({
    onSuccess: () => { toast.success("Password changed"); setPassOpen(null); },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });
  const setUserLocations = trpc.users.setUserLocations.useMutation({
    onSuccess: () => {
      toast.success("Locations updated");
      utils.permissions.listUsers.invalidate();
      utils.users.getUserLocations.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update locations"),
  });

  const addMember = trpc.businesses.addMember.useMutation({
    onSuccess: () => { toast.success("User assigned to business"); utils.permissions.listUsers.invalidate(); utils.businesses.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to assign"),
  });
  const removeMember = trpc.businesses.removeMember.useMutation({
    onSuccess: () => { toast.success("User removed from business"); utils.permissions.listUsers.invalidate(); utils.businesses.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to remove"),
  });
  const updateUserBusinessRole = trpc.permissions.updateUserBusinessRole.useMutation({
    onSuccess: (_, variables) => {
      toast.success("User role updated");
      utils.permissions.listUsers.invalidate();
      utils.permissions.verifyRoleSync.invalidate({ userId: variables.userId });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update role");
    },
  });
  const { data: allBusinesses } = trpc.businesses.list.useQuery();
  trpc.permissions.listUsers.useQuery(); // Keep warm for invalidation

  const [selectedUserForLog, setSelectedUserForLog] = useState<number | null>(null);
  const [locationsOpen, setLocationsOpen] = useState<number | null>(null);
  const [draftLocationIds, setDraftLocationIds] = useState<number[]>([]);

  const [form, setForm] = useState({
    username: "", password: "", name: "", email: "", phone: "", role: "viewer" as const, locationIds: [] as number[],
  });
  const [editForm, setEditForm] = useState<{ name: string; email: string; phone: string; role: "owner" | "admin" | "manager" | "employee" | "viewer"; locationIds: number[]; isActive: boolean }>({ name: "", email: "", phone: "", role: "viewer", locationIds: [], isActive: true });
  const [passForm, setPassForm] = useState({ newPassword: "" });

  const resetForm = () => setForm({ username: "", password: "", name: "", email: "", phone: "", role: "viewer", locationIds: [] });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
      toast.error("Username, password and name are required");
      return;
    }
    createUser.mutate({
      username: form.username, password: form.password, name: form.name,
      email: form.email || undefined, phone: form.phone || undefined,
      role: form.role,
      locationIds: form.locationIds.length > 0 ? form.locationIds : undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent, id: number) => {
    e.preventDefault();
    updateUser.mutate({
      id,
      name: editForm.name, email: editForm.email || undefined, phone: editForm.phone || undefined,
      role: editForm.role, locationIds: editForm.locationIds, isActive: editForm.isActive,
    });
  };

  const toggleLocation = (current: number[], locationId: number) => (
    current.includes(locationId)
      ? current.filter((id) => id !== locationId)
      : [...current, locationId]
  );

  const openLocationsDialog = (userId: number, locationIds: number[], legacyLocationId?: number | null) => {
    setLocationsOpen(userId);
    setDraftLocationIds(locationIds.length > 0 ? locationIds : (legacyLocationId ? [legacyLocationId] : []));
  };

  const saveLocationsDialog = () => {
    if (locationsOpen == null) return;
    setUserLocations.mutate({ id: locationsOpen, locationIds: draftLocationIds });
    // Keep the edit form in sync so that a subsequent "Save Changes" does not
    // overwrite the location assignments that were just saved.
    if (locationsOpen === editOpen) {
      setEditForm((prev) => ({ ...prev, locationIds: draftLocationIds }));
    }
    setLocationsOpen(null);
  };

  const renderLocationBadges = (scopeMode: string, effectiveLocationIds: number[]) => {
    switch (scopeMode) {
      case "all":
        return <span className="rounded-full bg-[#E8E0D8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8D8A87]">All locations</span>;
      case "none":
        return <span className="rounded-full bg-[#D32F2F]/10 px-2 py-0.5 text-[10px] font-semibold text-[#D32F2F]">No locations</span>;
      default:
        if (effectiveLocationIds.length === 0) {
          return <span className="rounded-full bg-[#E8E0D8] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8D8A87]">All locations</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {effectiveLocationIds.map((locationId) => {
              const location = locations?.find((item) => item.id === locationId);
              return (
                <span key={locationId} className="rounded-full bg-[#F5EDE6] px-2 py-0.5 text-[10px] font-semibold text-[#2D2A26]">
                  {location?.name ?? `Location #${locationId}`}
                </span>
              );
            })}
          </div>
        );
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-[#C73E1D]/10 text-[#C73E1D]";
      case "admin": return "bg-[#D4A854]/10 text-[#D4A854]";
      case "manager": return "bg-[#2E7D32]/10 text-[#2E7D32]";
      case "employee": return "bg-[#8D8A87]/10 text-[#8D8A87]";
      default: return "bg-[#E8E0D8]/10 text-[#8D8A87]";
    }
  };

  // ── Permissions matrix state ──
  const { data: matrixData } = trpc.permissions.getRoleMatrix.useQuery();
  const saveRoleTemplate = trpc.permissions.createRoleTemplate.useMutation({
    onSuccess: () => { toast.success("Permissions saved"); utils.permissions.getRoleMatrix.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to save permissions"),
  });

  const [localMatrix, setLocalMatrix] = useState<Record<string, string[]> | null>(null);
  const matrix = localMatrix ?? matrixData?.matrix ?? {};

  function togglePermission(role: string, permission: string) {
    const current = new Set(matrix[role] || []);
    if (current.has(permission)) current.delete(permission);
    else current.add(permission);
    setLocalMatrix({ ...matrix, [role]: Array.from(current) });
  }

  function resetMatrix() {
    setLocalMatrix(null);
  }

  function saveMatrix() {
    for (const role of ROLE_ORDER) {
      if (role === "owner") continue; // Owner always gets everything; skip saving
      saveRoleTemplate.mutate({
        roleKey: role,
        roleLabel: ROLE_LABELS[role],
        permissions: matrix[role] || [],
      });
    }
  }

  const hasChanges = localMatrix !== null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Users &amp; Permissions</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Manage team members and role access levels</p>
          </div>
          {canManage && tab === "users" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90"><Plus className="mr-2 h-4 w-4" /> Add User</Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-serif text-xl">Add User</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="john.doe" required /></div>
                    <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 4 characters" required /></div>
                  </div>
                  <div className="space-y-2"><Label>Full Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" required /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254..." /></div>
                  </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Role</Label>
                      <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Assigned Locations</Label>
                      <div className="grid max-h-32 grid-cols-1 gap-1 overflow-y-auto rounded border border-[#E8E0D8] p-2 sm:grid-cols-2">
                        {locations?.map(l => (
                          <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[#F5EDE6]">
                            <input
                              type="checkbox"
                              checked={form.locationIds.includes(l.id)}
                              onChange={() => setForm(p => ({ ...p, locationIds: toggleLocation(p.locationIds, l.id) }))}
                              className="h-3 w-3"
                            />
                            <span className="truncate text-[#2D2A26]">{l.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createUser.isPending}>{createUser.isPending ? "Creating..." : "Create User"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E8E0D8]">
          <button onClick={() => setTab("users")} className={`px-4 py-2 text-sm font-medium ${tab === "users" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <UsersIcon className="mr-1 inline h-4 w-4"/>Team
          </button>
          <button onClick={() => setTab("businesses")} className={`px-4 py-2 text-sm font-medium ${tab === "businesses" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <Building2 className="mr-1 inline h-4 w-4"/>Businesses
          </button>
          <button onClick={() => setTab("permissions")} className={`px-4 py-2 text-sm font-medium ${tab === "permissions" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
            <ShieldCheck className="mr-1 inline h-4 w-4"/>Permissions
          </button>
          {canManage && (
            <button onClick={() => setTab("metrics")} className={`px-4 py-2 text-sm font-medium ${tab === "metrics" ? "border-b-2 border-[#C73E1D] text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}>
              <UsersIcon className="mr-1 inline h-4 w-4"/>Account Metrics
            </button>
          )}
        </div>

        {tab === "users" && (
          <>
            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><UsersIcon className="h-5 w-5 text-[#C73E1D]"/>Team Members</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E0D8]">
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Name</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Username</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Role</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Location</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Status</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Last Sign In</th>
                        <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D8]">
                      {users?.map(u => (
                        <tr key={u.id} className="hover:bg-[#F5EDE6]/50">
                          <td className="py-3">
                            <div className="text-sm font-medium text-[#2D2A26]">{u.name}</div>
                            <div className="text-xs text-[#8D8A87]">{u.email}</div>
                          </td>
                          <td className="py-3 text-sm text-[#2D2A26]">{u.username ?? "-"}</td>
                          <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${getRoleColor(u.role)}`}>{u.role}</span></td>
                          <td className="py-3 text-sm text-[#8D8A87]">{renderLocationBadges(u.scopeMode ?? "assigned", u.effectiveLocationIds ?? u.locationIds ?? [])}</td>
                          <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="py-3 text-sm text-[#8D8A87]">{u.lastSignInAt ? formatDate(u.lastSignInAt) : "Never"}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/profile?id=${u.id}`)}><UserCircle className="h-4 w-4 text-[#8D8A87]" /></Button>
                              {canManage && (
                                <>
                                  <Dialog open={passOpen === u.id} onOpenChange={(v) => setPassOpen(v ? u.id : null)}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={() => { setPassOpen(u.id); setPassForm({ newPassword: "" }); }}><KeyRound className="h-4 w-4 text-[#8D8A87]" /></Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-white">
                                      <DialogHeader><DialogTitle className="font-serif text-xl">Change Password</DialogTitle></DialogHeader>
                                      <form onSubmit={(e) => { e.preventDefault(); if (!passForm.newPassword || passForm.newPassword.length < 4) { toast.error("Password must be at least 4 characters"); return; } changePassword.mutate({ userId: u.id, newPassword: passForm.newPassword }); }} className="space-y-3">
                                        <div className="space-y-2"><Label>New Password</Label><Input type="password" value={passForm.newPassword} onChange={e => setPassForm(p => ({ ...p, newPassword: e.target.value }))} placeholder="Min 4 characters" required /></div>
                                        <Button type="submit" className="w-full bg-[#C73E1D]" disabled={changePassword.isPending}>{changePassword.isPending ? "Saving..." : "Update Password"}</Button>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                  <Dialog open={editOpen === u.id} onOpenChange={(v) => setEditOpen(v ? u.id : null)}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={() => { setEditOpen(u.id); setEditForm({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "", role: u.role, locationIds: u.locationIds ?? [], isActive: u.isActive }); }}><Pencil className="h-4 w-4 text-[#8D8A87]" /></Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-white">
                                      <DialogHeader><DialogTitle className="font-serif text-xl">Edit User</DialogTitle></DialogHeader>
                                      <form onSubmit={(e) => handleUpdate(e, u.id)} className="space-y-3">
                                        <div className="space-y-2"><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required /></div>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
                                          <div className="space-y-2"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div className="space-y-2"><Label>Role</Label>
                                            <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                                              <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                                            </select>
                                          </div>
                                          <div className="space-y-2"><Label>Assigned Locations</Label>
                                            <div className="flex items-center justify-between gap-2 rounded border border-[#E8E0D8] px-3 py-2">
                                              <div className="min-w-0 flex-1">{renderLocationBadges("assigned", editForm.locationIds)}</div>
                                              <Button type="button" size="sm" variant="outline" onClick={() => openLocationsDialog(u.id, editForm.locationIds, u.legacyLocationId)}>Manage</Button>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input type="checkbox" id={`active-${u.id}`} checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} />
                                          <Label htmlFor={`active-${u.id}`} className="text-sm font-normal">Active</Label>
                                        </div>
                                        <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateUser.isPending}>{updateUser.isPending ? "Saving..." : "Save Changes"}</Button>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
                                  {u.isActive ? (
                                    <Button size="sm" variant="ghost" onClick={() => disableUser.mutate({ id: u.id })}>
                                      <span className="text-xs text-[#8D8A87]">Disable</span>
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => enableUser.mutate({ id: u.id })}>
                                      <span className="text-xs text-[#2E7D32]">Enable</span>
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmFor({ id: u.id, name: u.name ?? u.username ?? `User #${u.id}` })}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!users || users.length === 0) && (
                        <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Role info card */}
            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D4A854]"/>Role Reference</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { role: "Owner", desc: "Full access to everything. Can reset all transactions." },
                    { role: "Admin", desc: "Full access except owner-only actions like transaction reset." },
                    { role: "Manager", desc: "Can manage sales, expenses, bills, suppliers, payroll, and accounts." },
                    { role: "Employee", desc: "Can record sales and expenses. View-only on bills and M-PESA." },
                    { role: "Viewer", desc: "Read-only access to all reports and data." },
                  ].map(r => (
                    <div key={r.role} className="rounded-lg border border-[#E8E0D8] p-3">
                      <p className="text-sm font-semibold text-[#2D2A26]">{r.role}</p>
                      <p className="text-xs text-[#8D8A87]">{r.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "businesses" && (
          <>
            <Card className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3"><CardTitle className="font-serif text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-[#C73E1D]"/>Business Assignments</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E0D8]">
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">User</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Role</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Assigned Businesses</th>
                        <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Sync</th>
                        {canManage && <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D8]">
                      {users?.map(u => {
                        const userBizIds = u.businessIds || [];
                        return (
                          <tr key={u.id} className="hover:bg-[#F5EDE6]/50">
                            <td className="py-3">
                              <div className="text-sm font-medium text-[#2D2A26]">{u.name}</div>
                              <div className="text-xs text-[#8D8A87]">{u.username ?? "-"}</div>
                            </td>
                            <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${getRoleColor(u.role)}`}>{u.role}</span></td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {userBizIds.length === 0 && <span className="text-xs text-[#8D8A87]">No businesses assigned</span>}
                                {userBizIds.map((bid: number) => {
                                  const biz = allBusinesses?.find(b => b.id === bid);
                                  const bizRoles = (u as Record<string, unknown>).businessRoles as Record<number, string> | undefined;
                                  const bizRole = bizRoles?.[bid] ?? u.role;
                                  return (
                                    <span key={bid} className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs text-[#2D2A26]">
                                      <Building2 className="h-3 w-3"/>{biz?.name ?? `Biz #${bid}`}
                                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getRoleColor(bizRole)}`}>{bizRole}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3">
                              <RoleSyncBadge userId={u.id} globalRole={u.role} businessRoles={(u as Record<string, unknown>).businessRoles as Record<number, string> || {}} businessIds={userBizIds} />
                            </td>
                            {canManage && (
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <select
                                    value={u.businessRoles?.[userBizIds[0]] ?? u.role}
                                    onChange={e => {
                                      const newRole = e.target.value as "owner" | "admin" | "manager" | "employee" | "viewer";
                                      // Sync the per-business role for EVERY business the user is assigned to,
                                      // not just the first one. This keeps the Team tab's users.role and every
                                      // per-business role in agreement.
                                      userBizIds.forEach((bid: number) => {
                                        updateUserBusinessRole.mutate({ userId: u.id, businessId: bid, role: newRole });
                                      });
                                    }}
                                    className="rounded border px-2 py-1 text-xs"
                                    aria-label={`Role for ${u.name}`}
                                  >
                                    <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                                  </select>
                                  <select
                                    className="rounded border px-2 py-1 text-xs"
                                    defaultValue=""
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      // Format: "businessId:role"
                                      const [bizIdStr, roleStr] = val.split(":");
                                      const bizId = +bizIdStr;
                                      if (!bizId) return;
                                      addMember.mutate({ businessId: bizId, userId: u.id, role: roleStr || "employee" });
                                      // Reset to placeholder
                                      e.target.value = "";
                                    }}
                                  >
                                    <option value="">Assign to...</option>
                                    {allBusinesses?.filter(b => !userBizIds.includes(b.id)).map(b => (
                                      <optgroup key={b.id} label={b.name}>
                                        <option value={`${b.id}:owner`}>Owner</option>
                                        <option value={`${b.id}:admin`}>Admin</option>
                                        <option value={`${b.id}:manager`}>Manager</option>
                                        <option value={`${b.id}:employee`}>Employee</option>
                                        <option value={`${b.id}:viewer`}>Viewer</option>
                                      </optgroup>
                                    ))}
                                  </select>
                                  <select
                                    className="rounded border px-2 py-1 text-xs"
                                    onChange={e => {
                                      const bizId = +e.target.value;
                                      if (!bizId) return;
                                      if (confirm(`Remove ${u.name} from this business?`)) removeMember.mutate({ businessId: bizId, userId: u.id });
                                    }}
                                  >
                                    <option value="">Remove from...</option>
                                    {allBusinesses?.filter(b => userBizIds.includes(b.id)).map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {(!users || users.length === 0) && (
                        <tr><td colSpan={canManage ? 5 : 4} className="py-8 text-center text-sm text-[#8D8A87]">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {canManage && (
              <Card className="border-[#E8E0D8] bg-white mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2"><History className="h-5 w-5 text-[#D4A854]"/>Role Change Audit Log</CardTitle>
                  <p className="text-xs text-[#8D8A87]">Timestamped history of role updates so you can verify the user management section and business section's role selector agree.</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-[#8D8A87]">User</label>
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      value={selectedUserForLog ?? ""}
                      onChange={e => setSelectedUserForLog(e.target.value ? +e.target.value : null)}
                    >
                      <option value="">Select a user...</option>
                      {users?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <RoleChangeLog userId={selectedUserForLog} />
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog open={locationsOpen !== null} onOpenChange={(openState) => { if (!openState) setLocationsOpen(null); }}>
          <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif text-xl">Assign Locations</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded border border-[#E8E0D8] p-2 sm:grid-cols-2">
                {locations?.map((location) => (
                  <label key={location.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[#F5EDE6]">
                    <input
                      type="checkbox"
                      checked={draftLocationIds.includes(location.id)}
                      onChange={() => setDraftLocationIds((prev) => toggleLocation(prev, location.id))}
                      className="h-3 w-3"
                    />
                    <span className="truncate text-[#2D2A26]">{location.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDraftLocationIds([])}>Clear</Button>
                <Button type="button" variant="outline" onClick={() => setLocationsOpen(null)}>Cancel</Button>
                <Button type="button" className="bg-[#C73E1D]" onClick={saveLocationsDialog} disabled={setUserLocations.isPending}>
                  {setUserLocations.isPending ? "Saving..." : "Save Assignments"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmFor !== null} onOpenChange={(openState) => { if (!openState) setDeleteConfirmFor(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Delete <span className="font-medium text-[#2D2A26]">{deleteConfirmFor?.name}</span>? This only succeeds when there are no blocking historical records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#D32F2F] hover:bg-[#D32F2F]/90"
                onClick={() => {
                  if (deleteConfirmFor) {
                    deleteUser.mutate({ id: deleteConfirmFor.id });
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={deleteBlockedFor !== null} onOpenChange={(openState) => { if (!openState) setDeleteBlockedFor(null); }}>
          <DialogContent className="bg-white max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-serif text-xl">Deletion Blocked</DialogTitle></DialogHeader>
            {deleteBlockedFor && (
              <div className="space-y-4">
                <p className="text-sm text-[#8D8A87]">
                  <span className="font-medium text-[#2D2A26]">{deleteBlockedFor.name}</span> still has linked records, so the account cannot be deleted safely.
                </p>
                <pre className="whitespace-pre-wrap rounded border border-[#E8E0D8] bg-[#F5EDE6] p-3 text-xs text-[#2D2A26]">
                  {deleteBlockedFor.message}
                </pre>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setDeleteBlockedFor(null)}>Close</Button>
                  <Button
                    type="button"
                    className="bg-[#C73E1D]"
                    onClick={() => disableUser.mutate({ id: deleteBlockedFor.id })}
                    disabled={disableUser.isPending}
                  >
                    {disableUser.isPending ? "Disabling..." : "Disable Instead"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {tab === "permissions" && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#D4A854]"/>Permission Matrix</CardTitle>
                {canManage && (
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <Button size="sm" variant="outline" onClick={resetMatrix}><RotateCcw className="mr-1 h-4 w-4"/>Reset</Button>
                    )}
                    <Button size="sm" className="bg-[#C73E1D]" onClick={saveMatrix} disabled={!hasChanges || saveRoleTemplate.isPending}>
                      <Save className="mr-1 h-4 w-4"/>{saveRoleTemplate.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#8D8A87]">Checked = allowed. Owner always has all permissions. Changes apply immediately to backend middleware.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E0D8]">
                      <th className="sticky left-0 bg-white pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Permission</th>
                      {ROLE_ORDER.map(role => (
                        <th key={role} className="pb-3 px-2 text-center text-xs font-medium uppercase tracking-wider text-[#8D8A87]">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${role === "owner" ? "bg-[#C73E1D]/10 text-[#C73E1D]" : role === "admin" ? "bg-[#D4A854]/10 text-[#D4A854]" : role === "manager" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : role === "employee" ? "bg-[#8D8A87]/10 text-[#8D8A87]" : "bg-[#E8E0D8]/10 text-[#8D8A87]"}`}>{ROLE_LABELS[role]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_GROUPS.map(group => (
                      <>
                        <tr key={`g-${group.label}`} className="border-t border-[#E8E0D8]">
                          <td colSpan={ROLE_ORDER.length + 1} className="py-2 text-xs font-bold uppercase tracking-wider text-[#8D8A87]">{group.label}</td>
                        </tr>
                        {group.keys.map(key => (
                          <tr key={key} className="hover:bg-[#F5EDE6]/30">
                            <td className="sticky left-0 bg-white py-2 pr-4 text-sm text-[#2D2A26]">{PERMISSION_LABELS[key] ?? key}</td>
                            {ROLE_ORDER.map(role => {
                              const allowed = role === "owner" || (matrix[role] || []).includes(key);
                              const isDisabled = !canManage || role === "owner";
                              return (
                                <td key={`${key}-${role}`} className="py-2 px-2 text-center">
                                  <button
                                    disabled={isDisabled}
                                    onClick={() => togglePermission(role, key)}
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition-colors ${
                                      allowed
                                        ? "border-[#2E7D32] bg-[#2E7D32] text-white"
                                        : "border-[#E8E0D8] bg-white text-transparent hover:border-[#8D8A87]"
                                    } ${isDisabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
                                  >
                                    {allowed ? "✓" : ""}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "metrics" && canManage && (
          <Card className="border-[#E8E0D8] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-[#C73E1D]"/>Account Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Total", value: statusMetrics?.total ?? 0, tone: "text-[#2D2A26]" },
                  { label: "Active", value: statusMetrics?.active ?? 0, tone: "text-[#2E7D32]" },
                  { label: "Disabled", value: statusMetrics?.disabled ?? 0, tone: "text-[#D4A854]" },
                  { label: "Deleted", value: statusMetrics?.deleted ?? 0, tone: "text-[#D32F2F]" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-[#E8E0D8] p-4">
                    <p className="text-xs uppercase tracking-wider text-[#8D8A87]">{metric.label}</p>
                    <p className={`mt-2 text-2xl font-semibold ${metric.tone}`}>{metric.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

/**
 * Small status pill showing whether global and per-business roles agree.
 */
function RoleSyncBadge({
  userId,
  globalRole,
  businessRoles,
  businessIds,
}: {
  userId: number;
  globalRole: string;
  businessRoles: Record<number, string>;
  businessIds: number[];
}) {
  const { data, isFetching } = trpc.permissions.verifyRoleSync.useQuery(
    { userId },
    { enabled: businessIds.length > 0, refetchOnWindowFocus: true },
  );
  const localMismatches = useMemo(() => {
    if (businessIds.length === 0) return [];
    return businessIds
      .map((bid) => ({ businessId: bid, role: businessRoles[bid] }))
      .filter((entry) => entry.role && entry.role !== globalRole);
  }, [businessIds, businessRoles, globalRole]);

  if (businessIds.length === 0) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#E8E0D8] px-2 py-0.5 text-[10px] uppercase text-[#8D8A87]">No memberships</span>;
  }

  const inSync = (data?.inSync ?? true) && localMismatches.length === 0;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
      inSync ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"
    }`}>
      {isFetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
      {inSync ? "In sync" : "Needs sync"}
    </span>
  );
}

/**
 * Timestamped audit log of role changes for a user.
 */
function RoleChangeLog({ userId }: { userId: number | null }) {
  const { data, isLoading, error } = trpc.permissions.getRoleChangeLog.useQuery(
    { userId: userId ?? -1, limit: 20 },
    { enabled: userId !== null },
  );

  if (userId === null) {
    return <p className="py-6 text-center text-xs text-[#8D8A87]">Select a user to see role change history.</p>;
  }
  if (isLoading) return <p className="py-6 text-center text-xs text-[#8D8A87]">Loading audit log...</p>;
  if (error) return <p className="py-6 text-center text-xs text-[#D32F2F]">Failed to load: {error.message}</p>;
  if (!data || data.length === 0) {
    return <p className="py-6 text-center text-xs text-[#8D8A87]">No role changes recorded for this user.</p>;
  }
  return (
    <ul className="divide-y divide-[#E8E0D8]">
      {data.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#F5EDE6] px-2 py-0.5 text-[#2D2A26]">
              {entry.previousRole ?? "(none)"} → {entry.nextRole ?? "(none)"}
            </span>
            {entry.businessId !== null && (
              <span className="rounded bg-[#E8E0D8] px-2 py-0.5 text-[#2D2A26]">business #{entry.businessId}</span>
            )}
            <span className="text-[#8D8A87]">{entry.reason}</span>
          </div>
          <span className="text-[#8D8A87]" title={entry.timestamp}>{formatDate(entry.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}
