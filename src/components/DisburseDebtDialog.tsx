// ABOUTME: Dialog that records the cash leg of a deferred loan — debits the destination
// ABOUTME: bank account, credits the loan liability account, optionally debits a Bank Charges
// ABOUTME: expense account for the arrangement fee. Mirrors the structure of the wallet
// ABOUTME: "Link Topup to Bank Account" dialog.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKES, formatDate } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Landmark, CalendarDays, AlertTriangle } from "lucide-react";

interface DisburseDebtDialogProps {
  debtId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onSuccess?: () => void;
}

export function DisburseDebtDialog({ debtId, open, onOpenChange, defaultDate, onSuccess }: DisburseDebtDialogProps) {
  const [disbursementDate, setDisbursementDate] = useState(defaultDate);
  const [fee, setFee] = useState("");

  useEffect(() => {
    if (open) {
      setDisbursementDate(defaultDate);
      setFee("");
    }
  }, [open, defaultDate]);

  const { data: debt } = trpc.debts.get.useQuery(
    { id: debtId ?? 0 },
    { enabled: open && debtId !== null }
  );
  const { data: bankAccounts } = trpc.debts.bankAccounts.useQuery(undefined, {
    enabled: open,
    retry: false,
  });

  const utils = trpc.useUtils();
  const disburse = trpc.debts.disburse.useMutation({
    onSuccess: () => {
      toast.success("Loan disbursed. Cash leg posted to the bank and liability accounts.");
      utils.debts.list.invalidate();
      utils.debts.get.invalidate();
      onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const destAcct = debt?.destinationAccountId
    ? bankAccounts?.find(a => a.id === debt.destinationAccountId)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debtId === null) return;
    if (!disbursementDate) {
      toast.error("Disbursement date is required.");
      return;
    }
    disburse.mutate({
      id: debtId,
      disbursementDate,
      fee: fee ? fee : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">Disburse Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {debt && (
            <div className="rounded-lg bg-[#F5EDE6] p-3">
              <p className="text-sm font-medium text-[#2D2A26]">{debt.creditorName}</p>
              <p className="text-xs text-[#8D8A87]">
                Principal: {formatKES(debt.totalAmount)} · Loaned: {formatDate(debt.loanDate)}
              </p>
              {destAcct && (
                <p className="mt-1 flex items-center gap-1 text-xs text-[#2D2A26]">
                  <Landmark className="h-3 w-3" /> Destination: {destAcct.name} ({formatKES(destAcct.currentBalance)})
                </p>
              )}
              {debt.loanAccountId && (
                <p className="text-[10px] text-[#8D8A87]">Loan Account: #{debt.loanAccountId}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Disbursement Date
            </Label>
            <Input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} required />
            <p className="text-xs text-[#8D8A87]">Date the bank actually released the funds. The cash leg is posted on this date.</p>
          </div>

          <div className="space-y-2">
            <Label>Arrangement Fee (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8D8A87]">KES</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fee}
                onChange={e => setFee(e.target.value)}
                className="pl-10"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-[#8D8A87]">
              If the bank deducted an arrangement fee, the net cash to the destination will be reduced by this amount, and the fee posted to the Bank Charges expense account.
            </p>
          </div>

          {fee && parseFloat(fee) > 0 && debt && (
            <div className="rounded border border-[#D4A854]/30 bg-[#D4A854]/5 p-2 text-xs text-[#8D8A87]">
              <p className="flex items-center gap-1 font-medium text-[#2D2A26]">
                <AlertTriangle className="h-3 w-3 text-[#D4A854]" /> Posting preview
              </p>
              <ul className="mt-1 space-y-0.5 pl-4">
                <li>Debit {destAcct?.name ?? "destination bank"}: {formatKES((parseFloat(debt.totalAmount) - parseFloat(fee)).toFixed(2))}</li>
                <li>Debit Bank Charges: {formatKES(fee)}</li>
                <li>Credit Loan Liability: {formatKES(debt.totalAmount)}</li>
              </ul>
            </div>
          )}

          <Button type="submit" className="w-full bg-[#D4A854] hover:bg-[#D4A854]/90" disabled={disburse.isPending}>
            <Landmark className="mr-2 h-4 w-4" />
            {disburse.isPending ? "Posting..." : "Confirm Disbursement"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
