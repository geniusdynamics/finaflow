// ABOUTME: Reusable Add Debt dialog — renders the full debt-creation form.
// ABOUTME: Used both in the Accounts page header (when the Debts inner tab is active)
// ABOUTME: and in the standalone Debts page, so the trigger can sit at the parent level
// ABOUTME: alongside Add Account and Add Method.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatKES, getLocalDateString } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LocationSelector } from "@/components/LocationSelector";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type PaymentSchedule = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

interface AddDebtDialogProps {
  trigger?: "button" | "controlled";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onSuccess?: () => void;
}

export function AddDebtDialog({ trigger = "button", open: controlledOpen, onOpenChange, onSuccess }: AddDebtDialogProps) {
  const { user } = useAuth();
  const permContext = user?.permissions?.length ? user.permissions : (user?.role ?? "viewer");
  const canManage = hasPermission(permContext, PERMISSIONS.DEBTS_MANAGE);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };

  const [form, setForm] = useState<{
    locationId: string;
    creditorName: string;
    description: string;
    totalAmount: string;
    interestRate: string;
    dueDate: string;
    loanDate: string;
    installmentAmount: string;
    paymentSchedule: PaymentSchedule;
    destinationAccountId: string;
    disburseImmediately: boolean;
    notes: string;
  }>({
    locationId: "", creditorName: "", description: "",
    totalAmount: "", interestRate: "", dueDate: "",
    loanDate: getLocalDateString(),
    installmentAmount: "",
    paymentSchedule: "monthly",
    destinationAccountId: "",
    disburseImmediately: true,
    notes: "",
  });

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();
  const { data: bankAccounts } = trpc.debts.bankAccounts.useQuery(undefined, { retry: false });

  const createDebt = trpc.debts.create.useMutation({
    onSuccess: (res) => {
      const accountLabel = res.loanAccountId ? ` (account #${res.loanAccountId})` : "";
      toast.success(`Debt added${accountLabel}`);
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({
      locationId: "", creditorName: "", description: "",
      totalAmount: "", interestRate: "", dueDate: "",
      loanDate: getLocalDateString(),
      installmentAmount: "",
      paymentSchedule: "monthly",
      destinationAccountId: "",
      disburseImmediately: true,
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.destinationAccountId) {
      toast.error("Please select a destination account.");
      return;
    }
    createDebt.mutate({
      locationId: +form.locationId,
      creditorName: form.creditorName,
      description: form.description || undefined,
      totalAmount: form.totalAmount,
      interestRate: form.interestRate || undefined,
      dueDate: form.dueDate || undefined,
      loanDate: form.loanDate || undefined,
      paymentSchedule: form.paymentSchedule,
      destinationAccountId: +form.destinationAccountId,
      disburseImmediately: form.disburseImmediately,
      installmentAmount: form.installmentAmount || undefined,
      notes: form.notes || undefined,
    });
  };

  const isLongTerm = (loanDate: string | Date | null, dueDate: string | Date | null) => {
    if (!loanDate || !dueDate) return false;
    const start = new Date(loanDate).getTime();
    const end = new Date(dueDate).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return (end - start) / (1000 * 60 * 60 * 24) > 365;
  };

  const dialogBody = (
    <DialogContent className="bg-white max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-serif text-xl">Add New Debt</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Location</Label>
            <LocationSelector
              locations={locations}
              assignedLocationIds={user?.assignedLocationIds ?? []}
              value={form.locationId}
              onChange={v => setForm(p => ({ ...p, locationId: v }))}
              enforceAssigned={settings?.["enforceLocationAssignment"] === "true"}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Schedule</Label>
            <select value={form.paymentSchedule} onChange={e => setForm(p => ({ ...p, paymentSchedule: e.target.value as PaymentSchedule }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Installment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
              <Input type="number" step="0.01" value={form.installmentAmount} onChange={e => setForm(p => ({ ...p, installmentAmount: e.target.value }))} className="pl-10" placeholder="e.g. 5000" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Loan Date <span className="text-[#D32F2F]">*</span></Label>
            <Input type="date" value={form.loanDate} onChange={e => setForm(p => ({ ...p, loanDate: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Destination Account (Bank / Cash / Wallet) <span className="text-[#D32F2F]">*</span></Label>
          <p className="text-xs text-[#8D8A87]">The real account that will receive the loan proceeds. Auto-classified to 2600 (≤1y) or 2700 (&gt;1y) on save.</p>
          <select value={form.destinationAccountId} onChange={e => setForm(p => ({ ...p, destinationAccountId: e.target.value }))} className="w-full rounded-lg border border-[#E8E0D8] px-3 py-2 text-sm" required>
            <option value="">Select destination account…</option>
            {bankAccounts?.map(a => <option key={a.id} value={a.id}>{a.name}{a.accountNumber ? ` (${a.accountNumber})` : ""} · {a.type === "bank_account" ? "Bank" : a.type === "mpesa" ? "Wallet" : "Cash"} · Bal: {formatKES(a.currentBalance)}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.disburseImmediately} onChange={e => setForm(p => ({ ...p, disburseImmediately: e.target.checked }))} className="rounded" />
            <span className="font-medium text-[#2D2A26]">Disburse immediately on save</span>
          </label>
          {!form.disburseImmediately && (
            <p className="ml-6 text-xs text-[#D4A854]">Will record only the loan liability now. You can post the cash leg later from the debt card.</p>
          )}
          {form.dueDate && form.loanDate && (
            <p className="ml-6 text-xs text-[#8D8A87]">
              Term: {Math.max(0, Math.round((new Date(form.dueDate).getTime() - new Date(form.loanDate).getTime()) / (1000 * 60 * 60 * 24)))} days · will be classified as{" "}
              <span className="font-semibold text-[#2D2A26]">
                {isLongTerm(form.loanDate, form.dueDate) ? "2700 Long-Term Loan Payable" : "2600 Current Loan Payable"}
              </span>
            </p>
          )}
        </div>

        <div className="space-y-2"><Label>Creditor Name</Label><Input value={form.creditorName} onChange={e => setForm(p => ({ ...p, creditorName: e.target.value }))} placeholder="e.g. KCB Bank, Supplier XYZ" required /></div>
        <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Purpose of the debt" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Total Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
              <Input type="number" step="0.01" value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} className="pl-10" required />
            </div>
          </div>
          <div className="space-y-2"><Label>Interest Rate (%)</Label>
            <Input type="number" step="0.01" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} placeholder="e.g. 12.5" />
          </div>
        </div>
        <div className="space-y-2"><Label>Notes</Label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm min-h-[60px]" placeholder="Optional notes" />
        </div>
        <Button type="submit" className="w-full bg-[#C73E1D]" disabled={createDebt.isPending}>
          {createDebt.isPending ? "Saving..." : "Add Debt"}
        </Button>
      </form>
    </DialogContent>
  );

  if (trigger === "controlled" || controlledOpen !== undefined) {
    // Controlled mode — caller manages open state, no trigger button rendered.
    return <Dialog open={open} onOpenChange={setOpen}>{dialogBody}</Dialog>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {canManage && (
        <DialogTrigger asChild>
          <Button className="bg-[#C73E1D] hover:bg-[#C73E1D]/90" onClick={() => { if (!open) resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Debt
          </Button>
        </DialogTrigger>
      )}
      {dialogBody}
    </Dialog>
  );
}
