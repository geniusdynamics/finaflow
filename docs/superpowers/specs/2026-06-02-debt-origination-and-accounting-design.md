# Debt Origination, COA Auto-Classification, Bank Linking, and Recurring Installments

**Date:** 2026-06-02
**Status:** Approved

## Goal

Bring debt management in line with proper double-entry bookkeeping: when a user
records a new loan, the system picks the correct 2600/2700 liability account
based on term length, posts a paired cash + liability leg to the bank and loan
accounts, and auto-creates a recurring bill template so that the existing
`Bills` payment flow handles every installment on the agreed schedule.

## Schema additions

### `debts` table

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| `loanDate` | `timestamp` | `now()` | Origination date. Required for new rows. |
| `installmentAmount` | `numeric(15,2)` | `null` | Per-period amount. Optional. |
| `destinationAccountId` | `bigint` → `accounts.id` | `null` | Bank that receives proceeds. Required for new rows. |
| `loanAccountId` | `bigint` → `accounts.id` | `null` | 2600/2700 system account, frozen at creation. |
| `isDisbursed` | `boolean` | `false` | Whether the cash leg has been posted. |
| `disbursementDate` | `timestamp` | `null` | When the bank actually paid out. |
| `disbursementFee` | `numeric(15,2)` | `null` | Optional arrangement fee. |
| `recurringBillTemplateId` | `bigint` → `recurringBillTemplates.id` | `null` | Link to the auto-created recurring bill. |

### `bills` table

| Column | Type | Notes |
| --- | --- | --- |
| `debtId` | `bigint` → `debts.id`, `onDelete: set null` | Lets `payBill` know to update the debt on payment. |

## Classification rule

`getLoanLiabilityAccountId(businessId, loanDate, dueDate)`:

- If `(dueDate - loanDate) <= 365` days → returns the business's
  `current_loan` system account (accountCode `2600`).
- Otherwise → returns the `long_term_loan` system account (accountCode `2700`).

Lookup is by `accountSubType` per business, matching the pattern in
`api/employees-payroll-router.ts:417`.

## Double-entry postings

### Origination (`postOriginationLedgerEntries`)

Inside one `db.transaction`:

- **Immediate (default):**
  - Debit `destinationAccountId` for `totalAmount` at `loanDate`.
  - Credit `loanAccountId` for `totalAmount` at `loanDate`.
  - Update `accounts.currentBalance` on the destination bank.
  - Set `debts.isDisbursed = true`, `debts.disbursementDate = loanDate`.
- **Deferred:**
  - Credit `loanAccountId` for `totalAmount` at `loanDate` only.
  - Set `debts.isDisbursed = false`. User triggers `Disburse` later.

### Disbursement (`postDisbursementLedgerEntries`)

Runs when the user clicks `Disburse` on a deferred debt, or to back-fill a
disbursement date correction.

- Without fee:
  - Debit `destinationAccountId` for `totalAmount` at `disbursementDate`.
  - Credit `loanAccountId` for `totalAmount` at `disbursementDate`.
- With fee `f`:
  - Debit `destinationAccountId` for `totalAmount - f` (the net cash).
  - Debit the business's `bank_charges` expense account for `f`.
  - Credit `loanAccountId` for `totalAmount`.

Both paths set `debts.isDisbursed = true` and `debts.disbursementDate`.

## Recurring installments

When a debt is created with both `installmentAmount` and a frequency:

- A `recurringBillTemplates` row is created with:
  - `liabilityAccountId = debts.loanAccountId`.
  - `amount = debts.installmentAmount`.
  - `frequency = debts.paymentSchedule`.
  - `nextDueDate = loanDate + 1 period` (e.g., `loanDate + 7 days` for
    `weekly`).
  - `description = "Loan Repayment: {creditorName} (#{debt.id})"`.
- The `debts.recurringBillTemplateId` is set to the new template's id.

The user (or a future scheduled task) calls `generateNextInstallment`:

- Creates a `bills` row with:
  - `debtId = debts.id`.
  - `liabilityAccountId = debts.loanAccountId`.
  - `amount = template.amount`.
  - `issueDate` and `dueDate` from the template's `nextDueDate`.
  - `balanceDue = amount`, `amountPaid = 0`, `status = 'pending'`.
- Advances `template.nextDueDate` by the frequency.

The bill is then paid through the existing `Bills` page. `payBill` in
`api/lib/bill-payment.ts` already posts a `debit` to the cash account and a
`debit` to the liability account, which is exactly the loan-reduction
accounting we want.

## API changes

### `api/debts-router.ts`

- `create` — accepts the new fields, runs classification, calls
  `postOriginationLedgerEntries`, optionally creates the recurring template.
- `disburse` (new) — runs `postDisbursementLedgerEntries`. Throws if the
  debt is already disbursed.
- `generateInstallment` (new) — runs `generateNextInstallment`. Returns the
  new bill id.
- `recordPayment` (existing) — unchanged in shape, still works for ad-hoc
  top-ups.
- `list` / `get` — return all new fields plus joined
  `loanAccountName`, `destinationAccountName`, and `pendingInstallmentCount`.

### `api/bills-router.ts`

After `payBill` returns, if the bill has a `debtId`:

- Recompute `debts.paidAmount` from the sum of paid bill amounts for that
  debt.
- Set `debts.status` to `"paid"` when fully paid.

## UI changes — `src/pages/AddDebtDialog` (inside `Debts.tsx`)

Top row (5 narrow columns, wrap on mobile):

```
[ Location | Payment Schedule | Installment Amount | Loan Date | Due Date ]
[ Destination Bank Account (full width, required)                       ]
[ ☐ Disburse immediately on save  (default checked)                     ]
[ Notes (full width, optional)                                          ]
```

- Destination Bank is a `<select>` filtered to
  `type === "bank_account"`.
- The "Disburse immediately" checkbox default is `true`; unchecking shows a
  small "Will disburse later" hint.

### Debt card additions

- New `Loan Account` line: `2600 — Current Loan Payable` (or 2700).
- `Disburse` button when `!isDisbursed` → opens
  `<DisburseDebtDialog>`.
- `Generate Next Installment` button → calls
  `debts.generateInstallment` and toasts the new bill id.
- A small badge linking to the bills list filtered by `debtId`.

## New components

- `src/components/DisburseDebtDialog.tsx` — single dialog with
  `disbursementDate` (default `loanDate`), optional `arrangementFee`,
  "Confirm Disbursement" submit. Mirrors the `Link Topup` dialog structure
  from `Wallet.tsx`.
- `src/components/DebtScheduledPayments.tsx` — small list/table showing
  bills generated for the debt, with a link to the Bills page filtered by
  `debtId`.

## Out of scope

- Auto-generating bills on a cron. The user clicks "Generate Next
  Installment". A daily task can be layered on later.
- Reclassifying a debt when `dueDate` is edited after creation.
  Classification is frozen at creation.
- Amortization / interest accrual schedules. Interest is captured as a
  manual expense.
