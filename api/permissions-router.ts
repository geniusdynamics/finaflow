import { z } from "zod";
import { createRouter, authedQuery, userManage, getAuthorizedLocationIds, PERMISSIONS, loadRolePermissionsFromDb, invalidateRolePermissionCache, type Permission } from "./middleware";
import { getDb } from "./queries/connection";
import { users, rolePermissions, userBusinesses, userLocations, businesses, auditLog } from "@db/schema";
import { eq, and, isNull, sql, inArray, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logAudit, logCrossAccountAccess } from "./lib/audit";
import { syncUserLocationAssignments } from "./users-router";

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
  listUsers: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const accountId = ctx.user?.accountId;
    if (!accountId) return [];

    const userRows = await db.select({
      id: users.id, name: users.name, email: users.email, username: users.username,
      role: users.role, phone: users.phone, locationId: users.locationId,
      isActive: users.isActive, createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
    }).from(users).where(and(isNull(users.deletedAt), eq(users.accountId, accountId))).orderBy(users.name);

    if (userRows.length === 0) return [];
    const userIds = userRows.map(u => u.id);

    // Fetch business assignments scoped to this account's businesses
    const accountBizIds = (await db.select({ id: businesses.id }).from(businesses)
      .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)))).map(b => b.id);

    let allJunctions: Array<{ userId: number; businessId: number; role: string | null }> = [];
    if (accountBizIds.length > 0) {
      allJunctions = await db.select({ userId: userBusinesses.userId, businessId: userBusinesses.businessId, role: userBusinesses.role })
        .from(userBusinesses)
        .where(and(
          eq(userBusinesses.isActive, true),
          sql`${userBusinesses.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${userBusinesses.businessId} IN (${sql.join(accountBizIds.map(id => sql`${id}`), sql`, `)})`,
        ));
    }

    let locationRows: Array<{ userId: number; locationId: number }> = [];
    try {
      locationRows = await db.select({
        userId: userLocations.userId,
        locationId: userLocations.locationId,
      }).from(userLocations)
        .where(and(eq(userLocations.isActive, true), inArray(userLocations.userId, userIds)));
    } catch (e) {
      console.warn("[permissions] listUsers: failed to load user locations:", (e as Error).message);
    }

    const userBizMap: Record<number, number[]> = {};
    const userBizRoleMap: Record<number, Record<number, string>> = {};
    for (const j of allJunctions) {
      if (!userBizMap[j.userId]) userBizMap[j.userId] = [];
      userBizMap[j.userId].push(j.businessId);
      if (!userBizRoleMap[j.userId]) userBizRoleMap[j.userId] = {};
      if (j.role) userBizRoleMap[j.userId][j.businessId] = j.role;
    }

    const userLocationMap: Record<number, number[]> = {};
    for (const row of locationRows) {
      if (!userLocationMap[row.userId]) userLocationMap[row.userId] = [];
      userLocationMap[row.userId].push(row.locationId);
    }

    return userRows.map(u => ({
      ...u,
      businessIds: userBizMap[u.id] || [],
      businessRoles: userBizRoleMap[u.id] || {},
      // Only real user_locations rows; the legacy single-location value is
      // exposed separately so the frontend can synthesize a pre-check without
      // falsely implying junction rows exist.
      locationIds: userLocationMap[u.id] || [],
      legacyLocationId: u.locationId ?? null,
    }));
  }),

  updateUserRole: userManage
    .input(z.object({
      userId: z.number(),
      role: z.enum(["owner", "admin", "manager", "employee", "viewer"]),
      locationId: z.number().optional(),
      locationIds: z.array(z.number()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      
      if (!accountId) throw new Error("Account context required");
      
      const { userId, locationIds, ...updates } = input;
      
      const targetUser = await db.select({ 
        id: users.id, 
        accountId: users.accountId, 
        role: users.role, 
        locationId: users.locationId,
        username: users.username,
      })
        .from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
        
      if (!targetUser[0] || targetUser[0].accountId !== accountId) {
        await logCrossAccountAccess({
          userId: ctx.user!.id,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: userId,
          targetAccountId: targetUser[0]?.accountId ?? undefined,
          action: "updateUserRole",
          reason: "Cross-account user role update attempt blocked",
        });
        throw new Error("User not found in this account");
      }
      
      // Track what changed for audit logging
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      
      await db.transaction(async (tx) => {
        // Handle role change - synchronize with userBusinesses
        if (updates.role && updates.role !== targetUser[0].role) {
          changes.role = { from: targetUser[0].role, to: updates.role };
          
          // Update role in userBusinesses junction table for all active business assignments
          await tx.update(userBusinesses)
            .set({ role: updates.role })
            .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.isActive, true)));
        }
        
        // Handle locationId change (legacy single location)
        if (updates.locationId !== undefined && updates.locationId !== targetUser[0].locationId) {
          changes.locationId = { from: targetUser[0].locationId, to: updates.locationId };
        }
        
        // Handle isActive change
        if (updates.isActive !== undefined && updates.isActive !== undefined) {
          const currentIsActive = targetUser[0].role ? true : undefined;
          if (currentIsActive !== undefined && currentIsActive !== updates.isActive) {
            changes.isActive = { from: currentIsActive, to: updates.isActive };
          }
        }
        
        // Update users table
        await tx.update(users).set(updates).where(eq(users.id, userId));
      });
      
      // Handle multi-location assignment updates
      if (locationIds !== undefined) {
        // Authorization: validate every supplied location is in the caller's
        // authorized set. Without this, a users:manage holder could assign a
        // user to branches outside their own access (matching setUserLocations).
        const authorizedIds = await getAuthorizedLocationIds(ctx);
        if (locationIds.length > 0) {
          const authorizedSet = new Set(authorizedIds);
          const unauthorized = locationIds.filter(id => !authorizedSet.has(id));
          if (unauthorized.length > 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Unauthorized location(s): ${unauthorized.join(", ")}`,
            });
          }
        }

        // syncUserLocationAssignments is the single source of truth: it deletes
        // stale rows, inserts the new set, marks the first as primary, and
        // updates the legacy users.locationId column. Its empty-array guard
        // prevents wiping existing assignments when the caller sends `[]`.
        await db.transaction(async (tx) => {
          if (locationIds.length > 0) {
            await syncUserLocationAssignments(tx, userId, locationIds, currentUserId);
          } else {
            // Empty array is an explicit request to clear assignments. The sync
            // guard skips clearing, so handle it directly here.
            await tx.update(userLocations)
              .set({ isActive: false })
              .where(eq(userLocations.userId, userId));
            await tx.update(users)
              .set({ locationId: null })
              .where(eq(users.id, userId));
          }
        });
      }
      
      // Log audit event for role/permission changes
      if (Object.keys(changes).length > 0) {
        await logAudit({
          userId: currentUserId,
          action: "UPDATE",
          resource: "users",
          resourceId: userId,
          details: { 
            targetUsername: targetUser[0].username,
            changes,
            updatedBy: currentUserId,
            businessId: currentBusinessId,
          },
        });
      }
      
      return { success: true };
    }),

  /**
   * Return the user's role for a specific business. The business section's
   * role selector calls this to keep its dropdown value in sync with the
   * backend without re-fetching the full user list.
   */
  getUserBusinessRole: authedQuery
    .input(z.object({ userId: z.number(), businessId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select({ role: userBusinesses.role })
        .from(userBusinesses)
        .where(and(
          eq(userBusinesses.userId, input.userId),
          eq(userBusinesses.businessId, input.businessId),
          eq(userBusinesses.isActive, true),
        ))
        .limit(1);
      return { userId: input.userId, businessId: input.businessId, role: row?.role ?? null };
    }),

  /**
   * Update a user's role within a specific business. The audit log captures
   * the before/after with a timestamp.
   */
  updateUserBusinessRole: userManage
    .input(z.object({
      userId: z.number(),
      businessId: z.number(),
      role: z.enum(["owner", "admin", "manager", "employee", "viewer"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const operatorId = ctx.user!.id;
      const { userId, businessId, role } = input;

      const [existing] = await db.select({ role: userBusinesses.role })
        .from(userBusinesses)
        .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.businessId, businessId)))
        .limit(1);

      const previousRole = existing?.role ?? null;
      const timestamp = new Date().toISOString();

      await db.transaction(async (tx) => {
        if (existing) {
          await tx.update(userBusinesses)
            .set({ role, isActive: true })
            .where(and(eq(userBusinesses.userId, userId), eq(userBusinesses.businessId, businessId)));
        } else {
          await tx.insert(userBusinesses).values({
            userId, businessId, role, isActive: true,
          } as typeof userBusinesses.$inferInsert);
        }

        // Cascade to users.role so the Team tab stays in sync with
        // the per-business role change.
        await tx.update(users)
          .set({ role })
          .where(eq(users.id, userId));

        await logAudit({
          userId: operatorId,
          action: "UPDATE",
          resource: "user_businesses",
          resourceId: userId,
          details: {
            reason: "per_business_role_update",
            targetUserId: userId,
            businessId,
            previousRole,
            nextRole: role,
            timestamp,
            operatorId,
          },
        });
      });
      return { success: true, userId, businessId, role, previousRole, syncedAt: timestamp };
    }),

  /**
   * Verify that the global `users.role` and every active per-business
   * `user_businesses.role` are consistent for the given user.
   */
  verifyRoleSync: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select({ id: users.id, role: users.role, currentBusinessId: users.currentBusinessId })
        .from(users)
        .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
        .limit(1);
      if (!user) {
        return { userId: input.userId, inSync: true, mismatches: [], checkedAt: new Date().toISOString() };
      }
      const memberships = await db.select({
        businessId: userBusinesses.businessId,
        role: userBusinesses.role,
      })
        .from(userBusinesses)
        .where(and(eq(userBusinesses.userId, input.userId), eq(userBusinesses.isActive, true)));
      const mismatches: Array<{ businessId: number; userBusinessRole: string; usersRole: string }> = [];
      for (const m of memberships) {
        if (m.businessId === user.currentBusinessId && m.role !== user.role) {
          mismatches.push({
            businessId: m.businessId,
            userBusinessRole: m.role ?? "unknown",
            usersRole: user.role,
          });
        }
      }
      return {
        userId: input.userId,
        inSync: mismatches.length === 0,
        mismatches,
        checkedAt: new Date().toISOString(),
      };
    }),

  /**
   * Return timestamped audit-log entries for a user's role changes.
   */
  getRoleChangeLog: authedQuery
    .input(z.object({
      userId: z.number(),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select({
        id: auditLog.id,
        action: auditLog.action,
        resource: auditLog.tableName,
        resourceId: auditLog.recordId,
        newValues: auditLog.newValues,
        createdAt: auditLog.createdAt,
        changedBy: auditLog.changedBy,
      })
        .from(auditLog)
        .where(and(
          eq(auditLog.recordId, input.userId),
          sql`${auditLog.tableName} IN ('users', 'user_businesses')`,
        ))
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);
      return rows
        .map((row) => {
          let payload: Record<string, unknown> | null = null;
          const raw = row.newValues as unknown;
          if (typeof raw === "string") {
            try { payload = JSON.parse(raw); } catch { payload = null; }
          } else if (raw && typeof raw === "object") {
            payload = raw as Record<string, unknown>;
          }
          if (!payload) return null;
          const reason = typeof payload.reason === "string" ? payload.reason : "";
          const isRoleChange = reason === "per_business_role_update"
            || (typeof payload.nextRole === "string" && typeof payload.previousRole !== "undefined")
            || reason === "manual_role_update"
            || reason === "user_role_update";
          if (!isRoleChange) return null;
          return {
            id: row.id,
            userId: input.userId,
            businessId: typeof payload.businessId === "number" ? payload.businessId : null,
            previousRole: typeof payload.previousRole === "string" ? payload.previousRole : null,
            nextRole: typeof payload.nextRole === "string" ? payload.nextRole : null,
            changedBy: row.changedBy,
            timestamp: typeof payload.timestamp === "string" ? payload.timestamp : row.createdAt.toISOString(),
            reason,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
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
        dbOverrides[row.roleKey] = perms.filter((p: string): p is Permission => Object.values(PERMISSIONS).includes(p as Permission));
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
