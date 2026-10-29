// ABOUTME: Defines shared tRPC middleware, permission guards, and error formatting for the backend routers.
// ABOUTME: Centralizes auth, RBAC, tenant scoping, and helper utilities that every API module reuses.
import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import SuperJSON from "superjson";
import { getDb } from "./queries/connection";
import { businesses, locations, users, userBusinesses, userLocations, appSettings, rolePermissions, type Business } from "@db/schema";
import { eq, and, sql, isNull, type AnyColumn, type AnyTable } from "drizzle-orm";
import type { RightsProfile } from "./lib/partner-allocations";
import type { ResolvedApiKey } from "./lib/api-key-auth";
import { hasScope } from "./lib/api-scopes";
import type { ApiScope } from "./lib/api-scopes";
import { env } from "./lib/env";
import { getAccountAccess, assertBusinessOperational, billingHoldError } from "./lib/account-access";

export const ErrorMessages = {
  unknownError: "Unknown error",
  invalidToken: "Invalid or expired token",
  invalidCredentials: "Invalid credentials",
  missingToken: "Authentication token is missing",
  insufficientRole: "You do not have permission to perform this action",
  userNotFound: "User not found",
  authRequired: "Authentication required",
  tierLimit: "You have reached the limit for your plan tier. Please upgrade.",
};

// Permission definitions
export const PERMISSIONS = {
  SALES_VIEW: "sales:view",
  SALES_CREATE: "sales:create",
  SALES_VIEW_OWN: "sales:view_own",
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_CREATE: "expenses:create",
  EXPENSES_MANAGE: "expenses:manage",
  EXPENSES_VIEW_OWN: "expenses:view_own",
  BILLS_VIEW: "bills:view",
  BILLS_CREATE: "bills:create",
  BILLS_PAY: "bills:pay",
  SUPPLIERS_VIEW: "suppliers:view",
  SUPPLIERS_MANAGE: "suppliers:manage",
  SUPPLIER_PRICES_VIEW: "supplier_prices:view",
  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_MANAGE: "accounts:manage",
  PAYROLL_VIEW: "payroll:view",
  PAYROLL_PROCESS: "payroll:process",
  MPESA_VIEW: "mpesa:view",
  MPESA_IMPORT: "mpesa:import",
  WALLET_VIEW: "wallet:view",
  WALLET_IMPORT: "wallet:import",
  WALLET_ADMIN: "wallet:admin",
  REPORTS_VIEW: "reports:view",
  USERS_MANAGE: "users:manage",
  SETTINGS_MANAGE: "settings:manage",
  FEEDBACK_MANAGE: "feedback:manage",
  BUSINESS_MANAGE: "business:manage",
  INQUIRY_VIEW: "inquiry:view",
  API_KEYS_MANAGE: "api_keys:manage",
  WEBHOOKS_MANAGE: "webhooks:manage",
  INTEGRATIONS_MANAGE: "integrations:manage",
  PARTNER_VIEW: "partner:view",
  PURCHASE_ORDERS_VIEW: "po:view",
  PURCHASE_ORDERS_MANAGE: "po:manage",
  CALENDAR_VIEW: "calendar:view",
  BUDGET_MANAGE: "budget:manage",
  COGS_MANAGE: "cogs:manage",
  ALERTS_CONFIG: "alerts:config",
  LEDGER_VIEW: "ledger:view",
  DASHBOARD_VIEW: "dashboard:view",
  RESET_TRANSACTIONS: "transactions:reset",
  DEBTS_VIEW: "debts:view",
  DEBTS_MANAGE: "debts:manage",
  PAYMENT_METHODS_VIEW: "payment_methods:view",
  PAYMENT_METHODS_MANAGE: "payment_methods:manage",
  EXPENSE_CATEGORIES_MANAGE: "expense_categories:manage",
  SUBSCRIPTIONS_VIEW: "subscriptions:view",
  SUBSCRIPTIONS_MANAGE: "subscriptions:manage",
  SUBSCRIPTIONS_PAY: "subscriptions:pay",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-based permission helpers
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE,
    PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW, PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS,
    PERMISSIONS.MPESA_VIEW, PERMISSIONS.MPESA_IMPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.BUSINESS_MANAGE,
    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW, PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.BUDGET_MANAGE, PERMISSIONS.COGS_MANAGE,
    PERMISSIONS.ALERTS_CONFIG, PERMISSIONS.LEDGER_VIEW, PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DEBTS_VIEW, PERMISSIONS.DEBTS_MANAGE,
    PERMISSIONS.PAYMENT_METHODS_VIEW, PERMISSIONS.PAYMENT_METHODS_MANAGE,
    PERMISSIONS.EXPENSE_CATEGORIES_MANAGE,
    PERMISSIONS.SUBSCRIPTIONS_VIEW, PERMISSIONS.SUBSCRIPTIONS_MANAGE, PERMISSIONS.SUBSCRIPTIONS_PAY,
    PERMISSIONS.INTEGRATIONS_MANAGE,
  ],
  manager: [
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE,
    PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS,
    PERMISSIONS.MPESA_VIEW, PERMISSIONS.MPESA_IMPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW, PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.BUDGET_MANAGE, PERMISSIONS.COGS_MANAGE,
    PERMISSIONS.ALERTS_CONFIG, PERMISSIONS.LEDGER_VIEW, PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DEBTS_VIEW, PERMISSIONS.DEBTS_MANAGE,
    PERMISSIONS.PAYMENT_METHODS_VIEW,
    PERMISSIONS.EXPENSE_CATEGORIES_MANAGE,
    PERMISSIONS.SUBSCRIPTIONS_VIEW, PERMISSIONS.SUBSCRIPTIONS_MANAGE, PERMISSIONS.SUBSCRIPTIONS_PAY,
  ],
  employee: [
    // Sole permission: can create new daily sales entries only
    PERMISSIONS.SALES_CREATE,
  ],
  viewer: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.BILLS_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.MPESA_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.SUBSCRIPTIONS_VIEW,
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CALENDAR_VIEW,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

// ── Dynamic role permissions from DB ──────────────────────────────
let ROLE_PERMISSIONS_CACHE: Record<string, Permission[]> | null = null;
let ROLE_CACHE_LOADED = false;

export async function loadRolePermissionsFromDb(): Promise<void> {
  if (ROLE_CACHE_LOADED) return;
  const db = getDb();
  const rows = await db.select().from(rolePermissions).where(eq(rolePermissions.isActive, true));
  const cache: Record<string, Permission[]> = {};
  for (const row of rows) {
    try {
      const perms = Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions as string || "[]");
      cache[row.roleKey] = perms.filter((p: string) => Object.values(PERMISSIONS).includes(p as Permission));
    } catch {
      cache[row.roleKey] = [];
    }
  }
  ROLE_PERMISSIONS_CACHE = cache;
  ROLE_CACHE_LOADED = true;
}

export function invalidateRolePermissionCache(): void {
  ROLE_PERMISSIONS_CACHE = null;
  ROLE_CACHE_LOADED = false;
}

// Effective permissions for a role: DB cache first, then hardcoded defaults.
export function getRolePermissionsWithCache(role: string): Permission[] {
  if (ROLE_PERMISSIONS_CACHE && ROLE_PERMISSIONS_CACHE[role]) {
    return ROLE_PERMISSIONS_CACHE[role];
  }
  return ROLE_PERMISSIONS[role] || [];
}

function getPermissionAction(permission: string): string {
  if (permission.includes(":")) {
    return permission.split(":").at(-1)?.toLowerCase() ?? "";
  }
  if (permission.includes(".")) {
    return permission.split(".").at(-1)?.toLowerCase() ?? "";
  }
  return permission.toLowerCase();
}

export function clampPermissionsForAllocation(base: string[], profile: RightsProfile): string[] {
  if (profile === "manage") {
    return base;
  }

  const viewActions = new Set(["view", "read"]);
  if (profile === "view_only") {
    return base.filter((permission) => viewActions.has(getPermissionAction(permission)));
  }

  const createViewActions = new Set(["view", "read", "create", "add"]);
  return base.filter((permission) => createViewActions.has(getPermissionAction(permission)));
}

type CurrentBusinessContext = Pick<
  Business,
  "id" | "accountId" | "accountRefId" | "plan" | "features" | "maxBranches" | "maxUsers"
>;

interface TrpcUser {
  id: number;
  role: string;
  name?: string | null;
  email?: string | null;
  currentBusinessId?: number | null;
  currentBusiness?: CurrentBusinessContext | null;
  businessIds?: number[];
  assignedLocationIds?: number[];
  enforceUserLocation?: boolean;
  accountId?: string | null;
  accountRefId?: number | null;
  allocationRightsProfile?: RightsProfile | null;
  accessSource?: "owned" | "allocated";
  [key: string]: unknown;
}

// tRPC setup with context type
interface TrpcCtx {
  req: Request;
  resHeaders: Headers;
  user?: TrpcUser;
  apiKey?: ResolvedApiKey;
  businessId?: number | null;
  apiKeyId?: number;
  apiKeyScopes?: string[];
}

type UserContextCarrier = Pick<TrpcCtx, "user">;
type LocationScopedTable = AnyTable<{ name: string }> & {
  id: AnyColumn;
  locationId: AnyColumn;
  deletedAt?: AnyColumn;
};
type BusinessScopedTable = AnyTable<{ name: string }> & {
  id: AnyColumn;
  businessId: AnyColumn;
  deletedAt?: AnyColumn;
};

const t = initTRPC.context<TrpcCtx>().create({
  transformer: SuperJSON,
  errorFormatter({ shape, error }) {
    const causeData = error.cause && typeof error.cause === "object" && !(error.cause instanceof ZodError)
      ? (error.cause as unknown as Record<string, unknown>)
      : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        ...(causeData ?? {}),
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createRouter = t.router;
const recoveryPaths = new Set(["localAuth.me", "localAuth.refresh", "localAuth.logout", "localAuth.logoutAll", "localAuth.changePassword", "localAuth.migratePassword", "localAuth.switchBusiness", "businesses.switch"]);
const baseProcedure = t.procedure.use(async (opts) => {
  const user = opts.ctx.user;
  const recovery = recoveryPaths.has(opts.path) || opts.path.startsWith("billing.");
  if (user) {
    const access = await getAccountAccess({ accountId: user.accountId ?? null, role: user.role, isActive: user.isActive !== false, deletedAt: user.deletedAt instanceof Date ? user.deletedAt : null });
    if (access.mode === "blocked" && !["localAuth.logout", "localAuth.logoutAll"].includes(opts.path)) throw billingHoldError();
    if (access.mode === "billing_only" && !recovery) throw billingHoldError();
    const rawInput = await opts.getRawInput();
    if (rawInput && typeof rawInput === "object" && "businessId" in rawInput && Number.isInteger(rawInput.businessId) && typeof rawInput.businessId === "number") await assertBusinessOperational(rawInput.businessId);
    const businessId = user.currentBusiness?.id ?? user.currentBusinessId;
    if (!recovery && businessId) await assertBusinessOperational(businessId);
  }
  if (opts.ctx.apiKey) await assertBusinessOperational(opts.ctx.apiKey.businessId);
  return opts.next();
});
export const publicQuery = baseProcedure;

// Auth middleware
const requireAuth = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.authRequired,
    });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});

export const requireApiKey = (scope?: ApiScope) =>
  t.middleware(async (opts) => {
    const apiKey = opts.ctx.apiKey;
    if (!apiKey) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Valid API key required",
      });
    }
    if (scope && !hasScope(apiKey.scopes, scope)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `API key missing required scope: ${scope}`,
      });
    }
    return opts.next({
      ctx: { ...opts.ctx, apiKey, businessId: apiKey.businessId },
    });
  });

export const apiKeyProcedure = publicQuery.use(requireApiKey());

export const requireAuthOrApiKey = t.middleware(async (opts) => {
  if (opts.ctx.user || opts.ctx.apiKey) {
    return opts.next({ ctx: opts.ctx });
  }
  throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.authRequired });
});

// Permission middleware factory
export function requirePermission(permission: Permission) {
  return t.middleware(async (opts) => {
    const user = opts.ctx.user;
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: ErrorMessages.authRequired,
      });
    }
    // Ensure DB role cache is loaded before checking
    await loadRolePermissionsFromDb();
    const basePermissions = getRolePermissionsWithCache(user.role);
    const effectivePermissions = user.accessSource === "allocated" && user.allocationRightsProfile
      ? clampPermissionsForAllocation(basePermissions, user.allocationRightsProfile)
      : basePermissions;
    if (!effectivePermissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  });
}

// Middleware factory that checks if user has ANY of the listed permissions (OR logic)
export function requireAnyPermission(permissions: Permission[]) {
  return t.middleware(async (opts) => {
    const user = opts.ctx.user;
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: ErrorMessages.authRequired,
      });
    }
    await loadRolePermissionsFromDb();
    const basePermissions = getRolePermissionsWithCache(user.role);
    const effectivePermissions = user.accessSource === "allocated" && user.allocationRightsProfile
      ? clampPermissionsForAllocation(basePermissions, user.allocationRightsProfile)
      : basePermissions;
    const hasAny = permissions.some((p) => effectivePermissions.includes(p));
    if (!hasAny) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }
    return opts.next({ ctx: { ...opts.ctx, user } });
  });
}

// Tier enforcement middleware
export const requireTier = (feature: string) => t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.authRequired });

  const biz = user.currentBusiness;
  if (!biz) throw new TRPCError({ code: "FORBIDDEN", message: "No active business selected" });

  const plan = biz.plan ?? "free";
  // Plan tier limits
  const TIER_FEATURES: Record<string, string[]> = {
    free: [],
    starter: ["multiple_users", "recurring_bills"],
    growth: ["multiple_users", "multiple_branches", "recurring_bills", "payroll"],
    pro: ["multiple_users", "multiple_branches", "recurring_bills", "payroll", "api_access", "webhooks", "white_label"],
    partner: ["multiple_users", "multiple_branches", "recurring_bills", "payroll", "api_access", "webhooks", "white_label", "partner_dashboard"],
  };

  const allowed = TIER_FEATURES[plan] || [];
  if (!allowed.includes(feature) && plan !== "pro" && plan !== "partner") {
    throw new TRPCError({ code: "FORBIDDEN", message: `${ErrorMessages.tierLimit} Upgrade to access: ${feature}` });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});

// Count check helpers for tier enforcement
export async function checkBranchLimit(businessId: number, requestedCount: number = 1) {
  const db = getDb();
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return false;
  const maxBranches = biz.maxBranches ?? 1;
  const current = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
    .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
  const currentCount = current[0]?.count ?? 0;
  return currentCount + requestedCount <= maxBranches;
}

export async function checkUserLimit(businessId: number, requestedCount: number = 1) {
  const db = getDb();
  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return false;
  const { checkUserLimitForAccount } = await import("./lib/account-subscriptions");
  const result = await checkUserLimitForAccount(db, biz.accountId, businessId, biz.accountRefId, requestedCount);
  return result.allowed;
}

export const authedQuery = baseProcedure.use(requireAuth);

// Permission-protected procedures
export const salesQuery = baseProcedure.use(requirePermission(PERMISSIONS.SALES_VIEW));
export const salesViewOwn = baseProcedure.use(requirePermission(PERMISSIONS.SALES_VIEW_OWN));
export const salesCreate = baseProcedure.use(requirePermission(PERMISSIONS.SALES_CREATE));
export const expenseQuery = baseProcedure.use(requirePermission(PERMISSIONS.EXPENSES_VIEW));
export const expenseViewOwn = baseProcedure.use(requirePermission(PERMISSIONS.EXPENSES_VIEW_OWN));
export const expenseCreate = baseProcedure.use(requirePermission(PERMISSIONS.EXPENSES_CREATE));
export const expenseViewOrCreate = baseProcedure.use(requireAnyPermission([PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE]));
export const expenseManage = baseProcedure.use(requirePermission(PERMISSIONS.EXPENSES_MANAGE));
export const billQuery = baseProcedure.use(requirePermission(PERMISSIONS.BILLS_VIEW));
export const billCreate = baseProcedure.use(requirePermission(PERMISSIONS.BILLS_CREATE));
export const billPay = baseProcedure.use(requirePermission(PERMISSIONS.BILLS_PAY));
export const billAccess = baseProcedure.use(requireAnyPermission([PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY]));
export const supplierQuery = baseProcedure.use(requirePermission(PERMISSIONS.SUPPLIERS_VIEW));
export const supplierManage = baseProcedure.use(requirePermission(PERMISSIONS.SUPPLIERS_MANAGE));
export const accountQuery = baseProcedure.use(requirePermission(PERMISSIONS.ACCOUNTS_VIEW));
export const accountManage = baseProcedure.use(requirePermission(PERMISSIONS.ACCOUNTS_MANAGE));
const requireAccountManageOrApiKey = t.middleware(async (opts) => {
  if (opts.ctx.user) {
    await loadRolePermissionsFromDb();
    const basePermissions = getRolePermissionsWithCache(opts.ctx.user.role);
    const effectivePermissions =
      opts.ctx.user.accessSource === "allocated" && opts.ctx.user.allocationRightsProfile
        ? clampPermissionsForAllocation(basePermissions, opts.ctx.user.allocationRightsProfile)
        : basePermissions;
    if (effectivePermissions.includes(PERMISSIONS.ACCOUNTS_MANAGE)) {
      return opts.next({ ctx: opts.ctx });
    }
  }
  if (
    opts.ctx.apiKey &&
    hasScope(opts.ctx.apiKey.scopes, "journal:write")
  ) {
    return opts.next({ ctx: opts.ctx });
  }
  throw new TRPCError({ code: "FORBIDDEN", message: ErrorMessages.insufficientRole });
});

export const accountManageOrApiKey = baseProcedure.use(requireAccountManageOrApiKey);
export const payrollQuery = baseProcedure.use(requirePermission(PERMISSIONS.PAYROLL_VIEW));
export const payrollProcess = baseProcedure.use(requirePermission(PERMISSIONS.PAYROLL_PROCESS));
export const mpesaQuery = baseProcedure.use(requirePermission(PERMISSIONS.MPESA_VIEW));
export const mpesaImport = baseProcedure.use(requirePermission(PERMISSIONS.MPESA_IMPORT));
export const walletQuery = baseProcedure.use(requirePermission(PERMISSIONS.WALLET_VIEW));
export const walletImport = baseProcedure.use(requirePermission(PERMISSIONS.WALLET_IMPORT));
export const walletAdmin = baseProcedure.use(requirePermission(PERMISSIONS.WALLET_ADMIN));
export const reportQuery = baseProcedure.use(requirePermission(PERMISSIONS.REPORTS_VIEW));
export const userManage = baseProcedure.use(requirePermission(PERMISSIONS.USERS_MANAGE));
export const settingsManage = baseProcedure.use(requirePermission(PERMISSIONS.SETTINGS_MANAGE));
export const feedbackManage = baseProcedure.use(requirePermission(PERMISSIONS.FEEDBACK_MANAGE));
export const businessManage = baseProcedure.use(requirePermission(PERMISSIONS.BUSINESS_MANAGE));
export const inquiryView = baseProcedure.use(requirePermission(PERMISSIONS.INQUIRY_VIEW));
export const purchaseOrdersView = baseProcedure.use(requirePermission(PERMISSIONS.PURCHASE_ORDERS_VIEW));
export const purchaseOrdersManage = baseProcedure.use(requirePermission(PERMISSIONS.PURCHASE_ORDERS_MANAGE));
export const calendarView = baseProcedure.use(requirePermission(PERMISSIONS.CALENDAR_VIEW));
export const budgetManage = baseProcedure.use(requirePermission(PERMISSIONS.BUDGET_MANAGE));
export const cogsManage = baseProcedure.use(requirePermission(PERMISSIONS.COGS_MANAGE));
export const alertsConfig = baseProcedure.use(requirePermission(PERMISSIONS.ALERTS_CONFIG));
export const ledgerView = baseProcedure.use(requirePermission(PERMISSIONS.LEDGER_VIEW));
export const resetTransactions = baseProcedure.use(requirePermission(PERMISSIONS.RESET_TRANSACTIONS));
export const apiKeysManage = baseProcedure.use(requirePermission(PERMISSIONS.API_KEYS_MANAGE));
export const webhooksManage = baseProcedure.use(requirePermission(PERMISSIONS.WEBHOOKS_MANAGE));
export const integrationsManage = baseProcedure.use(requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE));
export const partnerView = baseProcedure.use(requirePermission(PERMISSIONS.PARTNER_VIEW));
export const debtsView = baseProcedure.use(requirePermission(PERMISSIONS.DEBTS_VIEW));
export const debtsManage = baseProcedure.use(requirePermission(PERMISSIONS.DEBTS_MANAGE));
export const paymentMethodsView = baseProcedure.use(requirePermission(PERMISSIONS.PAYMENT_METHODS_VIEW));
export const paymentMethodsManage = baseProcedure.use(requirePermission(PERMISSIONS.PAYMENT_METHODS_MANAGE));
export const expenseCategoriesManage = baseProcedure.use(requirePermission(PERMISSIONS.EXPENSE_CATEGORIES_MANAGE));
export const subscriptionsView = baseProcedure.use(requirePermission(PERMISSIONS.SUBSCRIPTIONS_VIEW));
export const subscriptionsManage = baseProcedure.use(requirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE));
export const subscriptionsPay = baseProcedure.use(requirePermission(PERMISSIONS.SUBSCRIPTIONS_PAY));

// Owner-only middleware
const requireOwner = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.authRequired });
  }
  if (user.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required" });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});
export const ownerQuery = baseProcedure.use(requireOwner);

// Super-admin middleware: grants access to users whose accountId matches SUPER_ADMIN_ACCOUNT env var.
// Returns 404 (NOT_FOUND) instead of 403 so the route stays hidden from non-admins.
const requireSuperAdmin = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.authRequired });
  }
  if (!env.superAdminAccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
  }
  const userAccount = user.accountId;
  if (userAccount !== env.superAdminAccount) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
  }
  return opts.next({ ctx: { ...opts.ctx, user } });
});
export const adminProcedure = baseProcedure.use(requireAuth).use(requireSuperAdmin);

export async function getEnforceUserLocation(ctx: UserContextCarrier): Promise<boolean> {
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  if (!businessId) return false;

  const db = getDb();
  const rows = await db.select({ value: appSettings.value }).from(appSettings)
    .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, "enforceLocationAssignment")))
    .limit(1);

  const raw = rows[0]?.value;
  return raw === "true" || raw === "1" || raw === "yes";
}

export async function getAuthorizedLocationIds(ctx: UserContextCarrier): Promise<number[]> {
  const db = getDb();
  const userId = ctx.user?.id;
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  if (!businessId || !userId) return [];

  // Validate user has access to this business
  const junctions = await db.select().from(userBusinesses)
    .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)))
    .limit(1);
  if (junctions.length === 0) {
    // User lost access to this business — auto-clear it
    await db.update(users).set({ currentBusinessId: null }).where(eq(users.id, userId));
    return [];
  }

  const locs = await db.select({ id: locations.id }).from(locations)
    .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));
  const allLocationIds = locs.map((l) => l.id);

  const role = ctx.user?.role ?? "viewer";
  if (role === "owner" || role === "admin") {
    return allLocationIds;
  }

  const enforce = ctx.user?.enforceUserLocation ?? await getEnforceUserLocation(ctx);
  if (!enforce) {
    return allLocationIds;
  }

  let assignedLocationIds = ctx.user?.assignedLocationIds;
  if (!Array.isArray(assignedLocationIds)) {
    try {
      const assignedRows = await db.select({ locationId: userLocations.locationId }).from(userLocations)
        .where(and(eq(userLocations.userId, userId), eq(userLocations.isActive, true)));
      assignedLocationIds = assignedRows.map((row) => row.locationId);
    } catch (e) {
      console.warn("[middleware] getAuthorizedLocationIds failed:", (e as Error).message);
      assignedLocationIds = [];
    }
  }

  const assignedSet = new Set(assignedLocationIds);
  return allLocationIds.filter((locationId) => assignedSet.has(locationId));
}

export async function getCurrentBusinessLocationIds(ctx: UserContextCarrier): Promise<number[]> {
  return getAuthorizedLocationIds(ctx);
}

/** Get all businesses this user is assigned to */
export async function getUserBusinessIds(userId: number): Promise<number[]> {
  const db = getDb();
  const junctions = await db.select({ businessId: userBusinesses.businessId }).from(userBusinesses)
    .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true)));
  return junctions.map(j => j.businessId);
}

// ── Tenant Validation Helpers ────────────────────────────────────────

/**
 * Validates that a provided location ID belongs to the current user's business.
 * Throws an error if unauthorized.
 */
export async function requireAuthorizedLocation(ctx: UserContextCarrier, locationId: number): Promise<number> {
  const locIds = await getCurrentBusinessLocationIds(ctx);
  if (!locIds.includes(locationId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The specified location does not belong to the active business or you lack access.",
    });
  }
  return locationId;
}

/**
 * Generic helper to fetch an entity by ID and verify it belongs to the current business.
 * Assumes the entity table has an `id` and `locationId` column.
 */
export async function requireAuthorizedEntity<TTable extends LocationScopedTable>(
  ctx: UserContextCarrier,
  table: TTable,
  id: number
) {
  const db = getDb();
  const locIds = await getCurrentBusinessLocationIds(ctx);
  if (locIds.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active business locations available." });
  }

  const locIdSql = sql.join(locIds.map(locId => sql`${locId}`), sql`, `);
  const conditions = [
    eq(table.id, id),
    sql`${table.locationId} IN (${locIdSql})`
  ];

  // Optional: if the table has deletedAt, we only fetch non-deleted ones.
  // We'll dynamically check if it exists in the schema table def.
  if ("deletedAt" in table && table.deletedAt) {
    conditions.push(isNull(table.deletedAt));
  }

  const rows = await db.select().from(table as unknown as AnyTable<{ name: string }>).where(and(...conditions)).limit(1);
  if (rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entity not found or does not belong to the active business.",
    });
  }
  return rows[0];
}

/**
 * Generic helper to fetch an entity by ID and verify it belongs to the current business by its businessId.
 * Assumes the entity table has an `id` and `businessId` column.
 */
export async function requireAuthorizedBusinessEntity<TTable extends BusinessScopedTable>(
  ctx: UserContextCarrier,
  table: TTable,
  id: number
) {
  const db = getDb();
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  
  if (!businessId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active business context available." });
  }

  const conditions = [
    eq(table.id, id),
    eq(table.businessId, businessId)
  ];

  if ("deletedAt" in table && table.deletedAt) {
    conditions.push(isNull(table.deletedAt));
  }

  const rows = await db.select().from(table as unknown as AnyTable<{ name: string }>).where(and(...conditions)).limit(1);
  if (rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entity not found or does not belong to the active business.",
    });
  }
  return rows[0];
}
