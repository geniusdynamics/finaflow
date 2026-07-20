// ABOUTME: GET /api/v1/accounts — list accounts for the authenticated business.
import { Hono } from "hono";
import type { ApiKeyVariables } from "../../lib/api-key-middleware";
import { resolveApiKeyMiddleware } from "../../lib/api-key-middleware";
import { paginatedResponse, errorResponse } from "../../lib/api-response";
import { listAccounts, logIntegration } from "../../lib/integration-service";
import { listAccountsQuerySchema } from "../../schemas";

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

export default accounts;
