// ABOUTME: Thin helpers that fire outgoing webhook events for FinaFlow
// ABOUTME: integration points. Each helper dispatches to active webhook
// ABOUTME: subscribers registered for the business and event.
import { dispatchWebhook } from "./webhook-dispatcher";

export async function triggerSaleRecorded(
  businessId: number,
  payload: { dailySaleId: number; saleDate: string; netSales: string }
): Promise<void> {
  await dispatchWebhook(businessId, "sale.recorded", payload);
}

export async function triggerExpenseCreated(
  businessId: number,
  payload: { expenseId: number; amount: string; accountId: number | null }
): Promise<void> {
  await dispatchWebhook(businessId, "expense.created", payload);
}

export async function triggerBillPaid(
  businessId: number,
  payload: { billId: number; amount: string; paymentId: number }
): Promise<void> {
  await dispatchWebhook(businessId, "bill.paid", payload);
}

export async function triggerCoaUpdated(
  businessId: number,
  payload: { accountId: number; name: string; accountCode: string | null }
): Promise<void> {
  await dispatchWebhook(businessId, "coa.updated", payload);
}

export async function triggerSupplierUpdated(
  businessId: number,
  payload: { supplierId: number; name: string | null; email: string | null }
): Promise<void> {
  await dispatchWebhook(businessId, "supplier.updated", payload);
}
