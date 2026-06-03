// ABOUTME: Debt management page — list, create, edit, delete debts, disburse loan proceeds,
// ABOUTME: record ad-hoc payments, and generate scheduled installment bills.
// ABOUTME: When `embedded` is true, the title/header and the Add Debt trigger are not
// ABOUTME: rendered — the parent (Accounts hub) provides both, mirroring how the Add
// ABOUTME: Account and Add Method buttons sit at the section level above the inner tabs.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LocationSelector } from "@/components/LocationSelector";
import { DisburseDebtDialog } from "@/components/DisburseDebtDialog";
import { AddDebtDialog } from "@/components/AddDebtDialog";
import { Plus, Pencil, Trash2, Wallet, CalendarDays, Landmark, BadgeInfo, AlertTriangle, CheckCircle, Clock, Gauge, Building2, FilePlus, Link2 } from "lucide-react";
import { toast } from "sonner";

export function Debts({ embedded }: { embedded?: boolean }) {
  const { user } = useAuth();
  const role = user?.role ?? "viewer";
  const canManage = hasPermission(role, PERMISSIONS.DEBTS_MANAGE);

  const [editId, setEditId] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [disburseId, setDisburseId] = useState<number | null>(null);

  type PaymentSchedule = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

  const [form, setForm] = useState<{
    creditorName: string;
    description: string;
    totalAmount: string;
    interestRate: string;
    dueDate: string;
    paymentSchedule: PaymentSchedule;
    notes: string;
  }>({
    creditorName: "", description: "",
    totalAmount: "", interestRate: "", dueDate: "",
    paymentSchedule: "monthly", notes: "",
  });

  const [payForm, setPayForm] = useState({ amount: "" });

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: debts } = trpc.debts.list.useQuery({});
  const { data: bankAccounts } = trpc.debts.bankAccounts.useQuery(undefined, {
    retry: false,
  });

  const utils = trpc.useUtils();
  const invalidate = () => { utils.debts.list.invalidate(); };

  const updateDebt = trpc.debts.update.useMutation({
    onSuccess: () => { setEditId(null); invalidate(); toast.success("Debt updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDebt = trpc.debts.delete.useMutation({
    onSuccess: () => { setDeleteId(null); invalidate(); toast.success("Debt deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const recordPayment = trpc.debts.recordPayment.useMutation({
    onSuccess: () => { setPaymentId(null); setPayForm({ amount: "" }); invalidate(); toast.success("Payment recorded"); },
    onError: (e) => toast.error(e.message),
  });
  const generateInstallment = trpc.debts.generateInstallment.useMutation({
    onSuccess: (res) => {
      invalidate();
      toast.success(`Installment bill #${res.billId} generated. Pay it from the Bills page.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({
      creditorName: "", description: "",
      totalAmount: "", interestRate: "", dueDate: "",
      paymentSchedule: "monthly", notes: "",
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    const debt = debts?.find(d => d.id === editId);
    if (!debt) return;
    const updates: Record<string, unknown> = { id: editId };
    if (form.creditorName) updates.creditorName = form.creditorName;
    if (form.description) updates.description = form.description;
    if (form.totalAmount) updates.totalAmount = form.totalAmount;
    if (form.interestRate) updates.interestRate = form.interestRate;
    if (form.dueDate) updates.dueDate = form.dueDate;
    if (form.paymentSchedule) updates.paymentSchedule = form.paymentSchedule;
    if (form.notes !== undefined) updates.notes = form.notes;
    updateDebt.mutate(updates as Parameters<typeof updateDebt.mutate>[0]);
  };

  const openEdit = (debt: NonNullable<typeof debts>[number]) => {
    setEditId(debt.id);
    setForm({
      creditorName: debt.creditorName,
      description: debt.description ?? "",
      totalAmount: debt.totalAmount,
      interestRate: debt.interestRate ?? "",
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().split("T")[0] : "",
      paymentSchedule: (debt.paymentSchedule ?? "monthly") as PaymentSchedule,
      notes: debt.notes ?? "",
    });
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentId === null) return;
    recordPayment.mutate({ id: paymentId, amount: payForm.amount });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active": return "text-[#2E7D32] bg-[#2E7D32]/10";
      case "paid": return "text-[#1565C0] bg-[#1565C0]/10";
      case "overdue": return "text-[#D32F2F] bg-[#D32F2F]/10";
      case "defaulted": return "text-[#616161] bg-[#616161]/10";
      default: return "text-[#8D8A87] bg-[#8D8A87]/10";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Clock className="h-3 w-3" />;
      case "paid": return <CheckCircle className="h-3 w-3" />;
      case "overdue": return <AlertTriangle className="h-3 w-3" />;
      case "defaulted": return <AlertTriangle className="h-3 w-3" />;
      default: return <BadgeInfo className="h-3 w-3" />;
    }
  };

  const calcProgress = (paid: string, total: string) => {
    const p = parseFloat(paid);
    const t = parseFloat(total);
    if (t === 0) return 0;
    return Math.min(Math.round((p / t) * 100), 100);
  };

  const calcRemaining = (paid: string, total: string) => {
    return (parseFloat(total) - parseFloat(paid)).toFixed(2);
  };

  const isLongTerm = (loanDate: string | Date | null, dueDate: string | Date | null) => {
    if (!loanDate || !dueDate) return false;
    const start = new Date(loanDate).getTime();
    const end = new Date(dueDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return (end - start) / (1000 * 60 * 60 * 24) > 365;
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Debts</h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Track and manage debts, loans, and payment schedules</p>
          </div>
          <div className="flex gap-2">
            <AddDebtDialog onSuccess={invalidate} />
          </div>
        </div>
      )}

      {/* Debt Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {debts?.map(debt => {
          const progress = calcProgress(debt.paidAmount, debt.totalAmount);
          const remaining = calcRemaining(debt.paidAmount, debt.totalAmount);
          const locationName = locations?.find(l => l.id === debt.locationId)?.name ?? "";
          const destAcct = bankAccounts?.find(a => a.id === debt.destinationAccountId);
          return (
            <Card key={debt.id} className="border-[#E8E0D8] bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C73E1D]/10 text-[#C73E1D]">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="font-serif text-base">{debt.creditorName}</CardTitle>
                      {locationName && <p className="text-xs text-[#8D8A87]">{locationName}</p>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(debt.status)}`}>
                    {getStatusIcon(debt.status)}{debt.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {debt.description && <p className="text-sm text-[#8D8A87]">{debt.description}</p>}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#8D8A87]">Payment Progress</span>
                    <span className="font-medium text-[#2D2A26]">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-[#E8E0D8]" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-[#F5EDE6] p-2">
                    <p className="text-xs text-[#8D8A87]">Total</p>
                    <p className="font-mono text-sm font-semibold text-[#2D2A26]">{formatKES(debt.totalAmount)}</p>
                  </div>
                  <div className="rounded bg-[#E8F5E9] p-2">
                    <p className="text-xs text-[#8D8A87]">Paid</p>
                    <p className="font-mono text-sm font-semibold text-[#2E7D32]">{formatKES(debt.paidAmount)}</p>
                  </div>
                  <div className="rounded bg-[#FFF3E0] p-2">
                    <p className="text-xs text-[#8D8A87]">Remaining</p>
                    <p className={`font-mono text-sm font-semibold ${parseFloat(remaining) > 0 ? "text-[#D32F2F]" : "text-[#2E7D32]"}`}>{formatKES(remaining)}</p>
                  </div>
                  <div className="rounded bg-[#F3E5F5] p-2">
                    <p className="text-xs text-[#8D8A87]">Interest</p>
                    <p className="font-mono text-sm font-semibold text-[#2D2A26]">{debt.interestRate ? `${debt.interestRate}%` : "-"}</p>
                  </div>
                </div>

                <div className="space-y-1 rounded border border-[#E8E0D8] bg-[#FAF7F2] p-2 text-xs">
                  <div className="flex items-center gap-1 text-[#8D8A87]">
                    <Building2 className="h-3 w-3" />
                    <span>Loan Account:</span>
                    <span className="font-mono font-semibold text-[#2D2A26]">
                      {debt.loanAccountId ? `Account #${debt.loanAccountId}` : "Unclassified"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#8D8A87]">
                    <Landmark className="h-3 w-3" />
                    <span>Destination:</span>
                    <span className="font-medium text-[#2D2A26]">
                      {destAcct ? destAcct.name : debt.destinationAccountId ? `Account #${debt.destinationAccountId}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#8D8A87]">
                    {debt.isDisbursed ? <CheckCircle className="h-3 w-3 text-[#2E7D32]" /> : <AlertTriangle className="h-3 w-3 text-[#D4A854]" />}
                    <span>Disbursement:</span>
                    <span className={`font-medium ${debt.isDisbursed ? "text-[#2E7D32]" : "text-[#D4A854]"}`}>
                      {debt.isDisbursed ? `Posted ${debt.disbursementDate ? formatDate(debt.disbursementDate) : ""}` : "Pending"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#8D8A87]">
                  {debt.loanDate && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Loaned: {formatDate(debt.loanDate)}
                    </span>
                  )}
                  {debt.dueDate && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Due: {formatDate(debt.dueDate)}
                    </span>
                  )}
                  {debt.paymentSchedule && (
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {debt.paymentSchedule}
                    </span>
                  )}
                  {debt.installmentAmount && (
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {formatKES(debt.installmentAmount)} / period
                    </span>
                  )}
                </div>

                {canManage && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Dialog open={paymentId === debt.id} onOpenChange={v => { setPaymentId(v ? debt.id : null); setPayForm({ amount: "" }); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="border-[#2E7D32] text-[#2E7D32]" disabled={debt.status === "paid"}>
                          <Wallet className="mr-1 h-3 w-3" /> Pay
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white">
                        <DialogHeader><DialogTitle className="font-serif text-xl">Record Payment</DialogTitle></DialogHeader>
                        <form onSubmit={handlePayment} className="space-y-3">
                          <div className="rounded bg-[#F5EDE6] p-3">
                            <p className="text-sm font-medium">{debt.creditorName}</p>
                            <p className="text-xs text-[#8D8A87]">Remaining: {formatKES(remaining)} · Status: {debt.status}</p>
                          </div>
                          <div className="space-y-2"><Label>Payment Amount</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
                              <Input type="number" step="0.01" max={parseFloat(remaining)} value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className="pl-10" required />
                            </div>
                          </div>
                          <Button type="submit" className="w-full bg-[#2E7D32]" disabled={recordPayment.isPending}>
                            {recordPayment.isPending ? "Processing..." : "Record Payment"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    {!debt.isDisbursed && (
                      <Button size="sm" variant="outline" className="border-[#D4A854] text-[#D4A854]" onClick={() => setDisburseId(debt.id)}>
                        <Link2 className="mr-1 h-3 w-3" /> Disburse
                      </Button>
                    )}

                    {debt.recurringBillTemplateId && (
                      <Button size="sm" variant="outline" className="border-[#1565C0] text-[#1565C0]" onClick={() => generateInstallment.mutate({ id: debt.id })} disabled={generateInstallment.isPending}>
                        <FilePlus className="mr-1 h-3 w-3" /> Generate Installment
                      </Button>
                    )}

                    <Button size="sm" variant="ghost" onClick={() => openEdit(debt)}>
                      <Pencil className="h-4 w-4 text-[#8D8A87]" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(debt.id)}>
                      <Trash2 className="h-4 w-4 text-[#D32F2F]" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(!debts || debts.length === 0) && (
          <div className="col-span-full rounded-xl border border-[#E8E0D8] bg-white p-12 text-center text-sm text-[#8D8A87]">
            <Landmark className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>No debts recorded yet.</p>
            {canManage && <p className="mt-1 text-xs">Click "Add Debt" to get started.</p>}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={v => { if (!v) setEditId(null); }}>
        <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-xl">Edit Debt</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="space-y-2"><Label>Creditor Name</Label><Input value={form.creditorName} onChange={e => setForm(p => ({ ...p, creditorName: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Total Amount</Label><Input type="number" step="0.01" value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Payment Schedule</Label>
                <select value={form.paymentSchedule} onChange={e => setForm(p => ({ ...p, paymentSchedule: e.target.value as PaymentSchedule }))} className="w-full rounded border px-3 py-2 text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm min-h-[60px]" />
            </div>
            <Button type="submit" className="w-full bg-[#C73E1D]" disabled={updateDebt.isPending}>
              {updateDebt.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disburse dialog */}
      <DisburseDebtDialog
        debtId={disburseId}
        open={disburseId !== null}
        onOpenChange={(v) => { if (!v) setDisburseId(null); }}
        defaultDate={getLocalDateString()}
        onSuccess={() => { setDisburseId(null); invalidate(); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this debt record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId !== null) deleteDebt.mutate({ id: deleteId }); }}
              className="bg-[#D32F2F] hover:bg-[#B71C1C]"
              disabled={deleteDebt.isPending}
            >
              {deleteDebt.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
