// ABOUTME: Normalizes report totals into chart-friendly data for the reports dashboard visuals.
// ABOUTME: Keeps financial chart mapping and row-selection state separate from React rendering code.
import Decimal from "decimal.js";

const INFLOW_COLOR = "#5B9CFF";
const OUTFLOW_COLOR = "#D6A0B6";
const DEFAULT_CATEGORY_COLOR = "#E8CAD7";

export type ProfitLossChartInput = {
  revenue: string;
  cogs: string;
  expenses: string;
  payroll: string;
};

export type InflowOutflowSegmentKey = "inflow" | "outflow";

export type InflowOutflowSegment = {
  key: InflowOutflowSegmentKey;
  label: string;
  value: number;
  amount: string;
  percent: string;
  color: string;
};

export type InflowOutflowChartData = {
  segments: InflowOutflowSegment[];
  totalMovement: string;
  net: string;
  isEmpty: boolean;
};

export type BudgetActualCategoryInput = {
  categoryId: number;
  categoryName: string;
  categoryColor?: string | null;
  budgeted: string;
  actual: string;
  variance: string;
  variancePercent: string;
  isOverBudget: boolean;
};

export type BudgetActualChartInput = {
  totalBudgeted: string;
  totalActual: string;
  totalVariance: string;
  categories: BudgetActualCategoryInput[];
};

export type BudgetActualChartSegment = BudgetActualCategoryInput & {
  key: number;
  label: string;
  value: number;
  amount: string;
  percent: string;
  color: string;
};

export type BudgetActualLegendItem = BudgetActualCategoryInput & {
  key: number;
  label: string;
  amount: string;
  percent: string;
  color: string;
};

export type BudgetActualChartData = {
  segments: BudgetActualChartSegment[];
  legendItems: BudgetActualLegendItem[];
  totalBudgeted: string;
  totalActual: string;
  totalVariance: string;
  isEmpty: boolean;
};

const toDecimal = (value: string) => new Decimal(value || "0");

const toPercent = (value: Decimal, total: Decimal) =>
  total.gt(0) ? value.div(total).mul(100).toFixed(1) : "0.0";

export function buildInflowOutflowChartData(input: ProfitLossChartInput): InflowOutflowChartData {
  const inflow = toDecimal(input.revenue);
  const outflow = toDecimal(input.cogs).plus(input.expenses).plus(input.payroll);
  const totalMovement = inflow.plus(outflow);
  const net = inflow.minus(outflow);

  const segments = [
    {
      key: "inflow" as const,
      label: "Inflow",
      value: inflow.toNumber(),
      amount: inflow.toFixed(2),
      percent: toPercent(inflow, totalMovement),
      color: INFLOW_COLOR,
    },
    {
      key: "outflow" as const,
      label: "Outflow",
      value: outflow.toNumber(),
      amount: outflow.toFixed(2),
      percent: toPercent(outflow, totalMovement),
      color: OUTFLOW_COLOR,
    },
  ].filter((segment): segment is InflowOutflowSegment => segment.value > 0);

  return {
    segments,
    totalMovement: totalMovement.toFixed(2),
    net: net.toFixed(2),
    isEmpty: segments.length === 0,
  };
}

export function buildBudgetActualChartData(input: BudgetActualChartInput): BudgetActualChartData {
  const totalActual = toDecimal(input.totalActual);

  const legendItems = input.categories.map((category) => {
    const actual = toDecimal(category.actual);

    return {
      ...category,
      key: category.categoryId,
      label: category.categoryName,
      amount: category.actual,
      percent: toPercent(actual, totalActual),
      color: category.categoryColor || DEFAULT_CATEGORY_COLOR,
    };
  });

  const segments = legendItems
    .map((item) => ({
      ...item,
      value: toDecimal(item.actual).toNumber(),
    }))
    .filter((segment) => segment.value > 0);

  return {
    segments,
    legendItems,
    totalBudgeted: input.totalBudgeted,
    totalActual: input.totalActual,
    totalVariance: input.totalVariance,
    isEmpty: segments.length === 0,
  };
}

export function getVisibleBudgetRows<T extends { categoryId: number }>(
  rows: T[],
  selectedCategoryId: number | null,
) {
  return rows.map((row) => ({
    ...row,
    isSelected: selectedCategoryId === row.categoryId,
    isDimmed: selectedCategoryId !== null && selectedCategoryId !== row.categoryId,
  }));
}
