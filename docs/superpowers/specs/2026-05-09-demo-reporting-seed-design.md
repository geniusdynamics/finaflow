# Demo Reporting Seed Design

## Overview

Patch `db/seed-demo.cjs` so the DEMO business gets realistic reporting data, not just users, accounts, and categories. The seeded demo must populate the reports page, pie charts, monthly trends, export panels, and cash flow forecast without weakening existing business scoping rules.

## Goals

- Seed the DEMO business with usable reporting data for the last 3 months
- Seed budgets for the same 3-month window so Budget vs Actual is non-empty
- Seed realistic M-PESA activity patterned after the existing local database
- Seed a few future unpaid bills for the next few months so the forecast panel has meaningful upcoming outflows
- Keep the script idempotent so re-running it refreshes DEMO transactional data cleanly

## Non-Goals

- Change report query logic
- Relax tenant/business scoping
- Copy transactional rows from another business at runtime
- Build a generic seed framework for every script in the repo

## Seed Window

- Rolling window anchored to `today`
- Last 3 calendar months:
  - sales
  - expenses
  - M-PESA transactions
  - budgets
- Next 2 to 3 calendar months:
  - unpaid bills and recurring-looking supplier obligations for forecast visibility

## Data Shape

### Daily Sales

- Create multiple sales days across the last 3 months
- Bias volume toward the most recent month so current-period reports feel active
- Use a believable payment mix:
  - cash
  - M-PESA
  - card
  - bank transfer where applicable
- Write both parent `daily_sales` rows and child `daily_sale_payments` rows

### Expenses

- Seed several expense categories with repeated usage across months
- Ensure categories overlap with budget rows so Budget vs Actual has meaningful comparisons
- Mix cash and M-PESA expenses
- Include a few larger recurring-style expenses such as rent and utilities

### M-PESA Transactions

- Simulate patterns observed in the current database:
  - `transfer`
  - `topup`
  - `expense`
  - `airtime`
  - `bank_transfer`
- Use varied amounts, fees, and party names
- Keep transaction references unique and deterministic enough to avoid collisions
- Include some negative and some positive movement so the list and exports look realistic

### Budgets

- Seed monthly category budgets for the same categories used by expenses
- Create budget values that are close enough to actuals to be believable, with a mix of under-budget and over-budget outcomes

### Future Bills

- Seed several pending bills due across the next few months
- Use realistic amounts and balance-due values
- Tie them to suppliers so the forecast and payable views feel connected

## Idempotency

Before inserting fresh DEMO reporting data, remove existing DEMO transactional rows only for DEMO locations:

- `daily_sale_payments`
- `daily_sales`
- `expenses`
- `mpesa_transactions`
- `budgets`
- `bills`

Do not delete DEMO business, users, categories, locations, payment methods, or accounts.

## File Structure

- `db/seed-demo.cjs`
  - remains the execution entry point
  - calls a pure planning helper to build deterministic seed rows
- `db/seed-demo-plan.cjs`
  - pure seed data generator
  - date math, transaction templates, category allocation, and row assembly
- `api/__tests__/seed-demo-plan.test.ts`
  - regression tests for the seed planner behavior

## Testing Strategy

- Add a failing test first for the pure planner
- Verify:
  - planner covers 3 historical months
  - planner emits budgets, sales, expenses, M-PESA, and future bills
  - planner produces both positive and negative M-PESA amounts
  - planner stays deterministic for a fixed anchor date
- After implementation:
  - run the focused test
  - run `node db/seed-demo.cjs`
  - verify the reports page and export counts populate for the DEMO business

## Implementation Notes

- Keep generated values deterministic from a fixed anchor date inside tests
- Prefer simple static templates plus date offsets over pseudo-random generation
- Match the rough tone of existing local data without copying live business records
- Preserve the existing seed-demo login and business bootstrap behavior
