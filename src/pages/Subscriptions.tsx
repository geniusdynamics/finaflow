// ABOUTME: Subscriptions page — summary strip, filters, cards/table/split views, detail, payment and cancellation dialogs.
// ABOUTME: Handles ?highlight=<id> notification deep links; embedded mode hides the page header for hub hosting.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { formatKES, formatDate, getLocalDateString } from "@/lib/utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedToggle, type SegmentedToggleOption } from "@/components/ui/segmented-toggle";
import { LocationSelector } from "@/components/LocationSelector";
import { SubscriptionFormDialog } from "@/components/SubscriptionFormDialog";
import { SubscriptionStats } from "@/components/SubscriptionStats";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  EllipsisVertical,
  ExternalLink,
  Loader2,
  Pencil,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

/** Maps payment method to allowed account type values in the DB */
const PAYMENT_METHOD_ACCOUNT_TYPES: Record<string, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

const CYCLE_LABELS: Record<string, [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
  year: ["year", "years"],
};

function cycleLabel(unit: string, count: number): string {
  const [one, many] = CYCLE_LABELS[unit] ?? ["cycle", "cycles"];
  return count === 1 ? one : `${count} ${many}`;
}

function fmtMoney(value: string | null | undefined, currency = "KES"): string {
  if (value == null) return "-";
  if (currency === "KES") return formatKES(value);
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dueLabel(row: { daysUntilDue: number; isDueSoon: boolean; isOverdue: boolean }): { text: string; className: string } {
  const days = row.daysUntilDue;
  if (row.isOverdue || days < 0) return { text: `OVERDUE ${Math.abs(days)}d`, className: "text-[#D32F2F]" };
  if (days === 0) return { text: "DUE TODAY", className: "text-[#ED6C02]" };
  return {
    text: `in ${days} day${days === 1 ? "" : "s"}`,
    className: row.isDueSoon ? "text-[#ED6C02]" : "text-[#8D8A87]",
  };
}

function statusChipStyle(status: string): string {
  switch (status) {
    case "active": return "text-[#2E7D32] bg-[#2E7D32]/10";
    case "paused": return "text-[#ED6C02] bg-[#ED6C02]/10";
    case "cancelled": return "text-[#8D8A87] bg-[#8D8A87]/10";
    case "expired": return "text-[#D32F2F] bg-[#D32F2F]/10";
    default: return "text-[#8D8A87] bg-[#8D8A87]/10";
  }
}

interface SubscriptionRow {
  id: number;
  locationId: number | null;
  postingLocationId: number | null;
  name: string;
  description: string | null;
  vendorId: number | null;
  categoryId: number | null;
  amount: string;
  currency: string;
  cycleUnit: string;
  cycleCount: number;
  isOneTime: boolean;
  startDate: string;
  nextDueDate: string;
  autoRenew: boolean;
  status: string;
  cancelReason: string | null;
  replacedBySubscriptionId: number | null;
  defaultAccountId: number | null;
  postingMode: string;
  url: string | null;
  notifyEnabled: boolean;
  notifyDaysBefore: number | null;
  notes: string | null;
  updatedAt: Date | string;
  monthlyNormalized: string;
  yearlyNormalized: string;
  convertedMonthly: string | null;
  convertedYearly: string | null;
  progress: number;
  daysUntilDue: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  branchName: string | null;
  vendorName: string | null;
  categoryName: string | null;
  postingModeLabel: string;
  lastPaidDate: string | null;
}

interface SubscriptionDetail extends SubscriptionRow {
  successorName: string | null;
  predecessorName: string | null;
  paymentCount?: number;
}

interface PaymentRow {
  id: number;
  subscriptionId: number;
  cycleDueDate: string;
  amount: string;
  currency: string;
  paidDate: string | null;
  paymentMethod: string | null;
  reference: string | null;
  confirmed: boolean;
}

interface FundingAccount {
  id: number;
  type: string;
  name: string;
  deletedAt?: string | null;
  locationId?: number | null;
}

function getFundingAccounts(paymentMethod: string, allAccounts: FundingAccount[] | undefined, locationId?: number): FundingAccount[] {
  const allowedTypes = PAYMENT_METHOD_ACCOUNT_TYPES[paymentMethod] ?? [];
  return (allAccounts ?? []).filter((a) => allowedTypes.includes(a.type) && !a.deletedAt && (!locationId || a.locationId === locationId));
}

function SubscriptionKpis({ row, baseCurrency }: { row: SubscriptionRow; baseCurrency?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded bg-[#F5EDE6] p-2">
        <p className="text-xs text-[#8D8A87]">Monthly</p>
        <p className="font-mono text-sm font-semibold text-[#2D2A26]">{fmtMoney(row.monthlyNormalized, row.currency)}</p>
      </div>
      <div className="rounded bg-[#F5EDE6] p-2">
        <p className="text-xs text-[#8D8A87]">Yearly</p>
        <p className="font-mono text-sm font-semibold text-[#2D2A26]">{fmtMoney(row.yearlyNormalized, row.currency)}</p>
      </div>
      <div className="rounded bg-[#E8F5E9] p-2">
        <p className="text-xs text-[#8D8A87]">Converted monthly</p>
        <p className="font-mono text-sm font-semibold text-[#2E7D32]">
          {row.convertedMonthly != null ? fmtMoney(row.convertedMonthly, baseCurrency ?? "KES") : "Unavailable"}
        </p>
      </div>
      <div className="rounded bg-[#FFF3E0] p-2">
        <p className="text-xs text-[#8D8A87]">Posting</p>
        <p className="text-sm font-semibold text-[#ED6C02]">{row.postingModeLabel}</p>
      </div>
    </div>
  );
}

function PaymentHistoryTable({ subscriptionId, canConfirm }: { subscriptionId: number; canConfirm: boolean }) {
  const utils = trpc.useUtils();
  const paymentsQuery = trpc.subscriptions.payments.list.useQuery(
    { subscriptionId, page: 1, pageSize: 50 },
    { enabled: subscriptionId > 0 },
  );
  const confirmPayment = trpc.subscriptions.confirmPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment confirmed");
      utils.subscriptions.payments.list.invalidate();
      utils.subscriptions.get.invalidate();
      utils.subscriptions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const payments = (paymentsQuery.data?.rows ?? []) as PaymentRow[];

  return (
    <div>
      <h3 className="mb-2 font-serif text-base font-semibold text-[#2D2A26]">Payment History</h3>
      {payments.length === 0 ? (
        <p className="text-sm text-[#8D8A87]">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8E0D8] text-left text-xs text-[#8D8A87]">
                <th className="py-2 pr-3">Cycle due</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 pr-3">Status</th>
                {canConfirm && <th className="py-2">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E0D8]">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-[#F5EDE6]/50">
                  <td className="py-2 pr-3">{formatDate(p.cycleDueDate)}</td>
                  <td className="py-2 pr-3 font-mono font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                  <td className="py-2 pr-3">{p.paidDate ? formatDate(p.paidDate) : "Pending"}</td>
                  <td className="py-2 pr-3 capitalize text-[#8D8A87]">{p.paymentMethod ? p.paymentMethod.replace(/_/g, " ") : "-"}</td>
                  <td className="py-2 pr-3 text-[#8D8A87]">{p.reference ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.confirmed ? "text-[#2E7D32] bg-[#2E7D32]/10" : "text-[#ED6C02] bg-[#ED6C02]/10"}`}>
                      {p.confirmed ? "Confirmed" : "Pending"}
                    </span>
                  </td>
                  {canConfirm && (
                    <td className="py-2">
                      {!p.confirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#2E7D32] text-[#2E7D32]"
                          onClick={() => confirmPayment.mutate({ id: p.id })}
                        >
                          Confirm
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarkPaidDialog({ row, onClose }: { row: SubscriptionRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const [payEarly, setPayEarly] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: row.amount,
    paidDate: getLocalDateString(),
    paymentMethod: "bank_transfer" as "cash" | "wallet" | "bank_transfer" | "card",
    accountId: row.defaultAccountId != null ? String(row.defaultAccountId) : "",
    reference: "",
    notes: "",
  });
  // Paying a cycle further ahead than the reminder window requires explicit "Pay early"
  // confirmation — this is what stops a second accidental payment in the same period.
  const payAheadWindowDays = row.notifyDaysBefore ?? 7;
  const daysAhead = Math.round(
    (new Date(row.nextDueDate).getTime() - new Date(payForm.paidDate).getTime()) / 86_400_000,
  );
  const needsEarlyConfirmation = daysAhead > payAheadWindowDays;
  const canSubmit = !needsEarlyConfirmation || payEarly;
  const recordPayment = trpc.subscriptions.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      utils.subscriptions.list.invalidate();
      utils.subscriptions.get.invalidate();
      utils.subscriptions.payments.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const fundingAccounts = getFundingAccounts(payForm.paymentMethod, accounts as FundingAccount[] | undefined, row.locationId ?? undefined);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">Mark Paid — {row.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-[#E8E0D8] bg-[#F5EDE6]/60 px-3 py-2 text-xs text-[#2D2A26]" data-testid="mark-paid-cycle">
          Paying for cycle <strong>{formatDate(row.nextDueDate)}</strong> — {row.currency} {row.amount}
          {row.lastPaidDate && <> · last paid {formatDate(row.lastPaidDate)}</>}
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            recordPayment.mutate({
              subscriptionId: row.id,
              amount: payForm.amount,
              paidDate: payForm.paidDate,
              paymentMethod: payForm.paymentMethod,
              accountId: payForm.accountId ? Number(payForm.accountId) : undefined,
              reference: payForm.reference || undefined,
              notes: payForm.notes || undefined,
              allowEarly: payEarly,
            });
          }}
        >
          {needsEarlyConfirmation && (
            <label className="flex items-start gap-2 rounded-lg border border-[#ED6C02]/40 bg-[#ED6C02]/5 px-3 py-2 text-xs text-[#2D2A26]">
              <input
                type="checkbox"
                checked={payEarly}
                onChange={(e) => setPayEarly(e.target.checked)}
                className="mt-0.5"
                data-testid="pay-early-checkbox"
              />
              <span>
                This cycle isn't due until {formatDate(row.nextDueDate)} ({daysAhead} days away).
                Tick <strong>Pay early</strong> to record it now.
              </span>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0.01" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} required />
            </div>
            <div>
              <Label>Paid date</Label>
              <Input type="date" value={payForm.paidDate} onChange={(e) => setPayForm((p) => ({ ...p, paidDate: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Method</Label>
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value as typeof p.paymentMethod, accountId: "" }))}
                className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="wallet">Wallet</option>
                <option value="bank_transfer">Bank</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <Label>Funding source</Label>
              <select
                value={payForm.accountId}
                onChange={(e) => setPayForm((p) => ({ ...p, accountId: e.target.value }))}
                className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
              >
                <option value="">Auto-detect</option>
                {fundingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Reference</Label>
            <Input value={payForm.reference} onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Reference code" />
          </div>
          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={recordPayment.isPending || !canSubmit}>
            {recordPayment.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubscriptionDialog({ row, replacementRows, onClose }: { row: SubscriptionRow; replacementRows: SubscriptionRow[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [cancelForm, setCancelForm] = useState({ cancellationDate: getLocalDateString(), cancelReason: "", replacedBySubscriptionId: "" });
  const cancelMutation = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => {
      toast.success("Subscription cancelled");
      utils.subscriptions.list.invalidate();
      utils.subscriptions.get.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">Cancel — {row.name}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            cancelMutation.mutate({
              id: row.id,
              cancellationDate: cancelForm.cancellationDate || undefined,
              cancelReason: cancelForm.cancelReason || undefined,
              replacedBySubscriptionId: cancelForm.replacedBySubscriptionId ? Number(cancelForm.replacedBySubscriptionId) : null,
            });
          }}
        >
          <div>
            <Label>Cancellation date</Label>
            <Input type="date" value={cancelForm.cancellationDate} onChange={(e) => setCancelForm((p) => ({ ...p, cancellationDate: e.target.value }))} required />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={cancelForm.cancelReason} onChange={(e) => setCancelForm((p) => ({ ...p, cancelReason: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <Label>Replaced by</Label>
            <select
              value={cancelForm.replacedBySubscriptionId}
              onChange={(e) => setCancelForm((p) => ({ ...p, replacedBySubscriptionId: e.target.value }))}
              className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
            >
              <option value="">Not replaced</option>
              {replacementRows.filter((r) => r.id !== row.id && r.status === "active").map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={cancelMutation.isPending}>
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionDetailBody({ detail, canPay, canManage, onMarkPaid }: { detail: SubscriptionDetail; canPay: boolean; canManage: boolean; onMarkPaid: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusChipStyle(detail.status)}`}>{detail.status}</span>
        <span className="rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#2D2A26]">{detail.branchName ?? "Whole business"}</span>
        {detail.categoryName && <span className="rounded-full bg-[#F5EDE6] px-2 py-1 text-xs text-[#2D2A26]">{detail.categoryName}</span>}
        {detail.isOverdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#D32F2F]/10 px-2 py-1 text-xs font-medium text-[#D32F2F]">
            <AlertTriangle className="h-3 w-3" /> Overdue
          </span>
        )}
      </div>
      <SubscriptionKpis row={detail} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-[#8D8A87]">Amount</p>
          <p className="font-mono font-semibold text-[#2D2A26]">{fmtMoney(detail.amount, detail.currency)} / {detail.isOneTime ? "one-time" : cycleLabel(detail.cycleUnit, detail.cycleCount)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8D8A87]">Next due</p>
          <p className="font-medium text-[#2D2A26]">{formatDate(detail.nextDueDate)}</p>
        </div>
        <div>
          <p className="text-xs text-[#8D8A87]">Vendor</p>
          <p className="text-[#2D2A26]">{detail.vendorName ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-[#8D8A87]">Auto-renew</p>
          <p className="text-[#2D2A26]">{detail.autoRenew ? "Yes" : "No"}</p>
        </div>
      </div>
      {detail.url && (
        <a href={detail.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#C73E1D] hover:underline">
          <ExternalLink className="h-3 w-3" /> {detail.url}
        </a>
      )}
      {detail.successorName && (
        <p className="text-sm text-[#8D8A87]">Replaced by <span className="font-medium text-[#2D2A26]">{detail.successorName}</span></p>
      )}
      {detail.predecessorName && (
        <p className="text-sm text-[#8D8A87]">Replaces <span className="font-medium text-[#2D2A26]">{detail.predecessorName}</span></p>
      )}
      {detail.notes && (
        <div>
          <p className="text-xs text-[#8D8A87]">Notes</p>
          <p className="text-sm text-[#2D2A26]">{detail.notes}</p>
        </div>
      )}
      <p className="text-xs text-[#8D8A87]">
        Last updated {formatDate(detail.updatedAt)} · {detail.paymentCount ?? 0} payment{(detail.paymentCount ?? 0) === 1 ? "" : "s"} recorded
        {detail.lastPaidDate ? <> · last paid {formatDate(detail.lastPaidDate)}</> : null}
      </p>
      {canPay && detail.status !== "cancelled" && (() => {
        const hasPayment = detail.lastPaidDate != null || (detail.paymentCount ?? 0) > 0;
        const paidUp = hasPayment && !detail.isOverdue;
        return (
          <Button
            className={paidUp ? "bg-[#2E7D32] hover:bg-[#2E7D32]/90" : "bg-[#C73E1D]"}
            onClick={onMarkPaid}
            data-testid="detail-mark-paid"
          >
            {paidUp ? <CheckCircle className="mr-1 h-3 w-3" /> : null}
            Mark Paid
          </Button>
        );
      })()}
      {canManage && detail.status === "cancelled" && detail.cancelReason && (
        <p className="text-sm text-[#8D8A87]">Cancel reason: {detail.cancelReason}</p>
      )}
    </div>
  );
}

const VIEW_OPTIONS: SegmentedToggleOption<"cards" | "table" | "split" | "stats">[] = [
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
  { value: "split", label: "Split" },
  { value: "stats", label: "Stats" },
];

/** CSV download helper (mirrors src/features/reports/useReportExports.ts downloadCSV). */
function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_PILLS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "paused", label: "Paused" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type StatusPill = (typeof STATUS_PILLS)[number]["key"];

export function Subscriptions({ embedded }: { embedded?: boolean }) {
  const { user } = useAuth();
  const permContext = user?.permissions?.length ? user.permissions : (user?.role ?? "viewer");
  const canManage = hasPermission(permContext, PERMISSIONS.SUBSCRIPTIONS_MANAGE);
  const canPay = hasPermission(permContext, PERMISSIONS.SUBSCRIPTIONS_PAY);

  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get("highlight");

  const [view, setView] = useState<"cards" | "table" | "split" | "stats">("cards");
  const [locationId, setLocationId] = useState("");
  const [scope, setScope] = useState<"all" | "main">("all");
  const [statusPill, setStatusPill] = useState<StatusPill>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"next_due" | "amount" | "name" | "category">("next_due");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [payForId, setPayForId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [splitSelectedId, setSplitSelectedId] = useState<number | null>(null);
  const [pulsingId, setPulsingId] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.subscriptions.list.invalidate();
    utils.subscriptions.get.invalidate();
    utils.subscriptions.payments.list.invalidate();
  };

  const exportSubscriptionsCsv = () => {
    const headers = ["Name", "Vendor", "Branch", "Category", "Amount", "Currency", "Cycle", "Next due", "Status", "Posting mode", "Monthly (base)"];
    const rows = visibleRows.map((r) => [
      r.name,
      r.vendorName ?? "",
      r.branchName ?? "Whole business",
      r.categoryName ?? "",
      r.amount,
      r.currency,
      cycleLabel(r.cycleUnit, r.cycleCount),
      r.nextDueDate,
      r.status,
      r.postingModeLabel,
      r.convertedMonthly ?? r.monthlyNormalized,
    ]);
    downloadCsv(`subscriptions-${getLocalDateString()}.csv`, headers, rows);
    toast.success("Subscriptions exported");
  };

  const exportPaymentsCsv = async () => {
    try {
      const result = await utils.subscriptions.payments.list.fetch({ page: 1, pageSize: 200 });
      const headers = ["Subscription ID", "Cycle due", "Amount", "Currency", "Paid date", "Method", "Reference", "Confirmed"];
      const rows = result.rows.map((p) => [
        String(p.subscriptionId),
        p.cycleDueDate,
        p.amount,
        p.currency,
        p.paidDate ?? "",
        p.paymentMethod ?? "",
        p.reference ?? "",
        p.confirmed ? "yes" : "no",
      ]);
      downloadCsv(`subscription-payments-${getLocalDateString()}.csv`, headers, rows);
      toast.success("Payments exported");
    } catch {
      toast.error("Failed to export payments");
    }
  };

  const { data: locations } = trpc.locations.list.useQuery();
  const { data: categories } = trpc.expenses.categories.useQuery();
  const queryStatus = statusPill === "active" || statusPill === "paused" || statusPill === "cancelled" ? statusPill : undefined;
  const listQuery = trpc.subscriptions.list.useQuery({
    ...(locationId ? { locationId: Number(locationId) } : {}),
    scope: locationId ? "all" : scope,
    ...(queryStatus ? { status: queryStatus } : {}),
    ...(categoryFilter ? { categoryId: Number(categoryFilter) } : {}),
    ...(cycleFilter ? { cycleUnit: cycleFilter as "day" | "week" | "month" | "year" } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    sort,
    page: 1,
    pageSize: 50,
  });

  const rows = (listQuery.data?.rows ?? []) as SubscriptionRow[];
  const totals = listQuery.data?.totals;
  const visibleRows = rows.filter((row) => {
    if (statusPill === "due_soon") return row.isDueSoon;
    if (statusPill === "overdue") return row.isOverdue;
    return true;
  });

  const monthPrefix = getLocalDateString().slice(0, 7);
  const dueThisMonth = rows.filter((r) => r.nextDueDate.slice(0, 7) === monthPrefix).length;
  const overdueCount = rows.filter((r) => r.isOverdue).length;

  const renewMutation = trpc.subscriptions.renew.useMutation({
    onSuccess: () => { toast.success("Subscription renewed"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const cloneMutation = trpc.subscriptions.clone.useMutation({
    onSuccess: () => { toast.success("Subscription cloned"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const pauseMutation = trpc.subscriptions.pause.useMutation({
    onSuccess: () => { toast.success("Subscription paused"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const resumeMutation = trpc.subscriptions.resume.useMutation({
    onSuccess: () => { toast.success("Subscription resumed"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.subscriptions.delete.useMutation({
    onSuccess: () => { setDeleteId(null); toast.success("Subscription deleted"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // The detail popup reads the subscription's own record (fresh on open) so payment state
  // cannot come from a stale list cache; falls back to the list row while it loads.
  const { data: detailData } = trpc.subscriptions.get.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId != null },
  );
  const detailRow = detailId != null ? (detailData ?? rows.find((r) => r.id === detailId) ?? null) : null;
  const payRow = payForId != null ? rows.find((r) => r.id === payForId) ?? null : null;
  const cancelRow = cancelId != null ? rows.find((r) => r.id === cancelId) ?? null : null;

  // Notification deep links: /subscriptions?highlight=<id> scrolls to the card and pulses it briefly.
  useEffect(() => {
    if (!highlightParam) return;
    const id = Number(highlightParam);
    if (!Number.isFinite(id)) return;
    const el = cardRefs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsingId(id);
    const timer = setTimeout(() => setPulsingId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightParam, visibleRows]);

  const openCreate = () => { setEditingId(null); setFormOpen(true); };
  const openEdit = (id: number) => { setEditingId(id); setFormOpen(true); };

  const summaryStrip = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#8D8A87]">Monthly Cost</p>
            <p className="font-mono text-lg font-semibold text-[#2D2A26]">{fmtMoney(totals?.monthly, totals?.currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#8D8A87]">Yearly Cost</p>
            <p className="font-mono text-lg font-semibold text-[#2D2A26]">{fmtMoney(totals?.yearly, totals?.currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#8D8A87]">Due this month</p>
            <p className="font-mono text-lg font-semibold text-[#ED6C02]">{dueThisMonth}</p>
          </CardContent>
        </Card>
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-4">
            <p className="text-xs text-[#8D8A87]">Overdue</p>
            <p className="font-mono text-lg font-semibold text-[#D32F2F]">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>
      {(totals?.conversionUnavailable ?? 0) > 0 && (
        <span className="inline-flex rounded-full border border-[#D4A854] px-2 py-1 text-xs text-[#D4A854]">
          conversion unavailable: {totals?.conversionUnavailable}
        </span>
      )}
    </div>
  );

  const filterBar = (
    <Card className="border-[#E8E0D8] bg-white">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <LocationSelector
            locations={locations ?? []}
            assignedLocationIds={[]}
            enforceAssigned
            showAllBranches
            value={locationId}
            onChange={setLocationId}
            label="Branch"
            className="w-44"
          />
          <div>
            <Label>Scope</Label>
            <select
              value={locationId ? "all" : scope}
              onChange={(e) => setScope(e.target.value as "all" | "main")}
              disabled={!!locationId}
              data-testid="scope-select"
              className="w-40 rounded border border-[#E8E0D8] px-3 py-2 text-sm"
            >
              <option value="all">All subscriptions</option>
              <option value="main">Whole business</option>
            </select>
          </div>
          <div>
            <Label>Category</Label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-40 rounded border border-[#E8E0D8] px-3 py-2 text-sm">
              <option value="">All categories</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Cycle</Label>
            <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="w-36 rounded border border-[#E8E0D8] px-3 py-2 text-sm">
              <option value="">All cycles</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <div>
            <Label>Sort by</Label>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} data-testid="sort-select" className="w-36 rounded border border-[#E8E0D8] px-3 py-2 text-sm">
              <option value="next_due">Next due</option>
              <option value="amount">Amount</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="min-w-40 flex-1">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#8D8A87]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriptions..."
                className="pl-8"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.key}
              type="button"
              data-testid={`status-pill-${pill.key}`}
              onClick={() => setStatusPill(pill.key)}
              className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                statusPill === pill.key
                  ? "border-[#C73E1D] bg-[#C73E1D] text-white"
                  : "border-[#E8E0D8] bg-white text-[#8D8A87] hover:bg-[#F5EDE6] hover:text-[#2D2A26]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const cardActions = (row: SubscriptionRow) => (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {canPay && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="border-[#D4A854] text-[#D4A854]"
            disabled={row.isOneTime || row.status === "cancelled" || renewMutation.isPending}
            onClick={() => renewMutation.mutate({ id: row.id, record: false })}
          >
            <RotateCcw className="h-3 w-3" /> Renew
          </Button>
          <Button
            size="sm"
            className={
              row.lastPaidDate && !row.isOverdue
                ? "bg-[#2E7D32] hover:bg-[#2E7D32]/90"
                : "bg-[#C73E1D]"
            }
            onClick={() => setPayForId(row.id)}
            data-testid={`mark-paid-${row.id}`}
          >
            {row.lastPaidDate && !row.isOverdue ? (
              <CheckCircle className="mr-1 h-3 w-3" />
            ) : null}
            Mark paid
          </Button>
        </>
      )}
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="border-[#E8E0D8] px-2" aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.id)}><Pencil className="mr-2 h-3 w-3" /> Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => cloneMutation.mutate({ id: row.id })}><Copy className="mr-2 h-3 w-3" /> Clone</DropdownMenuItem>
            {row.status === "paused" ? (
              <DropdownMenuItem onClick={() => resumeMutation.mutate({ id: row.id })}><Play className="mr-2 h-3 w-3" /> Resume</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: row.id })}><Pause className="mr-2 h-3 w-3" /> Pause</DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setCancelId(row.id)}><XCircle className="mr-2 h-3 w-3" /> Cancel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[#D32F2F]" onClick={() => setDeleteId(row.id)}><Trash2 className="mr-2 h-3 w-3" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const cardGrid = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((row) => {
        const due = dueLabel(row);
        return (
          <Card
            key={row.id}
            data-testid={`subscription-card-${row.id}`}
            ref={(el) => { cardRefs.current.set(row.id, el); }}
            onClick={() => setDetailId(row.id)}
            className={`cursor-pointer border-[#E8E0D8] bg-white transition-shadow hover:shadow-md ${pulsingId === row.id ? "animate-pulse ring-2 ring-[#C73E1D]" : ""}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C73E1D]/10 text-[#C73E1D]">
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="font-serif text-base text-[#2D2A26]">{row.name}</CardTitle>
                    <p className="text-xs text-[#8D8A87]">{row.vendorName ?? "No vendor"}</p>
                  </div>
                </div>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusChipStyle(row.status)}`}>{row.status}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs text-[#2D2A26]">{row.branchName ?? "Whole business"}</span>
                {row.categoryName && <span className="rounded-full bg-[#F5EDE6] px-2 py-0.5 text-xs text-[#2D2A26]">{row.categoryName}</span>}
              </div>
              <p className="font-mono text-sm font-semibold text-[#2D2A26]">
                {fmtMoney(row.amount, row.currency)}
                <span className="ml-1 font-sans font-normal text-[#8D8A87]">/ {row.isOneTime ? "one-time" : cycleLabel(row.cycleUnit, row.cycleCount)}</span>
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-[#8D8A87]">Next due {formatDate(row.nextDueDate)}</span>
                <span className={`text-xs font-semibold ${due.className}`}>{due.text}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8D8A87]">Cycle progress</span>
                  <span className="font-medium text-[#2D2A26]">{row.progress}%</span>
                </div>
                <Progress value={row.progress} className="h-2 bg-[#E8E0D8]" />
              </div>
              <p className={`text-xs ${row.lastPaidDate ? "text-[#2E7D32]" : "text-[#8D8A87]"}`}>
                {row.lastPaidDate ? `Last paid ${formatDate(row.lastPaidDate)}` : "Not paid yet"}
              </p>
              {cardActions(row)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const sortHeader = (label: string, key: "name" | "amount" | "category" | "next_due") => (
    <button
      type="button"
      onClick={() => setSort(key)}
      className={`inline-flex items-center gap-1 text-xs font-medium ${sort === key ? "text-[#C73E1D]" : "text-[#8D8A87] hover:text-[#2D2A26]"}`}
    >
      {label}
    </button>
  );

  const tableView = (
    <div className="overflow-x-auto rounded border border-[#E8E0D8] bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#E8E0D8] text-left">
            <th className="p-3">{sortHeader("Name", "name")}</th>
            <th className="p-3 text-xs text-[#8D8A87]">Vendor</th>
            <th className="p-3 text-xs text-[#8D8A87]">Branch</th>
            <th className="p-3">{sortHeader("Category", "category")}</th>
            <th className="p-3">{sortHeader("Amount", "amount")}</th>
            <th className="p-3 text-xs text-[#8D8A87]">Currency</th>
            <th className="p-3 text-xs text-[#8D8A87]">Cycle</th>
            <th className="p-3">{sortHeader("Next due", "next_due")}</th>
            <th className="p-3 text-xs text-[#8D8A87]">Progress</th>
            <th className="p-3 text-xs text-[#8D8A87]">Status</th>
            <th className="p-3 text-xs text-[#8D8A87]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8E0D8]">
          {visibleRows.map((row) => {
            const due = dueLabel(row);
            return (
              <tr
                key={row.id}
                data-testid={`subscription-row-${row.id}`}
                onClick={() => setDetailId(row.id)}
                className="cursor-pointer hover:bg-[#F5EDE6]/50"
              >
                <td className="p-3 font-medium text-[#2D2A26]">{row.name}</td>
                <td className="p-3 text-[#8D8A87]">{row.vendorName ?? "-"}</td>
                <td className="p-3 text-[#8D8A87]">{row.branchName ?? "Whole business"}</td>
                <td className="p-3 text-[#8D8A87]">{row.categoryName ?? "-"}</td>
                <td className="p-3 font-mono font-semibold">{fmtMoney(row.amount, row.currency)}</td>
                <td className="p-3 text-[#8D8A87]">{row.currency}</td>
                <td className="p-3 text-[#8D8A87]">{row.isOneTime ? "one-time" : cycleLabel(row.cycleUnit, row.cycleCount)}</td>
                <td className="p-3">
                  <div>{formatDate(row.nextDueDate)}</div>
                  <div className={`text-xs font-semibold ${due.className}`}>{due.text}</div>
                </td>
                <td className="p-3">
                  <div className="w-20"><Progress value={row.progress} className="h-2 bg-[#E8E0D8]" /></div>
                </td>
                <td className="p-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusChipStyle(row.status)}`}>{row.status}</span>
                </td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="border-[#E8E0D8]" onClick={() => setDetailId(row.id)}>View</Button>
                    {canManage && (
                      <Button size="sm" variant="outline" className="border-[#E8E0D8]" onClick={() => openEdit(row.id)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const splitSelected = splitSelectedId != null ? rows.find((r) => r.id === splitSelectedId) ?? null : null;
  const splitView = (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2 rounded border border-[#E8E0D8] bg-white p-2">
        {visibleRows.map((row) => {
          const due = dueLabel(row);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setSplitSelectedId(row.id)}
              className={`w-full rounded border p-2 text-left transition-colors ${
                splitSelectedId === row.id ? "border-[#C73E1D] bg-[#F5EDE6]" : "border-[#E8E0D8] hover:bg-[#F5EDE6]"
              }`}
            >
              <p className="text-sm font-medium text-[#2D2A26]">{row.name}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#8D8A87]">{fmtMoney(row.amount, row.currency)} / {row.isOneTime ? "one-time" : cycleLabel(row.cycleUnit, row.cycleCount)}</p>
                <p className={`text-xs font-semibold ${due.className}`}>{due.text}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="rounded border border-[#E8E0D8] bg-white p-4">
        {splitSelected ? (
          <div className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#2D2A26]">{splitSelected.name}</h2>
            <SubscriptionDetailBody
              detail={splitSelected as SubscriptionDetail}
              canPay={canPay}
              canManage={canManage}
              onMarkPaid={() => setPayForId(splitSelected.id)}
            />
            <PaymentHistoryTable subscriptionId={splitSelected.id} canConfirm={canPay} />
          </div>
        ) : (
          <p className="text-sm text-[#8D8A87]">Select a subscription to see its details.</p>
        )}
      </div>
    </div>
  );

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">
              Subscriptions <span className="text-base font-normal text-[#8D8A87]">({rows.length})</span>
            </h1>
            <p className="mt-1 text-sm text-[#8D8A87]">Recurring costs, renewals and payment tracking</p>
          </div>
          {canManage && (
            <Button className="bg-[#C73E1D]" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Subscription
            </Button>
          )}
        </div>
      )}

      {summaryStrip}
      {filterBar}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedToggle options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="View mode" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-[#E8E0D8] text-[#8D8A87]" onClick={exportSubscriptionsCsv} data-testid="export-subscriptions-csv">
            <Download className="mr-1 h-4 w-4" /> Subscriptions CSV
          </Button>
          <Button variant="outline" size="sm" className="border-[#E8E0D8] text-[#8D8A87]" onClick={exportPaymentsCsv} data-testid="export-payments-csv">
            <Download className="mr-1 h-4 w-4" /> Payments CSV
          </Button>
          {embedded && canManage && (
            <Button className="bg-[#C73E1D]" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Subscription
            </Button>
          )}
        </div>
      </div>

      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
        </div>
      )}

      {listQuery.isError && !listQuery.isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Failed to load subscriptions</p>
              <p className="mt-1 text-sm text-red-600">
                {listQuery.error?.message ?? "An unexpected error occurred. Please try again."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => listQuery.refetch()}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "stats" && <SubscriptionStats />}

      {!listQuery.isLoading && !listQuery.isError && visibleRows.length === 0 && view !== "stats" && (
        <Card className="border-[#E8E0D8] bg-white">
          <CardContent className="p-10 text-center">
            <p className="font-serif text-lg text-[#2D2A26]">No subscriptions found</p>
            <p className="mt-1 text-sm text-[#8D8A87]">
              {statusPill === "all" ? "Add your first subscription to start tracking recurring costs." : "Try a different status filter."}
            </p>
          </CardContent>
        </Card>
      )}

      {!listQuery.isLoading && !listQuery.isError && visibleRows.length > 0 && view !== "stats" && (
        <>
          {view === "cards" && cardGrid}
          {view === "table" && tableView}
          {view === "split" && splitView}
        </>
      )}

      <SubscriptionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingId={editingId}
        onSaved={invalidate}
      />

      {detailRow && (
        <Dialog open onOpenChange={(o) => !o && setDetailId(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-[#2D2A26]">{detailRow.name}</DialogTitle>
            </DialogHeader>
            <SubscriptionDetailBody
              detail={detailRow as SubscriptionDetail}
              canPay={canPay}
              canManage={canManage}
              onMarkPaid={() => setPayForId(detailRow.id)}
            />
            <PaymentHistoryTable subscriptionId={detailRow.id} canConfirm={canPay} />
          </DialogContent>
        </Dialog>
      )}

      {payRow && <MarkPaidDialog key={payRow.id} row={payRow} onClose={() => setPayForId(null)} />}
      {cancelRow && (
        <CancelSubscriptionDialog
          key={cancelRow.id}
          row={cancelRow}
          replacementRows={rows}
          onClose={() => setCancelId(null)}
        />
      )}

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the subscription. Payment history is kept. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#D32F2F] text-white"
              onClick={() => { if (deleteId != null) deleteMutation.mutate({ id: deleteId }); }}
            >
              <CheckCircle className="h-4 w-4" /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) return content;
  return <Layout>{content}</Layout>;
}
