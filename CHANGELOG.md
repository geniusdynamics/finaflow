# Changelog

## [Unreleased] — Bill Payment Workflow Consolidation

### Added
- **`api/lib/bill-payment.ts`** — Shared `payBill()` utility that centralizes all bill payment accounting:
  - Bill balance update and status calculation
  - `billPayments` record creation
  - Supplier `totalPaid`/`currentBalance` update
  - Cash account credit ledger entry
  - AP account debit ledger entry (with overpayment → prepaid logic via `ensureSystemAccount`)
  - Expense audit trail record creation (optional via `skipExpenseCreation`)
  - Consistent category resolution, AP account lookup, and prepayment account resolution
- **Database migration** `0007_backfill_bill_payments.sql` — Backfills missing `billPayments` records for existing expenses that reference a `billId` but have no corresponding payment entry

### Changed
- **`api/bills-router.ts:recordPayment`** — Refactored to delegate all payment accounting to the shared `payBill()` utility. Router now handles validation (bill auth, account location check, category resolution) and passes context to `payBill()`.
- **`api/expenses-router.ts:create` → billId path** — Refactored to delegate AP debit, prepaid, supplier update, and bill update to `payBill({ skipExpenseCreation: true })`. The detailed expense record (with items/attachments) is created first, then `payBill()` handles the payment-specific side effects.
- **Blocking guard fix** — The supplier outstanding-bills guard at `expenses-router.ts:290-301` now only fires when `billId` is NOT set (Option C). Users paying a specific bill via the Expenses tab no longer get incorrectly blocked by other outstanding bills.

### Fixed
- **Missing `billPayments` records** — Bill payments initiated via the Expenses tab (Path B) now correctly create `billPayments` records, ensuring complete payment history and reconciliation data.
- **Inconsistent blocking guard** — The "outstanding bills" block no longer prevents legitimate bill payments from the Expenses tab.
- **Hardcoded AP account code `1550`** — Prepayment account lookup now uses the same `ensureSystemAccount` pattern as Path A, instead of hardcoding account code `1550`.
- **AP account lookup** — Path B now supports the same `accountSubType: "accounts_payable"` resolution as Path A.
- **Supplier balance double-update** — When `billId` is present, `payBill()` handles the supplier update, avoiding the duplicate inline update that previously existed.

### Testing
- Added 9 new integration tests in `expenses-dual-mode.test.ts`:
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
