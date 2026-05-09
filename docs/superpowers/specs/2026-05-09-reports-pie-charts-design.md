# Reports Pie Charts Design

## Overview

Add two interactive chart cards to the existing reports module in `src/pages/Reports.tsx` under the current **Budget vs Actual** section. The new visuals should borrow the dashboard styling language from `resources/cashflow dash.png` while remaining limited to the user-requested pie-chart-based additions.

The reference image is a mixed-chart dashboard rather than a donut-only composition. The relevant qualities to mirror are:

- Clean dashboard cards with light surfaces and subtle borders
- Muted blue and rose finance palette
- Generous whitespace and balanced panel spacing
- Compact legends paired with monetary values
- A calm, data-dense layout rather than decorative visual effects

## Goals

- Add an `Inflow vs Outflow` chart using real report data
- Add a `Budget vs Actual Expenses` chart using real budget and expense category data
- Place both charts directly inside the existing `Budget vs Actual` card
- Preserve the current totals row and category progress rows
- Support hover tooltips, clickable segments, keyboard interaction, and responsive layouts
- Keep styling consistent with the current reports page and the provided reference image

## Non-Goals

- Rebuild the overall reports page into a new dashboard layout
- Replace the existing progress rows or summary metrics
- Introduce a new charting library
- Use mock or placeholder data

## Placement And Layout

The new charts belong inside the existing **Budget vs Actual** card in `src/pages/Reports.tsx`.

Placement order inside the card:

1. Existing totals summary row
2. New chart row with two visual cards
3. Existing category progress rows

Responsive behavior:

- Mobile: single-column stack
- Tablet and desktop: two-column grid
- Each chart card should maintain balanced padding and similar height so they feel like a matched dashboard row

## Visual Design

The reference image should be interpreted as a composition and styling guide rather than a direct instruction to turn every report element into a donut chart.

Visual rules:

- Use light card backgrounds with subtle border and soft shadow treatment
- Match the existing warm neutral report shell in `Reports.tsx`
- Use muted finance colors:
  - Inflow: soft blue
  - Outflow: muted rose
  - Budget and category distribution: pastel rose, blush, lilac, and neutral accents
- Keep legends compact and aligned with amount values
- Keep center labels concise and readable

Chart form:

- `Inflow vs Outflow` may use a donut-style pie with a center summary because it only has two major values
- `Budget vs Actual Expenses` should use a pie/donut distribution layout for category share visualization, but the design should remain consistent with the broader mixed-chart dashboard aesthetic from the reference

## Component Structure

Create a small reusable chart layer instead of embedding all chart logic directly into `Reports.tsx`.

### `FinancialDistributionCard`

Responsibilities:

- Shared card shell
- Title and optional subtitle
- Chart canvas wrapper
- Legend and summary layout
- Empty-state rendering

### `InflowOutflowPieChart`

Responsibilities:

- Accept inflow and outflow totals
- Render a two-segment chart
- Show center summary with total movement and net direction
- Support hover, keyboard focus, and click selection

### `BudgetActualExpensesPieChart`

Responsibilities:

- Accept category-based budget and actual data
- Render category slices from real report data
- Show center summary for total actual spend and variance context
- Allow click selection to filter or highlight matching category rows below

### `ReportChartLegend`

Responsibilities:

- Shared legend item rendering
- Color chip, label, amount, and percentage
- Active and keyboard-focus states
- Click and keyboard activation parity with chart slices

## Data Mapping

### Inflow vs Outflow

Use existing reports data already loaded in `Reports.tsx`.

- `Inflow` = `pl.revenue`
- `Outflow` = `pl.cogs + pl.expenses + pl.payroll`

This keeps the chart grounded in actual financial totals already present in the report for the selected period and branch filter.

### Budget vs Actual Expenses

Use `bva.categories` from `trpc.reports.budgetVsActual.useQuery(...)`.

Each category entry should provide:

- Category name
- Category color when available
- Budgeted amount
- Actual amount
- Variance metadata

Chart mapping:

- Slice label = category name
- Slice value = actual amount for share-of-spend visualization
- Tooltip should also expose budgeted amount and variance
- Center summary = total actual, with secondary variance vs total budget

### Empty And Zero States

- All-zero data: render a clean empty state rather than a misleading full circle
- Zero-size slices: omit from pie geometry but keep optional legend presence if needed for explanation
- Missing report data: preserve existing textual fallback style used elsewhere in the page

## Interaction Design

### Hover

Hover should reveal:

- Label
- Exact amount
- Percentage of total
- Contextual secondary value

Chart-specific tooltip details:

- `Inflow vs Outflow`: percentage of total movement and net result context
- `Budget vs Actual Expenses`: budget, actual, variance, and variance percentage

### Click

Clicking a segment should act as a local filter/highlight interaction.

- `Inflow vs Outflow`: select inflow or outflow and emphasize matching summary content inside the card
- `Budget vs Actual Expenses`: select a category and filter or highlight the corresponding rows in the budget category list below

Selection rules:

- Selected segment gains a stronger stroke or opacity treatment
- Non-selected segments dim slightly
- Clicking the active segment again clears selection
- A `Clear filter` control appears only when a filter is active

## State Ownership

Selection state should remain in `Reports.tsx` so the charts and the existing category rows can stay synchronized without prop drilling through unrelated parts of the page.

Likely local state:

- Selected inflow/outflow segment
- Selected budget category id

Derived row rendering:

- Matching category row gains emphasis
- Non-selected rows may dim slightly
- No changes to backend data flow are required for filtering behavior

## Accessibility

Each chart must remain understandable without relying on hover alone.

Requirements:

- Visible card title and short description
- Screen-reader summary describing totals and the dominant segment
- Keyboard-reachable slices and legend items
- `Enter` and `Space` activate selection
- Clear visible focus state
- Tooltip-only values must also appear in the legend or summary area
- Color cannot be the sole indicator of selected state

## Responsiveness

Mobile behavior:

- Stack cards vertically
- Place legend beneath chart when horizontal space is limited
- Keep center labels short to avoid overflow

Desktop behavior:

- Use a two-card grid
- Allow chart and legend to sit in a balanced side-by-side composition within each card when space permits

## Performance

The charts should remain lightweight because they render from already-fetched report totals.

Performance requirements:

- Memoize chart input transforms with `useMemo`
- Avoid recomputing derived percentages on unrelated rerenders
- Keep chart components presentational and pass normalized data arrays
- Verify layout remains stable with larger category lists

## Testing Strategy

Add focused coverage that proves the chart addition works with real report data patterns.

Required validation:

- Unit tests for chart data transformation helpers
- Component tests for:
  - Empty states
  - Zero-value handling
  - Hover tooltip content
  - Click-to-filter behavior
  - Keyboard activation and focus handling
- Responsive browser verification in the reports page
- Large-category rendering check for performance and layout stability

Required commands:

- `npm run check`
- `npm run lint`
- Targeted tests covering the new chart behavior

## Implementation Notes

- Reuse the installed `Recharts` stack and the existing `src/components/ui/chart.tsx` wrapper
- Keep the new work scoped to the reports module and shared report chart components only
- Do not replace the existing budget progress rows; augment them with the chart row
- Follow the existing report styling conventions in `Reports.tsx`

## Open Decisions Resolved

- Reference image: corrected to `resources/cashflow dash.png`
- Reference interpretation: mixed-chart dashboard, not donut-only
- Click behavior: filter/highlight matching data in the current section
- Scope: add two new pie-chart-based visuals without reworking unrelated report areas
