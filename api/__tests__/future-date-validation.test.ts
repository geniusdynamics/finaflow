// ABOUTME: Verifies future-date constraints across financial transaction schemas.
// ABOUTME: Ensures date validation blocks future withdrawals, deposits, bill payments, and expenses.
import { describe, expect, it } from "vitest";
import { drawingInputSchema, depositInputSchema, transferInputSchema } from "../accounts-router";
import { billPaymentInputSchema, batchBillPaymentInputSchema } from "../bills-router";
import { createExpenseInputSchema, updateExpenseInputSchema } from "../expenses-router";
import { getTodayDateKey, isFutureDateString } from "../lib/future-date";

function tomorrowDateKey(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

describe("future-date guard helper", () => {
  it("marks tomorrow as future", () => {
    expect(isFutureDateString(tomorrowDateKey())).toBe(true);
  });

  it("allows today", () => {
    expect(isFutureDateString(getTodayDateKey())).toBe(false);
  });
});

describe("accounts transaction schema guards", () => {
  it("rejects future drawing date", () => {
    expect(() =>
      drawingInputSchema.parse({
        accountId: 1,
        amount: "100.00",
        date: tomorrowDateKey(),
      })
    ).toThrow(/future/i);
  });

  it("rejects future deposit date", () => {
    expect(() =>
      depositInputSchema.parse({
        accountId: 1,
        amount: "100.00",
        date: tomorrowDateKey(),
      })
    ).toThrow(/future/i);
  });

  it("rejects future transfer date", () => {
    expect(() =>
      transferInputSchema.parse({
        fromAccountId: 1,
        description: "Branch transfer",
        date: tomorrowDateKey(),
        toAccounts: [{ accountId: 2, amount: "50.00" }],
      })
    ).toThrow(/future/i);
  });
});

describe("bill payment schema guards", () => {
  it("rejects future bill payment date", () => {
    expect(() =>
      billPaymentInputSchema.parse({
        billId: 1,
        paymentMethod: "cash",
        amount: "1000.00",
        paymentDate: tomorrowDateKey(),
      })
    ).toThrow(/future/i);
  });

  it("rejects future batch payment date", () => {
    expect(() =>
      batchBillPaymentInputSchema.parse({
        billIds: [1, 2],
        paymentMethod: "bank_transfer",
        paymentDate: tomorrowDateKey(),
        accountId: 1,
      })
    ).toThrow(/future/i);
  });
});

describe("expense schema guards", () => {
  it("rejects future expense creation date", () => {
    expect(() =>
      createExpenseInputSchema.parse({
        locationId: 1,
        categoryId: 1,
        amount: "250.00",
        description: "Stock purchase",
        expenseDate: tomorrowDateKey(),
        paymentMethod: "cash",
      })
    ).toThrow(/future/i);
  });

  it("rejects future expense update date", () => {
    expect(() =>
      updateExpenseInputSchema.parse({
        id: 10,
        expenseDate: tomorrowDateKey(),
      })
    ).toThrow(/future/i);
  });
});
