# Changelog

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
