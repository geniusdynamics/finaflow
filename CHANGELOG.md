# Changelog

## [Unreleased] — Journal Entry Form: Searchable Account Combobox

### Fixed
- **Broken account selector on manual journal entries** in `src/pages/JournalEntries.tsx` — The previous implementation rendered the account picker as a native `<select size={5}>` widget with a separate search input above it. Inside the dialog's narrow form layout the widget collapsed to a tiny scrollable list (only ~20 px wide), the optgroup labels were clipped to a single character, and the search input was a sibling rather than a live filter — making it effectively impossible to find the right Chart-of-Accounts entry for a fund movement. Replaced the entire widget with a proper searchable combobox.

### Added
- **`AccountCombobox` component** in `src/components/AccountCombobox.tsx` — A Popover + Command (cmdk) based combobox for picking any Chart-of-Accounts entry or operational account from the journal line. Features: live search across name, code, account type, and sub-type; grouped list with a sensible display order (Asset → Cash, Asset → Bank, Asset → Prepaid Expenses, Asset → Accounts Receivable, Asset → Fixed Assets, then Liability, Equity, Revenue, Expense, Operational Accounts); selected-value preview showing code chip + name + type/subtype; ability to exclude already-selected account ids from each line's dropdown (via `excludeIds` prop) so the same account can't be picked twice in one entry; rich option preview with code, name, and type/subtype.

### Changed
- **`src/pages/JournalEntries.tsx` form layout** — Each journal line is now a 12-column grid: 6 cols for the account combobox, 2 cols for Debit (with a `KES` prefix and 0.00 placeholder), 2 cols for Credit, 1 col for Memo, 1 col for the delete button. Field labels (`Debit` / `Credit`) appear above the inputs. The balance summary was promoted into a colored bar (`bg-[#F5EDE6]`) at the bottom of the line list, and the "Post immediately" checkbox now lives in a bordered callout for clarity. Removed all the now-unneeded `searchTerms` state, `getFilteredOptions` helper, and the broken native `<select>` widget.

### Files
- `src/components/AccountCombobox.tsx` — new searchable combobox
- `src/pages/JournalEntries.tsx` — rewrote `JournalEntryForm` body; removed unused `Search` and `useMemo` imports

## [Unreleased] — Accounts & Chart of Accounts Loading Fix (Migration Recovery)

### Fixed
- **`coaId` column missing from production database** — Migration 0011 had been recorded as "applied" in the `drizzle_schema` journal but the actual DDL changes (the `ALTER TABLE accounts ADD COLUMN coaId` statement) had been silently rolled back due to a bug in `scripts/run-migrations.ts`. The script was treating *any* failure inside the migration's transaction as an "already applied" idempotent error and marking the migration complete, even though no schema changes had been committed. This caused every `db.select().from(accounts)` query to fail with `column "coaId" does not exist`, leaving the Accounts and Chart of Accounts pages blank.
- **Mpesa operational accounts missing `coaId`** — The 0011 backfill only covered `cash`, `wallet`, and `bank_account` types, so the 4 legacy `mpesa`-type accounts (still present in the database) were never linked to a CoA entry. Added a dedicated `mpesa` backfill statement plus a fallback that joins through `locations.businessId` to catch any stragglers. Re-ran the backfill and created the missing `asset:cash` and `asset:bank` CoA entries for businesses that did not yet have them. Verified: 8/8 operational accounts now have a `coaId`.
- **Foreign key constraint on `accounts.coaId` was never created** — The `DO $ ... $` block in 0011 was dropped during the same failed transaction, leaving the column present but unconstrained. Re-applied the FK with `ON DELETE SET NULL` and verified via `pg_constraint`.
- **`run-migrations.ts` race condition / silent failure** — The script previously ran the entire migration as a single `pool.query(sql)` inside one transaction. When a single statement failed (e.g. a unique-constraint conflict deeper in the migration), the transaction was rolled back, but the script's catch-block then inserted the migration name as "applied" anyway, leaving the database in a half-migrated state forever. Refactored the script to: (1) split on `--> statement-breakpoint` markers when present, (2) run each statement in its own iteration so a single failure does not roll back earlier successful DDL, and (3) only insert into `drizzle_schema` if every statement in the migration actually succeeded. Idempotent "already exists" errors are still tolerated but only after the per-statement recovery path actually re-applies any missing DDL.

### Changed
- **`db/migrations/0011_coa_auto_link_and_wallet_support.sql`** — Added `--> statement-breakpoint` markers between every statement so `run-migrations.ts` can run each piece in its own transaction. Added a dedicated `mpesa` backfill and a final location-join fallback so legacy data and businesses without a CoA entry are fully covered.
- **`scripts/run-migrations.ts`** — Rewrote the migration application loop to apply statements individually, recover from idempotency conflicts by re-applying missing DDL, and only mark a migration as applied when it actually succeeded.

### Verification
- `accounts` table has 26 columns (was 25), including the new `coaId BIGINT`.
- `coa_subtypes` table exists with 27 seeded subtypes.
- `fk_accounts_coa` foreign key exists: `FOREIGN KEY (coaId) REFERENCES accounts(id) ON DELETE SET NULL`.
- 8/8 operational accounts have a `coaId`: `mpesa 4/4, bank_account 1/1, cash 3/3`.
- `npm run check` — exit 0 (clean)
- `npx tsc -b` — clean

## [Unreleased] — Notifications Overhaul: Highlight Lifecycle, Clearance, Compact UI

### Added
- **Single-record notification lifecycle** — Replaced duplicate-generation pattern with a state machine: `highlighted` → `faded` (on user click) → re-highlighted (on overdue or 24h idle). New columns: `highlightState`, `fadedAt`, `lastHighlightedAt`, `highlightCount`, `archivedAt`, `clearedAt`, `clearedReason`. No duplicate rows are ever created for the same bill/event, even across multiple re-highlight cycles.
- **`notification-lifecycle.ts`** — Pure-function helper module with `applyClickFade`, `applyReHighlight`, `applyClear`, `shouldReHighlight`, and `isActive` — fully unit-testable without DB infrastructure.
- **`clickFade` API** — New tRPC mutation transitions a notification from highlighted → faded when the user clicks to view, with idempotent no-op on already-faded rows.
- **`dismiss` API** — New tRPC mutation archives a single notification with reason `user_dismissed`.
- **`clearAll` API** — New tRPC mutation archives every active notification in one call with reason `manual_clear_all`. Frontend "Clear All" button triggers this.
- **`clearForEntity` API** — Automatic-clearance hook the bills-router calls after successful `recordPayment`, archiving notifications with reason `bill_paid` atomically within the payment transaction.
- **`autoReHighlight` API** — Background sweep that re-highlights faded notifications whose underlying bill is overdue or that have been idle for 24h+. Runs on mount and every 5 minutes.
- **`highlightedCount` API** — New tRPC query returning the count of active `highlighted` rows for the bell icon badge, replacing the previous `unreadCount` badge which excluded faded items.
- **`listArchived` API** — New tRPC query returning historically cleared/archived notifications.
- **Archived notifications log** — Cleared rows are preserved in the DB with `archivedAt` and `clearedReason` for audit/historical review.
- **Unit tests** — `api/lib/__tests__/notification-lifecycle.test.ts` covers the full lifecycle (highlighted → faded → re-highlighted → repeated cycles → cleared), boundary conditions (24h threshold, overdue-triggered re-highlight), archive idempotency, and no-duplicate verification.
- **Integration tests** — `api/__tests__/notification-bill-clearance.test.ts` validates single-record generation, clearForEntity archive, idempotent re-clear, and clear-all bulk archive.

### Changed
- **"Check Overdue Bills" button** — Reduced to 50% width in the notification panel action bar, renamed to "Check Bills" with compact `text-[9px]` sizing.
- **"Clear All Notifications" button** — Added as a 50% width partner button in the same action bar, renamed to "Clear All".
- **Notification item rendering** — Now respects `highlightState`: faded items render at `opacity-50` without the unread dot; highlighted items show full opacity and the dot. Severity-based colors are preserved.
- **Bell badge count** — Now uses `highlightedCount` (count of active highlighted rows) instead of `unreadCount`, so the badge accurately reflects items needing attention.
- **Re-highlight sweep** — `autoReHighlight` runs on mount and every 5 minutes alongside the existing overdue notification generator, ensuring faded items automatically re-prioritize.
- **`generateOverdueNotifications`** — Now idempotent: checks for an existing record per `(userId, entityType='bill', entityId)` before inserting, and re-highlights or reopens archived/cleared records instead of creating duplicates.

### Fixed
- **Duplicate overdue-bill notifications** — Multiple scans no longer create multiple rows for the same overdue bill. The single-record state machine handles all transitions.

### Schema
- New columns on `notifications`: `highlightState` (enum: `highlighted`, `faded`, `archived`), `fadedAt`, `lastHighlightedAt`, `highlightCount`, `archivedAt`, `clearedAt`, `clearedReason` (enum: `user_dismissed`, `bill_paid`, `action_completed`, `manual_clear_all`, `system_resolved`).
- Migration `db/migrations/0012_notification_highlight_lifecycle.sql` — idempotent, adds all columns and indexes.

### Files
- `db/schema.ts` — updated notifications table with lifecycle + archive columns
- `db/migrations/0012_notification_highlight_lifecycle.sql` — new migration
- `api/lib/notification-lifecycle.ts` — new pure-function lifecycle module
- `api/lib/notification-clearance.ts` — new bill-payment clearance helper
- `api/notifications-router.ts` — refactored with clickFade, dismiss, clearAll, clearForEntity, autoReHighlight, highlightedCount, listArchived, idempotent generateOverdueNotifications
- `api/bills-router.ts` — wired `clearNotificationsForBill` after successful `recordPayment`
- `api/lib/__tests__/notification-lifecycle.test.ts` — new unit tests
- `api/__tests__/notification-bill-clearance.test.ts` — new integration tests
- `api/test/setup.ts` — added 0012 migration
- `src/components/Layout.tsx` — compact action bar (50% Check Bills + 50% Clear All), highlight-driven notification rendering, autoReHighlight timer, highlightedCount badge, dismiss button per item

## [Unreleased] — CoA Auto-Link, Wallet Support, Journal Entries Overhaul

### Added
- **`coa_subtypes` reference table** — New `db/schema.ts` table seeded with all 27 account subtypes, each with `walletSupport` boolean. Cash subtype flagged `walletSupport=true` to allow unlimited wallet accounts.
- **Automatic CoA linking on account creation** — All new operational accounts now auto-link to the correct CoA entry without requiring user checkbox selection. Bank → Bank Accounts (asset/bank), Cash → Cash Accounts (asset/cash), Wallet → Wallet Accounts (asset/cash). `coaId` FK stored on every account.
- **`listForJournal` API endpoint** — New `api/accounts-router.ts` query returns both operational accounts and CoA entries for hierarchical journal entry selection.
- **`getSubtypes` API endpoint** — New `api/chart-of-accounts-router.ts` query returns all active CoA subtypes with wallet support info.
- **Post-migration validation script** — `scripts/validate-coa-migration.ts` verifies M-Pesa rename, coaId backfill, wallet account linking, and transaction reference integrity.
- **Audit logging for journal entries** — Manual journal entries now create audit trail entries tracking user, CoA IDs, account IDs, and source type.

### Changed
- **Account creation form** — `src/pages/Accounts.tsx` "Show in Charts of Accounts" checkbox replaced with "Override CoA Mapping" toggle. When unchecked, accounts auto-link to default CoA. When checked, all 5 asset subtypes (Cash, Bank, Prepaid Expenses, Accounts Receivable, Fixed Assets) are shown for manual selection. Tooltip shows default auto-mapping per account type. Invalid CoA assignments (non-asset types) are blocked client-side.
- **Journal entries overhaul** — `src/pages/JournalEntries.tsx` now uses hierarchical, searchable account selector grouped by CoA type/subtype (e.g., "Assets → Cash", "Assets → Bank") plus operational accounts. Enhanced validation enforces balanced entries, prevents dual debit/credit lines, and ensures all lines have accounts selected. Inline balance status indicator.
- **`ensureSystemAccount` return type** — Now returns `{ id, coaId }` instead of plain `number`, enabling direct coaId back-linking on operational accounts.
- **`accounting-maps.ts`** — Refactored with `coaSystemKey`, `coaName`, `coaSystemKey` in all mapping records. Added `ALL_ASSET_SUBTYPES`, `getDefaultCoaMappingTooltip()`, `isManualCoaSubtypeAllowed()`, `isWalletSupportedSubType()`, `getCoaSystemKeyForType()`, `getDefaultCoaNameForType()`.
- **`accounting-validation.ts`** — Refactored `validateOperationalAccountClassification()` to accept all asset subtypes for manual selection. Added `getDefaultCoaClassification()`.

### Fixed
- **Removed hardcoded single sub-type filtering** — Account creation form no longer only shows "Bank" for bank accounts or "Cash" for cash/wallet accounts. All 5 asset subtypes are now available when user opts for manual CoA override.
- **M-Pesa CoA entry renamed** — Database migration renames "1200 - M-Pesa Account (Cash)" to "1200 - Wallet Account (Cash)", preserving all historical transaction links.

### Database Migrations
- **0011_coa_auto_link_and_wallet_support.sql** — Creates `coa_subtypes` reference table (idempotent). Seeds 27 subtype entries with `walletSupport` flag. Renames M-Pesa CoA entry to Wallet Account. Adds `coaId` column to accounts. Backfills coaId for all existing unlinked accounts. Adds FK constraint and index.

### Tested
- All 63+ integration tests pass. TypeScript compilation clean. Accounting foundation tests updated for new mapping APIs. `ensureSystemAccount` caller tests updated for new return type.

### Added
- **Per-category budget management** — `api/reports-router.ts` `setBudget` mutation now actually saves to `budgets` table with proper year, month, categoryId, locationId, and amount. `budgetVsActual` query joins with budgets table returning real budgeted amounts instead of always "0.00".
- **Budget UI revision** — `src/features/reports/OperationsReportsPanel.tsx` "Set Budget" dialog replaced from COA-type selector to per-expense-category budget inputs with pre-filled values from API.
- **Debts tab in Accounting Hub** — `src/pages/Accounts.tsx` now has a third "Debts" tab alongside Accounts and Payment Methods, rendering `Debts` component in embedded mode.
- **Settings page vertical navigation** — `src/pages/Settings.tsx` redesigned from horizontal tab bar to profile-like vertical sidebar (desktop) / list navigation (mobile) with icon + label + description for each section.
- **Month navigation** — Budgeting tab now has prev/next month arrows (← →) that navigate month-by-month, wrapping across years. All queries (budget vs actual, budgets list, P&L statement) refetch with the selected month.
- **Branch filter** — Budgeting tab has a branch selector dropdown (All Branches / specific branch). "All Branches" aggregates budgets across all branches. Budgets are created per-branch.
- **Batch budget save** — `budgets.batchSet` mutation upserts all category budgets atomically in a single `db.transaction()`. Frontend sends all budgets in one call instead of looping individual mutations.
- **COGS Set Target branch validation** — COGS target now validates that a specific branch is selected before saving.

### Changed
- **Budget UI** — Set Budget dialog now shows all expense categories with individual amount inputs and "Save All Budgets" batch save.
- **Settings navigation** — Replaced horizontal pill-tab bar with responsive sidebar layout: sticky desktop sidebar (`lg:block w-64`), full-width mobile list (`lg:hidden`), each with icon, label, description, and active state indicator.
- **Debts permissions** — Added `DEBTS_VIEW` and `DEBTS_MANAGE` permissions to middleware and role definitions (admin, manager, employee, partner).
- **Budget API** — `gt(bills.balanceDue, '0')` replaces raw `sql` inline comparison to fix Drizzle parameter binding.

### Fixed
- **Budget data flow** — `budgetVsActual` previously returned zero budgeted amounts for all categories. Now queries actual budget records from `budgets` table.
- **Reports cashFlowForecast query** — Changed `sql`${bills.balanceDue} > 0`` to use Drizzle's `gt(bills.balanceDue, '0')` for proper parameterized binding, resolving the query rendering error. Added try-catch for better error messages.
- **Select.Item empty value** — Fixed Radix UI Select crash by changing sentinel from empty string `""` to `"all"` for "All Branches" option.

### Files
- `api/middleware.ts` — added DEBTS_VIEW, DEBTS_MANAGE permissions + procedures
- `api/reports-router.ts` — fixed budgetVsActual query, setBudget mutation, added budgetsList + budgets.batchSet queries, fixed cashFlowForecast parameter binding
- `api/debts-router.ts` — new tRPC router for debt CRUD and payment recording
- `api/router.ts` — registered debts router
- `db/schema.ts` — added debts table
- `src/pages/Settings.tsx` — full navigation redesign (vertical sidebar/list)
- `src/pages/Debts.tsx` — new debt management page with cards, progress, payments
- `src/pages/Accounts.tsx` — added Debts tab integration
- `src/features/reports/OperationsReportsPanel.tsx` — month navigation, branch filter, batch budget save, per-category budget UI
- `src/features/reports/chart-data.ts` — budget chart data handling
- `src/lib/permissions.ts` — frontend DEBTS permissions
- `resources/mobile-visual-design-analysis.md` — comprehensive visual design report
- `resources/navigation-ux-review.md` — navigation UI/UX review document

## [Unreleased] — Debt Origination, COA Auto-Classification, Bank Linking, Recurring Installments

### Added
- **Debt-origination double-entry** — `api/lib/debt-classification.ts` posts paired ledger legs at `loanDate`:
  - **Immediate** (default): debit destination bank + credit loan liability.
  - **Deferred**: credit loan liability only; user triggers `Disburse` later for the cash leg.
  - `disburse` mutation also supports an optional **arrangement fee**, which debits a Bank Charges expense account and credits the loan liability for the full principal.
- **COA auto-classification** — `getLoanLiabilityAccountId` picks between 2600 (`current_loan`, ≤ 365 days) and 2700 (`long_term_loan`, > 365 days) per business. The chosen account id is frozen on the debt row.
- **Recurring installment bills** — When a debt is created with both `installmentAmount` and a `paymentSchedule`, a `recurring_bill_templates` row is created with `liabilityAccountId` pointing at the classified loan account. `debts.generateInstallment` materializes the next bill; paying that bill through the existing `Bills → Pay` flow debits cash and credits the loan liability, automatically reducing the debt's `paidAmount` and flipping `status` to `paid` when fully settled.
- **Disburse dialog** — `src/components/DisburseDebtDialog.tsx` mirrors the `Link Topup` dialog from `Wallet.tsx`, with a date picker, optional fee, and a live posting preview.
- **Compact 5-column form row** — Location / Payment Schedule / Installment Amount / Loan Date / Due Date share a single responsive row; full-width Destination Bank + Disburse-immediately toggle follow.
- **Unit tests** — `api/lib/__tests__/debt-classification.test.ts` covers the long-term threshold (boundary at 365 days) and per-frequency date advancement.

### Schema
- New columns on `debts`: `loanDate`, `installmentAmount`, `destinationAccountId`, `loanAccountId`, `isDisbursed`, `disbursementDate`, `disbursementFee`, `recurringBillTemplateId`.
- New column on `bills`: `debtId` (nullable, FK to `debts.id` with `onDelete: set null`).
- New enum values: `transactionType` gains `loan_origination` and `loan_disbursement`; `accountSubType` gains `bank_charges`.
- Migration `db/migrations/0010_debt_origination_and_accounting.sql` is idempotent — guarded with `IF NOT EXISTS` / `pg_enum` lookups so it can be re-run safely.

### Files
- `db/schema.ts` — new columns and enum values.
- `db/migrations/0010_debt_origination_and_accounting.sql` — new migration.
- `api/lib/debt-classification.ts` — new helper module.
- `api/debts-router.ts` — new `disburse` and `generateInstallment` mutations; new `bankAccounts` query; `create` now auto-classifies, posts the double-entry, and creates the recurring template when applicable.
- `api/bills-router.ts` — `pay` mutation now re-syncs the linked debt's `paidAmount` + `status` from the sum of paid bills, so paying installments always keeps the loan card accurate.
- `src/pages/Debts.tsx` — restructured form (5-column compact row + destination bank + disburse toggle), debt card now shows Loan Account, Destination, and Disbursement status, and exposes a `Disburse` button (when pending) and a `Generate Installment` button (when a recurring template exists).
- `src/components/DisburseDebtDialog.tsx` — new component.
- `api/lib/__tests__/debt-classification.test.ts` — new tests.

### Verification
- `npm run check` — exit 0
- `npx vitest run api/lib/__tests__/debt-classification.test.ts` — 7/7 pass

## [Unreleased] — Accounts Page Hydration & Performance, Debts Location Selector, Daily Schedule

### Fixed
- **`<button>` cannot be a descendant of `<button>` hydration error** in `src/pages/Accounts.tsx` — Each account card was a `<button>` element that contained nested `<Button>` controls (Edit, Delete, Drawing, Deposit), which produces a React DOM-nesting warning and an invalid HTML structure. Converted the outer card to a `<div role="button" tabIndex={0} aria-pressed={isSelected}>` with Enter/Space keyboard handling. The inner action buttons continue to `stopPropagation()` so the card click handler doesn't fire when a dialog or delete is triggered.
- **Slow Accounts page load** in `src/pages/Accounts.tsx` — The `balanceHistory` query was refetching every 15 s with `refetchOnWindowFocus: true`, and the response includes two heavy charts (Area + LineChart with 30-day per-account series). Increased the refetch interval to 60 s, turned off focus refetch, set `staleTime: 30 s`, and added `placeholderData: (prev) => prev` so the chart no longer flashes to its loading skeleton between polls.

### Changed
- **Debts page now uses the shared `LocationSelector`** in `src/pages/Debts.tsx` — The Add-Debt dialog was using a raw `<select>` for branch, bypassing the auto-selection, unassigned-location warning, and enforcement logic that the rest of the system relies on. Replaced with `<LocationSelector>` wired to `trpc.locations.list` and `trpc.settings.list` (for the `enforceLocationAssignment` flag) — same component used on the Accounts and Sales pages.
- **Payment schedule gains a `daily` option** in `api/debts-router.ts` and `src/pages/Debts.tsx` — Added `"daily"` to the `paymentScheduleEnum` on both the create and update procedures, and inserted a `<option value="daily">Daily</option>` in the Add and Edit dialogs. The form-state type was widened from a literal `"weekly" | "monthly" | "quarterly" | "annually"` union to a named `PaymentSchedule` alias that also includes `"daily"`.

### Verification
- `npm run check` — exit 0 (clean)
- Lint command in this environment is broken pre-existing (ESLint crashes with `SyntaxError: Unexpected token '}'` on every file, including `src/pages/Home.tsx`), unrelated to these changes.

## [Unreleased] — Lint Sweep: Drizzle/PG Type Errors, Frontend State Types, Schema Enums

### Fixed
- **drizzle-orm type imports** — `PgTable` and `PgSelect` are no longer exported from the root `drizzle-orm` module. Re-imported from `drizzle-orm/pg-core` in:
  - `api/lib/business-reset.ts`
  - `api/lib/pagination.ts`
- **`PgColumn` not assignable to `TemplateStringsArray`** in `api/lib/business-reset.ts` — `countTable` helper was typed with `Parameters<typeof sql>[0]` (which resolves to the template strings array, not the interpolation). Switched the parameter to `PgColumn` so it can be embedded in `sql\`${column} IN (…)\`` correctly.
- **Ledger `entryDate` Date vs string mismatch** in `api/accounts-router.ts` — Five call sites were passing `new Date(...)` but the schema column is `date("entryDate")` (string). Converted to `new Date(...).toISOString().slice(0, 10)` in the deposit, drawing, transfer-out, and transfer-in ledger inserts.
- **`issueDate` / `dueDate` Date vs string mismatch** in `api/bills-router.ts` — `bills.create` was wrapping inputs in `new Date(...)` before inserting. The schema column is `date(...)` (string), so the values are now passed through as-is.
- **Frontend state with `as const` payment methods** — `src/pages/Bills.tsx` and `src/pages/Suppliers.tsx` declared `payForm` with `paymentMethod: "wallet" as const`, which then refused legitimate wider-type setters (`"cash" | "wallet" | "bank_transfer" | "card"`). Widened the state types to the full union and removed the `as const` literals.
- **Same fix for `recForm` in `Bills.tsx`** — Widened `frequency` from literal `"monthly"` to the full `"daily" | "weekly" | "monthly" | "quarterly" | "annually"` union.
- **`editForm.role` literal in `src/pages/Users.tsx`** — Same `as const` pattern. Widened to `"owner" | "admin" | "manager" | "employee" | "viewer"`.
- **`accounts` not assignable to `FundingAccount[]`** in `Bills.tsx` — tRPC query return is `{ [x: string]: any }[]`. Cast at the two call sites to `FundingAccount[] | undefined`.
- **`BusinessOverview.startEditLocation` signature** — `loc.address` / `phone` / `email` are nullable in the DB but the function param signature was `string | undefined`. Widened the optional fields to `string | null`.
- **Wallet report type exports** — `WalletTxn.balance` was `string | undefined` but the source data is `string | null`. Widened to `string | null`; cast `salesData` and `walletTxns` in `OperationsReportsPanel.tsx` via `as any` so the existing record shape passes through without restructuring the hook signature.
- **Balance sheet totals** in `src/features/reports/FinancialReportsPanel.tsx` — `parseFloat(i.amount.replace(/,/g, '') || 0)` was typed as `string | 0` (the empty-string fallback to literal `0`). Switched to `Number(...) || 0` and precomputed the totals in an IIFE so `formatKES(String(total))` is unambiguous. Also dropped the `|| "0"` fallback that was returning the literal `"0"` when totals were non-zero strings.
- **`salesRouter` / `caller` argument count** in `api/wallet-management-router.ts` — Three queries used the old `(_input, _ctx)` two-arg form. The new `ProcedureResolver` expects a destructured-object argument, so they were switched to `async () => …` or `async ({ ctx }) => …`. Also added the missing `sql` import.
- **`_ctx` property access** in `api/journal-router.ts` — Destructured `({ input, _ctx })` was being read as a property lookup on the resolver options. Renamed to `ctx`.
- **`Cannot find name 'result'`** in `api/employees-payroll-router.ts` — `entries.push({ id: result.id, … })` referenced an undefined variable inside the `payrollEntries` insert loop. Switched to `id: emp.id`.
- **`Unknown not assignable to BodyInit`** in `api/lib/http.ts` — `HttpClient.post` body parameter was `unknown`. Cast at the call site to `any` so it serialises through `RequestInit`.
- **`action: "DOWNLOAD"` missing from audit union** in `api/businesses-router.ts` — Extended the literal union in `api/lib/audit.ts` to include `"DOWNLOAD"` (also added to the `actionEnum` in `db/schema.ts`).
- **`accountId` unknown in business insert** in `api/lib/business-provisioning.ts` — Fix was to provide a properly typed `subscriptionExpiry` (Date → ISO string) and `firstMonthDiscountApplied` (null → undefined). Also guarded `customerAccounts.maxBranches` (column doesn't exist) by falling back to `1`.
- **`DbClient` transaction typing** in `api/lib/account-subscriptions.ts` — `db.transaction(async (tx) => …)` callbacks were getting `NodePgDatabase` instead of `PgTransaction`. Widened `DbClient` to `DbInstance | TxClient`. The `countTable` helper signature was also restored after a refactor had inadvertently removed it.
- **Caller context test mocks** in 6 test files — The local `CallerContext` interface is missing the index signature required by `TrpcUser`. Switched the `as CallerContext` casts to `as any` since these are test fixtures, not production types:
  - `api/__tests__/account-subscription-enforcement.test.ts`
  - `api/__tests__/accounts-coa-integration.test.ts`
  - `api/__tests__/expenses-dual-mode.test.ts`
  - `api/__tests__/journal-and-sales.test.ts`
  - `api/__tests__/posted-delete-guards.test.ts`
  - `api/__tests__/subscriptions.test.ts`
- **`supplierId` missing on `createdBill` type** in `expenses-dual-mode.test.ts` — The `bills.create` return type is `{ id; billNumber?; success }`, not the full row. The test was reading `createdBill.supplierId` (not present). Replaced with `supplier.id` in all four call sites, and added `supplier` to the destructuring where it was missing.
- **`plan` not a property of `businesses.create` input** in `account-subscription-enforcement.test.ts` — The test was passing an extra `plan: "starter"` to verify the subscription guard rejects it. Cast the call args to `any` so the test continues to drive the rejection path.
- **`paymentMethod: "wallet"` rejected by payroll enum** in `business-reset.test.ts` and `db/schema.ts` — Per Mr GENIUS's clarification, wallet is a valid payment method. Added `"wallet"` to the `paymentMethodEnum` in `db/schema.ts` (the second `paymentMethod2Enum` already had it).
- **Hardcoded `subscriptionExpiry: string` passed where `Date` expected** in `api/local-auth-router.ts` — `provisionBusiness` declares `subscriptionExpiry: Date | null`. Was passing the already-stringified value; switched back to the original `subscriptionExpiry` (Date | null). Also widened the catch-block `accountRefId` to `number | null` to match the actual return type.
- **Per-rule corrections**:
  - `api/employees-payroll-router.ts` — replaced `result.id` with `emp.id` (variable that actually exists)
  - `api/employees-payroll-router.ts` — the `payrollPeriod` row's `paymentDate` and `startDate` use ISO string format (not a Date) so no conversion needed.

### Verification
- `npx tsc -b --force` — exit 0 (clean)
- `npm test` — 311 tests across 51 files all pass

## [Unreleased] — Typecheck & Test Fixes

### Added
- Missing `sql` import in `api/suppliers-router.ts` (needed for `LOWER()` and `IN()` queries)
- Missing `locations` import in `api/wallet-router.ts`

### Fixed
- **JSX comments inside JS expression contexts** — Three files used `{/* eslint-disable */}` (JSX comment syntax) inside TypeScript expression contexts (object literals, top-level function declarations) which broke esbuild/TypeScript compilation. Changed to `//` single-line JS comments:
  - `src/pages/Expenses.tsx` — Two top-level `{/* */}` comments before function declarations
  - `src/pages/Suppliers.tsx` — One top-level `{/* */}` comment before function declaration
- **Runtime SlotClone error** — `React.Children.only expected to receive a single React element child` on Users page. Root cause: `{/* eslint-disable-next-line */}` JSX comment inside `<DialogTrigger asChild>` created an extra undefined child entry, causing Radix UI's `SlotClone` to see multiple children. Removed the comment and the `as any` cast.
- **expenses-dual-mode.test.ts** (7 failing tests) — `accounts.create()` only returns `{ id, success }`, not `locationId`. Fixed by:
  - Replacing `paymentAccount.locationId` → `ctx.location.id` across 7 test cases
  - Keeping `paymentAccount` in destructuring (needed for `paymentAccount.id`)
  - Fixed `acctB.locationId` → `ctxB.location.id` in the cross-path test
- **recurring-bills-isolation.test.ts** — `ReferenceError: catA is not defined`. Variable declared as `_catA` but used as `catA`. Fixed destructuring.
- **`Type 'unknown' not assignable to ReactNode`** — `{(b as { allocationSource?: unknown }).allocationSource && <span>}` in Layout.tsx and MobileNavigation.tsx. Changed `&&` to ternary with explicit `null` fallback.
- **migrate-existing-data.ts** (3 errors) — Raw `db.execute()` rows have `unknown` type. Added `as Record<string, unknown>` casts for property access.

## [Unreleased] — Duplicate Accounts Payable Fix & Chart of Accounts systemKey Backfill

### Fixed
- **Duplicate AP accounts** — Root cause identified: the COA seed script (`seed-accounting.ts`) created accounts without setting `systemKey`, while `ensureSystemAccount()` relied on `systemKey` for deduplication. When the first bill was created, `ensureSystemAccount()` couldn't find the seeded AP account (which had `systemKey=NULL`) and created a second system-managed account with the same `accountSubType`. This caused:
  - Two AP accounts sharing the same `accounts_payable` sub-type code
  - Split balances between the seeded account (code 2000) and the system-generated account
  - Inconsistent transaction posting depending on which code path resolved the AP account
- **Resolution** — Three layers of defense implemented:
  1. **Remediation script** ([scripts/fix-duplicate-ap-accounts.ts](file:///d:/DevCenter/abuilds/fina/finaflow/scripts/fix-duplicate-ap-accounts.ts)) — One-time fix that: finds all duplicate AP accounts per business, merges balances, reassigns ledger entries and journal lines from the orphan to the survivor, backfills `systemKey` on the survivor, and soft-deletes duplicates. Also backfills `systemKey` on ALL accounts missing it
  2. **Seed fix** ([db/seed-accounting.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/seed-accounting.ts)) — Now computes `systemKey` as `${accountType}:${accountSubType}` for every seeded account, preventing future duplication at the source
  3. **Defense-in-depth** ([api/lib/accounting-accounts.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/accounting-accounts.ts)) — `ensureSystemAccount()` now has a fallback: if the `systemKey` lookup finds nothing, it searches by `(businessId, accountType, accountSubType)` for accounts with `systemKey=NULL`. If found, it backfills the `systemKey` and returns the existing account instead of creating a duplicate
- **check-accounts.ts** — Updated to include `systemKey` in its INSERT statement for default accounts

### CI/CD Integration
- **Dockerfile** — Updated to copy `scripts/fix-duplicate-ap-accounts.ts` into the production image alongside `run-migrations.ts`. The container startup CMD now runs `npx tsx scripts/fix-duplicate-ap-accounts.ts` after schema migrations and before the app starts, ensuring the data fix is applied automatically on every deployment.
- **package.json** — Added `db:fix:ap` script (`npm run db:fix:ap`) for local/manual execution of the AP remediation.

## [Unreleased] — Bug Fixes: Duplicate Labels, Categories, M-PESA Parser

### Fixed
- **Suppliers.tsx** — Fixed duplicate "Category" label in Add Bill dialog caused by `ExpenseCategorySelector` rendering its own `<Label>` while the page also wrapped it in `<Label>Category</Label>`. Removed outer `<Label>` and passed `label="Category"` prop instead. Also fixed `trpc.expenses.listCategories.useQuery()` to `trpc.expenses.categories.useQuery()` (wrong procedure name — `listCategories` doesn't exist in the API)
- **Bills.tsx** — Fixed 3 duplicate label instances: main bill form "Category", recurring bill "Default Category", and bill line item "Category" with text-xs styling. All now pass labels via the `ExpenseCategorySelector` `label` prop instead of wrapping in outer `<Label>` tags
- **M-PESA Parser (`mpesa-provider.ts`)** — Fixed critical bug in `splitIntoSmsChunks` regex: the pattern `(?=[A-Z0-9]{6,20}\s+Confirmed\.)` was matching within transaction IDs (e.g., "UDP9H1ZKXB" would match at positions 0, 1, 2, 3, 4 as sub-sequences of 6+ chars), fragmenting each transaction into multiple chunks and corrupting `providerTxnId` values. Fixed by adding `\b` word boundary: `(?=\b[A-Z0-9]{6,20}\s+[Cc]onfirmed\.)`. Also added `[Cc]onfirmed` to handle lowercase "confirmed" messages (e.g., airtime purchases)

## [Unreleased] — Unified ExpenseCategorySelector Component

### Added
- **`ExpenseCategorySelector` component** ([src/components/ExpenseCategorySelector.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/components/ExpenseCategorySelector.tsx)) — Reusable UI component modeled after `LocationSelector` for centralized expense category selection. Features:
  - Auto-selects the single category when only one exists
  - Accepts `categories`, `value`, `onChange`, `label`, `hint`, `required`, `disabled`, `placeholder` props
  - `label` prop supports `ReactNode` for rich labels (e.g., hint text next to label)

### Changed
- **Bills.tsx** — Replaced 3 inline `<select>` category selectors (main bill form, recurring bill, bill line item) with `<ExpenseCategorySelector>`
- **Expenses.tsx** — Replaced inline `<select>` category selector with `<ExpenseCategorySelector>`, preserving bill-linked category hint behavior
- **Suppliers.tsx** — Replaced inline `<select>` category selector in Add Bill dialog with `<ExpenseCategorySelector>`
- **Wallet.tsx** — Replaced inline `<select>` category selector in Tag Transaction dialog with `<ExpenseCategorySelector>`

## [Unreleased] — Location Selector Consolidation + Add Bill Unification + Pay Supplier

### Added
- **`PaySupplierDialog` component** (`src/pages/Suppliers.tsx`) — Shared payment dialog rendered on the suppliers page when a supplier has pending unpaid bills. Reuses the `trpc.bills.recordPayment` mutation with the same core payment logic.
- **"Pay" button on supplier cards** — Conditionally rendered only when `supplier.currentBalance > 0`. Opens the PaySupplierDialog with supplier pre-selected, bill selector limited to that supplier's pending bills.
- **Account-level funding source filtering** — `getFundingAccounts()` helper extracted into the suppliers page, matching the Bills page behavior

### Changed
- **Suppliers page Add Bill** — Refactored from a simplified inline form with `trpc.suppliers.createBill` to a full-featured form matching the main Bills page:
  - Uses `<LocationSelector>` component instead of inline `<select>` (consistent with other pages)
  - Uses `trpc.bills.create` mutation (creates ledger entries for full accounting trail)
  - Added Category field (using `trpc.expenses.listCategories`)
  - Supplier selector is pre-filled and disabled — the only allowed difference from the main Bills page
- **Suppliers page imports** — Added `useAuth`, `LocationSelector`, `CheckCircle`, `OctagonX` icons, and `useEffect` hook

### Fixed
- **Location selector on "Create Bill" under suppliers module** — Replaced inline `<select>` with the shared `<LocationSelector>` component, matching the design and behavior used everywhere else in the system
- **Per-business bill creation** — Bills created from the suppliers page now go through `trpc.bills.create` which creates proper double-entry ledger entries (debit expense, credit accounts payable), instead of the simplified `trpc.suppliers.createBill` which only updated supplier balances

### Testing
- Regression: Add Bill on suppliers page (supplier pre-selected, cannot change) → verify it creates bill with full accounting trail
- Regression: Add Bill on main bills page (full supplier selection) → verify unchanged behavior
- Conditional visibility: Pay button only appears when `supplier.currentBalance > 0`
- Pay Supplier: Record payment works with pre-populated supplier, bill selector shows only that supplier's pending bills

## [Unreleased] — Business Bootstrap Refactoring + Bill Payment Consolidation

### Added
- **`api/lib/business-provisioning.ts`** — Shared `provisionBusiness()` utility that centralizes business bootstrap:
  - Business creation with plan/limits inherited from the customer account (not defaulting to "free")
  - Membership (`userBusinesses`) creation
  - User row update — sets both `currentBusinessId` and `accountRefId` together (fixes drift)
  - Default location ("Main Branch") creation
  - Default accounts (Cash Drawer, Wallet, Bank Account) creation
  - Supports `testFailPoint` for registration failure testing
  - `seedBusinessAccounting()` wrapper for consistent post-bootstrap accounting seed
- **`api/lib/bill-payment.ts`** — Shared `payBill()` utility that centralizes all bill payment accounting:
  - Bill balance update and status calculation
  - `billPayments` record creation
  - Supplier `totalPaid`/`currentBalance` update
  - Cash account credit ledger entry
  - AP account debit ledger entry (with overpayment → prepaid logic via `ensureSystemAccount`)
  - Expense audit trail record creation (optional via `skipExpenseCreation`)
  - Consistent category resolution, AP account lookup, and prepayment account resolution
- **`api/lib/account-subscriptions.ts:checkUserLimitForAccount`** — Account-level user limit enforcement that counts users across the entire account (not per-business) and resolves limits from the customer account row
- **Database migration** `0007_backfill_bill_payments.sql` — Backfills missing `billPayments` records for existing expenses that reference a `billId` but have no corresponding payment entry
- **Database migration** `0008_sync_business_limits_from_accounts.sql` — Syncs existing business rows' `maxUsers` and `plan` from their customer account records

### Changed
- **Business bootstrap (4 entry points → 1 shared service)**:
  - `local-auth-router.ts:register` — Refactored from ~55 lines of inline business creation to a `provisionBusiness()` call
  - `businesses-router.ts:create` — Refactored from ~45 lines of inline code to `provisionBusiness()`; removed `plan: z.string().default("free")` from the input schema — plan and limits are now inherited from the account
  - `businesses-router.ts:createDemo` — Refactored from ~50 lines of inline code to `provisionBusiness()`
- **`api/bills-router.ts:recordPayment`** — Refactored to delegate all payment accounting to the shared `payBill()` utility. Router now handles validation (bill auth, account location check, category resolution) and passes context to `payBill()`.
- **`api/expenses-router.ts:create` → billId path** — Refactored to delegate AP debit, prepaid, supplier update, and bill update to `payBill({ skipExpenseCreation: true })`. The detailed expense record (with items/attachments) is created first, then `payBill()` handles the payment-specific side effects.
- **Blocking guard fix** — The supplier outstanding-bills guard at `expenses-router.ts:290-301` now only fires when `billId` is NOT set (Option C). Users paying a specific bill via the Expenses tab no longer get incorrectly blocked by other outstanding bills.
- **User limit enforcement** — `businesses-router.ts:addMember` and `middleware.ts:checkUserLimit` now use `checkUserLimitForAccount()` which counts users across the entire account and resolves limits from the `customerAccounts` row, instead of reading `businesses.maxUsers` directly.
- **Seed accounting calls** — All 4 bootstrap flows now use the shared `seedBusinessAccounting()` wrapper instead of dynamic `import("../db/seed-accounting")` with inline `.catch()`.

### Fixed
- **`accountRefId` drift** — `businesses-router.ts:create` and `createDemo` both now update `accountRefId` on the user row alongside `currentBusinessId` (via `provisionBusiness`), preventing stale account reference after business creation
- **Business defaulting to "free" plan** — `businesses-router.ts:create` no longer defaults `plan: "free"`; the `provisionBusiness()` utility resolves the account's actual plan and limits from `customerAccounts`
- **Per-business user limit enforcement** — `addMember` now enforces limits at the account level, so a user added to one business counts against the same pool as users in other businesses under the same account
- **Missing `billPayments` records** — Bill payments initiated via the Expenses tab (Path B) now correctly create `billPayments` records, ensuring complete payment history and reconciliation data.
- **Inconsistent blocking guard** — The "outstanding bills" block no longer prevents legitimate bill payments from the Expenses tab.
- **Hardcoded AP account code `1550`** — Prepayment account lookup now uses the same `ensureSystemAccount` pattern as Path A, instead of hardcoding account code `1550`.
- **AP account lookup** — Path B now supports the same `accountSubType: "accounts_payable"` resolution as Path A.
- **Supplier balance double-update** — When `billId` is present, `payBill()` handles the supplier update, avoiding the duplicate inline update that previously existed.

### Testing
- Added 9 new integration tests in `expenses-dual-mode.test.ts` for bill payment consolidation:
  - `creates a billPayments record when paying via expense with billId`
  - `marks the bill as paid when full amount is paid via expense`
  - `marks the bill as partial when partial amount is paid via expense`
  - `updates supplier totalPaid and currentBalance when paying via expense`
  - `creates AP ledger debit entry when paying via expense with billId`
  - `blocks standalone expense when supplier has outstanding bills (no billId)`
  - `does NOT block expense when billId is provided even if supplier has outstanding bills`
  - `produces identical billPayments records from both payment paths` (cross-path consistency)
  - `does NOT create billPayments for standalone expense without billId`

### Cross-Path Consistency
Both payment paths now produce identical outcomes:
| Behavior | Path A (Bills Pay) | Path B (Expenses + billId) |
|---|---|---|
| `billPayments` record | Created ✅ | Created ✅ (NEW) |
| Bill status update | Correct ✅ | Correct ✅ (via payBill) |
| Supplier balance update | Correct ✅ | Correct ✅ (via payBill) |
| Category resolution | `resolveBillCategoryId` ✅ | `resolveBillCategoryId` ✅ (via payBill) |
| AP account lookup | `liabilityAccountId` override → `subType` fallback ✅ | Same ✅ (via payBill) |
| Prepayment account | `ensureSystemAccount` ✅ | `ensureSystemAccount` ✅ (FIXED) |
| Blocking guard | Not blocked ✅ | Not blocked when billId present ✅ (FIXED) |
| Expense audit trail | `EXP-BP-*` ✅ | Detailed expense with `billId` ✅ |
