// ABOUTME: Budget list component that renders plan cards with status badges, period labels, and bucket counts.
// ABOUTME: Supports click-to-select and status filter pills.
import type { Period, BudgetStatus } from "@/lib/budgets/fiscal-year";
import { budgetStatusConfig, PERIOD_LABELS } from "./shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, FolderOpen } from "lucide-react";
import { fiscalYearLabel, getFiscalYearStart } from "@/lib/budgets/fiscal-year";

export interface PlanSummary {
  id: number;
  locationId: number | null;
  fiscalYearStart: number;
  period: string;
  name: string | null;
  notes: string | null;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  bucketCount: number;
}

interface BudgetListProps {
  plans: PlanSummary[];
  selectedPlanId: number | null;
  onSelectPlan: (planId: number) => void;
  activeStatuses: string[];
  onStatusFilterChange: (statuses: string[]) => void;
}

const STATUS_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Locked", value: "locked" },
  { label: "Archived", value: "archived" },
];

function formatDate(dateValue: string | Date): string {
  const d = new Date(dateValue);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function BudgetList({
  plans,
  selectedPlanId,
  onSelectPlan,
  activeStatuses,
  onStatusFilterChange,
}: BudgetListProps) {
  const toggleStatus = (status: string | null) => {
    if (status === null) {
      onStatusFilterChange([]);
      return;
    }
    const current = new Set(activeStatuses);
    if (current.has(status)) {
      current.delete(status);
    } else {
      current.add(status);
    }
    onStatusFilterChange(Array.from(current));
  };

  const fys = getFiscalYearStart();

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = opt.value === null
            ? activeStatuses.length === 0
            : activeStatuses.includes(opt.value);
          const cfg = opt.value ? budgetStatusConfig(opt.value) : null;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#C73E1D] text-white"
                  : "bg-[#F5EDE6] text-[#2D2A26] hover:bg-[#EDE0D6]"
              }`}
            >
              {cfg?.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {plans.length === 0 && (
          <div className="rounded-xl border border-[#E8E0D8] bg-white p-12 text-center text-sm text-[#8D8A87]">
            <FolderOpen className="mx-auto mb-3 h-12 w-12 opacity-20" />
            <p>No budget plans found for this year.</p>
            <p className="mt-1 text-xs">Create a new budget plan to get started.</p>
          </div>
        )}
        {plans.map((plan) => {
          const statusCfg = budgetStatusConfig(plan.status);
          const periodLabel = PERIOD_LABELS[plan.period as Period] ?? plan.period;
          const fyLabel = fiscalYearLabel(plan.fiscalYearStart, fys);
          const isSelected = selectedPlanId === plan.id;
          return (
            <Card
              key={plan.id}
              className={`cursor-pointer border transition-all hover:shadow-md ${
                isSelected
                  ? "border-[#C73E1D] ring-1 ring-[#C73E1D]/30"
                  : "border-[#E8E0D8]"
              }`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="font-serif text-base text-[#2D2A26]">
                      {plan.name || `Budget Plan #${plan.id}`}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-[#8D8A87]">{fyLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge className="bg-[#F5EDE6] text-[#2D2A26] border-0 text-xs">
                      {periodLabel}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-[#8D8A87]">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(plan.createdAt)}
                  </span>
                  <span>{plan.bucketCount} bucket{plan.bucketCount !== 1 ? "s" : ""}</span>
                  {plan.notes && (
                    <span className="truncate max-w-[200px]">{plan.notes}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
