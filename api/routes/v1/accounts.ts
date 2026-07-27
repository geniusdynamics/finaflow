// ABOUTME: /api/v1/accounts — list accounts, upsert CoA entries, and read account transactions.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, successResponse, errorResponse } from "../../lib/api-response";
import { listAccounts, listAccountTransactions, upsertAccount, logIntegration } from "../../lib/integration-service";
import { listAccountsQuerySchema, listAccountTransactionsQuerySchema, upsertAccountSchema } from "../../schemas";

const accounts = new Hono<{ Variables: ApiKeyVariables }>();

accounts.get("/", resolveApiKeyMiddleware("accounts:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const parsed = listAccountsQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const { offset, limit, accountType } = parsed.data;
    const all = await listAccounts(apiKey.businessId, accountType);
    const total = all.length;
    const data = all.slice(offset, offset + limit);

    logIntegration({ businessId: apiKey.businessId, apiKey }, "listAccounts", "success", { count: data.length, total });
    return paginatedResponse(c, data, { page: Math.floor(offset / limit) + 1, limit, total });
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listAccounts", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

accounts.post("/", resolveApiKeyMiddleware("accounts:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const body = await c.req.json();
    const parsed = upsertAccountSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const result = await upsertAccount(apiKey.businessId, parsed.data as Parameters<typeof upsertAccount>[1]);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "upsertAccount", "success", { accountId: result.id, created: result.created });
    return successResponse(c, result, result.created ? 201 : 200);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "upsertAccount", "failed", { error: String(err) });
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

accounts.get("/:id/transactions", resolveApiKeyMiddleware("accounts:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const accountId = Number(c.req.param("id"));
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid account id");
    }
    const parsed = listAccountTransactionsQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
    }

    const data = await listAccountTransactions(apiKey.businessId, accountId, parsed.data);
    logIntegration({ businessId: apiKey.businessId, apiKey }, "listAccountTransactions", "success", { accountId, count: data.length });
    return successResponse(c, data);
  } catch (err) {
    logIntegration({ businessId: c.get("apiKey")?.businessId, apiKey: c.get("apiKey") }, "listAccountTransactions", "failed", { error: String(err) });
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("not found")) {
      return errorResponse(c, 404, "NOT_FOUND", message);
    }
    return errorResponse(c, 500, "INTERNAL_ERROR", message);
  }
});

export default accounts;
