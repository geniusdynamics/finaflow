import { describe, it, expect, afterEach, vi } from "vitest";
import {
  triggerSaleRecorded,
  triggerExpenseCreated,
  triggerBillPaid,
  triggerCoaUpdated,
  triggerSupplierUpdated,
} from "../lib/webhook-triggers";

vi.mock("../lib/webhook-dispatcher", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/webhook-dispatcher")>();
  return {
    ...original,
    dispatchWebhook: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("outgoing webhook triggers", () => {
  it("triggerSaleRecorded dispatches sale.recorded with the expected payload", async () => {
    const { dispatchWebhook } = await import("../lib/webhook-dispatcher");

    await triggerSaleRecorded(1, {
      dailySaleId: 10,
      saleDate: "2026-07-01",
      netSales: "12500.00",
    });

    expect(dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).toHaveBeenCalledWith(1, "sale.recorded", {
      dailySaleId: 10,
      saleDate: "2026-07-01",
      netSales: "12500.00",
    });
  });

  it("triggerExpenseCreated dispatches expense.created with the expected payload", async () => {
    const { dispatchWebhook } = await import("../lib/webhook-dispatcher");

    await triggerExpenseCreated(2, {
      expenseId: 20,
      amount: "450.00",
      accountId: 100,
    });

    expect(dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).toHaveBeenCalledWith(2, "expense.created", {
      expenseId: 20,
      amount: "450.00",
      accountId: 100,
    });
  });

  it("triggerBillPaid dispatches bill.paid with the expected payload", async () => {
    const { dispatchWebhook } = await import("../lib/webhook-dispatcher");

    await triggerBillPaid(3, {
      billId: 30,
      amount: "900.00",
      paymentId: 300,
    });

    expect(dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).toHaveBeenCalledWith(3, "bill.paid", {
      billId: 30,
      amount: "900.00",
      paymentId: 300,
    });
  });

  it("triggerCoaUpdated dispatches coa.updated with the expected payload", async () => {
    const { dispatchWebhook } = await import("../lib/webhook-dispatcher");

    await triggerCoaUpdated(4, {
      accountId: 40,
      name: "Bank Account",
      accountCode: "1020",
    });

    expect(dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).toHaveBeenCalledWith(4, "coa.updated", {
      accountId: 40,
      name: "Bank Account",
      accountCode: "1020",
    });
  });

  it("triggerSupplierUpdated dispatches supplier.updated with the expected payload", async () => {
    const { dispatchWebhook } = await import("../lib/webhook-dispatcher");

    await triggerSupplierUpdated(5, {
      supplierId: 50,
      name: "Acme Supplies",
      email: "acme@example.com",
    });

    expect(dispatchWebhook).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).toHaveBeenCalledWith(5, "supplier.updated", {
      supplierId: 50,
      name: "Acme Supplies",
      email: "acme@example.com",
    });
  });
});

describe("webhook signature format", () => {
  it("produces a sha256= prefix followed by a 64-char hex digest", async () => {
    const { signWebhookPayload } = await import("../lib/webhook-dispatcher");

    const signature = signWebhookPayload('{"event":"test"}', "secret");

    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
