import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import SuperJSON from "superjson";
import { getDb } from "./queries/connection";
import { businesses, locations, users, userBusinesses, rolePermissions } from "@db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

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
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_CREATE: "expenses:create",
  EXPENSES_MANAGE: "expenses:manage",
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
  REPORTS_VIEW: "reports:view",
  USERS_MANAGE: "users:manage",
  SETTINGS_MANAGE: "settings:manage",
  FEEDBACK_MANAGE: "feedback:manage",
  BUSINESS_MANAGE: "business:manage",
  INQUIRY_VIEW: "inquiry:view",
  API_KEYS_MANAGE: "api_keys:manage",
  WEBHOOKS_MANAGE: "webhooks:manage",
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
  ],
  employee: [
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE,
    PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.BILLS_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.MPESA_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CALENDAR_VIEW,
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

// Override hasPermission to check DB cache first, then fall back to hardcoded defaults
function hasPermissionWithCache(role: string, permission: Permission): boolean {
  if (ROLE_PERMISSIONS_CACHE && ROLE_PERMISSIONS_CACHE[role]) {
    return ROLE_PERMISSIONS_CACHE[role].includes(permission);
  }
  return hasPermission(role, permission);
}

// tRPC setup with context type
interface TrpcCtx {
  req: Request;
  resHeaders: Headers;
  user?: {
    id: number;
    role: string;
    name: string | null;
    email: string | null;
    currentBusinessId?: number | null;
    currentBusiness?: any;
    businessIds?: number[];
    [key: string]: any;
  };
}

const t = initTRPC.context<TrpcCtx>().create({
  transformer: SuperJSON,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

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

// Permission middleware factory
function requirePermission(permission: Permission) {
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
    if (!hasPermissionWithCache(user.role, permission)) {
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
  const features = biz.features ?? {};

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
  const maxUsers = biz.maxUsers ?? 1;
  const current = await db.select({ count: sql<number>`COUNT(*)` }).from(userBusinesses)
    .where(and(eq(userBusinesses.businessId, businessId), eq(userBusinesses.isActive, true)));
  const currentCount = current[0]?.count ?? 0;
  return currentCount + requestedCount <= maxUsers;
}

export const authedQuery = t.procedure.use(requireAuth);

// Permission-protected procedures
export const salesQuery = t.procedure.use(requirePermission(PERMISSIONS.SALES_VIEW));
export const salesCreate = t.procedure.use(requirePermission(PERMISSIONS.SALES_CREATE));
export const expenseQuery = t.procedure.use(requirePermission(PERMISSIONS.EXPENSES_VIEW));
export const expenseCreate = t.procedure.use(requirePermission(PERMISSIONS.EXPENSES_CREATE));
export const expenseManage = t.procedure.use(requirePermission(PERMISSIONS.EXPENSES_MANAGE));
export const billQuery = t.procedure.use(requirePermission(PERMISSIONS.BILLS_VIEW));
export const billCreate = t.procedure.use(requirePermission(PERMISSIONS.BILLS_CREATE));
export const billPay = t.procedure.use(requirePermission(PERMISSIONS.BILLS_PAY));
export const supplierQuery = t.procedure.use(requirePermission(PERMISSIONS.SUPPLIERS_VIEW));
export const supplierManage = t.procedure.use(requirePermission(PERMISSIONS.SUPPLIERS_MANAGE));
export const accountQuery = t.procedure.use(requirePermission(PERMISSIONS.ACCOUNTS_VIEW));
export const accountManage = t.procedure.use(requirePermission(PERMISSIONS.ACCOUNTS_MANAGE));
export const payrollQuery = t.procedure.use(requirePermission(PERMISSIONS.PAYROLL_VIEW));
export const payrollProcess = t.procedure.use(requirePermission(PERMISSIONS.PAYROLL_PROCESS));
export const mpesaQuery = t.procedure.use(requirePermission(PERMISSIONS.MPESA_VIEW));
export const mpesaImport = t.procedure.use(requirePermission(PERMISSIONS.MPESA_IMPORT));
export const reportQuery = t.procedure.use(requirePermission(PERMISSIONS.REPORTS_VIEW));
export const userManage = t.procedure.use(requirePermission(PERMISSIONS.USERS_MANAGE));
export const settingsManage = t.procedure.use(requirePermission(PERMISSIONS.SETTINGS_MANAGE));
export const feedbackManage = t.procedure.use(requirePermission(PERMISSIONS.FEEDBACK_MANAGE));
export const businessManage = t.procedure.use(requirePermission(PERMISSIONS.BUSINESS_MANAGE));
export const inquiryView = t.procedure.use(requirePermission(PERMISSIONS.INQUIRY_VIEW));
export const purchaseOrdersView = t.procedure.use(requirePermission(PERMISSIONS.PURCHASE_ORDERS_VIEW));
export const purchaseOrdersManage = t.procedure.use(requirePermission(PERMISSIONS.PURCHASE_ORDERS_MANAGE));
export const calendarView = t.procedure.use(requirePermission(PERMISSIONS.CALENDAR_VIEW));
export const budgetManage = t.procedure.use(requirePermission(PERMISSIONS.BUDGET_MANAGE));
export const cogsManage = t.procedure.use(requirePermission(PERMISSIONS.COGS_MANAGE));
export const alertsConfig = t.procedure.use(requirePermission(PERMISSIONS.ALERTS_CONFIG));
export const ledgerView = t.procedure.use(requirePermission(PERMISSIONS.LEDGER_VIEW));
export const resetTransactions = t.procedure.use(requirePermission(PERMISSIONS.RESET_TRANSACTIONS));
export const apiKeysManage = t.procedure.use(requirePermission(PERMISSIONS.API_KEYS_MANAGE));
export const webhooksManage = t.procedure.use(requirePermission(PERMISSIONS.WEBHOOKS_MANAGE));
export const partnerView = t.procedure.use(requirePermission(PERMISSIONS.PARTNER_VIEW));

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
export const ownerQuery = t.procedure.use(requireOwner);

export async function getCurrentBusinessLocationIds(ctx: any): Promise<number[]> {
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
  return locs.map(l => l.id);
}

/** Get all businesses this user is assigned to */
export async function getUserBusinessIds(userId: number): Promise<number[]> {
  const db = getDb();
  const junctions = await db.select({ businessId: userBusinesses.businessId }).from(userBusinesses)
    .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true)));
  return junctions.map(j => j.businessId);
}
