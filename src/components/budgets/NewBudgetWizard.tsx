// ABOUTME: Multi-step budget creation wizard dialog with name/period, category lines, and review/save steps.
// ABOUTME: Uses TRPC mutations for submission and sonner for toast notifications.
import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { cn, formatKES } from "@/lib/utils";
import { getFiscalYearStart } from "@/lib/budgets/fiscal-year";
import { validatePeriod } from "@/lib/budgets/validation";
import { generateTrackedBuckets } from "@/lib/budgets/period";
import type { Period } from "@/lib/budgets/fiscal-year";
import { PERIOD_LABELS, PERIOD_DESCRIPTIONS, PERIOD_OPTIONS } from "./shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  Save,
  Send,
  Loader2,
  Tag,
  List,
  ClipboardList,
} from "lucide-react";

interface NewBudgetWizardProps {
  onClose: () => void;
  onCreated: (planId: number) => void;
}

interface LineEntry {
  categoryId: number;
  categoryName: string;
  categoryColor: string | null;
  amount: string;
}

type WizardStep = "name-period" | "lines" | "review";

const STEPS: { key: WizardStep; label: string; icon: typeof Tag }[] = [
  { key: "name-period", label: "Name & Period", icon: FileText },
  { key: "lines", label: "Budget Lines", icon: List },
  { key: "review", label: "Review & Save", icon: ClipboardList },
];

export function NewBudgetWizard({ onClose, onCreated }: NewBudgetWizardProps) {
  const [step, setStep] = useState<WizardStep>("name-period");
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineEntry[]>([]);

  const { data: categories, isLoading: catsLoading } = trpc.expenses.categories.useQuery();
  const createMutation = trpc.budgets.create.useMutation();

  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.key === step), [step]);

  // Initialise lines from categories when they arrive
  useMemo(() => {
    if (!categories) return;
    if (lines.length > 0) return;

    const initialLines: LineEntry[] = categories.map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      categoryColor: cat.color,
      amount: "",
    }));
    setLines(initialLines);
    // Intentionally run only when categories change from undefined to defined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const activeLines = useMemo(() => lines.filter((l) => l.amount && Number(l.amount) > 0), [lines]);
  const totalAmount = useMemo(
    () => activeLines.reduce((sum, l) => sum + Number(l.amount), 0),
    [activeLines],
  );
  const bucketCount = useMemo(
    () => generateTrackedBuckets(period, getFiscalYearStart()).length,
    [period],
  );

  const canProceedToLines = name.trim().length > 0;
  const canProceedToReview = activeLines.length > 0;
  const periodDescription = PERIOD_DESCRIPTIONS[period];

  function handleAmountChange(categoryId: number, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.categoryId === categoryId ? { ...l, amount: value } : l)),
    );
  }

  function goNext() {
    if (step === "name-period" && canProceedToLines) {
      setStep("lines");
    } else if (step === "lines" && canProceedToReview) {
      setStep("review");
    }
  }

  function goBack() {
    if (step === "lines") setStep("name-period");
    else if (step === "review") setStep("lines");
  }

  async function handleSave(saveAs: "draft" | "active") {
    try {
      validatePeriod(period);

      const lineInputs = activeLines.map((l) => ({
        categoryId: l.categoryId,
        amount: l.amount,
      }));

      const result = await createMutation.mutateAsync({
        locationId: 0, // The API will resolve the actual location from context
        fiscalYearStart: new Date().getFullYear(),
        period,
        name: name.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: lineInputs,
        saveAs,
      });

      toast.success(
        saveAs === "active"
          ? "Budget plan created and activated"
          : "Budget plan saved as draft",
      );
      onCreated(result.planId);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create budget plan");
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#2D2A26]">
            New Budget Plan
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isComplete = stepIndex > i;
            const isClickable = i <= stepIndex;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && setStep(s.key)}
                className={cn(
                  "flex flex-col items-center gap-1 text-xs transition-colors",
                  isActive && "text-[#C73E1D]",
                  isComplete && "text-[#2E7D32]",
                  !isActive && !isComplete && "text-[#B0ABA7]",
                  isClickable && "cursor-pointer",
                  !isClickable && "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isActive && "border-[#C73E1D] bg-[#C73E1D]/10",
                    isComplete && "border-[#2E7D32] bg-[#2E7D32]/10",
                    !isActive && !isComplete && "border-[#E8E0D8] bg-white",
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4 text-[#2E7D32]" />
                  ) : (
                    <Icon className={cn("h-4 w-4", isActive ? "text-[#C73E1D]" : "text-[#B0ABA7]")} />
                  )}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step connector line */}
        <div className="relative mx-9 -mt-3">
          <div className="absolute inset-0 flex items-center">
            <div className="h-0.5 w-full bg-[#E8E0D8]" />
          </div>
          <div
            className="absolute inset-0 flex items-center transition-all duration-300"
            style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
          >
            <div className="h-0.5 w-full bg-[#C73E1D]" />
          </div>
        </div>

        {/* Step 1: Name & Period */}
        {step === "name-period" && (
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="budget-name" className="text-sm font-medium text-[#2D2A26]">
                Budget Name
              </Label>
              <Input
                id="budget-name"
                placeholder="e.g. FY 2025/26 Operating Budget"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-[#E8E0D8] focus-visible:ring-[#C73E1D]"
              />
              <p className="text-xs text-[#8D8A87]">
                A descriptive name for this budget plan
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-period" className="text-sm font-medium text-[#2D2A26]">
                Period
              </Label>
              <Select
                value={period}
                onValueChange={(val) => setPeriod(val as Period)}
              >
                <SelectTrigger
                  id="budget-period"
                  className="border-[#E8E0D8] focus:ring-[#C73E1D]"
                >
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[#8D8A87]">{periodDescription}</p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="budget-notes"
                className="text-sm font-medium text-[#2D2A26]"
              >
                Notes{" "}
                <span className="text-xs font-normal text-[#8D8A87]">(optional)</span>
              </Label>
              <textarea
                id="budget-notes"
                placeholder="Any additional notes or context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26] placeholder:text-[#B0ABA7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C73E1D] resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Lines */}
        {step === "lines" && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8D8A87]">
                Set budget amounts for each expense category.
              </p>
            </div>

            {catsLoading && (
              <div className="flex items-center justify-center py-8 text-sm text-[#8D8A87]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading categories...
              </div>
            )}

            {!catsLoading && categories && (
              <>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-[#E8E0D8]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E8E0D8] bg-[#F5EDE6]/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-[#8D8A87] uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-[#8D8A87] uppercase tracking-wider">
                          Amount per Bucket
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D8]">
                      {lines.map((line) => (
                        <tr key={line.categoryId} className="hover:bg-[#FAF7F4] transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: line.categoryColor ?? "#C73E1D" }}
                              />
                              <span className="text-sm text-[#2D2A26]">
                                {line.categoryName}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-[#B0ABA7]">KES</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={line.amount}
                                onChange={(e) =>
                                  handleAmountChange(line.categoryId, e.target.value)
                                }
                                className="w-36 border-[#E8E0D8] text-right text-sm focus-visible:ring-[#C73E1D]"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-[#8D8A87]">
                  This amount will be applied to each of the{" "}
                  <span className="font-medium text-[#2D2A26]">{bucketCount}</span>{" "}
                  tracked {bucketCount === 1 ? "bucket" : "buckets"} (
                  {PERIOD_LABELS[period]}).
                </p>

                {activeLines.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-[#F5EDE6]/50 px-3 py-2">
                    <span className="text-sm text-[#8D8A87]">
                      {activeLines.length} categor{activeLines.length === 1 ? "y" : "ies"} with amounts
                    </span>
                    <span className="text-sm font-medium text-[#2D2A26]">
                      Total per bucket: {formatKES(totalAmount)}
                    </span>
                  </div>
                )}
              </>
            )}

            {!catsLoading && !categories && (
              <div className="rounded-lg border border-[#E8E0D8] bg-[#FAF7F4] p-6 text-center text-sm text-[#8D8A87]">
                No expense categories found. Create categories in the Expenses section first.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Save */}
        {step === "review" && (
          <div className="space-y-5 pt-4">
            <div className="rounded-lg border border-[#E8E0D8] divide-y divide-[#E8E0D8]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#8D8A87]">Name</span>
                <span className="text-sm font-medium text-[#2D2A26]">
                  {name.trim() || "Untitled Budget"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#8D8A87]">Period</span>
                <span className="text-sm font-medium text-[#2D2A26]">
                  {PERIOD_LABELS[period]} ({bucketCount} bucket{bucketCount !== 1 ? "s" : ""})
                </span>
              </div>
              {notes.trim() && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-[#8D8A87]">Notes</span>
                  <span className="text-sm text-[#2D2A26] max-w-[240px] truncate text-right">
                    {notes.trim()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#8D8A87]">Categories</span>
                <span className="text-sm font-medium text-[#2D2A26]">
                  {activeLines.length} categor{activeLines.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-[#F5EDE6]/30">
                <span className="text-sm font-medium text-[#2D2A26]">
                  Total per bucket
                </span>
                <span className="text-base font-semibold text-[#C73E1D]">
                  {formatKES(totalAmount)}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[#E8E0D8]">
              <div className="px-4 py-2 border-b border-[#E8E0D8] bg-[#FAF7F4]">
                <span className="text-xs font-medium text-[#8D8A87] uppercase tracking-wider">
                  Category Breakdown
                </span>
              </div>
              <div className="divide-y divide-[#E8E0D8] max-h-48 overflow-y-auto">
                {activeLines.map((line) => (
                  <div
                    key={line.categoryId}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: line.categoryColor ?? "#C73E1D" }}
                      />
                      <span className="text-sm text-[#2D2A26]">{line.categoryName}</span>
                    </div>
                    <span className="text-sm font-medium text-[#2D2A26]">
                      {formatKES(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-[#E8E0D8] pt-4">
          <div>
            {step !== "name-period" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                className="text-[#8D8A87] hover:text-[#2D2A26] hover:bg-[#F5EDE6]"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-[#8D8A87] hover:text-[#2D2A26] hover:bg-[#F5EDE6]"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === "review" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave("draft")}
                  disabled={createMutation.isPending}
                  className="border-[#E8E0D8] text-[#2D2A26] hover:bg-[#F5EDE6]"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave("active")}
                  disabled={createMutation.isPending}
                  className="bg-[#C73E1D] text-white hover:bg-[#A83216]"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  Save & Activate
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  (step === "name-period" && !canProceedToLines) ||
                  (step === "lines" && !canProceedToReview)
                }
                className="bg-[#C73E1D] text-white hover:bg-[#A83216] disabled:bg-[#E8E0D8] disabled:text-[#B0ABA7]"
              >
                {step === "lines" ? "Review" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
