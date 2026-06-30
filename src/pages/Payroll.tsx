import { useState } from "react";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Users, DollarSign, CreditCard, CheckCircle, Clock, Eye, Play, Banknote, Pencil, UserCircle, UserPlus, UserMinus, Calculator, Landmark, Shield, Trash2 } from "lucide-react";
import { LocationSelector } from "@/components/LocationSelector";
import { toast } from "sonner";

export function Payroll() {
  const { user } = useAuth();
  const permContext = user?.permissions?.length ? user.permissions : (user?.role ?? "viewer");
  const canProcess = hasPermission(permContext, PERMISSIONS.PAYROLL_PROCESS);
  const { data: settings } = trpc.settings.list.useQuery();

  const [periodOpen, setPeriodOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);
  const [empViewOpen, setEmpViewOpen] = useState<number | null>(null);
  const [empEditOpen, setEmpEditOpen] = useState<number | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [payPeriod, setPayPeriod] = useState<number | null>(null);
  const [assignEmpOpen, setAssignEmpOpen] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState<{ name: string; username: string; initialPassword: string } | null>(null);

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: employees } = trpc.employees.list.useQuery();
  const { data: allUsers } = trpc.permissions.listUsers.useQuery();
  const { data: periods } = trpc.payroll.periods.useQuery();
  const { data: periodEntries } = trpc.payroll.entries.useQuery(
    { periodId: selectedPeriod ?? 0 },
    { enabled: selectedPeriod !== null }
  );
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: employeeDetail } = trpc.employees.get.useQuery(
    { id: empViewOpen ?? 0 },
    { enabled: empViewOpen !== null }
  );

  const utils = trpc.useUtils();
  const createPeriod = trpc.payroll.createPeriod.useMutation({ onSuccess: () => { setPeriodOpen(false); utils.payroll.periods.invalidate(); } });
  const createEmployee = trpc.employees.create.useMutation({
    onSuccess: (data) => {
      setEmpOpen(false);
      setCreatedEmployee({
        name: empForm.fullName,
        username: data.username,
        initialPassword: data.initialPassword,
      });
      utils.employees.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateEmployee = trpc.employees.update.useMutation({ onSuccess: () => { setEmpEditOpen(null); utils.employees.list.invalidate(); } });
  const processPayroll = trpc.payroll.processPayroll.useMutation({
    onSuccess: (data) => { toast.success(`Payroll processed: ${data.entries.length} entries, ${formatKES(data.totalNetPay)}`); utils.payroll.periods.invalidate(); utils.payroll.entries.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const markPaid = trpc.payroll.markPaid.useMutation({
    onSuccess: () => { setPayPeriod(null); toast.success("Payroll marked as paid"); utils.payroll.periods.invalidate(); utils.payroll.entries.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const requestAdvance = trpc.payroll.requestAdvance.useMutation({ onSuccess: () => { setAdvanceOpen(false); utils.employees.list.invalidate(); } });
  const addToPeriod = trpc.payroll.addEmployeeToPeriod.useMutation({
    onSuccess: () => { setAssignEmpOpen(false); toast.success("Employee added to period"); utils.payroll.entries.invalidate(); utils.payroll.periods.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const removeFromPeriod = trpc.payroll.removeEmployeeFromPeriod.useMutation({
    onSuccess: () => { toast.success("Employee removed from period"); utils.payroll.entries.invalidate(); utils.payroll.periods.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteEmployee = trpc.employees.deleteWithUser.useMutation({
    onSuccess: (_data) => { toast.success("Employee and linked user account deleted"); setDeleteConfirm(null); setEmpViewOpen(null); utils.employees.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  const [periodForm, setPeriodForm] = useState({ locationId: "", periodName: "", startDate: "", endDate: "", paymentDate: "" });
  const [empForm, setEmpForm] = useState({ locationId: "", fullName: "", phone: "", idNumber: "", kraPin: "", nssfNumber: "", nhifNumber: "", salaryType: "monthly" as const, basicSalary: "", bankName: "", bankAccount: "", bankCode: "", employmentDate: "" });
  const [editEmpForm, setEditEmpForm] = useState({ fullName: "", phone: "", basicSalary: "", isActive: true, bankName: "", bankAccount: "", bankCode: "", idNumber: "", kraPin: "", nssfNumber: "", nhifNumber: "", userId: "" });
  const [advanceForm, setAdvanceForm] = useState({ employeeId: "", amount: "", requestDate: getLocalDateString(), notes: "", payrollPeriodId: "" });
  const [assignEmpId, setAssignEmpId] = useState("");
  const [deductOpen, setDeductOpen] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deductForm, setDeductForm] = useState({ grossPay: "", insurancePremium: "" });
  const [settingsForm, setSettingsForm] = useState({
    nhifRate: "2.75", nssfTier1Employee: "420", nssfTier2Employee: "1740",
    personalRelief: "2400", insuranceRelief: "0",
  });

  const selectedPeriodData = periods?.find(p => p.id === selectedPeriod);
  const selectedLocationName = locations?.find(l => l.id === selectedPeriodData?.locationId)?.name ?? "";

  const { data: payrollSet } = trpc.payrollSettings.get.useQuery(
    { locationId: selectedPeriodData?.locationId ?? 0 },
    { enabled: !!selectedPeriodData?.locationId }
  );
  const { data: computedDeductions } = trpc.payrollSettings.compute.useQuery(
    { grossPay: parseFloat(deductForm.grossPay) || 0, locationId: selectedPeriodData?.locationId ?? 0, insurancePremium: parseFloat(deductForm.insurancePremium) || 0 },
    { enabled: deductOpen !== null && parseFloat(deductForm.grossPay) > 0 && !!selectedPeriodData?.locationId }
  );
  const updatePayrollSet = trpc.payrollSettings.update.useMutation({
    onSuccess: () => { toast.success("Payroll settings saved"); setSettingsOpen(false); },
    onError: (err) => toast.error(err.message),
  });

  const handlePeriod = (e: React.FormEvent) => { e.preventDefault(); createPeriod.mutate({ locationId: +periodForm.locationId, periodName: periodForm.periodName, startDate: periodForm.startDate, endDate: periodForm.endDate, paymentDate: periodForm.paymentDate }); };
  const handleEmp = (e: React.FormEvent) => { e.preventDefault(); createEmployee.mutate({ ...empForm, locationId: +empForm.locationId, employmentDate: empForm.employmentDate }); };
  const handleAdvance = (e: React.FormEvent) => { e.preventDefault(); requestAdvance.mutate({ employeeId: +advanceForm.employeeId, amount: advanceForm.amount, requestDate: advanceForm.requestDate, notes: advanceForm.notes, payrollPeriodId: advanceForm.payrollPeriodId ? +advanceForm.payrollPeriodId : undefined }); };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Payroll</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Process payroll, manage employees, advances, and deductions</p>
          </div>
          {canProcess && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="border-[#8D8A87] text-[#8D8A87]" onClick={() => setSettingsOpen(true)}><Shield className="mr-1 h-4 w-4" />Settings</Button>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-serif text-xl flex items-center gap-2"><Shield className="h-5 w-5 text-[#C73E1D]"/>Payroll Settings</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); updatePayrollSet.mutate({ ...settingsForm, nhifRate: settingsForm.nhifRate, nssfTier1Employee: settingsForm.nssfTier1Employee, nssfTier2Employee: settingsForm.nssfTier2Employee, personalRelief: settingsForm.personalRelief, insuranceRelief: settingsForm.insuranceRelief, locationId: selectedPeriodData?.locationId ?? 0 }); }} className="space-y-3">
                    <p className="text-xs text-[#8D8A87]">Configure statutory deduction rates for Kenya.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>NHIF Rate (%)</Label><Input value={settingsForm.nhifRate} onChange={e => setSettingsForm(p => ({ ...p, nhifRate: e.target.value }))} /></div>
                      <div><Label>NSSF Tier 1 (EE)</Label><Input value={settingsForm.nssfTier1Employee} onChange={e => setSettingsForm(p => ({ ...p, nssfTier1Employee: e.target.value }))} /></div>
                      <div><Label>NSSF Tier 2 (EE)</Label><Input value={settingsForm.nssfTier2Employee} onChange={e => setSettingsForm(p => ({ ...p, nssfTier2Employee: e.target.value }))} /></div>
                      <div><Label>Personal Relief</Label><Input value={settingsForm.personalRelief} onChange={e => setSettingsForm(p => ({ ...p, personalRelief: e.target.value }))} /></div>
                      <div><Label>Insurance Relief</Label><Input value={settingsForm.insuranceRelief} onChange={e => setSettingsForm(p => ({ ...p, insuranceRelief: e.target.value }))} /></div>
                    </div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updatePayrollSet.isPending}>Save Settings</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-[#D4A854] text-[#D4A854]"><DollarSign className="mr-2 h-4 w-4" /> Advance</Button></DialogTrigger>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Request Employee Advance</DialogTitle></DialogHeader>
                  <form onSubmit={handleAdvance} className="space-y-3">
                    <div><Label>Employee</Label><select value={advanceForm.employeeId} onChange={e => setAdvanceForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm" required><option value="">Select</option>{employees?.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Amount</Label><Input type="number" step="0.01" value={advanceForm.amount} onChange={e => setAdvanceForm(p => ({ ...p, amount: e.target.value }))} required /></div><div><Label>Date</Label><Input type="date" value={advanceForm.requestDate} onChange={e => setAdvanceForm(p => ({ ...p, requestDate: e.target.value }))} required /></div></div>
                    <div><Label>Deduct From Period</Label><select value={advanceForm.payrollPeriodId} onChange={e => setAdvanceForm(p => ({ ...p, payrollPeriodId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm"><option value="">Auto (next period)</option>{periods?.filter(p => p.status === "open").map(p => <option key={p.id} value={p.id}>{p.periodName}</option>)}</select></div>
                    <div><Label>Notes</Label><Input value={advanceForm.notes} onChange={e => setAdvanceForm(p => ({ ...p, notes: e.target.value }))} /></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={requestAdvance.isPending}>{requestAdvance.isPending ? "Saving..." : "Request Advance"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={empOpen} onOpenChange={setEmpOpen}>
                <DialogTrigger asChild><Button variant="outline" className="border-[#D4A854] text-[#D4A854]"><Users className="mr-2 h-4 w-4" /> Add Staff</Button></DialogTrigger>
                <DialogContent className="bg-white max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="font-serif text-xl">Add Employee</DialogTitle></DialogHeader>
                  <form onSubmit={handleEmp} className="space-y-3">
                    <div>
                      <LocationSelector
                      locations={locations}
                      assignedLocationIds={user?.assignedLocationIds ?? []}
                      value={empForm.locationId}
                      onChange={v => setEmpForm(p => ({ ...p, locationId: v }))}
                      enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                        required
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Full Name</Label><Input value={empForm.fullName} onChange={e => setEmpForm(p => ({ ...p, fullName: e.target.value }))} required /></div><div><Label>Phone</Label><Input value={empForm.phone} onChange={e => setEmpForm(p => ({ ...p, phone: e.target.value }))} required /></div></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>ID Number</Label><Input value={empForm.idNumber} onChange={e => setEmpForm(p => ({ ...p, idNumber: e.target.value }))} /></div><div><Label>KRA PIN</Label><Input value={empForm.kraPin} onChange={e => setEmpForm(p => ({ ...p, kraPin: e.target.value }))} /></div></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>NSSF</Label><Input value={empForm.nssfNumber} onChange={e => setEmpForm(p => ({ ...p, nssfNumber: e.target.value }))} /></div><div><Label>NHIF</Label><Input value={empForm.nhifNumber} onChange={e => setEmpForm(p => ({ ...p, nhifNumber: e.target.value }))} /></div></div>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}                    <div className="grid grid-cols-2 gap-3"><div><Label>Salary Type</Label><select value={empForm.salaryType} onChange={e => setEmpForm(p => ({ ...p, salaryType: e.target.value as any }))} className="w-full rounded border px-3 py-2 text-sm"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option><option value="hourly">Hourly</option></select></div><div><Label>Basic Salary</Label><Input type="number" step="0.01" value={empForm.basicSalary} onChange={e => setEmpForm(p => ({ ...p, basicSalary: e.target.value }))} required /></div></div>
                    <div className="grid grid-cols-3 gap-3"><div><Label>Bank</Label><Input value={empForm.bankName} onChange={e => setEmpForm(p => ({ ...p, bankName: e.target.value }))} /></div><div><Label>Account</Label><Input value={empForm.bankAccount} onChange={e => setEmpForm(p => ({ ...p, bankAccount: e.target.value }))} /></div><div><Label>Code</Label><Input value={empForm.bankCode} onChange={e => setEmpForm(p => ({ ...p, bankCode: e.target.value }))} /></div></div>
                    <div><Label>Employment Date</Label><Input type="date" value={empForm.employmentDate} onChange={e => setEmpForm(p => ({ ...p, employmentDate: e.target.value }))} required /></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createEmployee.isPending}>{createEmployee.isPending ? "Saving..." : "Add Employee"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={createdEmployee !== null} onOpenChange={(openState) => {
                if (!openState) {
                  setCreatedEmployee(null);
                  setEmpForm({ locationId: "", fullName: "", phone: "", idNumber: "", kraPin: "", nssfNumber: "", nhifNumber: "", salaryType: "monthly", basicSalary: "", bankName: "", bankAccount: "", bankCode: "", employmentDate: "" });
                }
              }}>
                <DialogContent className="bg-white">
                  <DialogHeader><DialogTitle className="font-serif text-xl">Employee Login Credentials</DialogTitle></DialogHeader>
                  {createdEmployee && (
                    <div className="space-y-4">
                      <p className="text-sm text-[#8D8A87]">
                        Save these credentials for <span className="font-medium text-[#2D2A26]">{createdEmployee.name}</span>. The password is shown only once.
                      </p>
                      <div className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6] p-4">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Username</p>
                          <p className="font-mono text-sm text-[#2D2A26]">{createdEmployee.username}</p>
                        </div>
                        <div className="mt-3 space-y-1">
                          <p className="text-xs uppercase tracking-wider text-[#8D8A87]">Temporary Password</p>
                          <p className="font-mono text-sm text-[#2D2A26]">{createdEmployee.initialPassword}</p>
                        </div>
                      </div>
                      <Button type="button" className="w-full bg-[#C73E1D]" onClick={() => setCreatedEmployee(null)}>
                        Done
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
                <DialogTrigger asChild><Button className="bg-[#C73E1D]"><Plus className="mr-2 h-4 w-4" /> Add Period</Button></DialogTrigger>
                <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl">Add Pay Period</DialogTitle></DialogHeader>
                  <form onSubmit={handlePeriod} className="space-y-3">
                    <div>
                      <LocationSelector
                      locations={locations}
                      assignedLocationIds={user?.assignedLocationIds ?? []}
                      value={periodForm.locationId}
                      onChange={v => setPeriodForm(p => ({ ...p, locationId: v }))}
                      enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
                        required
                       />
                    </div>
                    <div><Label>Period Name</Label><Input value={periodForm.periodName} onChange={e => setPeriodForm(p => ({ ...p, periodName: e.target.value }))} placeholder="e.g. May 2026" required /></div>
                    <div className="grid grid-cols-3 gap-3"><div><Label>Start</Label><Input type="date" value={periodForm.startDate} onChange={e => setPeriodForm(p => ({ ...p, startDate: e.target.value }))} required /></div><div><Label>End</Label><Input type="date" value={periodForm.endDate} onChange={e => setPeriodForm(p => ({ ...p, endDate: e.target.value }))} required /></div><div><Label>Pay Date</Label><Input type="date" value={periodForm.paymentDate} onChange={e => setPeriodForm(p => ({ ...p, paymentDate: e.target.value }))} required /></div></div>
                    <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createPeriod.isPending}>{createPeriod.isPending ? "Saving..." : "Add Period"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Employees */}
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-lg"><Users className="h-5 w-5"/>Employees</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Name</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Salary</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Type</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Actions</th></tr></thead>
              <tbody className="divide-y">{employees?.map(emp => (
                <tr key={emp.id} className="hover:bg-[#F5EDE6]/50">
                  <td className="py-2 text-sm font-medium">{emp.fullName}</td>
                  <td className="py-2 text-right font-mono text-sm">{formatKES(emp.basicSalary)}</td>
                  <td className="py-2 text-sm capitalize text-[#8D8A87]">{emp.salaryType}</td>
                  <td className="py-2 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-xs ${emp.isActive ? "bg-[#2E7D32]/10 text-[#2E7D32]" : "bg-[#D32F2F]/10 text-[#D32F2F]"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View employee details */}
                      <Dialog open={empViewOpen === emp.id} onOpenChange={v => setEmpViewOpen(v ? emp.id : null)}>
                        <DialogTrigger asChild><Button size="sm" variant="ghost"><UserCircle className="h-4 w-4 text-[#8D8A87]" /></Button></DialogTrigger>
                        <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                          <DialogHeader><DialogTitle className="font-serif text-xl">Employee Details</DialogTitle></DialogHeader>
                          {employeeDetail && (
                            <div className="space-y-3 text-sm">
                              <div className="rounded bg-[#F5EDE6] p-3"><p className="font-medium text-lg">{employeeDetail.fullName}</p><p className="text-xs text-[#8D8A87]">{locations?.find(l => l.id === employeeDetail.locationId)?.name}</p></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs">Phone</Label><p>{employeeDetail.phone}</p></div>
                                <div><Label className="text-xs">ID Number</Label><p>{employeeDetail.idNumber || "-"}</p></div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs">KRA PIN</Label><p>{employeeDetail.kraPin || "-"}</p></div>
                                <div><Label className="text-xs">Employment Date</Label><p>{formatDate(employeeDetail.employmentDate)}</p></div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs">NSSF</Label><p>{employeeDetail.nssfNumber || "-"}</p></div>
                                <div><Label className="text-xs">NHIF</Label><p>{employeeDetail.nhifNumber || "-"}</p></div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs">Bank</Label><p>{employeeDetail.bankName || "-"}</p></div>
                                <div><Label className="text-xs">Bank Account</Label><p>{employeeDetail.bankAccount || "-"}</p></div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><Label className="text-xs">Bank Code</Label><p>{employeeDetail.bankCode || "-"}</p></div>
                                <div><Label className="text-xs">Basic Salary</Label><p className="font-mono font-semibold">{formatKES(employeeDetail.basicSalary)}</p></div>
                              </div>
                              {canProcess && (
                                <div className="border-t border-[#E8E0D8] pt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-[#D32F2F] text-[#D32F2F] hover:bg-[#D32F2F]/10"
                                    onClick={() => setDeleteConfirm(employeeDetail.id)}
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" />Delete Employee
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Delete confirmation */}
                          <AlertDialog open={deleteConfirm !== null} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
                            <AlertDialogContent className="bg-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Employee & User Account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently deactivate the employee record{employeeDetail?.userId ? " and the linked user account" : ""}. 
                                  {employeeDetail?.userId ? " The user will no longer be able to log in." : ""}
                                  This action can be undone by an administrator.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-[#D32F2F] hover:bg-[#B71C1C]"
                                  onClick={() => { if (deleteConfirm) deleteEmployee.mutate({ id: deleteConfirm }); }}
                                  disabled={deleteEmployee.isPending}
                                >
                                  {deleteEmployee.isPending ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DialogContent>
                      </Dialog>
                      {/* Edit employee */}
                      {canProcess && (
                        <Dialog open={empEditOpen === emp.id} onOpenChange={v => setEmpEditOpen(v ? emp.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setEditEmpForm({
                              fullName: emp.fullName, phone: emp.phone, basicSalary: emp.basicSalary, isActive: emp.isActive,
                              bankName: emp.bankName ?? "", bankAccount: emp.bankAccount ?? "", bankCode: emp.bankCode ?? "",
                              idNumber: emp.idNumber ?? "", kraPin: emp.kraPin ?? "", nssfNumber: emp.nssfNumber ?? "", nhifNumber: emp.nhifNumber ?? "",
                              userId: String(emp.userId ?? ""),
                            })}><Pencil className="h-3 w-3 text-[#8D8A87]" /></Button>
                          </DialogTrigger>
                          <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle className="font-serif text-xl">Edit Employee</DialogTitle></DialogHeader>
                            <form onSubmit={e => { e.preventDefault(); const userIdNum = editEmpForm.userId ? Number(editEmpForm.userId) : null; updateEmployee.mutate({ id: emp.id, ...editEmpForm, userId: userIdNum }); }} className="space-y-3">
                              <div className="grid grid-cols-2 gap-3"><div><Label>Full Name</Label><Input value={editEmpForm.fullName} onChange={e => setEditEmpForm(p => ({ ...p, fullName: e.target.value }))} required /></div><div><Label>Phone</Label><Input value={editEmpForm.phone} onChange={e => setEditEmpForm(p => ({ ...p, phone: e.target.value }))} required /></div></div>
                              <div className="grid grid-cols-2 gap-3"><div><Label>Basic Salary</Label><Input type="number" step="0.01" value={editEmpForm.basicSalary} onChange={e => setEditEmpForm(p => ({ ...p, basicSalary: e.target.value }))} required /></div><div><Label>ID Number</Label><Input value={editEmpForm.idNumber} onChange={e => setEditEmpForm(p => ({ ...p, idNumber: e.target.value }))} /></div></div>
                              <div className="grid grid-cols-3 gap-3"><div><Label>Bank</Label><Input value={editEmpForm.bankName} onChange={e => setEditEmpForm(p => ({ ...p, bankName: e.target.value }))} /></div><div><Label>Account</Label><Input value={editEmpForm.bankAccount} onChange={e => setEditEmpForm(p => ({ ...p, bankAccount: e.target.value }))} /></div><div><Label>Code</Label><Input value={editEmpForm.bankCode} onChange={e => setEditEmpForm(p => ({ ...p, bankCode: e.target.value }))} /></div></div>
                              <div className="grid grid-cols-2 gap-3"><div><Label>KRA PIN</Label><Input value={editEmpForm.kraPin} onChange={e => setEditEmpForm(p => ({ ...p, kraPin: e.target.value }))} /></div><div><Label>Status</Label><select value={editEmpForm.isActive ? "active" : "inactive"} onChange={e => setEditEmpForm(p => ({ ...p, isActive: e.target.value === "active" }))} className="w-full rounded border px-3 py-2 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
                              <div><Label>Linked User Account</Label><select value={editEmpForm.userId} onChange={e => setEditEmpForm(p => ({ ...p, userId: e.target.value }))} className="w-full rounded border px-3 py-2 text-sm"><option value="">-- No linked user --</option>{allUsers?.map(u => (<option key={u.id} value={String(u.id)}>{u.name} ({u.email})</option>))}</select></div>
                              <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateEmployee.isPending}>Save Changes</Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}{(!employees || employees.length === 0) && <tr><td colSpan={5} className="py-8 text-center text-sm text-[#8D8A87]"><Users className="mx-auto mb-2 h-8 w-8 opacity-30"/>No employees yet.</td></tr>}</tbody>
            </table></div></CardContent>
          </Card>

          {/* Payroll Periods */}
          <Card className="border-[#E8E0D8]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-serif text-lg"><DollarSign className="h-5 w-5"/>Pay Periods</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Period</th><th className="pb-2 text-left text-xs uppercase text-[#8D8A87]">Dates</th><th className="pb-2 text-center text-xs uppercase text-[#8D8A87]">Status</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Total</th><th className="pb-2 text-right text-xs uppercase text-[#8D8A87]">Actions</th></tr></thead>
              <tbody className="divide-y">{periods?.map(period => (
                <tr key={period.id} className="hover:bg-[#F5EDE6]/50">
                  <td className="py-3 text-sm font-medium">{period.periodName}</td>
                  <td className="py-3 text-sm text-[#8D8A87]">{formatDate(period.startDate)} - {formatDate(period.endDate)}</td>
                  <td className="py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${period.status === "paid" ? "bg-[#2E7D32]/10 text-[#2E7D32]" : period.status === "processing" ? "bg-[#D4A854]/10 text-[#D4A854]" : "bg-[#8D8A87]/10 text-[#8D8A87]"}`}>
                      {period.status === "paid" ? <CheckCircle className="h-3 w-3"/> : period.status === "processing" ? <Clock className="h-3 w-3"/> : <Eye className="h-3 w-3"/>}
                      {period.status}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-sm font-semibold">{period.totalNetPay ? formatKES(period.totalNetPay) : "-"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canProcess && period.status === "open" && (
                        <Button size="sm" variant="outline" className="border-[#C73E1D] text-[#C73E1D]" onClick={() => { if (confirm("Process payroll for this period?")) processPayroll.mutate({ periodId: period.id }); }} disabled={processPayroll.isPending}><Play className="h-3 w-3" /></Button>
                      )}
                      {canProcess && period.status === "processing" && (
                        <Dialog open={payPeriod === period.id} onOpenChange={v => setPayPeriod(v ? period.id : null)}>
                          <DialogTrigger asChild><Button size="sm" className="bg-[#2E7D32]"><Banknote className="h-3 w-3 mr-1"/>Pay</Button></DialogTrigger>
                          <DialogContent className="bg-white">
                            <DialogHeader><DialogTitle className="font-serif text-xl">Mark Period as Paid</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="rounded bg-[#F5EDE6] p-3">
                                <p className="text-sm font-medium">{period.periodName}</p>
                                <p className="text-xs text-[#8D8A87]">Total net pay: {formatKES(period.totalNetPay ?? "0")}</p>
                                <p className="text-xs text-[#8D8A87]">{formatDate(period.startDate)} - {formatDate(period.endDate)}</p>
                              </div>
                              <div className="space-y-2">
                                <Label>Payment Account</Label>
                                <p className="text-xs text-[#8D8A87]">Select the account used to disburse payroll. Total will be deducted.</p>
                                <select onChange={(e) => { if (e.target.value) markPaid.mutate({ periodId: period.id, accountId: +e.target.value }); }} className="w-full rounded border px-3 py-2 text-sm">
                                  <option value="">Select account</option>
                                  {accounts?.filter(a => a.isActive).map(a => { const loc = locations?.find(l => l.id === a.locationId)?.name ?? ""; return <option key={a.id} value={a.id}>{a.name} {loc ? `· ${loc}` : ""} · {formatKES(a.currentBalance)}</option>; })}
                                </select>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setSelectedPeriod(period.id); setTimeout(() => utils.payroll.entries.invalidate(), 50); }} className={selectedPeriod === period.id ? "border-[#C73E1D] text-[#C73E1D]" : ""}><Eye className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}{(!periods || periods.length === 0) && <tr><td colSpan={5} className="py-8 text-center text-sm text-[#8D8A87]"><DollarSign className="mx-auto mb-2 h-8 w-8 opacity-30"/>No pay periods yet.</td></tr>}</tbody>
            </table></div></CardContent>
          </Card>
        </div>

        {/* Payroll entries for selected period */}
        {selectedPeriod && (
          <Card className="border-[#D4A854]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 font-serif text-lg">
                  <CreditCard className="h-5 w-5 text-[#D4A854]" />
                  Payroll Details: {selectedPeriodData?.periodName} {selectedLocationName && `· ${selectedLocationName}`}
                </CardTitle>
                {canProcess && selectedPeriodData?.status === "open" && (
                  <Dialog open={assignEmpOpen} onOpenChange={setAssignEmpOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="border-[#2E7D32] text-[#2E7D32]">
                        <UserPlus className="mr-1 h-4 w-4" /> Assign Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader><DialogTitle className="font-serif text-xl">Assign Employee to Period</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <p className="text-sm text-[#8D8A87]">Select an employee to add to <strong>{selectedPeriodData?.periodName}</strong>. Their salary will be calculated when you process payroll.</p>
                        <select value={assignEmpId} onChange={e => setAssignEmpId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                          <option value="">Select employee</option>
                          {employees?.filter(e => e.isActive && e.locationId === selectedPeriodData?.locationId && !periodEntries?.some(pe => pe.employee.id === e.id)).map(e => (
                            <option key={e.id} value={e.id}>{e.fullName} · {formatKES(e.basicSalary)}</option>
                          ))}
                        </select>
                        {employees?.filter(e => e.isActive && e.locationId === selectedPeriodData?.locationId && !periodEntries?.some(pe => pe.employee.id === e.id)).length === 0 && (
                          <p className="text-sm text-[#8D8A87]">No unassigned employees for this location.</p>
                        )}
                        <Button
                          onClick={() => { if (assignEmpId && selectedPeriod) addToPeriod.mutate({ periodId: selectedPeriod, employeeId: +assignEmpId }); }}
                          disabled={!assignEmpId || addToPeriod.isPending}
                          className="w-full bg-[#2E7D32]"
                        >
                          {addToPeriod.isPending ? "Adding..." : "Add to Period"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Employee</th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Basic Pay</th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Advances</th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Deductions</th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Net Pay</th>
                      <th className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Status</th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-[#8D8A87]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E0D8]">
                    {periodEntries && periodEntries.length > 0 ? (
                      periodEntries.map(({ employee, entry }) => (
                        <tr key={employee.id} className="hover:bg-[#F5EDE6]/50">
                          <td className="py-3 text-sm font-medium text-[#2D2A26]">{employee.fullName}</td>
                          <td className="py-3 text-right font-mono text-sm">{entry ? formatKES(entry.basicPay) : "-"}</td>
                          <td className="py-3 text-right font-mono text-sm text-[#D32F2F]">{entry ? formatKES(entry.advancesDeducted) : "-"}</td>
                          <td className="py-3 text-right font-mono text-sm text-[#D32F2F]">{entry ? formatKES(entry.deductions) : "-"}</td>
                          <td className="py-3 text-right font-mono text-sm font-semibold text-[#2E7D32]">{entry ? formatKES(entry.netPay) : "-"}</td>
                          <td className="py-3 text-center">
                            {entry ? (
                              entry.paidAt ? (
                                <span className="rounded-full bg-[#2E7D32]/10 px-2 py-0.5 text-xs text-[#2E7D32]">Paid</span>
                              ) : (
                                <span className="rounded-full bg-[#D4A854]/10 px-2 py-0.5 text-xs text-[#D4A854]">Pending</span>
                              )
                            ) : (
                              <span className="rounded-full bg-[#8D8A87]/10 px-2 py-0.5 text-xs text-[#8D8A87]">Not assigned</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {canProcess && selectedPeriodData?.status === "open" && (
                              <div className="flex items-center justify-end gap-1">
                                {!entry && (
                                  <Button size="sm" variant="ghost" onClick={() => addToPeriod.mutate({ periodId: selectedPeriod!, employeeId: employee.id })} disabled={addToPeriod.isPending}>
                                    <UserPlus className="h-4 w-4 text-[#2E7D32]" />
                                  </Button>
                                )}
                                {entry && (
                                  <Dialog open={deductOpen === employee.id} onOpenChange={v => { setDeductOpen(v ? employee.id : null); if (v) setDeductForm({ grossPay: entry.basicPay, insurancePremium: "" }); }}>
                                    <DialogTrigger asChild><Button size="sm" variant="ghost"><Calculator className="h-4 w-4 text-[#D4A854]" /></Button></DialogTrigger>
                                    <DialogContent className="bg-white"><DialogHeader><DialogTitle className="font-serif text-xl flex items-center gap-2"><Calculator className="h-5 w-5 text-[#D4A854]"/>Deductions: {employee.fullName}</DialogTitle></DialogHeader>
                                      <div className="space-y-3">
                                        <div className="rounded-lg bg-[#F5EDE6] p-3">
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><span className="text-[#8D8A87]">Gross Pay:</span> <span className="font-mono font-semibold">{formatKES(entry.basicPay)}</span></div>
                                            <div><span className="text-[#8D8A87]">Advances:</span> <span className="font-mono font-semibold text-[#D32F2F]">{formatKES(entry.advancesDeducted)}</span></div>
                                          </div>
                                        </div>
                                        {computedDeductions && (
                                          <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="flex items-center gap-2"><Landmark className="h-3 w-3 text-[#8D8A87]"/>NHIF ({payrollSet?.nhifRate ?? "2.75"}%)</span><span className="font-mono">{formatKES(computedDeductions.nhif)}</span></div>
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="flex items-center gap-2"><Landmark className="h-3 w-3 text-[#8D8A87]"/>NSSF Employee</span><span className="font-mono">{formatKES(computedDeductions.nssfEmployee)}</span></div>
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="flex items-center gap-2"><Landmark className="h-3 w-3 text-[#8D8A87]"/>NSSF Employer</span><span className="font-mono">{formatKES(computedDeductions.nssfEmployer)}</span></div>
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="flex items-center gap-2"><Shield className="h-3 w-3 text-[#8D8A87]"/>PAYE (after relief)</span><span className="font-mono font-semibold text-[#D32F2F]">{formatKES(computedDeductions.paye)}</span></div>
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="text-[#8D8A87]">Taxable Income</span><span className="font-mono">{formatKES(computedDeductions.taxableIncome)}</span></div>
                                            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-1"><span className="text-[#8D8A87]">Total Deductions</span><span className="font-mono font-semibold text-[#D32F2F]">{formatKES(computedDeductions.totalDeductions)}</span></div>
                                            <div className="flex items-center justify-between pt-1"><span className="font-semibold">Net Pay (computed)</span><span className="font-mono text-lg font-bold text-[#2E7D32]">{formatKES(computedDeductions.netPay)}</span></div>
                                          </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                          <div><Label className="text-xs">Gross Pay Override</Label><Input type="number" step="0.01" value={deductForm.grossPay} onChange={e => setDeductForm(p => ({ ...p, grossPay: e.target.value }))} /></div>
                                          <div><Label className="text-xs">Insurance Premium</Label><Input type="number" step="0.01" value={deductForm.insurancePremium} onChange={e => setDeductForm(p => ({ ...p, insurancePremium: e.target.value }))} placeholder="Optional" /></div>
                                        </div>
                                        <p className="text-xs text-[#8D8A87]">Adjust gross pay to preview deductions for different salary amounts.</p>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
                                {entry && !entry.paidAt && (
                                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${employee.fullName} from this period?`)) removeFromPeriod.mutate({ periodId: selectedPeriod!, employeeId: employee.id }); }}>
                                    <UserMinus className="h-4 w-4 text-[#D32F2F]" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={7} className="py-8 text-center text-sm text-[#8D8A87]">
                        {selectedPeriodData?.status === "open" ? <p>No employees assigned. Click <strong>Assign Employee</strong> to add staff.</p> : <p>No entries found.</p>}
                      </td></tr>
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
