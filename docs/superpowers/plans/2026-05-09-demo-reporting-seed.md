# Demo Reporting Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the DEMO business with deterministic reportable data so reports, exports, charts, and forecast views populate immediately.

**Architecture:** Extract a pure planner that generates demo sales, expenses, budgets, M-PESA transactions, and future bills from an anchor date, then have `db/seed-demo.cjs` apply that plan to DEMO locations after clearing old DEMO transactional rows. Keep tenant scoping untouched and verify behavior with focused planner tests plus an actual seed run.

**Tech Stack:** Node CJS seed script, PostgreSQL via `pg`, Vitest, existing database schema

---

## File Map

- Create: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo-plan.cjs`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\seed-demo-plan.test.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo.cjs`

### Task 1: Add Failing Planner Test

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\seed-demo-plan.test.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo-plan.cjs`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildDemoReportingSeedPlan } from "../../db/seed-demo-plan.cjs";

describe("buildDemoReportingSeedPlan", () => {
  it("builds sales, expenses, budgets, mpesa transactions, and future bills for a 3 month reporting window", () => {
    const plan = buildDemoReportingSeedPlan({
      anchorDate: "2026-05-09",
      locationIds: { main: 10, secondary: 11 },
      categoryIds: { food: 1, utilities: 2, salaries: 3, rent: 4, supplies: 5, marketing: 6 },
      paymentMethodIds: { cash: 1, mpesa: 2, bank: 3, card: 4 },
      accountIds: { cash: 101, mpesa: 102, bank: 103 },
      enteredBy: 8,
      supplierIds: { landlord: 1, fuel: 2, utilities: 3, stationery: 4 },
    });

    expect(plan.sales.length).toBeGreaterThan(0);
    expect(plan.expenses.length).toBeGreaterThan(0);
    expect(plan.budgets.length).toBeGreaterThan(0);
    expect(plan.mpesaTransactions.length).toBeGreaterThan(0);
    expect(plan.futureBills.length).toBeGreaterThan(0);
    expect(new Set(plan.reportingMonths.map((m) => `${m.year}-${m.month}`)).size).toBe(3);
  });

  it("creates both positive and negative mpesa movements and keeps results deterministic for the same anchor date", () => {
    const first = buildDemoReportingSeedPlan(/* same fixture input */);
    const second = buildDemoReportingSeedPlan(/* same fixture input */);

    expect(first.mpesaTransactions.some((txn) => Number(txn.amount) > 0)).toBe(true);
    expect(first.mpesaTransactions.some((txn) => Number(txn.amount) < 0)).toBe(true);
    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/__tests__/seed-demo-plan.test.ts`
Expected: FAIL because the planner module does not exist yet.

- [ ] **Step 3: Add the minimal planner module stub**

```js
function buildDemoReportingSeedPlan() {
  throw new Error("Not implemented");
}

module.exports = { buildDemoReportingSeedPlan };
```

- [ ] **Step 4: Run test to verify the failure moves to behavior**

Run: `npm test -- api/__tests__/seed-demo-plan.test.ts`
Expected: FAIL with `Not implemented`.

### Task 2: Implement Demo Planner

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo-plan.cjs`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\seed-demo-plan.test.ts`

- [ ] **Step 1: Implement deterministic date window helpers and seed templates**

```js
function monthWindow(anchorDate) {
  const base = new Date(`${anchorDate}T00:00:00Z`);
  return [0, 1, 2].map((offset) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }).reverse();
}
```

- [ ] **Step 2: Implement row planners for sales, expenses, budgets, M-PESA, and future bills**

```js
function buildDemoReportingSeedPlan(input) {
  const reportingMonths = monthWindow(input.anchorDate);
  return {
    reportingMonths,
    sales: buildSales(reportingMonths, input),
    expenses: buildExpenses(reportingMonths, input),
    budgets: buildBudgets(reportingMonths, input),
    mpesaTransactions: buildMpesa(reportingMonths, input),
    futureBills: buildFutureBills(input),
  };
}
```

- [ ] **Step 3: Run the focused test**

Run: `npm test -- api/__tests__/seed-demo-plan.test.ts`
Expected: PASS

### Task 3: Wire Planner Into `seed-demo.cjs`

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo.cjs`
- Modify if needed: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo-plan.cjs`

- [ ] **Step 1: Import the planner and resolve DEMO entity IDs**

```js
const { buildDemoReportingSeedPlan } = require("./seed-demo-plan.cjs");
```

- [ ] **Step 2: Clear old DEMO transactional rows before reseeding**

```js
await conn.query('DELETE FROM "daily_sale_payments" WHERE "dailySaleId" IN (SELECT id FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[]))', [demoLocationIds]);
await conn.query('DELETE FROM "daily_sales" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
await conn.query('DELETE FROM "expenses" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
await conn.query('DELETE FROM "mpesa_transactions" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
await conn.query('DELETE FROM "budgets" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
await conn.query('DELETE FROM "bills" WHERE "locationId" = ANY($1::bigint[])', [demoLocationIds]);
```

- [ ] **Step 3: Insert planned budgets, sales, payments, expenses, M-PESA rows, and future bills**

```js
for (const budget of plan.budgets) {
  await conn.query(
    'INSERT INTO "budgets" ("locationId","categoryId","month","year","amount","notes","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())',
    [budget.locationId, budget.categoryId, budget.month, budget.year, budget.amount, budget.notes]
  );
}
```

- [ ] **Step 4: Run the planner test again**

Run: `npm test -- api/__tests__/seed-demo-plan.test.ts`
Expected: PASS

### Task 4: Seed And Verify

**Files:**
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\seed-demo-plan.test.ts`
- Modify if needed: `d:\DevCenter\abuilds\fina\finaflow\db\seed-demo.cjs`

- [ ] **Step 1: Run the focused test**

Run: `npm test -- api/__tests__/seed-demo-plan.test.ts`
Expected: PASS

- [ ] **Step 2: Run the demo seed**

Run: `node db/seed-demo.cjs`
Expected: PASS with logs showing refreshed DEMO reporting rows

- [ ] **Step 3: Spot-check seeded counts**

Run: `node -e "/* query demo sales, expenses, budgets, mpesa, and bills counts */"`
Expected: non-zero counts for the DEMO business locations

- [ ] **Step 4: Verify the reports page in the browser**

Check:
- reports cards show non-zero values for DEMO
- pie charts render with actual segments
- export counts are non-zero
- forecast shows upcoming bills

- [ ] **Step 5: Commit only the seed-related changes**

```bash
git add db/seed-demo.cjs db/seed-demo-plan.cjs api/__tests__/seed-demo-plan.test.ts docs/superpowers/specs/2026-05-09-demo-reporting-seed-design.md docs/superpowers/plans/2026-05-09-demo-reporting-seed.md
git commit -m "Seed demo reporting data"
```
