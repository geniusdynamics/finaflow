import { z } from "zod";
import { createRouter, authedQuery, userManage, PERMISSIONS, loadRolePermissionsFromDb, invalidateRolePermissionCache } from "./middleware";
import { getDb } from "./queries/connection";
import { users, rolePermissions, userBusinesses } from "@db/schema";
import { eq, isNull } from "drizzle-orm";

const HARD_DEFAULTS: Record<string, string[]> = {
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

export const permissionsRouter = createRouter({
  // List all users
  listUsers: authedQuery.query(async () => {
    const db = getDb();
    const userRows = await db.select({
      id: users.id, name: users.name, email: users.email, username: users.username,
      role: users.role, phone: users.phone, locationId: users.locationId,
      isActive: users.isActive, createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
    }).from(users).where(isNull(users.deletedAt)).orderBy(users.name);

    // Fetch business assignments for all users
    const allJunctions = await db.select().from(userBusinesses).where(eq(userBusinesses.isActive, true));
    const userBizMap: Record<number, number[]> = {};
    for (const j of allJunctions) {
      if (!userBizMap[j.userId]) userBizMap[j.userId] = [];
      userBizMap[j.userId].push(j.businessId);
    }

    return userRows.map(u => ({ ...u, businessIds: userBizMap[u.id] || [] }));
  }),

  updateUserRole: userManage
    .input(z.object({
      userId: z.number(),
      role: z.enum(["owner", "admin", "manager", "employee", "viewer"]),
      locationId: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { userId, ...updates } = input;
      await db.update(users).set(updates).where(eq(users.id, userId));
      return { success: true };
    }),

  // Role permission templates
  listRoleTemplates: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(rolePermissions).where(eq(rolePermissions.isActive, true));
  }),

  getRoleMatrix: authedQuery.query(async () => {
    const db = getDb();
    await loadRolePermissionsFromDb();
    const rows = await db.select().from(rolePermissions).where(eq(rolePermissions.isActive, true));
    const dbOverrides: Record<string, string[]> = {};
    for (const row of rows) {
      try {
        const perms = Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions as string || "[]");
        dbOverrides[row.roleKey] = perms.filter((p: string) => Object.values(PERMISSIONS).includes(p));
      } catch {
        dbOverrides[row.roleKey] = [];
      }
    }
    const allRoles = ["owner", "admin", "manager", "employee", "viewer"];
    const matrix: Record<string, string[]> = {};
    for (const role of allRoles) {
      matrix[role] = dbOverrides[role] ?? (HARD_DEFAULTS[role] || []);
    }
    return { matrix, permissions: Object.values(PERMISSIONS), roles: allRoles };
  }),

  createRoleTemplate: userManage
    .input(z.object({
      roleKey: z.string().min(1).max(50),
      roleLabel: z.string().min(1).max(100),
      permissions: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      // Upsert: if roleKey exists, update; else insert
      const existing = await db.select().from(rolePermissions).where(eq(rolePermissions.roleKey, input.roleKey)).limit(1);
      if (existing.length > 0) {
        await db.update(rolePermissions).set({
          permissions: input.permissions as any,
          isActive: true,
        }).where(eq(rolePermissions.id, existing[0].id));
        invalidateRolePermissionCache();
        return { id: existing[0].id, updated: true };
      }
      const [result] = await db.insert(rolePermissions).values({
        roleKey: input.roleKey, roleLabel: input.roleLabel,
        permissions: input.permissions as any,
      }).returning();
      invalidateRolePermissionCache();
      return { id: result.id, success: true };
    }),

  updateRoleTemplate: userManage
    .input(z.object({
      id: z.number(),
      roleLabel: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      if (updates.permissions) updates.permissions = updates.permissions as any;
      await db.update(rolePermissions).set(updates).where(eq(rolePermissions.id, id));
      invalidateRolePermissionCache();
      return { success: true };
    }),

  // Permission definitions for frontend
  definitions: authedQuery.query(async () => {
    return {
      permissions: Object.entries(PERMISSIONS).map(([key, value]) => ({
        key, value, label: key.toLowerCase().replace(/_/g, " "),
      })),
      defaultRoles: [
        { role: "owner", label: "Owner", description: "Full access to everything" },
        { role: "admin", label: "Admin", description: "Full access except critical settings" },
        { role: "manager", label: "Manager", description: "Sales, expenses, bills, suppliers, payroll, reports" },
        { role: "employee", label: "Employee", description: "Can add sales and expenses, view bills" },
        { role: "viewer", label: "Viewer", description: "Read-only access to all data" },
      ],
    };
  }),
});
