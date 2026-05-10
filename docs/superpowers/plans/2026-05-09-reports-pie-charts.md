# Reports Pie Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two interactive pie-chart-based visuals under the existing Budget vs Actual section without breaking the current reports experience.

**Architecture:** Keep the backend API unchanged and build a small frontend chart layer around the existing `Recharts` wrapper. Put data normalization in a focused helper module, keep selection state in `Reports.tsx`, and add logic-only tests for the new chart mapping and filtering behavior.

**Tech Stack:** React 19, TypeScript, Recharts, existing `src/components/ui/chart.tsx`, Vitest, Testing-library-free logic tests, Tailwind CSS

---

## File Map

- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\chart-data.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\FinancialDistributionCard.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\ReportChartLegend.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\InflowOutflowPieChart.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\BudgetActualExpensesPieChart.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\__tests__\chart-data.test.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\src\pages\Reports.tsx`

### Task 1: Add Failing Logic Tests

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\__tests__\chart-data.test.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\chart-data.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  buildBudgetActualChartData,
  buildInflowOutflowChartData,
  getVisibleBudgetRows,
} from "../chart-data";

describe("buildInflowOutflowChartData", () => {
  it("maps revenue, cogs, expenses, and payroll into inflow and outflow totals", () => {
    const result = buildInflowOutflowChartData({
      revenue: "125000.00",
      cogs: "18000.00",
      expenses: "22000.00",
      payroll: "15000.00",
    });

    expect(result.totalMovement).toBe("180000.00");
    expect(result.net).toBe("70000.00");
    expect(result.segments).toEqual([
      expect.objectContaining({ key: "inflow", value: 125000 }),
      expect.objectContaining({ key: "outflow", value: 55000 }),
    ]);
  });

  it("returns an empty flag when both sides are zero", () => {
    const result = buildInflowOutflowChartData({
      revenue: "0.00",
      cogs: "0.00",
      expenses: "0.00",
      payroll: "0.00",
    });

    expect(result.isEmpty).toBe(true);
    expect(result.segments).toEqual([]);
  });
});

describe("buildBudgetActualChartData", () => {
  it("builds chart segments from non-zero actuals and keeps totals for the center summary", () => {
    const result = buildBudgetActualChartData({
      totalBudgeted: "90000.00",
      totalActual: "76000.00",
      totalVariance: "14000.00",
      categories: [
        {
          categoryId: 1,
          categoryName: "Rent",
          categoryColor: "#d9a3b7",
          budgeted: "40000.00",
          actual: "35000.00",
          variance: "5000.00",
          variancePercent: "12.5",
          isOverBudget: false,
        },
        {
          categoryId: 2,
          categoryName: "Marketing",
          categoryColor: "#e9d6df",
          budgeted: "20000.00",
          actual: "0.00",
          variance: "20000.00",
          variancePercent: "100.0",
          isOverBudget: false,
        },
      ],
    });

    expect(result.isEmpty).toBe(false);
    expect(result.totalActual).toBe("76000.00");
    expect(result.segments).toEqual([
      expect.objectContaining({ categoryId: 1, value: 35000 }),
    ]);
    expect(result.legendItems).toHaveLength(2);
  });
});

describe("getVisibleBudgetRows", () => {
  it("marks only the selected category row as active", () => {
    const rows = getVisibleBudgetRows(
      [
        { categoryId: 1, categoryName: "Rent" },
        { categoryId: 2, categoryName: "Utilities" },
      ],
      2,
    );

    expect(rows).toEqual([
      expect.objectContaining({ categoryId: 1, isSelected: false, isDimmed: true }),
      expect.objectContaining({ categoryId: 2, isSelected: true, isDimmed: false }),
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/reports/__tests__/chart-data.test.ts`
Expected: FAIL with module or export errors because `chart-data.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildInflowOutflowChartData() {
  throw new Error("Not implemented");
}

export function buildBudgetActualChartData() {
  throw new Error("Not implemented");
}

export function getVisibleBudgetRows() {
  throw new Error("Not implemented");
}
```

- [ ] **Step 4: Run test to verify it still fails for behavior, not missing files**

Run: `npm test -- src/features/reports/__tests__/chart-data.test.ts`
Expected: FAIL with `Not implemented`.

### Task 2: Implement Chart Data Helpers

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\chart-data.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\__tests__\chart-data.test.ts`

- [ ] **Step 1: Implement the helper types and decimal-safe mapping**

```ts
import { d } from "@/lib/decimal";

type ProfitLossInput = {
  revenue: string;
  cogs: string;
  expenses: string;
  payroll: string;
};

type BudgetCategoryInput = {
  categoryId: number;
  categoryName: string;
  categoryColor?: string | null;
  budgeted: string;
  actual: string;
  variance: string;
  variancePercent: string;
  isOverBudget: boolean;
};

type BudgetActualInput = {
  totalBudgeted: string;
  totalActual: string;
  totalVariance: string;
  categories: BudgetCategoryInput[];
};

export function buildInflowOutflowChartData(input: ProfitLossInput) {
  const inflow = d(input.revenue);
  const outflow = d(input.cogs).plus(input.expenses).plus(input.payroll);
  const totalMovement = inflow.plus(outflow);
  const net = inflow.minus(outflow);

  const segments = [
    { key: "inflow", label: "Inflow", value: inflow.toNumber(), amount: inflow.toFixed(2), color: "#5B9CFF" },
    { key: "outflow", label: "Outflow", value: outflow.toNumber(), amount: outflow.toFixed(2), color: "#D6A0B6" },
  ].filter((segment) => segment.value > 0);

  return {
    segments,
    totalMovement: totalMovement.toFixed(2),
    net: net.toFixed(2),
    isEmpty: segments.length === 0,
  };
}

export function buildBudgetActualChartData(input: BudgetActualInput) {
  const segments = input.categories
    .map((category) => ({
      ...category,
      value: d(category.actual).toNumber(),
      color: category.categoryColor || "#E8CAD7",
    }))
    .filter((segment) => segment.value > 0);

  const legendItems = input.categories.map((category) => ({
    ...category,
    color: category.categoryColor || "#E8CAD7",
  }));

  return {
    segments,
    legendItems,
    totalBudgeted: input.totalBudgeted,
    totalActual: input.totalActual,
    totalVariance: input.totalVariance,
    isEmpty: segments.length === 0,
  };
}

export function getVisibleBudgetRows<T extends { categoryId: number }>(rows: T[], selectedCategoryId: number | null) {
  return rows.map((row) => ({
    ...row,
    isSelected: selectedCategoryId === row.categoryId,
    isDimmed: selectedCategoryId !== null && selectedCategoryId !== row.categoryId,
  }));
}
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/features/reports/__tests__/chart-data.test.ts`
Expected: PASS

- [ ] **Step 3: Refine helper outputs for UI text and percent calculations if tests expose gaps**

```ts
const percent = totalMovement.gt(0)
  ? inflow.div(totalMovement).mul(100).toFixed(1)
  : "0.0";
```

- [ ] **Step 4: Run the focused test again**

Run: `npm test -- src/features/reports/__tests__/chart-data.test.ts`
Expected: PASS

### Task 3: Build Shared Chart UI Components

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\FinancialDistributionCard.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\ReportChartLegend.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\InflowOutflowPieChart.tsx`
- Create: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\BudgetActualExpensesPieChart.tsx`

- [ ] **Step 1: Create the shared card shell**

```tsx
// ABOUTME: Wraps report distribution charts in a consistent dashboard-style card.
// ABOUTME: Keeps titles, empty states, summaries, and legend placement aligned across report visuals.
import type { ReactNode } from "react";

type FinancialDistributionCardProps = {
  title: string;
  subtitle?: string;
  summary: ReactNode;
  chart: ReactNode;
  legend: ReactNode;
  isEmpty: boolean;
  emptyMessage: string;
};

export function FinancialDistributionCard(props: FinancialDistributionCardProps) {
  return (
    <div className="rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-[#2D2A26]">{props.title}</h3>
          {props.subtitle ? <p className="mt-1 text-xs text-[#8D8A87]">{props.subtitle}</p> : null}
        </div>
        {props.summary}
      </div>
      {props.isEmpty ? (
        <div className="mt-4 rounded-xl bg-[#FAF7F3] p-6 text-sm text-[#8D8A87]">{props.emptyMessage}</div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          {props.chart}
          {props.legend}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the interactive legend**

```tsx
// ABOUTME: Renders interactive legend rows for report charts with accessible buttons.
// ABOUTME: Mirrors chart selection behavior so keyboard and screen-reader users can work from the legend.
type ReportChartLegendItem = {
  key: string | number;
  label: string;
  amount: string;
  percent?: string;
  color: string;
  isActive: boolean;
};
```

- [ ] **Step 3: Create the two pie chart components around the existing chart wrapper**

```tsx
// ABOUTME: Shows inflow and outflow share for the current report period.
// ABOUTME: Uses the shared chart wrapper, tooltip pattern, and accessible active-state handling.

// ABOUTME: Shows actual expense distribution by budget category under Budget vs Actual.
// ABOUTME: Connects slice selection to the visible category list in the reports page.
```

- [ ] **Step 4: Verify type-checking on the new component files**

Run: `npm run check`
Expected: PASS for the new files, or only unrelated pre-existing failures outside these files.

### Task 4: Integrate Charts Into `Reports.tsx`

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\src\pages\Reports.tsx`

- [ ] **Step 1: Add the failing integration by importing the new helpers and components**

```tsx
import {
  buildBudgetActualChartData,
  buildInflowOutflowChartData,
  getVisibleBudgetRows,
} from "@/features/reports/chart-data";
import { InflowOutflowPieChart } from "@/features/reports/InflowOutflowPieChart";
import { BudgetActualExpensesPieChart } from "@/features/reports/BudgetActualExpensesPieChart";
```

- [ ] **Step 2: Add local selection state and memoized data**

```tsx
const [selectedFlowKey, setSelectedFlowKey] = useState<"inflow" | "outflow" | null>(null);
const [selectedBudgetCategoryId, setSelectedBudgetCategoryId] = useState<number | null>(null);

const inflowOutflowData = useMemo(
  () =>
    buildInflowOutflowChartData({
      revenue: pl?.revenue ?? "0",
      cogs: pl?.cogs ?? "0",
      expenses: pl?.expenses ?? "0",
      payroll: pl?.payroll ?? "0",
    }),
  [pl],
);

const budgetActualData = useMemo(
  () =>
    bva
      ? buildBudgetActualChartData(bva)
      : { segments: [], legendItems: [], totalBudgeted: "0.00", totalActual: "0.00", totalVariance: "0.00", isEmpty: true },
  [bva],
);
```

- [ ] **Step 3: Insert the new two-card chart row under the totals summary**

```tsx
<div className="grid gap-4 lg:grid-cols-2">
  <InflowOutflowPieChart
    data={inflowOutflowData}
    selectedKey={selectedFlowKey}
    onSelect={setSelectedFlowKey}
  />
  <BudgetActualExpensesPieChart
    data={budgetActualData}
    selectedCategoryId={selectedBudgetCategoryId}
    onSelectCategory={setSelectedBudgetCategoryId}
  />
</div>
```

- [ ] **Step 4: Apply row highlight and dimming to the existing budget rows**

```tsx
{getVisibleBudgetRows(bva.categories, selectedBudgetCategoryId).map((cat) => (
  <div
    key={cat.categoryId}
    className={cn(
      "space-y-1 rounded-lg p-2 transition-colors",
      cat.isSelected && "bg-[#F8F4F7]",
      cat.isDimmed && "opacity-60",
    )}
  >
```

- [ ] **Step 5: Add a reset control that only appears when a selection exists**

```tsx
{selectedBudgetCategoryId !== null ? (
  <Button variant="ghost" size="sm" onClick={() => setSelectedBudgetCategoryId(null)}>
    Clear filter
  </Button>
) : null}
```

- [ ] **Step 6: Run type-checking after integration**

Run: `npm run check`
Expected: PASS for the changed files, or only unrelated pre-existing failures already present before these edits.

### Task 5: Validate, Lint, And Verify

**Files:**
- Test: `d:\DevCenter\abuilds\fina\finaflow\src\features\reports\__tests__\chart-data.test.ts`
- Modify if needed: changed report chart files

- [ ] **Step 1: Run the focused logic test**

Run: `npm test -- src/features/reports/__tests__/chart-data.test.ts`
Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS for changed files, or capture and document any unrelated pre-existing lint failures.

- [ ] **Step 3: Run full type-check**

Run: `npm run check`
Expected: PASS for changed files, or capture and document any unrelated pre-existing type issues.

- [ ] **Step 4: Run the app and verify the reports page in the browser**

Run: `npm run dev`
Check:
- Reports page loads without runtime errors
- Both new chart cards render under Budget vs Actual
- Hover tooltips show expected values
- Clicking a budget category slice highlights the matching row
- Layout stays readable on narrow and wide screens

- [ ] **Step 5: Commit only the implementation files**

```bash
git add src/pages/Reports.tsx src/features/reports docs/superpowers/plans/2026-05-09-reports-pie-charts.md
git commit -m "Add reports budget chart visuals"
```
