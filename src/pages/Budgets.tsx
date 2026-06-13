// ABOUTME: Main budgets page with year selection, status filters, budget list, detail view, and creation wizard.
// ABOUTME: Manages list vs detail view state and exposes a "Create Budget" dialog. No Layout wrapper -- router provides it.
import { useState, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BudgetList } from "@/components/budgets/BudgetList";
import { BudgetDetail } from "@/components/budgets/BudgetDetail";
import { NewBudgetWizard } from "@/components/budgets/NewBudgetWizard";
import { budgetStatusConfig } from "@/components/budgets/shared";
import {
  Plus,
  ArrowLeft,
  CalendarDays,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export default function BudgetsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Year selection
  const [year, setYear] = useState(currentYear);

  // Status filter state -- empty array means "All"
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // View state: null means list view, a number means detail view for that plan
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Create wizard dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch budgets
  const { data: plans, isLoading, isError, error, refetch } = trpc.budgets.listByYear.useQuery(
    { year, statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined },
  );

  // Build year options: current year +/- 5
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const handleSelectPlan = useCallback((planId: number) => {
    setSelectedPlanId(planId);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedPlanId(null);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateDialogOpen(false);
    refetch();
  }, [refetch]);

  // Detail view
  if (selectedPlanId !== null) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBackToList}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#C73E1D] hover:text-[#A83215] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Budget Plans
        </button>

        <BudgetDetail planId={selectedPlanId} />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2D2A26]">Budget Plans</h1>
          <p className="mt-1 text-sm text-[#8D8A87]">
            Create and manage annual budget plans for your business
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="rounded-lg border border-[#E8E0D8] bg-white px-3 py-2 text-sm text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#C73E1D]/30"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                FY {y}/{String(y + 1).slice(-2)}
              </option>
            ))}
          </select>

          {/* Create button */}
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-[#C73E1D] text-white hover:bg-[#A83215]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create Budget
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#C73E1D]" />
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Failed to load budget plans</p>
              <p className="mt-1 text-sm text-red-600">
                {error?.message ?? "An unexpected error occurred. Please try again."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget list with status filters */}
      {!isLoading && !isError && (
        <BudgetList
          plans={plans ?? []}
          selectedPlanId={selectedPlanId}
          onSelectPlan={handleSelectPlan}
          activeStatuses={selectedStatuses}
          onStatusFilterChange={setSelectedStatuses}
        />
      )}

      {/* Create budget dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#2D2A26]">
              Create Budget Plan
            </DialogTitle>
            <DialogDescription className="text-sm text-[#8D8A87]">
              Set up a new budget plan with categories, amounts, and period allocation.
            </DialogDescription>
          </DialogHeader>
          <NewBudgetWizard onCreated={handleCreateSuccess} onClose={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
