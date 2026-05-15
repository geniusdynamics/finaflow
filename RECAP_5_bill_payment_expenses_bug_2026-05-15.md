ABOUTME: Recap document for bill payment → expenses bug fix session
ABOUTME: Created: 2026-05-15

# RECAP 5: Bill Payment → Expenses Visibility Bug Fix

## Date: 2026-05-15

## Problem Identified

Bill payments recorded via `recordPayment` in `bills-router.ts` were NOT appearing in the Expenses section of the app. The payment was recorded in `billPayments` table and ledger entries were updated (cash/bank credit, AP debit), but NO record was created in the `expenses` table.

The `expenses.list` tRPC query only reads from the `expenses` table. Since bill payments bypassed that table, they were invisible under the Expenses tab — showing as zeros or missing entirely regardless of the date filter selected.

## Root Cause Analysis

1. **`bills-router.ts` `recordPayment` mutation** — Records payment to `billPayments` table, updates cash/bank account (credit) in `ledgerEntries`, and reduces AP account balance (debit). Does NOT create an `expenses` table record.

2. **`expenses-router.ts` `createExpense` mutation** — Creates a record in the `expenses` table, linked to a category. For bills, it also handles the AP debit, but this is only triggered when an expense is created with `billId` set — not from the bill payment flow.

3. **`expenses.list` query** — Queries only the `expenses` table. Bill payments were never creating expenses records, so they never appeared.

## Solution Implemented

Modified `api/bills-router.ts` `recordPayment` mutation to create an `expenses` table entry inside the transaction after recording the payment. This ensures bill payments are visible in the Expenses section with correct date filtering.

**File Modified:** `d:\DevCenter\abuilds\fina\finaflow\api\bills-router.ts`

**Changes:**
1. Added `expenses` to the schema import from `@db/schema`
2. Inside the `recordPayment` transaction, after all ledger entries and AP debit/prepayment handling, added:

```typescript
const categoryId = bill.categoryId ?? 1;
const expenseNumber = `EXP-BP-${String(paymentId).padStart(6, "0")}`;
await tx.insert(expenses).values({
  locationId: bill.locationId,
  businessId: bill.businessId,
  categoryId,
  supplierId: bill.supplierId,
  expenseNumber,
  billId: input.billId,
  amount: input.amount,
  description: `Bill Payment: ${input.reference || bill.description}`,
  expenseDate: new Date(input.paymentDate),
  paymentMethod: input.paymentMethod,
  accountId: cashAccountId ?? null,
  enteredBy,
  refNo: bill.billNumber ?? `BILL-${String(bill.id).padStart(4, "0")}`,
} as any).returning();
```

**Key Design Decisions:**
- Uses `EXP-BP-{paymentId}` format for bill payment expense numbers (e.g., EXP-BP-000123)
- Falls back to `categoryId: 1` (first/default category) if bill has no category
- `expenseDate` set to the payment date — ensures correct date filtering
- `billId` is stored — enables linking expense records back to originating bill
- `refNo` captures the bill number for cross-reference

## Verification

- TypeScript compilation: PASSED (0 errors in bills-router.ts)
- ESLint: PASSED (0 errors in bills-router.ts)
- Code structure verified — insertion is inside the transaction, after ledgerEntries and AP account updates
- Expense number format uses paymentId which is available at that point in the transaction

## Status

- Fix implemented in working directory
- NOT committed (per user instruction: "never push or commit anything unless told to")
- Memory updated to include this rule

## Files Modified

- `d:\DevCenter\abuilds\fina\finaflow\api\bills-router.ts` — Added expense record creation in `recordPayment` mutation (2 changes: import + insertion block)

## Related Context (from previous sessions)

This fix builds on the expense category → COA linking work (Session 4 / Recap 4) where every expense category was pre-linked to a Chart of Accounts expense entry via `defaultAccountId`. The bill payment expense creation uses `bill.categoryId` which resolves to the category's COA-linked account.

## Next Steps (if user wants to proceed)

1. Test the fix end-to-end: record a bill payment via Bills UI and verify it appears in Expenses list
2. If bill doesn't have a categoryId set, the expense will use category 1 (default) — may want to add a bill-level category selection in the Bills UI
3. Consider whether bill payments should also create journal entries for full double-entry audit trail