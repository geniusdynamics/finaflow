# Tasks

- [ ] Task 1: Redesign the budget persistence model and migrate existing data in place.
  - [ ] SubTask 1.1: Update `db/schema.ts` to introduce `budget_plans`, `budget_plan_buckets`, and `budget_bucket_lines` tables with `budget_period` and `budget_plan_status` enums.
  - [ ] SubTask 1.2: Add migration `0014_budget_plan_bucket_model.sql` that creates the new tables, supports `half-yearly`, and backfills legacy grouped `budgets` rows into plans, buckets, and lines with idempotent INSERT guards.
  - [ ] SubTask 1.3: Wire the migration into test bootstrap (`setup.ts`) and `_journal.json`.
  - [ ] SubTask 1.4: Add migration tests (`0014_budget_plan_model_migration.test.ts`) that validate idempotence and successful migration of existing budget records.
  - [ ] SubTask 1.5: Ensure the migration can repair an already-existing partial `budget_plans` table (ALTER TABLE ADD COLUMN IF NOT EXISTS for missing columns).

- [ ] Task 2: Replace the current budget helper logic with period-aware plan and bucket helpers.
  - [ ] SubTask 2.1: Create `src/lib/budgets/fiscal-year.ts` — expanded `Period` union to include `half-yearly`, shared plan/bucket rollup types.
  - [ ] SubTask 2.2: Create `src/lib/budgets/period.ts` — tracked bucket generation, analytical month generation, fiscal-year-aware labels, half-yearly support.
  - [ ] SubTask 2.3: Create `src/lib/budgets/rollups.ts` — switch rollup input from legacy grouped lines to explicit bucket inputs, add analytical month allocation with deterministic even-split (decimal.js, remainder cents to earliest months).
  - [ ] SubTask 2.4: Create `src/lib/budgets/validation.ts` — update `ALL_PERIODS` and `isPeriod` coverage for `half-yearly`.
  - [ ] SubTask 2.5: Write helper tests (`period.test.ts`, `rollups.test.ts`, `validation.test.ts`) covering monthly, quarterly, half-yearly, annual tracked vs analytical semantics.

- [ ] Task 3: Refactor the budgets router to use explicit plan and bucket identifiers.
  - [ ] SubTask 3.1: Create `api/budgets-router.ts` with plan-aware CRUD procedures (create, list, get, getLines, updateLines, copyMonthlyBucket).
  - [ ] SubTask 3.2: Implement `updateLines` that updates only the selected bucket's lines, preserving the plan status.
  - [ ] SubTask 3.3: Implement `copyMonthlyBucket` that copies source bucket lines into selected target month buckets with validation (reject no targets, reject source-in-targets) and transaction safety.
  - [ ] SubTask 3.4: Add plan-aware rollup/view building for list/detail responses.
  - [ ] SubTask 3.5: Update `api/reports-router.ts` budget reads/writes to the plan/bucket model.
  - [ ] SubTask 3.6: Write router tests covering isolated edits, monthly copy, `half-yearly`, annual analytical breakdown, and status preservation.

- [ ] Task 4: Restore and refine the budgets list and detail user experience.
  - [ ] SubTask 4.1: Create `src/pages/Budgets.tsx` — main budgets page with `listByYear` query, status filter buttons (All/Draft/Active/Locked/Archived), filters wired via statuses array query param.
  - [ ] SubTask 4.2: Create `src/components/budgets/BudgetList.tsx` — card/table view of budget plans with status badges, period labels, year navigation.
  - [ ] SubTask 4.3: Create `src/components/budgets/BudgetDetail.tsx` — detail view with explicit tracked-bucket selection, selected-bucket summary, edit dialog that targets a single bucket, monthly copy dialog with multi-select target months.
  - [ ] SubTask 4.4: Clarify annual budget detail so monthly breakdown is labeled as analytical (not bucket-editable).
  - [ ] SubTask 4.5: Write component tests for budgets list, detail, and copy workflow.

- [ ] Task 5: Refine budget creation and edit workflows to match the approved period semantics.
  - [ ] SubTask 5.1: Create `src/components/budgets/NewBudgetWizard.tsx` — wizard that creates monthly budgets as 12 editable month buckets, quarterly as 4 quarter buckets, half-yearly as 2 half-year buckets, annual as 1 tracked bucket.
  - [ ] SubTask 5.2: Ensure month edits only update the selected month and never recreate other months.
  - [ ] SubTask 5.3: Ensure saving edits does not implicitly activate a budget or otherwise alter its lifecycle state.
  - [ ] SubTask 5.4: Add user-facing validation and error handling for invalid copy targets, forbidden edits, and unsupported actions.
  - [ ] SubTask 5.5: Write wizard component tests.

- [ ] Task 6: Add Operation Reports Panel budget integration.
  - [ ] SubTask 6.1: Update `src/features/reports/OperationsReportsPanel.tsx` to scope budget queries only when the Budgeting tab is active.
  - [ ] SubTask 6.2: Write reports panel regression tests.

- [ ] Task 7: Verify the redesign through automated and end-to-end coverage.
  - [ ] SubTask 7.1: Run `npm run lint` and fix any new errors in changed files.
  - [ ] SubTask 7.2: Run `npm run check` and fix any type errors.
  - [ ] SubTask 7.3: Run `npm test` and verify all budget-related tests pass.
  - [ ] SubTask 7.4: Run end-to-end budget lifecycle test covering create monthly budget, copy to selected months, edit one month only, and verify unrelated months remain unchanged.

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1] and [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 3] and [Task 4]
- [Task 6] depends on [Task 3]
- [Task 7] depends on all previous tasks
