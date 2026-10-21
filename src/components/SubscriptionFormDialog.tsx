// ABOUTME: Add/Edit subscription dialog with cycle, billing, posting and notification fields for the Subscriptions feature.
// ABOUTME: Exports a pure addCycle date helper (with month-end clamping) and mirrors QuickSupplierDialog's controlled-open pattern.
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LocationSelector } from "@/components/LocationSelector";
import { ExpenseCategorySelector } from "@/components/ExpenseCategorySelector";
import { QuickSupplierDialog } from "@/components/QuickSupplierDialog";
import { QuickCategoryDialog } from "@/components/QuickCategoryDialog";
import { CurrencySelect } from "@/components/CurrencySelect";
import { toast } from "sonner";

export type CycleUnit = "day" | "week" | "month" | "year";

/** Maps payment method to allowed account type values in the DB */
const PAYMENT_METHOD_ACCOUNT_TYPES: Record<string, string[]> = {
  cash: ["cash"],
  wallet: ["mpesa", "wallet"],
  bank_transfer: ["bank_account"],
  card: ["bank_account"],
};

/** Adds one billing cycle to a YYYY-MM-DD date string, clamping the day at month ends (Jan 31 + 1 month = Feb 28/29). */
export function addCycle(startDate: string, unit: CycleUnit, count: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!match) return startDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const cycles = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;

  if (unit === "day" || unit === "week") {
    const days = unit === "day" ? cycles : cycles * 7;
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return formatUtcDate(date);
  }

  const monthsToAdd = unit === "month" ? cycles : cycles * 12;
  const totalMonths = (month - 1) + monthsToAdd;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return formatUtcDate(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
}

function formatUtcDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface SubscriptionFormValues {
  name: string;
  description: string;
  vendorId: string;
  categoryId: string;
  amount: string;
  currency: string;
  cycleUnit: CycleUnit;
  cycleCount: string;
  isOneTime: boolean;
  startDate: string;
  nextDueDate: string;
  autoRenew: boolean;
  locationId: string;
  postingLocationId: string;
  postingMode: "none" | "expense" | "bill";
  defaultAccountId: string;
  url: string;
  notifyEnabled: boolean;
  notifyDaysBefore: string;
  notes: string;
}

const emptyForm: SubscriptionFormValues = {
  name: "",
  description: "",
  vendorId: "",
  categoryId: "",
  amount: "",
  currency: "KES",
  cycleUnit: "month",
  cycleCount: "1",
  isOneTime: false,
  startDate: getLocalDateString(),
  nextDueDate: "",
  autoRenew: false,
  locationId: "",
  postingLocationId: "",
  postingMode: "bill",
  defaultAccountId: "",
  url: "",
  notifyEnabled: true,
  notifyDaysBefore: "",
  notes: "",
};

export function SubscriptionFormDialog({
  open,
  onOpenChange,
  editingId,
  initialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: number | null;
  initialValues?: Partial<SubscriptionFormValues>;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<SubscriptionFormValues>({ ...emptyForm, ...initialValues });
  const [nextDueTouched, setNextDueTouched] = useState(false);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const isEdit = open && !!editingId;

  const utils = trpc.useUtils();
  const { data: locations } = trpc.locations.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: categories } = trpc.expenses.categories.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: existing } = trpc.subscriptions.get.useQuery({ id: editingId ?? 0 }, { enabled: isEdit });

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyForm, startDate: getLocalDateString(), ...initialValues });
    setNextDueTouched(false);
  }, [open, initialValues]);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name ?? "",
      description: existing.description ?? "",
      vendorId: existing.vendorId != null ? String(existing.vendorId) : "",
      categoryId: existing.categoryId != null ? String(existing.categoryId) : "",
      amount: String(existing.amount ?? ""),
      currency: existing.currency ?? "KES",
      cycleUnit: (existing.cycleUnit ?? "month") as CycleUnit,
      cycleCount: String(existing.cycleCount ?? 1),
      isOneTime: Boolean(existing.isOneTime),
      startDate: (existing.startDate ?? "").slice(0, 10),
      nextDueDate: (existing.nextDueDate ?? "").slice(0, 10),
      autoRenew: Boolean(existing.autoRenew),
      locationId: existing.locationId != null ? String(existing.locationId) : "",
      postingLocationId: existing.postingLocationId != null ? String(existing.postingLocationId) : "",
      postingMode: (existing.postingMode ?? "bill") as SubscriptionFormValues["postingMode"],
      defaultAccountId: existing.defaultAccountId != null ? String(existing.defaultAccountId) : "",
      url: existing.url ?? "",
      notifyEnabled: Boolean(existing.notifyEnabled),
      notifyDaysBefore: existing.notifyDaysBefore != null ? String(existing.notifyDaysBefore) : "",
      notes: existing.notes ?? "",
    });
    setNextDueTouched(true);
  }, [existing]);

  const set = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const suggestNextDue = (next: SubscriptionFormValues) => {
    if (nextDueTouched) return;
    if (!next.startDate) return;
    set("nextDueDate", addCycle(next.startDate, next.cycleUnit, parseInt(next.cycleCount, 10) || 1));
  };

  const createMutation = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Subscription created");
      utils.subscriptions.list.invalidate();
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Failed to create subscription"),
  });
  const updateMutation = trpc.subscriptions.update.useMutation({
    onSuccess: () => {
      toast.success("Subscription updated");
      utils.subscriptions.list.invalidate();
      utils.subscriptions.get.invalidate();
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Failed to update subscription"),
  });

  const fundingAccounts = (accounts ?? []).filter(
    (a) => PAYMENT_METHOD_ACCOUNT_TYPES.bank_transfer.includes(a.type) && !a.deletedAt,
  );

  const needsPostingLocation = form.postingMode !== "none" && form.locationId === "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!form.startDate || !form.nextDueDate) {
      toast.error("Start date and next due date are required");
      return;
    }
    if (needsPostingLocation && !form.postingLocationId) {
      toast.error("Business-wide subscriptions that post to accounting need a 'Post to branch'");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      amount: form.amount,
      currency: form.currency,
      cycleUnit: form.cycleUnit,
      cycleCount: parseInt(form.cycleCount, 10) || 1,
      isOneTime: form.isOneTime,
      startDate: form.startDate,
      nextDueDate: form.nextDueDate,
      autoRenew: form.autoRenew,
      locationId: form.locationId ? Number(form.locationId) : null,
      postingLocationId: form.postingLocationId ? Number(form.postingLocationId) : null,
      postingMode: form.postingMode,
      defaultAccountId: form.defaultAccountId ? Number(form.defaultAccountId) : null,
      url: form.url.trim() || undefined,
      notifyEnabled: form.notifyEnabled,
      notifyDaysBefore: form.notifyDaysBefore === "" ? null : parseInt(form.notifyDaysBefore, 10),
      notes: form.notes.trim() || undefined,
    };
    if (isEdit && editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">
            {isEdit ? "Edit Subscription" : "Add Subscription"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Netflix, Internet, Insurance"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vendor</Label>
              <div className="flex gap-2">
                <select
                  value={form.vendorId}
                  onChange={(e) => set("vendorId", e.target.value)}
                  className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {(suppliers ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <QuickSupplierDialog
                  onCreated={(id) => set("vendorId", String(id))}
                  open={addSupplierOpen}
                  onOpenChange={setAddSupplierOpen}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="shrink-0 border-[#D4A854] text-[#D4A854]">
                      Add new
                    </Button>
                  }
                />
              </div>
            </div>
            <ExpenseCategorySelector
              categories={categories ?? []}
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              label="Category"
              onAddNew={() => setAddCategoryOpen(true)}
              addNewLabel="Add category"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <Label>Currency</Label>
              <CurrencySelect value={form.currency} onValueChange={(v) => set("currency", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cycle</Label>
              <select
                value={form.cycleUnit}
                onChange={(e) => {
                  const next = { ...form, cycleUnit: e.target.value as CycleUnit };
                  setForm(next);
                  suggestNextDue(next);
                }}
                className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <Label>Every (cycles)</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={form.cycleCount}
                onChange={(e) => {
                  const next = { ...form, cycleCount: e.target.value };
                  setForm(next);
                  suggestNextDue(next);
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded border border-[#E8E0D8] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#2D2A26]">One-time purchase</p>
              <p className="text-xs text-[#8D8A87]">Does not renew on a cycle</p>
            </div>
            <Switch checked={form.isOneTime} onCheckedChange={(v) => set("isOneTime", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  const next = { ...form, startDate: e.target.value };
                  setForm(next);
                  suggestNextDue(next);
                }}
                required
              />
            </div>
            <div>
              <Label>Next due date</Label>
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => {
                  setNextDueTouched(true);
                  set("nextDueDate", e.target.value);
                }}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded border border-[#E8E0D8] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#2D2A26]">Auto-renew</p>
              <p className="text-xs text-[#8D8A87]">Renew automatically when due</p>
            </div>
            <Switch checked={form.autoRenew} onCheckedChange={(v) => set("autoRenew", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Notifications</Label>
              <div className="flex h-[38px] items-center gap-2">
                <Switch checked={form.notifyEnabled} onCheckedChange={(v) => set("notifyEnabled", v)} />
                <span className="text-sm text-[#8D8A87]">{form.notifyEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
            <div>
              <Label>Days before due</Label>
              <Input
                type="number"
                min="0"
                max="90"
                value={form.notifyDaysBefore}
                onChange={(e) => set("notifyDaysBefore", e.target.value)}
                placeholder="Business default"
              />
            </div>
          </div>

          <div>
            <Label>Default money account</Label>
            <select
              value={form.defaultAccountId}
              onChange={(e) => set("defaultAccountId", e.target.value)}
              className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {fundingAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <LocationSelector
              locations={locations ?? []}
              assignedLocationIds={[]}
              enforceAssigned
              value={form.locationId}
              onChange={(v) => set("locationId", v)}
              label="Branch"
              placeholder="Whole business"
            />
            {needsPostingLocation && (
              <LocationSelector
                locations={locations ?? []}
                assignedLocationIds={[]}
                enforceAssigned
                value={form.postingLocationId}
                onChange={(v) => set("postingLocationId", v)}
                label="Post to branch"
                placeholder="Select branch"
                required
              />
            )}
            <div>
              <Label>Posting mode</Label>
              <select
                value={form.postingMode}
                onChange={(e) => set("postingMode", e.target.value as SubscriptionFormValues["postingMode"])}
                className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
              >
                <option value="none">Reminder only</option>
                <option value="expense">Create expense</option>
                <option value="bill">Create bill</option>
              </select>
            </div>
          </div>

          <div>
            <Label>URL</Label>
            <Input
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
              className="w-full rounded border border-[#E8E0D8] px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full bg-[#C73E1D]" disabled={pending}>
            {pending ? "Saving..." : isEdit ? "Save Changes" : "Add Subscription"}
          </Button>
        </form>
      </DialogContent>
      <QuickCategoryDialog
        businessId={user?.currentBusinessId ?? 0}
        onCreated={(id) => set("categoryId", String(id))}
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
      />
    </Dialog>
  );
}
