// ABOUTME: /api/v1/subscriptions — external REST access to subscriptions and their payment history.
// ABOUTME: List endpoints require the subscriptions:read scope; recording payments requires subscriptions:write.
import { Hono } from "hono";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, successResponse, errorResponse } from "../../lib/api-response";
import { listSubscriptions, listSubscriptionPayments, logIntegration, resolveActingUserId } from "../../lib/integration-service";
import { updatedSinceQuerySchema } from "../../schemas";
import { getDb } from "../../queries/connection";
import { subscriptions as subscriptionsTable } from "@db/schema";
import { recordPaymentInTx } from "../../lib/subscription-service";

const subscriptions = new Hono<{ Variables: ApiKeyVariables }>();

const paymentInput = z.object({
  amount: z.string().optional(),
  cycleDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountId: z.number().optional(),
  paymentMethod: z.enum(["cash", "wallet", "bank_transfer", "card"]),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
  advance: z.boolean().default(true),
  allowEarly: z.boolean().default(false),
});

subscriptions.get("/", resolveApiKeyMiddleware("subscriptions:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = updatedSinceQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }
    const { offset, limit, updatedSince } = parsed.data;
    const all = await listSubscriptions(apiKey.businessId, { updatedSince });
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listSubscriptions", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listSubscriptions", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

subscriptions.get("/payments", resolveApiKeyMiddleware("subscriptions:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = updatedSinceQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }
    const { offset, limit, updatedSince } = parsed.data;
    const all = await listSubscriptionPayments(apiKey.businessId, { updatedSince });
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listSubscriptionPayments", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listSubscriptionPayments", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

subscriptions.post("/:id/payments", resolveApiKeyMiddleware("subscriptions:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "id must be a positive integer");
    }
    const body = await c.req.json().catch(() => ({}));
    const parsed = paymentInput.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }
    const input = parsed.data;

    const db = getDb();
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.id, id), eq(subscriptionsTable.businessId, apiKey.businessId), isNull(subscriptionsTable.deletedAt)))
      .limit(1);
    if (!subscription) {
      return errorResponse(c, 404, "NOT_FOUND", "Subscription not found");
    }

    // API keys act on behalf of the subscription's creator (else the business owner).
    const actingUserId = await resolveActingUserId(apiKey.businessId, subscription.createdBy);
    if (!actingUserId) {
      return errorResponse(c, 409, "NO_ACTING_USER", "No user available to attribute this payment to");
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const cycleDueDate = input.cycleDueDate ?? subscription.nextDueDate;
    const result = await db.transaction((tx) =>
      recordPaymentInTx(tx, {
        subscription,
        cycleDueDate,
        amount: input.amount ?? subscription.amount,
        paidDate: input.paidDate ?? todayStr,
        accountId: input.accountId ?? subscription.defaultAccountId ?? null,
        paymentMethod: input.paymentMethod,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        userId: actingUserId,
        businessId: apiKey.businessId,
        advance: input.advance && cycleDueDate === subscription.nextDueDate,
        allowEarly: input.allowEarly,
      }),
    );

    logIntegration({ businessId: apiKey.businessId, apiKey }, "recordSubscriptionPayment", "success", { subscriptionId: id, paymentId: result.paymentId });
    return successResponse(c, { ...result, subscriptionId: id }, 201);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "recordSubscriptionPayment", "failed", { error: String(err) });
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("already recorded")) {
      return errorResponse(c, 409, "CONFLICT", message);
    }
    return errorResponse(c, 500, "INTERNAL_ERROR", message);
  }
});

/** The user an API-key action is attributed to: the creator, else an owner/admin of the business. */

export default subscriptions;
