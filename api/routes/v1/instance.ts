// ABOUTME: Mounts the /api/v1/instance machine-to-machine API for FinaBill instance control.
// ABOUTME: Reads need instance:read, mutations need instance:manage, and no session or CSRF applies.
import { Hono } from "hono";
import type { Context } from "hono";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { InstanceVariables } from "../../lib/instance-auth";
import { resolveInstanceKeyMiddleware } from "../../lib/instance-auth";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "../../lib/api-response";
import {
  getAccount,
  holdAccount,
  instanceHealth,
  listAccounts,
  listPlans,
  listUsers,
  resumeAccount,
  setAccountPlan,
  setUserStatus,
} from "../../lib/instance-control";

const instance = new Hono<{ Variables: InstanceVariables }>();

const pageQuery = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
};

const listAccountsQuery = z.object({
  search: z.string().trim().min(1).optional(),
  plan: z.string().trim().min(1).optional(),
  access: z.enum(["all", "held", "active"]).default("all"),
  ...pageQuery,
});

const listUsersQuery = z.object({
  accountId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  ...pageQuery,
});

const reason = z.string().trim().min(3).max(2000);
const accountIdParam = z.string().trim().min(1);
const userIdParam = z.coerce.number().int().positive();

const holdBody = z.object({ reason });
const planBody = z.object({
  plan: z.enum(["free", "starter", "growth", "pro"]),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expiresOn must be YYYY-MM-DD")
    .optional(),
  reason,
});
const userStatusBody = z.object({
  accountId: accountIdParam,
  isActive: z.boolean(),
  reason,
});

function queryObject(c: Context) {
  return Object.fromEntries(new URL(c.req.url).searchParams);
}

async function jsonBody(c: Context) {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function validationError(c: Context, error: z.ZodError) {
  return errorResponse(
    c,
    400,
    "VALIDATION_ERROR",
    error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ")
  );
}

function handleError(c: Context, error: unknown) {
  if (error instanceof TRPCError) {
    const status =
      error.code === "BAD_REQUEST"
        ? 400
        : error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : error.code === "CONFLICT"
                ? 409
                : 500;
    return errorResponse(c, status, error.code, error.message);
  }
  console.error("[v1/instance] error:", error);
  return errorResponse(
    c,
    500,
    "INTERNAL_ERROR",
    error instanceof Error ? error.message : "Internal server error"
  );
}

instance.get(
  "/health",
  resolveInstanceKeyMiddleware("instance:read"),
  async c => {
    try {
      return successResponse(c, await instanceHealth());
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.get(
  "/accounts",
  resolveInstanceKeyMiddleware("instance:read"),
  async c => {
    const parsed = listAccountsQuery.safeParse(queryObject(c));
    if (!parsed.success) return validationError(c, parsed.error);

    try {
      const { offset, limit } = parsed.data;
      const result = await listAccounts(parsed.data);
      return paginatedResponse(c, result.data, {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
      });
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.get(
  "/accounts/:accountId",
  resolveInstanceKeyMiddleware("instance:read"),
  async c => {
    const parsed = accountIdParam.safeParse(c.req.param("accountId"));
    if (!parsed.success) return validationError(c, parsed.error);

    try {
      return successResponse(c, await getAccount(parsed.data));
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.post(
  "/accounts/:accountId/hold",
  resolveInstanceKeyMiddleware("instance:manage"),
  async c => {
    const accountId = accountIdParam.safeParse(c.req.param("accountId"));
    if (!accountId.success) return validationError(c, accountId.error);
    const body = holdBody.safeParse(await jsonBody(c));
    if (!body.success) return validationError(c, body.error);

    try {
      return successResponse(
        c,
        await holdAccount(accountId.data, body.data.reason)
      );
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.post(
  "/accounts/:accountId/resume",
  resolveInstanceKeyMiddleware("instance:manage"),
  async c => {
    const accountId = accountIdParam.safeParse(c.req.param("accountId"));
    if (!accountId.success) return validationError(c, accountId.error);
    const body = holdBody.safeParse(await jsonBody(c));
    if (!body.success) return validationError(c, body.error);

    try {
      return successResponse(
        c,
        await resumeAccount(accountId.data, body.data.reason)
      );
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.post(
  "/accounts/:accountId/plan",
  resolveInstanceKeyMiddleware("instance:manage"),
  async c => {
    const accountId = accountIdParam.safeParse(c.req.param("accountId"));
    if (!accountId.success) return validationError(c, accountId.error);
    const body = planBody.safeParse(await jsonBody(c));
    if (!body.success) return validationError(c, body.error);

    try {
      const account = await setAccountPlan(
        accountId.data,
        body.data.plan,
        body.data.expiresOn,
        body.data.reason
      );
      return successResponse(c, account);
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.get(
  "/users",
  resolveInstanceKeyMiddleware("instance:read"),
  async c => {
    const parsed = listUsersQuery.safeParse(queryObject(c));
    if (!parsed.success) return validationError(c, parsed.error);

    try {
      const { offset, limit } = parsed.data;
      const result = await listUsers(parsed.data);
      return paginatedResponse(c, result.data, {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total,
      });
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.post(
  "/users/:userId/status",
  resolveInstanceKeyMiddleware("instance:manage"),
  async c => {
    const userId = userIdParam.safeParse(c.req.param("userId"));
    if (!userId.success) return validationError(c, userId.error);
    const body = userStatusBody.safeParse(await jsonBody(c));
    if (!body.success) return validationError(c, body.error);

    try {
      const result = await setUserStatus(
        body.data.accountId,
        userId.data,
        body.data.isActive,
        body.data.reason
      );
      return successResponse(c, result);
    } catch (error) {
      return handleError(c, error);
    }
  }
);

instance.get(
  "/plans",
  resolveInstanceKeyMiddleware("instance:read"),
  async c => {
    try {
      return successResponse(c, listPlans());
    } catch (error) {
      return handleError(c, error);
    }
  }
);

export default instance;
