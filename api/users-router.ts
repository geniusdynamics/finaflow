import { z } from "zod";
import { createRouter, authedQuery, userManage } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBusinesses } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { hashPassword } from "./lib/password";
import { logCrossAccountAccess } from "./lib/audit";

type CreateUserInput = {
  username: string;
  name: string;
  role: "owner" | "admin" | "manager" | "employee" | "viewer";
  email?: string;
  phone?: string;
  locationId?: number;
};

export function buildCreateUserValues(
  input: CreateUserInput,
  accountId: string,
  currentBusinessId: number | null,
  passwordHash: string
) {
  return {
    username: input.username,
    passwordHash,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    locationId: input.locationId,
    accountId,
    currentBusinessId,
  };
}

export const usersRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const accountId = ctx.user?.accountId;
    if (!accountId) return [];
    return db.select({
      id: users.id, name: users.name, email: users.email, username: users.username,
      role: users.role, phone: users.phone, locationId: users.locationId,
      currentBusinessId: users.currentBusinessId, isActive: users.isActive,
      createdAt: users.createdAt, lastSignInAt: users.lastSignInAt,
    }).from(users).where(and(isNull(users.deletedAt), eq(users.accountId, accountId))).orderBy(users.name);
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      if (!accountId) return null;
      const rows = await db.select().from(users)
        .where(and(eq(users.id, input.id), eq(users.accountId, accountId)))
        .limit(1);
      return rows[0] ?? null;
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
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.currentBusiness?.accountId || null;
      const currentBusinessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null;
      if (!accountId) throw new Error("Account context required to create user");
      const existing = await db.select().from(users)
        .where(and(eq(users.username, input.username), eq(users.accountId, accountId)))
        .limit(1);
      if (existing.length > 0) throw new Error("Username already taken in this account");

      const passwordHash = await hashPassword(input.password);
      const values = buildCreateUserValues(input, accountId, currentBusinessId, passwordHash);
      const [result] = await db.transaction(async (tx) => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [createdUser] = await tx.insert(users).values(values as any).returning();
        if (currentBusinessId) {
          await tx.insert(userBusinesses).values({
            userId: createdUser.id,
            businessId: currentBusinessId,
            role: input.role,
            isActive: true,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }
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
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      if (!accountId) throw new Error("Account context required");
      const { id, ...updates } = input;
      const targetUser = await db.select({ id: users.id, accountId: users.accountId })
        .from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
      if (!targetUser[0] || targetUser[0].accountId !== accountId) {
        await logCrossAccountAccess({
          userId: ctx.user!.id,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: id,
          targetAccountId: targetUser[0]?.accountId ?? undefined,
          action: "update",
          reason: "Cross-account user update attempt blocked",
        });
        throw new Error("User not found in this account");
      }
      await db.update(users).set(updates).where(eq(users.id, id));
      return { success: true };
    }),

  delete: userManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const accountId = ctx.user?.accountId;
      if (!accountId) throw new Error("Account context required");
      const targetUser = await db.select({ id: users.id, accountId: users.accountId })
        .from(users).where(and(eq(users.id, input.id), isNull(users.deletedAt))).limit(1);
      if (!targetUser[0] || targetUser[0].accountId !== accountId) {
        await logCrossAccountAccess({
          userId: ctx.user!.id,
          userAccountId: accountId,
          targetResourceType: "users",
          targetId: input.id,
          targetAccountId: targetUser[0]?.accountId ?? undefined,
          action: "delete",
          reason: "Cross-account user delete attempt blocked",
        });
        throw new Error("User not found in this account");
      }
      await db.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, input.id));
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
      return { success: true };
    }),
});
