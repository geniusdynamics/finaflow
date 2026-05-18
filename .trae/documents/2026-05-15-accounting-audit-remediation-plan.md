# Accounting Audit And Remediation Plan

## Summary
- Audit and remediate the accounting implementation so non-accountants can complete day-to-day accounting safely, while power users can still use a formal Chart of Accounts (COA) without breaking simpler workflows.
- Deliver a dual-mode accounting model:
  - Operational mode for simple users: categories, cash, bank, and payment workflows stay simple and auto-manage their backing GL accounts.
  - COA mode for power users: users can explicitly link operational objects to existing chart accounts and manage advanced classifications.
- Use a phased core-first execution order, but keep the plan decision-complete so the implementation can proceed without new design decisions.
- Standardize business logic around an IFRS-for-SMEs style baseline: clear asset/liability/equity/revenue/expense boundaries, immutable posted transactions, and explicit reversals instead of destructive deletes.

## Current State Analysis

### What Exists Today
- `api/accounts-router.ts` manages operational cash, M-Pesa, and bank accounts, but it also accepts arbitrary COA metadata (`accountType`, `accountSubType`, `isContra`) during account creation and update.
- `api/chart-of-accounts-router.ts` manages the chart on the same `accounts` table, grouped by `businessId` and `accountType`.
- `api/expenses-router.ts` requires each expense category to reference an existing expense account via `defaultAccountId`, making non-COA operation incomplete.
- `api/bills-router.ts`, `api/expenses-router.ts`, and `api/daily-sales-router.ts` post directly to `ledgerEntries` and `accounts.currentBalance` instead of consistently going through the journal engine in `api/lib/journal.ts`.
- `src/pages/Accounts.tsx` is the general accounts UI and currently exposes COA-only choices such as `accounts_payable`, causing structural leakage into the simple workflow.
- `src/pages/Expenses.tsx` already has category, supplier, bill, and funding source inputs, but category defaults and dual-mode account creation are not implemented.
- `src/pages/Bills.tsx` already supports bill creation, line items, and bill payment, but category/accounting wiring is incomplete.

### Confirmed Defects And Architectural Gaps
- Scope mismatch in `accounts`:
  - `db/schema.ts` currently requires `accounts.locationId`, while `api/chart-of-accounts-router.ts` treats `locationId` as optional for business-level GL accounts.
  - `api/accounts-router.ts` creates operational accounts without setting `businessId`, while the COA router and COA UI query by `businessId`.
- COA and operational account leakage:
  - `src/pages/Accounts.tsx` exposes liability, equity, revenue, and expense subtype options in the operational Accounts dialog, including `accounts_payable`, which should never be created from the simple operational accounts module.
- Expense category non-COA failure mode:
  - `api/expenses-router.ts` requires `defaultAccountId` and validates it against an existing expense account. This blocks category creation for businesses that have not intentionally set up a COA.
- Duplicated posting logic and mapping drift:
  - `api/expenses-router.ts`, `api/bills-router.ts`, and `api/lib/expense-journal.ts` each contain overlapping account classification and posting rules.
  - `api/bills-router.ts` maps `other` to `other_expense`, but `db/schema.ts` does not define `other_expense` in `accountSubTypeEnum`.
- Hard bugs in current flows:
  - `api/journal-router.ts` calls `createJournalEntry({ businessId: business.id, ... })`, but `business` is undefined.
  - `api/bills-router.ts` falls back to `categoryId = bill.categoryId ?? 1` when creating the synthetic expense row for a bill payment, which is unsafe and tenant-fragile.
  - `src/pages/Bills.tsx` references `form.billNumber` in the Add Bill form submission UI state even though the local form state does not define `billNumber`.
  - Existing bill creation UI does not expose bill category selection even though backend support exists.
- Invalid lifecycle handling for posted transactions:
  - `api/expenses-router.ts` and `api/bills-router.ts` soft-delete records without reversing the accounting impact.
  - This violates the desired “reverse, don’t delete” policy and makes reconciliation unreliable.
- Accounting correctness gaps:
  - `api/daily-sales-router.ts` risks crediting revenue incorrectly when multiple payment lines are processed.
  - M-Pesa subtype conventions are inconsistent between migrations, seeds, and runtime logic.
- Auditability gaps:
  - `api/accounts-router.ts`, `api/chart-of-accounts-router.ts`, and `api/payment-methods-router.ts` do not consistently audit create/update/delete/link actions that materially affect accounting behavior.

## Assumptions And Decisions
- Execution scope: phased core-first.
- Posted transaction policy: reverse posted entries instead of deleting them.
- Dual-mode category/account strategy:
  - Power users can link to an existing COA account.
  - Non-COA users can select an allowed subtype/classification and the system will auto-create or reuse a backing GL account.
- System-generated backing accounts should be managed in the background for simple workflows, but still remain visible inside the advanced COA module if a power user later opens it.
- Use the smallest reasonable set of schema and router changes needed to fix the model; do not replace the accounting subsystem from scratch.
- Acceptance baseline: IFRS-for-SMEs style account boundaries, explicit AP/prepayment treatment, valid debit/credit polarity, and immutable posted history.

## Proposed Changes

### Phase 1: Normalize The Accounting Model And Dual-Mode Metadata

#### 1. Update the shared schema and migration layer
Files:
- `db/schema.ts`
- `db/migrations/0011_accounting_dual_mode_and_reversal.sql` (new)
- `db/seed-accounting.ts`
- `db/migrations/0010_coa_foundational_accounts.sql`

Changes:
- Make `accounts.locationId` nullable so business-level chart accounts can exist without being falsely tied to a branch.
- Add `isSystemGenerated boolean default false not null` to `accounts` so the app can distinguish system-managed backing accounts from user-authored accounts.
- Add `systemKey varchar(...)` to `accounts` with a business-scoped unique index for idempotent auto-created accounts.
  - Example keys to use during implementation: `asset:cash`, `asset:bank`, `asset:mpesa`, `expense:operating_expense`, `expense:admin_expense`, `expense:cogs`, `expense:marketing_expense`, `expense:depreciation_expense`, `liability:accounts_payable`, `asset:supplier_prepayments`.
- Backfill existing foundational accounts with stable `systemKey` values where the account purpose is already known.
- Normalize M-Pesa treatment so the backing GL subtype is consistently asset/cash across migrations, seeds, and posting helpers.

Why:
- The current single-table design is workable, but only if it clearly distinguishes branch-operational accounts from business-level GL accounts and supports idempotent system-generated accounts.

How:
- Keep `accounts` as the shared table, but enforce the following rule in code:
  - Operational accounts: require `locationId`, require `businessId`, and allow only operational GL linkage.
  - Pure COA accounts: require `businessId`, allow nullable `locationId`.

#### 2. Add shared accounting mapping and account ensuring helpers
Files:
- `api/lib/accounting-maps.ts` (new)
- `api/lib/accounting-accounts.ts` (new)
- `api/lib/accounting-validation.ts` (new)

Changes:
- Centralize these mappings in one place:
  - `AccountingClass -> AccountSubType`
  - `PaymentMethod -> operational account type + backing asset subtype`
  - `Operational account type -> allowed GL subtype`
  - `Allowed operational link targets` for the general Accounts page
- Add a helper that ensures a system-generated account exists for a business and returns its id:
  - `ensureSystemAccount({ businessId, systemKey, accountType, accountSubType, name, accountCodeHint? })`
- Add validation helpers for:
  - valid same-business linking
  - allowed operational link targets in simple flows
  - preventing invalid subtype/type combinations
  - requiring `businessId` for every account used in accounting flows

Why:
- Current mappings are duplicated and already drifting. A single source of truth is required before router fixes can be made safely.

### Phase 2: Repair Account Creation, COA Linking, And General Accounts UX

#### 3. Harden operational account creation and update flows
Files:
- `api/accounts-router.ts`
- `api/payment-methods-router.ts`
- `src/pages/Accounts.tsx`

Changes:
- `api/accounts-router.ts`
  - Derive and persist `businessId` from the selected `locationId` when creating operational accounts.
  - Enforce that operational accounts can only link to asset-side COA targets relevant to their type:
    - cash -> asset/cash
    - mpesa -> asset/cash
    - bank_account -> asset/bank
  - If the user does not explicitly link to an existing COA account, auto-create or reuse the correct backing asset account using `ensureSystemAccount`.
  - Add audit logging for create/update/delete and for COA-link changes.
- `api/payment-methods-router.ts`
  - Restrict branch payment-method linking to active operational accounts for the same location.
  - Audit assign/update/remove actions.
- `src/pages/Accounts.tsx`
  - Split the Add/Edit Account dialog into two explicit modes:
    - `Use existing COA asset account`
    - `Let the system manage the backing account`
  - Remove all non-operational subtype options from this page.
  - Remove AP, revenue, equity, and expense choices from the general Accounts page.
  - Keep the page focused on operational money containers and payment rails only.
  - Show short helper text that the advanced COA module is optional and only needed for manual accounting customization.

Why:
- This directly satisfies the requirement that bank/cash additions must work for both COA and non-COA users while eliminating structural inconsistencies in the general accounts module.

### Phase 3: Implement Dual-Mode Expense Category Management And Better Defaults

#### 4. Make expense category creation work with or without a formal COA
Files:
- `api/expenses-router.ts`
- `src/pages/Expenses.tsx`
- `src/pages/Mpesa.tsx`
- `src/pages/Bills.tsx`

Changes:
- Extend category create/update input so the UI can submit either:
  - `defaultAccountId` for explicit COA linkage, or
  - `defaultAccountSubType` / accounting-class-driven system creation for non-COA mode.
- On category create/update:
  - If `defaultAccountId` is provided, validate it belongs to the same business and is an expense account.
  - If not provided, resolve the required subtype from the selected classification and ensure the backing expense account exists automatically.
  - Store the resulting account id in `expenseCategories.defaultAccountId` either way so downstream posting stays deterministic.
- Update the Categories UI in `src/pages/Expenses.tsx`:
  - Add a mode switch:
    - `Link existing chart account`
    - `Let system create/manage chart account`
  - Keep the form simple for non-COA users by default.
  - Only show filtered COA expense accounts when the user explicitly chooses the advanced mode.
- Improve transaction category defaults while preserving manual override:
  - Expense form should auto-populate category from `bill.categoryId` when present.
  - When supplier context exists and the bill does not set the category, use `suppliers.autoCategoryId` if available.
  - In bill line-item flows, continue using remembered item categories (`lastCategoryId`) as the initial suggestion.
  - In M-Pesa expense capture, preserve the selected category as the default for the current capture flow while still allowing manual selection.

Why:
- This is the core usability requirement: categories must remain simple for non-accountants but still post correctly to the ledger.

### Phase 4: Fix Bills, Payables, And Transaction Lifecycle Rules

#### 5. Repair bill creation and bill payment accounting flows
Files:
- `api/bills-router.ts`
- `src/pages/Bills.tsx`
- `api/lib/accounting-maps.ts`
- `api/lib/accounting-accounts.ts`

Changes:
- `src/pages/Bills.tsx`
  - Add missing form state for `billNumber` so the existing UI references are valid.
  - Add category selection to the Add Bill form and recurring bill form so payables can be classified at creation time.
  - Keep category editable/overridable before posting.
- `api/bills-router.ts`
  - Use the shared mapping helper instead of local subtype maps.
  - Remove the invalid `other_expense` fallback and replace it with a valid subtype resolution path.
  - Require category resolution for bill posting:
    - explicit bill category
    - supplier default category
    - line-item-derived category
    - otherwise reject with a clear validation error instead of silently using `1`
  - Use ensured AP and supplier prepayment accounts with stable `systemKey` values.
- Keep bill payment expense records and AP postings coordinated through a single source of truth.

Why:
- Bills are already the most explicit payable flow. They should be the cleanest expression of standards-aligned AP behavior, not a source of silent category/account fallbacks.

#### 6. Replace delete-on-posted-record behavior with reverse flows
Files:
- `api/expenses-router.ts`
- `api/bills-router.ts`
- `api/journal-router.ts`
- `src/pages/Expenses.tsx`
- `src/pages/Bills.tsx`
- `src/pages/JournalEntries.tsx`

Changes:
- Stop allowing soft-delete of posted accounting events as if nothing happened.
- Add explicit reverse mutations for expense-originated and bill-originated postings.
- If a source record is not yet posted, allow draft deletion; if it is posted, require reversal.
- Update UI actions:
  - Replace generic `Delete` for posted rows with `Reverse`.
  - Show a clear status badge or message explaining that posted accounting records are immutable and corrections are made by reversal.
- Keep the source row for history, mark it reversed/cancelled as appropriate, and link the reversal journal entry back to the source transaction.

Why:
- This enforces the user-selected policy and removes the largest reconciliation failure mode in the current implementation.

### Phase 5: Route Core Postings Through The Journal Engine

#### 7. Make expenses, bills, bill payments, and daily sales journal-backed
Files:
- `api/lib/journal.ts`
- `api/lib/expense-journal.ts`
- `api/expenses-router.ts`
- `api/bills-router.ts`
- `api/daily-sales-router.ts`
- `db/schema.ts`

Changes:
- Keep `api/lib/journal.ts` as the posting engine and move domain posting logic to thin domain helpers that build journal lines from validated business rules.
- Refactor expense, bill, and bill-payment posting so they create/post journal entries and let the journal engine manage ledger entries and account balances.
- Use `expenses.journalEntryId` where available; for flows without direct foreign keys, rely on `sourceType` + `sourceId` lookups consistently.
- Fix `api/journal-router.ts` create bug by using `input.businessId`, then harden router scoping for post/unpost/reverse.
- Fix daily sales multi-payment posting so revenue is credited exactly once per sale total, while payment-side debits follow the actual payment splits.

Why:
- This removes duplicated debit/credit code, aligns reversals with the existing journal engine, and closes the correctness gap between modules.

### Phase 6: Secondary Audit Fixes That Should Ship With The Core Work

#### 8. Clean up remaining structural and UX inconsistencies discovered during audit
Files:
- `src/pages/ChartOfAccounts.tsx`
- `src/pages/Accounts.tsx`
- `api/chart-of-accounts-router.ts`
- `scripts/comprehensive-financial-audit.ts`
- `scripts/audit-double-entry.ts`

Changes:
- `src/pages/ChartOfAccounts.tsx`
  - Remove duplicate account code rendering in the table.
  - Keep advanced-only account controls here, not in the general accounts module.
- `src/pages/Accounts.tsx`
  - Harmonize subtype lists with actual schema values; include only valid, intentionally supported options.
- `api/chart-of-accounts-router.ts`
  - Enforce business-scoped validation on create/update/delete.
  - Add audit logging for chart mutations.
  - Align router assumptions with the nullable-location chart model.
- Audit scripts:
  - Extend existing scripts so they validate the new invariants:
    - no posted source row without a matching journal trail
    - no expense category with a cross-business default account
    - no operational account linked to non-asset chart targets
    - no invalid fallback subtype values

Why:
- These are not cosmetic extras; they are the cleanup items that keep the core remediation from regressing immediately.

## File-Level Implementation Notes
- `db/schema.ts`
  - Add system-account metadata and nullable location support for pure GL accounts.
- `api/accounts-router.ts`
  - Treat operational account creation as a business+location-scoped action with controlled GL linkage.
- `api/chart-of-accounts-router.ts`
  - Treat chart account creation as a business-scoped action and keep it distinct from operational account UX.
- `api/expenses-router.ts`
  - Be the main dual-mode expense-category entrypoint and enforce category/account compatibility.
- `api/bills-router.ts`
  - Remove silent fallbacks and align AP/prepayment logic with shared helpers.
- `api/journal-router.ts`
  - Fix the create bug and make it safe to use as the central reversal/posting controller.
- `src/pages/Accounts.tsx`
  - Operational cash/bank/M-Pesa management only.
- `src/pages/Expenses.tsx`
  - Dual-mode category management, better defaults, and reverse-not-delete behavior.
- `src/pages/Bills.tsx`
  - Category-aware payable creation and payment correction workflow.

## Verification Steps

### Automated Tests
- Add or update unit tests for:
  - shared accounting mappings
  - system-account ensuring/idempotency
  - operational account validation rules
- Add or update integration tests for:
  - account creation in both modes
  - expense category creation in both modes
  - expense creation with defaulted and overridden categories
  - bill creation and bill payment category/account resolution
  - journal creation/post/reverse behavior
  - daily sales multi-payment posting correctness
- Add or update end-to-end coverage for:
  - non-COA business creating categories/accounts and recording expenses successfully
  - power user linking categories/accounts to existing COA entries
  - bill creation, payment, and reversal workflow
  - sales posting into linked operational accounts without chart setup friction

### Manual/Scripted Checks
- Run the existing accounting audit scripts after the refactor and update them where they encode old assumptions.
- Verify that the general Accounts page never offers AP or other non-operational entries.
- Verify that a non-COA user can:
  - create an expense category
  - create a cash or bank account
  - record an expense
  - reconcile balances without ever opening the COA page
- Verify that a COA user can explicitly link the same workflows to existing chart accounts without duplicate or conflicting entries being created.
- Verify that posted records can be reversed but not silently deleted.

### Project Commands
- `npm run lint`
- `npm run check`
- `npm test`
- targeted e2e runs for the affected accounting flows if the test runner supports filtering in this repo

## Acceptance Criteria
- Non-accountants can complete daily expense, bill, payment, and cash/bank workflows without needing to understand the chart of accounts.
- Power users can still map categories and operational accounts to explicit chart accounts.
- General Accounts no longer exposes COA-only structures such as `accounts_payable`.
- Expense categories work in both explicit-link and system-managed modes.
- Cash and bank account creation works in both explicit-link and system-managed modes.
- Posted accounting records are corrected via reversal, not silent deletion.
- Core postings run through consistent journal-backed logic and preserve ledger integrity.
- The implementation passes lint, typecheck, unit/integration tests, and the affected e2e coverage.

## Explicitly Out Of Scope
- Broad visual redesign unrelated to accounting clarity.
- Replacing the entire single-table `accounts` model with a brand-new ledger schema.
- Changing unrelated modules that are not part of the accounting, payable, expense, payment, or reconciliation workflows.
