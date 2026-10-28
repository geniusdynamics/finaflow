// ABOUTME: /api/v1/accounts — list accounts, upsert CoA entries, and read account transactions.
import { Hono } from "hono";
import { z } from "zod";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, successResponse, errorResponse } from "../../lib/api-response";
import { listAccounts, listAccountTransactions, upsertAccount, getAccount, updateAccount, logIntegration } from "../../lib/integration-service";
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

accounts.get("/:id", resolveApiKeyMiddleware("accounts:read"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid account id");
    }
    const account = await getAccount(apiKey.businessId, id);
    if (!account) return errorResponse(c, 404, "NOT_FOUND", "Account not found");
    return successResponse(c, account);
  } catch (err) {
    return errorResponse(c, 500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Internal server error");
  }
});

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  accountCode: z.string().max(20).optional(),
  accountNumber: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  isPaymentMethod: z.boolean().optional(),
});

accounts.patch("/:id", resolveApiKeyMiddleware("accounts:write"), async (c) => {
  try {
    const apiKey = c.get("apiKey");
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid account id");
    }
    const parsed = updateAccountSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return errorResponse(c, 400, "VALIDATION_ERROR", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", "));
    }
    const account = await updateAccount(apiKey.businessId, id, parsed.data);
    if (!account) return errorResponse(c, 404, "NOT_FOUND", "Account not found");
    logIntegration({ businessId: apiKey.businessId, apiKey }, "updateAccount", "success", { accountId: id });
    return successResponse(c, account);
  } catch (err) {
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
