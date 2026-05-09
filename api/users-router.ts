import { z } from "zod";
import { createRouter, authedQuery, userManage } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userBusinesses } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { hashPassword } from "./lib/password";

export const usersRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    return db.select({
      id: users.id, name: users.name, email: users.email, username: users.username,
      role: users.role, phone: users.phone, locationId: users.locationId,
      currentBusinessId: users.currentBusinessId, isActive: users.isActive,
      createdAt: users.createdAt, lastSignInAt: users.lastSignInAt,
    }).from(users).where(isNull(users.deletedAt)).orderBy(users.name);
  }),

  get: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
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
      if (!accountId) throw new Error("Account context required to create user");
      const existing = await db.select().from(users)
        .where(and(eq(users.username, input.username), eq(users.accountId, accountId)))
        .limit(1);
      if (existing.length > 0) throw new Error("Username already taken in this account");

      const passwordHash = await hashPassword(input.password);
      const [result] = await db.insert(users).values({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        locationId: input.locationId,
      } as any);

      return { id: Number(result.insertId), success: true };
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(users).set(updates).where(eq(users.id, id));
      return { success: true };
    }),

  delete: userManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, input.id));
      return { success: true };
    }),

  changePassword: userManage
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(4).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const newHash = await hashPassword(input.newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
