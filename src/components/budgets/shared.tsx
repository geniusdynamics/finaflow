// ABOUTME: Shared constants, type aliases, and helper utilities for budget UI components.
// ABOUTME: Provides status color config, period labels, and type definitions used across the budgets feature.
import type { Period, BudgetStatus } from "@/lib/budgets/fiscal-year";
import { Circle, Lock, Archive, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";

export const PERIOD_LABELS: Record<Period, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-Yearly",
  annual: "Annual",
};

export const PERIOD_DESCRIPTIONS: Record<Period, string> = {
  monthly: "12 monthly buckets — edit each month individually",
  quarterly: "4 quarterly buckets — each covers 3 calendar months",
  "half-yearly": "2 half-year buckets — each covers 6 calendar months",
  annual: "1 annual bucket with 12-month analytical breakdown",
};

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "monthly", label: "Monthly (12 months)" },
  { value: "quarterly", label: "Quarterly (4 quarters)" },
  { value: "half-yearly", label: "Half-Yearly (2 halves)" },
  { value: "annual", label: "Annual (1 year)" },
];

export function budgetStatusConfig(status: string): {
  label: string;
  className: string;
  icon: ReactNode;
} {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        className: "text-[#8D8A87] bg-[#8D8A87]/10",
        icon: <Circle className="h-3 w-3" />,
      };
    case "active":
      return {
        label: "Active",
        className: "text-[#2E7D32] bg-[#2E7D32]/10",
        icon: <PlayCircle className="h-3 w-3" />,
      };
    case "locked":
      return {
        label: "Locked",
        className: "text-[#1565C0] bg-[#1565C0]/10",
        icon: <Lock className="h-3 w-3" />,
      };
    case "archived":
      return {
        label: "Archived",
        className: "text-[#616161] bg-[#616161]/10",
        icon: <Archive className="h-3 w-3" />,
      };
    default:
      return {
        label: status,
        className: "text-[#8D8A87] bg-[#8D8A87]/10",
        icon: <Circle className="h-3 w-3" />,
      };
  }
}

export function canEditStatus(status: string): boolean {
  return status === "draft" || status === "active";
}

export function canActivate(status: string): boolean {
  return status === "draft";
}

export function canLock(status: string): boolean {
  return status === "active";
}

export function canArchive(status: string): boolean {
  return status === "locked" || status === "active";
}
