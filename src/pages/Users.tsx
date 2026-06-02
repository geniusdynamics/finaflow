import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, KeyRound, Users as UsersIcon, ShieldCheck, Save, RotateCcw, Building2 } from "lucide-react";
import { toast } from "sonner";

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
  { label: "Other", keys: [PERMISSIONS.FEEDBACK_MANAGE, PERMISSIONS.RESET_TRANSACTIONS] },
];

export function Users() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role ?? "viewer", PERMISSIONS.USERS_MANAGE);

  const [tab, setTab] = useState<"users" | "businesses" | "permissions">("users");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const [passOpen, setPassOpen] = useState<number | null>(null);

  const { data: users } = trpc.permissions.listUsers.useQuery();
  const { data: locations } = trpc.locations.list.useQuery();

  const utils = trpc.useUtils();
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => { toast.success("User created"); setOpen(false); resetForm(); utils.permissions.listUsers.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to create user"),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => { toast.success("User updated"); setEditOpen(null); utils.permissions.listUsers.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("User deactivated"); utils.permissions.listUsers.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to delete user"),
  });
  const changePassword = trpc.users.changePassword.useMutation({
    onSuccess: () => { toast.success("Password changed"); setPassOpen(null); },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  const addMember = trpc.businesses.addMember.useMutation({
    onSuccess: () => { toast.success("User assigned to business"); utils.permissions.listUsers.invalidate(); utils.businesses.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to assign"),
  });
  const removeMember = trpc.businesses.removeMember.useMutation({
    onSuccess: () => { toast.success("User removed from business"); utils.permissions.listUsers.invalidate(); utils.businesses.list.invalidate(); },
    onError: (err) => toast.error(err.message || "Failed to remove"),
  });
  const { data: allBusinesses } = trpc.businesses.list.useQuery();
  trpc.permissions.listUsers.useQuery(); // Keep warm for invalidation

  const [selectedBizForUser, setSelectedBizForUser] = useState<number | null>(null);
  const [assignRole, setAssignRole] = useState("employee");

  const [form, setForm] = useState({
    username: "", password: "", name: "", email: "", phone: "", role: "viewer" as const, locationId: "",
  });
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "viewer" as const, locationId: "", isActive: true });
  const [passForm, setPassForm] = useState({ newPassword: "" });

  const resetForm = () => setForm({ username: "", password: "", name: "", email: "", phone: "", role: "viewer", locationId: "" });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
      toast.error("Username, password and name are required");
      return;
    }
    createUser.mutate({
      username: form.username, password: form.password, name: form.name,
      email: form.email || undefined, phone: form.phone || undefined,
      role: form.role, locationId: form.locationId ? +form.locationId : undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent, id: number) => {
    e.preventDefault();
    updateUser.mutate({
      id,
      name: editForm.name, email: editForm.email || undefined, phone: editForm.phone || undefined,
      role: editForm.role, locationId: editForm.locationId ? +editForm.locationId : undefined, isActive: editForm.isActive,
    });
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
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                      <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Location</Label>
                      <select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                        <option value="">All / HQ</option>
                        {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
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
                          <td className="py-3 text-sm text-[#8D8A87]">{locations?.find(l => l.id === u.locationId)?.name ?? "HQ"}</td>
                          <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${u.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                          <td className="py-3 text-sm text-[#8D8A87]">{u.lastSignInAt ? formatDate(u.lastSignInAt) : "Never"}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
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
                                      <Button size="sm" variant="ghost" onClick={() => { setEditOpen(u.id); setEditForm({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "", role: u.role, locationId: u.locationId?.toString() ?? "", isActive: u.isActive }); }}><Pencil className="h-4 w-4 text-[#8D8A87]" /></Button>
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
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                                            <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm">
                                              <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                                            </select>
                                          </div>
                                          <div className="space-y-2"><Label>Location</Label>
                                            <select value={editForm.locationId} onChange={e => setEditForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm">
                                              <option value="">All / HQ</option>
                                              {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
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
                                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Deactivate user "${u.name}"?`)) deleteUser.mutate({ id: u.id }); }}><Trash2 className="h-4 w-4 text-[#D32F2F]" /></Button>
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
                                  return (
                                    <span key={bid} className="inline-flex items-center gap-1 rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs text-[#2D2A26]">
                                      <Building2 className="h-3 w-3"/>{biz?.name ?? `Biz #${bid}`}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            {canManage && (
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <select
                                    value={selectedBizForUser === u.id ? assignRole : "employee"}
                                    onChange={e => { setSelectedBizForUser(u.id); setAssignRole(e.target.value); }}
                                    className="rounded border px-2 py-1 text-xs"
                                  >
                                    <option value="owner">Owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option><option value="viewer">Viewer</option>
                                  </select>
                                  <select
                                    className="rounded border px-2 py-1 text-xs"
                                    onChange={e => {
                                      const bizId = +e.target.value;
                                      if (!bizId) return;
                                      const role = selectedBizForUser === u.id ? assignRole : "employee";
                                      addMember.mutate({ businessId: bizId, userId: u.id, role });
                                    }}
                                  >
                                    <option value="">Assign to...</option>
                                    {allBusinesses?.filter(b => !userBizIds.includes(b.id)).map(b => (
                                      <option key={b.id} value={b.id}>{b.name} ({b.accountId})</option>
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
                        <tr><td colSpan={canManage ? 4 : 3} className="py-8 text-center text-sm text-[#8D8A87]">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

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
      </div>
    </Layout>
  );
}
