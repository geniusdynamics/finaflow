// ABOUTME: Manages user lifecycle operations inside an account and active business.
// ABOUTME: Includes safe deletion checks, disable/enable flows, and location assignment syncing.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, authedQuery, userManage, requireAuthorizedLocation } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBusinesses, userLocations } from "@db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { hashPassword } from "./lib/password";
import { logAudit, logCrossAccountAccess } from "./lib/audit";
import { findLinkedRecordsForUser, formatLinkedRecordsMessage } from "./lib/user-references";

type CreateUserInput = {
  username: string;
  name: string;
  role: "owner" | "admin" | "manager" | "employee" | "viewer";
  email?: string;
  phone?: string;
  locationId?: number;
  locationIds?: number[];
};

export function buildCreateUserValues(
  input: CreateUserInput,
  accountId: string,
  currentBusinessId: number | null,
  passwordHash: string
) {
  const primaryLocationId = input.locationId ?? (input.locationIds && input.locationIds.length > 0 ? input.locationIds[0] : undefined);

  return {
    username: input.username,
    passwordHash,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    locationId: primaryLocationId,
    accountId,
    currentBusinessId,
  };
}

async function getTargetUserInAccount(accountId: string, userId: number) {
  const db = getDb();
  const rows = await db.select({
    id: users.id,
    accountId: users.accountId,
    name: users.name,
    role: users.role,
    locationId: users.locationId,
    username: users.username,
    isActive: users.isActive,
    deletedAt: users.deletedAt,
  }).from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user || user.accountId !== accountId) {
    return null;
  }
  return user;
}

export async function getUserLocationIds(userId: number): Promise<number[]> {
  try {
    const db = getDb();
    const rows = await db.select({ locationId: userLocations.locationId }).from(userLocations)
      .where(and(eq(userLocations.userId, userId), eq(userLocations.isActive, true)));
    return rows.map((row) => row.locationId);
  } catch (e) {
    console.warn("[users] getUserLocationIds failed:", (e as Error).message);
    return [];
  }
}

export async function syncUserLocationAssignments(
  tx: Pick<ReturnType<typeof getDb>, "delete" | "insert" | "update">,
  userId: number,
  locationIds: number[],
  assignedBy?: number | null,
) {
  // Guard: If no valid location IDs provided, skip sync entirely to prevent
  // accidental deletion of all existing user-location assignments.
  const validIds = locationIds.filter((value): value is number => Number.isFinite(value));
  if (validIds.length === 0) {
    console.warn("[users] syncUserLocationAssignments: called with empty or invalid locationIds array — skipping sync");
    return [];
  }

  const uniqueLocationIds = Array.from(new Set(validIds));

  try {
    await tx.delete(userLocations).where(eq(userLocations.userId, userId));
  } catch {
    // Table may not exist yet (migration not applied). Safe to skip.
  }

  await tx.insert(userLocations).values(uniqueLocationIds.map((locationId, index) => ({
    userId,
    locationId,
    isPrimary: index === 0,
    isActive: true,
    assignedBy: assignedBy ?? null,
  })));

  await tx.update(users).set({
    locationId: uniqueLocationIds[0] ?? null,
  }).where(eq(users.id, userId));

  return uniqueLocationIds;
}

export const usersRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const accountId = ctx.user?.accountId;
    if (!accountId) return [];

    const userRows = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      role: users.role,
      phone: users.phone,
      locationId: users.locationId,
      currentBusinessId: users.currentBusinessId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
    }).from(users)
      .where(and(eq(users.accountId, accountId), isNull(users.deletedAt)))
      .orderBy(users.name);

    if (userRows.length === 0) {
      return [];
    }

    const userIds = userRows.map((user) => user.id);
    let locationRows: Array<{ userId: number; locationId: number; isPrimary: boolean | null }> = [];
    try {
      locationRows = await db.select({
        userId: userLocations.userId,
        locationId: userLocations.locationId,
        isPrimary: userLocations.isPrimary,
      }).from(userLocations)
        .where(and(eq(userLocations.isActive, true), inArray(userLocations.userId, userIds)));
    } catch (e) {
      console.warn("[users] list: failed to load user locations:", (e as Error).message);
    }

    const byUser: Record<number, number[]> = {};
    for (const row of locationRows) {
      if (!byUser[row.userId]) byUser[row.userId] = [];
      byUser[row.userId].push(row.locationId);
    }

    return userRows.map((user) => ({
      ...user,
      locationIds: byUser[user.id] ?? (user.locationId ? [user.locationId] : []),
    }));
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      if (!accountId) return null;
      const rows = await db.select().from(users)
        .where(and(eq(users.id, input.id), eq(users.accountId, accountId), isNull(users.deletedAt)))
        .limit(1);
      if (rows.length === 0) return null;

      return {
        ...rows[0],
        locationIds: await getUserLocationIds(input.id),
      };
    }),

  create: userManage
    .input(z.object({
      username: z.string().min(3).max(100),
      password: z.string().min(4).max(100),
      name: z.string().min(1).max(255),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(["owner", "admin", "manager", "employee", "viewer"]),
      locationId: z.number().optional(),
      locationIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? null;
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      const currentUserId = ctx.user?.id;
      if (!accountId) throw new Error("Account context required to create user");
      const existing = await db.select().from(users)
        .where(and(eq(users.username, input.username), eq(users.accountId, accountId)))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Username already taken in this account" });
      }

      const locationIds = input.locationIds && input.locationIds.length > 0
        ? input.locationIds
        : (input.locationId != null ? [input.locationId] : []);

      for (const locationId of locationIds) {
        await requireAuthorizedLocation(ctx, locationId);
      }

      const passwordHash = await hashPassword(input.password);
      const values = buildCreateUserValues({ ...input, locationIds }, accountId, currentBusinessId, passwordHash);

      const [result] = await db.transaction(async (tx) => {
        const [createdUser] = await tx.insert(users).values(values as typeof users.$inferInsert).returning();
        if (currentBusinessId) {
          await tx.insert(userBusinesses).values({
            userId: createdUser.id,
            businessId: currentBusinessId,
            role: input.role,
            isActive: true,
          } as typeof userBusinesses.$inferInsert);
        }

        if (locationIds.length > 0) {
          await syncUserLocationAssignments(tx, createdUser.id, locationIds, currentUserId);
        }

        await logAudit({
          userId: currentUserId ?? createdUser.id,
          action: "CREATE",
          resource: "users",
          resourceId: createdUser.id,
          details: {
            username: input.username,
            role: input.role,
            locationIds,
          },
        });

        return [createdUser];
      });

      return { id: result.id, success: true };
    }),

  update: userManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(["owner", "admin", "manager", "employee", "viewer"]).optional(),
      locationId: z.number().optional(),
      locationIds: z.array(z.number()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      if (!accountId) throw new Error("Account context required");

      const { id, locationIds, ...updates } = input;
      const targetUser = await getTargetUserInAccount(accountId, id);
      if (!targetUser) {
        await logCrossAccountAccess({
          userId: ctx.user!.id,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: id,
          targetAccountId: undefined,
          action: "update",
          reason: "Cross-account user update attempt blocked",
        });
        throw new Error("User not found in this account");
      }

      // Only handle location sync when locationIds was explicitly
      // passed. A simple role-only edit should not touch user_locations.
      const locationIdsExplicitlyPassed = "locationIds" in input;
      const nextLocationIds = locationIdsExplicitlyPassed
        ? locationIds ?? (updates.locationId != null ? [updates.locationId] : [])
        : undefined;

      if (Array.isArray(nextLocationIds) && nextLocationIds.length > 0) {
        for (const locationId of nextLocationIds) {
          await requireAuthorizedLocation(ctx, locationId);
        }
      }

      await db.transaction(async (tx) => {
        await tx.update(users).set(updates).where(eq(users.id, id));

        if (updates.role && updates.role !== targetUser.role) {
          await tx.update(userBusinesses)
            .set({ role: updates.role })
            .where(and(eq(userBusinesses.userId, id), eq(userBusinesses.isActive, true)));
        }

        if (Array.isArray(nextLocationIds)) {
          await syncUserLocationAssignments(tx, id, nextLocationIds, currentUserId);
        }
      });

      await logAudit({
        userId: currentUserId ?? id,
        action: "UPDATE",
        resource: "users",
        resourceId: id,
        details: {
          role: updates.role,
          isActive: updates.isActive,
        },
      });

      return { success: true };
    }),

  setUserLocations: userManage
    .input(z.object({
      id: z.number(),
      locationIds: z.array(z.number()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      if (!accountId) throw new Error("Account context required");

      const targetUser = await getTargetUserInAccount(accountId, input.id);
      if (!targetUser) {
        throw new Error("User not found in this account");
      }

      for (const locationId of input.locationIds) {
        await requireAuthorizedLocation(ctx, locationId);
      }

      await db.transaction(async (tx) => {
        await syncUserLocationAssignments(tx, input.id, input.locationIds, currentUserId);
      });

      await logAudit({
        userId: currentUserId ?? input.id,
        action: "UPDATE",
        resource: "users",
        resourceId: input.id,
        details: {
          locationIds: input.locationIds,
        },
      });

      return { success: true };
    }),

  getDeletionCheck: userManage
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const accountId = ctx.user?.accountId;
      if (!accountId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Account context required" });
      }

      const targetUser = await getTargetUserInAccount(accountId, input.id);
      if (!targetUser || targetUser.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this account" });
      }

      return findLinkedRecordsForUser(input.id);
    }),

  getStatusMetrics: userManage.query(async ({ ctx }) => {
    const db = getDb();
    const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
    if (!currentBusinessId) {
      return { total: 0, active: 0, disabled: 0, deleted: 0 };
    }

    const memberships = await db.select({ userId: userBusinesses.userId })
      .from(userBusinesses)
      .where(eq(userBusinesses.businessId, currentBusinessId));
    const userIds = Array.from(new Set(memberships.map((row) => row.userId)));

    if (userIds.length === 0) {
      return { total: 0, active: 0, disabled: 0, deleted: 0 };
    }

    const rows = await db.select({
      id: users.id,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    }).from(users)
      .where(inArray(users.id, userIds));

    const metrics = rows.reduce(
      (summary, row) => {
        summary.total += 1;
        if (row.deletedAt) {
          summary.deleted += 1;
        } else if (row.isActive) {
          summary.active += 1;
        } else {
          summary.disabled += 1;
        }
        return summary;
      },
      { total: 0, active: 0, disabled: 0, deleted: 0 },
    );

    return metrics;
  }),

  delete: userManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      if (!accountId || !currentUserId) throw new Error("Account context required");

      const targetUser = await db.select({
        id: users.id,
        accountId: users.accountId,
        username: users.username,
        name: users.name,
        deletedAt: users.deletedAt,
      }).from(users).where(eq(users.id, input.id)).limit(1);

      if (!targetUser[0] || targetUser[0].accountId !== accountId) {
        await logCrossAccountAccess({
          userId: currentUserId,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: input.id,
          targetAccountId: targetUser[0]?.accountId ?? undefined,
          action: "delete",
          reason: "Cross-account user delete attempt blocked",
        });
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this account" });
      }

      if (targetUser[0].deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User has already been deleted" });
      }

      if (targetUser[0].id === currentUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot delete your own account" });
      }

      const check = await findLinkedRecordsForUser(input.id);
      if (check.hasBlockingRecords) {
        const message = formatLinkedRecordsMessage(check);
        throw new TRPCError({
          code: "CONFLICT",
          message,
          cause: {
            code: "USER_DELETION_BLOCKED",
            message,
            check,
            target: {
              id: targetUser[0].id,
              name: targetUser[0].name ?? targetUser[0].username ?? `User #${targetUser[0].id}`,
            },
          },
        });
      }

      await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ deletedAt: new Date(), isActive: false })
          .where(eq(users.id, input.id));
        await tx.update(userBusinesses)
          .set({ isActive: false })
          .where(eq(userBusinesses.userId, input.id));
        await tx.update(userLocations)
          .set({ isActive: false })
          .where(eq(userLocations.userId, input.id));
      });

      await logAudit({
        userId: currentUserId,
        action: "DELETE",
        resource: "users",
        resourceId: input.id,
        details: {
          username: targetUser[0].username,
          informationalReferences: check.informationalGroups,
        },
      });

      return { success: true };
    }),

  disable: userManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      if (!accountId || !currentUserId) throw new Error("Account context required");

      const targetUser = await getTargetUserInAccount(accountId, input.id);
      if (!targetUser || targetUser.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this account" });
      }
      if (targetUser.id === currentUserId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot disable your own account" });
      }

      await db.update(users).set({ isActive: false }).where(eq(users.id, input.id));

      await logAudit({
        userId: currentUserId,
        action: "UPDATE",
        resource: "users",
        resourceId: input.id,
        details: { status: "disabled", username: targetUser.username },
      });

      return { success: true };
    }),

  enable: userManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      const currentUserId = ctx.user?.id;
      if (!accountId || !currentUserId) throw new Error("Account context required");

      const targetUser = await getTargetUserInAccount(accountId, input.id);
      if (!targetUser || targetUser.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this account" });
      }

      await db.update(users).set({ isActive: true }).where(eq(users.id, input.id));

      await logAudit({
        userId: currentUserId,
        action: "RESTORE",
        resource: "users",
        resourceId: input.id,
        details: { status: "active", username: targetUser.username },
      });

      return { success: true };
    }),

  changePassword: userManage
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(4).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      if (!accountId) throw new Error("Account context required");
      const targetUser = await db.select({ id: users.id, accountId: users.accountId })
        .from(users).where(and(eq(users.id, input.userId), isNull(users.deletedAt))).limit(1);
      if (!targetUser[0] || targetUser[0].accountId !== accountId) {
        await logCrossAccountAccess({
          userId: ctx.user!.id,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: input.userId,
          targetAccountId: targetUser[0]?.accountId ?? undefined,
          action: "changePassword",
          reason: "Cross-account password change attempt blocked",
        });
        throw new Error("User not found in this account");
      }
      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, input.userId));
      await logAudit({
        userId: ctx.user?.id ?? input.userId,
        action: "UPDATE",
        resource: "users",
        resourceId: input.userId,
        details: { passwordChanged: true },
      });
      return { success: true };
    }),
    
  getUserLocations: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const accountId = ctx.user?.accountId;
      if (!accountId) return [];

      const targetUser = await getTargetUserInAccount(accountId, input.id);
      if (!targetUser) return [];

      return getUserLocationIds(input.id);
    }),

  updateProfile: authedQuery
    .input(z.object({
      username: z.string().min(3).max(100).optional(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user!.id;
      const accountId = ctx.user!.accountId;
      if (!accountId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Account context required" });

      // If updating username, check uniqueness within the account
      if (input.username) {
        const existing = await db.query.users.findFirst({
          where: (u, { and, eq, ne, isNull }) => and(
            eq(u.username, input.username!),
            eq(u.accountId, accountId),
            ne(u.id, userId),
            isNull(u.deletedAt),
          ),
          columns: { id: true },
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Username already taken in this account" });
        }
      }

      await db.update(users).set(input).where(eq(users.id, userId));
      return { success: true };
    }),
});
