# Plan: Dashboard Coherence — 3 New Cards + Layout Overhaul

## Summary

Bring the main `Dashboard` page up to the standard set by `Home.tsx` and the
reports surfaces. Add three new cards (Cash Position, Mobile Wallet Summary,
30-Day Cashflow Trend) that close existing data-visibility gaps, then
restructure the layout so the page reads top-down: **position → trend →
KPIs → details → alerts → summaries**.

The work touches one backend file, one new feature folder, one existing page,
and the CHANGELOG. It is grounded in the existing design tokens
(`#C73E1D` / `#2E7D32` / `#D32F2F` / `#D4A854` / `#8D8A87` / `#E8E0D8` /
`#F5EDE6`), the existing `Card` primitive in `src/components/ui/card.tsx`, the
existing `ChartContainer` wrapper in `src/components/ui/chart.tsx`, and the
existing chart patterns from
`src/features/reports/MonthlyTrendChart.tsx`.

## Current State Analysis

`src/pages/Dashboard.tsx` is a flat top-to-bottom page with five
problems that make it incoherent and unappealing:

1. **Data invisibility** — `summary.wallet` is already returned by
   `api/dashboard-router.ts` but never rendered. M-PESA appears, mobile
   wallet doesn't, even though both are imported the same way.
2. **No visual hierarchy** — every section is a white card with a header.
   The eye has nowhere to land first. There's no "hero" element.
3. **No time series** — the page shows period totals only. There is no
   sparkline, area chart, or comparison line, while the rest of the app
   (e.g. `MonthlyTrendChart`) already uses Recharts.
4. **KPIs are flat** — `KpiCard` shows a number and a subtitle. No trend vs
   the prior period, no gradient background to match `Home.tsx`'s
   "Today's Sales / Expenses / Net Position / Bills Due" hero card.
5. **Alerts are fragmented** — "Overdue Bills" and "Due Within 7 Days" are
   two sibling cards. `alerts.upcomingBills30` and
   `alerts.upcomingRecurring` are returned by the router but never
   displayed. A single bills pipeline view would be more coherent.

The existing infrastructure we will reuse:

* `Card` / `CardHeader` / `CardTitle` / `CardContent` from
  `src/components/ui/card.tsx`

* `ChartContainer` / `ChartTooltip` from `src/components/ui/chart.tsx`

* `trpc.dashboard.summary` and `trpc.dashboard.alerts` already power the
  page

* Decimal math via `d()` from `api/lib/decimal.ts` (server) and
  `Decimal` from `decimal.js` (client)

* `formatKES`, `formatDate`, `getLocalDateString` from `src/lib/utils.ts`

* Permissions: `PERMISSIONS.DASHBOARD_VIEW` is already in every role
  except `employee`. No new permission is needed.

* `trpc.dashboard.*` is mounted in `api/router.ts` (line 11, 57)

## Proposed Changes

### 1. Backend — `api/dashboard-router.ts`

**Why:** Provide the data the three new cards need.

**Changes:**

a. **Extend** **`summary`** **response** to include:

* `previousPeriodTotals: { totalSales, totalExpenses }` — the same
  metrics for the period of equal length immediately preceding
  `dateFrom`..`dateTo`. The frontend uses this to compute the trend %
  shown on each KPI card.

* `cashPosition: { total: string, byType: { cash: string, bank: string,
  wallet: string, other: string } }` — aggregated from `accounts`. The
  frontend uses this for the new featured "Cash Position" card.
  `accounts` is already fetched; this is just a `reduce`.

b. **Add new query** **`cashflowTrend`**:

* Input: `{ dateFrom: string, dateTo: string, locationId?: number }`

* Output: `{ days: Array<{ date: string, sales: string, expenses: string,
  net: string }> }` — one row per calendar day in the range, with
  per-day totals for `daily_sales.netSales` and `expenses.amount`. Days
  with no data return `0`.

* Implementation: two `GROUP BY DATE(...)` queries against
  `daily_sales` and `expenses`, then merge into a dense date array in
  JS. Use `d()` for arithmetic. Respect the same `getCurrentBusinessLocationIds`
  filter as `summary`.

**No changes** to other queries (`alerts`, `billsSummary`, etc.) —
the alerts response already has everything the Bills Pipeline card
needs.

### 2. New feature folder — `src/features/dashboard/`

Mirrors the pattern of `src/features/reports/`. All new dashboard
sub-components live here so the page itself stays small.

**`src/features/dashboard/cash-position.ts`** — pure helper.

* `aggregateCashPosition(accounts)` → `CashPosition` for the new card.

* Separated from the component so it can be unit-tested without React.

**`src/features/dashboard/cashflow-trend-data.ts`** — pure helper.

* `buildCashflowTrendSeries(days)` → `ChartPoint[]` for Recharts.

* Handles empty days, decimal-to-number conversion, y-axis max
  calculation.

* Parallel to `src/features/reports/chart-data.ts` (which has no
  test coverage gap to worry about, but we will add a small unit test
  for this new helper).

**`src/features/dashboard/CashPositionCard.tsx`** — the new featured
hero card.

* Full-width, sits at the top of the dashboard body, below the header.

* Shows: large `formatKES(total)` centered, a horizontal stacked bar
  breaking down by account type (Cash / Bank / Wallet / Other), and a
  one-line caption "Total cash on hand across all branches".

* Color scheme: `from-#2E7D32/5 to-#2E7D32/10` gradient on the card
  background to match the `Home.tsx` hero card aesthetic.

* Uses the existing `Card` primitive; no new UI dependencies.

**`src/features/dashboard/CashflowTrendCard.tsx`** — the new chart
card.

* 30-day daily sales/expenses line + area chart.

* Uses the same Recharts primitives as
  `src/features/reports/MonthlyTrendChart.tsx` (ComposedChart, Line,
  Area, XAxis, YAxis, ResponsiveContainer).

* Colors: sales `#2E7D32`, expenses `#D32F2F`, net `#C73E1D`.

* Empty-state matches `MonthlyTrendChart` (centered "No data" text).

* Tooltip reuses the `chart.tsx` `ChartTooltipContent` shape.

* Title row includes the legend swatches like `MonthlyTrendChart`.

**`src/features/dashboard/MobileWalletSummaryCard.tsx`** — mirrors
the existing M-PESA Summary block in `Dashboard.tsx`.

* Same three-up layout (Inflows / Outflows / Fees) using
  `summary.wallet`.

* Renders conditionally on `summary.wallet && summary.wallet.totalIn !==
  "0" || totalOut !== "0" || totalFees !== "0"` so it doesn't show
  empty zeros to businesses that don't use mobile wallets.

**`src/features/dashboard/TrendKpiCard.tsx`** — replacement for the
in-page `KpiCard` helper.

* Same shape as the existing in-page `KpiCard`, plus a trend %
  badge in the top-right corner (`▲ 12%` green / `▼ 8%` red /
  `— 0%` grey) computed from `previousPeriodTotals`.

* Gradient background classes
  (`bg-gradient-to-br from-{color}/5 to-{color}/10`) to tie into the
  Home page aesthetic.

* `data-testid` attributes for regression testing.

**`src/features/dashboard/BillsPipelineCard.tsx`** — replaces the two
separate alert cards in `Dashboard.tsx`.

* Single card with three stacked sub-sections: Overdue (red tint),
  Due in 7 days (orange tint), Due in 30 days (gold tint).

* Each section shows up to 3 bills with "View all →" links to the
  Bills page filtered appropriately.

* Uses `alerts.overdueBills`, `alerts.upcomingBills7`,
  `alerts.upcomingBills30`. `upcomingBills30` is already in the router
  response (line 80 of `api/dashboard-router.ts`) but not currently
  surfaced anywhere in the UI.

**`src/features/dashboard/TodayStrip.tsx`** — compact anchor row
between KPIs and the trend chart.

* Two side-by-side mini-cards: "Yesterday's Income" (from
  `trpc.dashboard.previousDayIncome` — already exists in the router
  and is used on `Expenses.tsx`) and "Today's Pending" (count of
  bills due today + payroll periods with `paymentDate = today`).

**`src/features/dashboard/index.ts`** — barrel re-export, mirroring
`src/features/reports/index.ts`.

### 3. Modified — `src/pages/Dashboard.tsx`

**Why:** Apply the new layout. The page becomes the assembly point
for the new components rather than the place where section markup
lives.

**Changes:**

* Keep the existing header (title + date range inputs).

* Drop the in-page `KpiCard` helper; import `TrendKpiCard` from the
  new feature folder.

* New section order, top to bottom:

  1. `<CashPositionCard />` — full width
  2. KPI row (4 `<TrendKpiCard />`) — replaces the current 5 flat
     KPIs; keeps Total Sales, Total Expenses, Net Cashflow, Bills Due.
     "Unpaid Sales" KPI is dropped — it duplicates info shown in the
     Bills Pipeline card.
  3. `<TodayStrip />` (2-col) + `<CashflowTrendCard />` (2-col, the
     larger half)
  4. Account Balances (col-span-2) + Quick Actions — unchanged
  5. `<BillsPipelineCard />` — full width
  6. `<MobileWalletSummaryCard />` (col-span-1) + the existing
     M-PESA Summary block (col-span-1) — symmetric pair

* Permission gating on the new cards:

  * `CashPositionCard` and `TrendKpiCard` row: gated on
    `hasAnyPermission(permContext, [PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW])` (matches the existing role spread).

  * `MobileWalletSummaryCard`: gated on
    `hasPermission(permContext, PERMISSIONS.WALLET_VIEW)`. Falls back
    to a one-line "No mobile wallet connected" empty state if hidden.

  * `CashflowTrendCard`: always rendered (uses sales+expenses data the
    user already has access to via the `summary` query).

  * `BillsPipelineCard`: gated on
    `hasPermission(permContext, PERMISSIONS.BILLS_VIEW)`.

  * `TodayStrip`: always rendered.

### 4. New tests

**`src/features/dashboard/__tests__/cashflow-trend-data.test.ts`**

* Verifies `buildCashflowTrendSeries` maps dense days correctly,
  handles empty input, and clamps negative net values into the chart
  series.

**`src/features/dashboard/__tests__/cash-position.test.ts`**

* Verifies `aggregateCashPosition` buckets accounts by type and sums
  totals with `Decimal`. No React.

**`src/pages/__tests__/dashboard-coherence.test.ts`** — source-level
regression test (matches the pattern in
`src/pages/__tests__/partner-dashboard-visibility.test.ts`).

* Asserts that `src/pages/Dashboard.tsx` imports and renders
  `CashPositionCard`, `CashflowTrendCard`, `MobileWalletSummaryCard`,
  `BillsPipelineCard`, `TodayStrip`, and `TrendKpiCard`.

* Asserts that the new `cashflowTrend` query is wired up.

* Asserts that `MobileWalletSummaryCard` reads from `summary.wallet`.

* Asserts that the page no longer renders the in-page `KpiCard`
  helper (replaced by `TrendKpiCard`).

**`api/__tests__/dashboard-summary-extensions.test.ts`** — backend
regression test for the extended `summary` and the new
`cashflowTrend` query.

* Mocks the DB and verifies `previousPeriodTotals` is the prior
  equal-length window.

* Verifies `cashPosition.byType` correctly aggregates by `type`.

* Verifies `cashflowTrend` returns one row per day in the requested
  range, fills zero days, and respects the location filter.

### 5. CHANGELOG.md

Append a new section above the current top entry (which is
"Partner Leads Engine...") under `[Unreleased]`. Format follows the
existing changelog style (### Added / ### Changed / ### Tests).

## Assumptions & Decisions

1. **`wallet`** **is already in the** **`summary`** **response** — confirmed at
   line 56 of `api/dashboard-router.ts`. The "Mobile Wallet Summary"
   card is purely a frontend addition; no backend change is needed
   for it.
2. **No new permissions** — `DASHBOARD_VIEW` is already in every role
   except `employee`. `WALLET_VIEW` and `BILLS_VIEW` are already in
   the relevant roles. The new cards gate on existing permissions.
3. **Decimal safety** — all backend math uses `d()` /
   `Decimal`. The `aggregateCashPosition` helper uses
   `Decimal` on the frontend (already imported by
   `chart-data.ts`), so we won't regress the rule that all financial
   calculations use `decimal.js`.
4. **`MobileWalletSummaryCard`** **hides when unused** — if a business
   has no mobile wallet transactions, the M-PESA card still renders
   and the layout remains symmetric. The M-PESA block stays exactly
   as it is; we only add a sibling card.
5. **KPI count drops from 5 to 4** — the "Unpaid Sales" KPI is
   redundant with the Bills Pipeline. Removing it makes the KPI row
   fit cleanly at `lg:grid-cols-4` without an awkward 5th card.
6. **Recharts is already in the dependency tree** — confirmed via
   `src/components/ui/chart.tsx` (line 4) and
   `src/features/reports/MonthlyTrendChart.tsx` (line 4). No
   `package.json` change.
7. **Layout reflow at 1440 / 768 / 320** — the new layout uses
   `lg:` breakpoints already present in the codebase
   (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, etc.). Mobile-first
   stacking is preserved.
8. **The M-PESA Summary block stays in** **`Dashboard.tsx`** rather than
   being moved into a new component, because the user did not ask
   for a refactor — only for the new cards. This is a deliberate
   restraint to avoid scope creep.
9. **Permissions are read-only references** — the new cards don't
   introduce new permission strings. The `Dashboard.tsx` permission
   helper usage matches the existing `hasAnyPermission` /
   `hasPermission` calls already in the page.

## Verification Steps

1. **Typecheck** — `npm run check` must pass cleanly. The new
   `cashflowTrend` query, the extended `summary` response, and the
   new components all need to type-check.
2. **Lint** — `npm run lint` must pass. The new files follow the
   existing `// ABOUTME: ...` header convention.
3. **Unit tests** — `npx vitest run
   src/features/dashboard/__tests__/cashflow-trend-data.test.ts
   src/features/dashboard/__tests__/cash-position.test.ts
   src/pages/__tests__/dashboard-coherence.test.ts
   api/__tests__/dashboard-summary-extensions.test.ts` must all pass.
4. **Build** — `npm run build` must succeed. Recharts is already
   bundled, so the new chart card shouldn't introduce a bundle-size
   regression worth flagging, but the build output is the source of
   truth.
5. **Manual smoke** — run `npm run dev:app` (or `npm run dev` if
   Portless is set up), open `/dashboard`, verify:

   * Cash Position card is at the top with a stacked breakdown bar.

   * KPI row shows trend % badges.

   * 30-day trend chart renders with sales/expenses lines.

   * Today Strip shows yesterday's income and today's pending.

   * Bills Pipeline card shows overdue + 7d + 30d sections.

   * M-PESA and Mobile Wallet summaries render as a symmetric pair.
6. **Coherence check** — verify the page no longer references
   `summary.wallet` invisibly (now wired up to the new card), and
   that the "Unpaid Sales" KPI is removed.
7. **Responsive check** — verify at 320px, 768px, and 1440px widths
   that cards stack correctly and the chart container resizes
   properly (the existing Recharts `ResponsiveContainer` already
   handles this, but visual confirmation is required).
8. **Permission check** — log in as a `viewer` and verify the
   Mobile Wallet card is hidden, and the Bills Pipeline card is
   hidden if `BILLS_VIEW` is missing.

