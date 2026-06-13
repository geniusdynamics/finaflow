// ABOUTME: Budget detail view with bucket selector, editable lines, lifecycle actions, and monthly copy dialog.
// ABOUTME: Supports monthly/quarterly/half-yearly tracked buckets and annual analytical breakdowns.
import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PERIOD_LABELS,
  PERIOD_DESCRIPTIONS,
  budgetStatusConfig,
  canEditStatus,
  canActivate,
  canLock,
  canArchive,
} from "./shared";
import {
  Pencil,
  Save,
  X,
  Copy,
  Loader2,
  AlertTriangle,
  CalendarDays,
  PlayCircle,
  Lock,
  Archive,
} from "lucide-react";
import type { Period } from "@/lib/budgets/fiscal-year";
import { fiscalMonths } from "@/lib/budgets/period";
import { getFiscalYearStart, fiscalYearLabel } from "@/lib/budgets/fiscal-year";

interface BudgetDetailProps {
  planId: number;
}

export function BudgetDetail({ planId }: BudgetDetailProps) {
  const { data: plan, isLoading, isError, error, refetch } = trpc.budgets.get.useQuery({ planId });
  const utils = trpc.useUtils();

  const [selectedBucketId, setSelectedBucketId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editLines, setEditLines] = useState<Record<number, string>>({});
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);

  const updateMutation = trpc.budgets.updateLines.useMutation({
    onSuccess: () => {
      toast.success("Budget lines updated");
      setIsEditing(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const activateMutation = trpc.budgets.activate.useMutation({
    onSuccess: () => { toast.success("Budget activated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const lockMutation = trpc.budgets.lock.useMutation({
    onSuccess: () => { toast.success("Budget locked"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.budgets.archive.useMutation({
    onSuccess: () => { toast.success("Budget archived"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const copyMutation = trpc.budgets.copyMonthlyBucket.useMutation({
    onSuccess: () => {
      toast.success("Budget copied to selected months");
      setCopyDialogOpen(false);
      setSelectedTargetIds([]);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const period = plan?.period as Period | undefined;
  const fsMonths = fiscalMonths(getFiscalYearStart());
  const periodBuckets = plan?.buckets ?? [];

  // Select first bucket by default
  const currentBucketId = selectedBucketId ?? periodBuckets[0]?.id ?? null;
  const currentBucket = periodBuckets.find((b) => b.id === currentBucketId);

  const nonSourceBuckets = useMemo(
    () => periodBuckets.filter((b) => b.id !== currentBucketId),
    [periodBuckets, currentBucketId],
  );

  const statusCfg = plan ? budgetStatusConfig(plan.status) : null;
  const statusConfig = useMemo(() => statusCfg, [plan, statusCfg]);

  function handleStartEdit() {
    if (!currentBucket) return;
    const form: Record<number, string> = {};
    for (const line of currentBucket.lines) {
      form[line.categoryId] = line.amount;
    }
    setEditLines(form);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditLines({});
  }

  function handleSaveEdit() {
    if (!currentBucketId) return;
    const lines = Object.entries(editLines).map(([categoryId, amount]) => ({
      categoryId: Number(categoryId),
      amount: amount || "0.00",
    }));
    updateMutation.mutate({ planId, bucketId: currentBucketId, lines });
  }

  function handleCopy() {
    if (!currentBucketId) return;
    copyMutation.mutate({ planId, sourceBucketId: currentBucketId, targetBucketIds: selectedTargetIds });
  }

  function toggleTarget(bucketId: number) {
    setSelectedTargetIds((prev) =>
      prev.includes(bucketId) ? prev.filter((id) => id !== bucketId) : [...prev, bucketId],
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
        <span className="ml-3 text-sm text-gray-500">Loading budget...</span>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <Card className="border-red-300/30 bg-red-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-medium">Failed to load budget</p>
          </div>
          <p className="mt-1 text-sm text-gray-500">{error?.message ?? "Plan not found"}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-serif font-semibold text-[#2D2A26]">{plan.name ?? `Budget #${plan.id}`}</h2>
          <p className="text-sm text-[#8D8A87]">
            {PERIOD_LABELS[plan.period as Period] ?? plan.period} &middot;{" "}
            {fiscalYearLabel(plan.fiscalYearStart, getFiscalYearStart())}
          </p>
        </div>
        {statusConfig && (
          <Badge className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusConfig.className}`}>
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
        )}
      </div>

      {plan.notes && (
        <p className="text-sm text-[#8D8A87]">{plan.notes}</p>
      )}

      {/* Bucket Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#8D8A87]" />
        {periodBuckets.map((bucket) => (
          <button
            key={bucket.id}
            type="button"
            onClick={() => { setSelectedBucketId(bucket.id); setIsEditing(false); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              currentBucketId === bucket.id
                ? "border-[#C73E1D] bg-[#C73E1D]/10 text-[#C73E1D] font-medium"
                : "border-[#E8E0D8] text-[#8D8A87] hover:border-[#C73E1D]/50"
            }`}
          >
            {bucket.label}
          </button>
        ))}
      </div>

      {/* Lines Table */}
      {currentBucket && (
        <Card className="border-[#E8E0D8]">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-base">{currentBucket.label} &mdash; Category Budget</CardTitle>
            <div className="flex items-center gap-2">
              {plan.period === "monthly" && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(true)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy to months
                </Button>
              )}
              {canEditStatus(plan.status) && (
                isEditing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleStartEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                )
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E0D8] text-left text-xs uppercase text-[#8D8A87]">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBucket.lines.map((line) => (
                    <tr key={line.categoryId} className="border-b border-[#E8E0D8]/50">
                      <td className="py-2 flex items-center gap-2">
                        {line.categoryColor && (
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.categoryColor }} />
                        )}
                        {line.categoryName ?? `Category #${line.categoryId}`}
                      </td>
                      <td className="py-2 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editLines[line.categoryId] ?? line.amount}
                            onChange={(e) => setEditLines((p) => ({ ...p, [line.categoryId]: e.target.value }))}
                            className="w-28 ml-auto text-right text-sm"
                          />
                        ) : (
                          <span className="font-mono">{formatKES(line.amount)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annual information notice */}
      {period === "annual" && (
        <p className="text-xs text-[#8D8A87] flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Annual budgets show a monthly breakdown for analysis only. Edit the annual total above.
        </p>
      )}

      {/* Lifecycle Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#E8E0D8] pt-4">
        {canActivate(plan.status) && (
          <Button size="sm" onClick={() => activateMutation.mutate({ planId })} disabled={activateMutation.isPending}>
            <PlayCircle className="h-3.5 w-3.5 mr-1" /> Activate
          </Button>
        )}
        {canLock(plan.status) && (
          <Button size="sm" variant="outline" onClick={() => lockMutation.mutate({ planId })} disabled={lockMutation.isPending}>
            <Lock className="h-3.5 w-3.5 mr-1" /> Lock
          </Button>
        )}
        {canArchive(plan.status) && (
          <Button size="sm" variant="ghost" onClick={() => archiveMutation.mutate({ planId })} disabled={archiveMutation.isPending}>
            <Archive className="h-3.5 w-3.5 mr-1" /> Archive
          </Button>
        )}
      </div>

      {/* Copy Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {currentBucket?.label ?? "Month"} to...</DialogTitle>
            <DialogDescription>
              Select target months to copy this bucket&apos;s amounts into.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {nonSourceBuckets.map((bucket) => (
              <label key={bucket.id} className="flex items-center gap-2 rounded border border-[#E8E0D8] p-2 text-sm cursor-pointer hover:bg-[#F5EDE6]/50">
                <input
                  type="checkbox"
                  checked={selectedTargetIds.includes(bucket.id)}
                  onChange={() => toggleTarget(bucket.id)}
                  className="rounded border-gray-300"
                />
                {bucket.label}
              </label>
            ))}
            {nonSourceBuckets.length === 0 && (
              <p className="text-sm text-[#8D8A87]">No other buckets available to copy into.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCopy} disabled={selectedTargetIds.length === 0 || copyMutation.isPending}>
              {copyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              Copy ({selectedTargetIds.length} months)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
