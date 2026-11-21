// ABOUTME: Superadmin management of the FinaBill controllers allowed to drive this FinaFlow instance.
// ABOUTME: Issues and rotates one-time `fic_` keys while persisting only their hashes.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { instanceControllers, auditLog } from "@db/schema";
import { createRouter, adminProcedure } from "./middleware";
import { getDb } from "./queries/connection";
import {
  generateInstanceKey,
  hashInstanceKey,
  instanceKeyPrefix,
} from "./lib/instance-auth";

// The only scopes a FinaBill controller may hold. Kept in step with
// INSTANCE_SCOPES in api/lib/instance-auth.ts.
const instanceScopeSchema = z.enum(["instance:read", "instance:manage"]);
const scopesSchema = z.array(instanceScopeSchema).min(1).max(2);

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type ControllerRow = typeof instanceControllers.$inferSelect;

function fail(
  message: string,
  code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message });
}

function normalizeScopes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((scope): scope is string => typeof scope === "string")
    : [];
}

/** Everything the dashboard may see. The key hash never leaves the database. */
function publicController(row: ControllerRow) {
  return {
    id: row.id,
    name: row.name,
    controllerId: row.controllerId,
    keyPrefix: row.keyPrefix,
    scopes: normalizeScopes(row.scopes),
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

function auditValues(row: ControllerRow) {
  return {
    name: row.name,
    controllerId: row.controllerId,
    keyPrefix: row.keyPrefix,
    scopes: normalizeScopes(row.scopes),
    isActive: row.isActive,
  };
}

async function audit(
  tx: Tx,
  actor: number,
  recordId: number,
  action: "CREATE" | "UPDATE" | "DELETE",
  before: unknown,
  after: unknown
) {
  await tx.insert(auditLog).values({
    tableName: "instance_controller",
    recordId,
    action,
    changedBy: actor,
    oldValues: before,
    newValues: after,
  });
}

async function lockedController(tx: Tx, id: number) {
  const [row] = await tx
    .select()
    .from(instanceControllers)
    .where(
      and(eq(instanceControllers.id, id), isNull(instanceControllers.deletedAt))
    )
    .for("update");
  if (!row) return fail("Controller not found", "NOT_FOUND");
  return row;
}

async function newKey() {
  const rawKey = generateInstanceKey();
  return {
    rawKey,
    keyHash: await hashInstanceKey(rawKey),
    keyPrefix: instanceKeyPrefix(rawKey),
  };
}

export const adminControllersRouter = createRouter({
  list: adminProcedure.query(async () => {
    const rows = await getDb()
      .select()
      .from(instanceControllers)
      .where(isNull(instanceControllers.deletedAt))
      .orderBy(
        desc(instanceControllers.createdAt),
        desc(instanceControllers.id)
      );
    return rows.map(publicController);
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        controllerId: z.string().trim().min(1).max(100),
        scopes: scopesSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const key = await newKey();
      try {
        return await getDb().transaction(async tx => {
          const [duplicate] = await tx
            .select({
              id: instanceControllers.id,
              isActive: instanceControllers.isActive,
            })
            .from(instanceControllers)
            .where(
              and(
                eq(instanceControllers.controllerId, input.controllerId),
                isNull(instanceControllers.deletedAt)
              )
            )
            .limit(1)
            .for("update");
          if (duplicate)
            fail(
              duplicate.isActive
                ? "An active controller already uses this controller ID"
                : "A revoked controller already uses this controller ID; delete it before adding a new one",
              "CONFLICT"
            );

          const [row] = await tx
            .insert(instanceControllers)
            .values({
              name: input.name,
              controllerId: input.controllerId,
              keyHash: key.keyHash,
              keyPrefix: key.keyPrefix,
              scopes: input.scopes,
              createdByUserId: ctx.user!.id,
            })
            .returning();
          await audit(
            tx,
            ctx.user!.id,
            row.id,
            "CREATE",
            null,
            auditValues(row)
          );
          return { controller: publicController(row), key: key.rawKey };
        });
      } catch (error) {
        // Two concurrent creates can both pass the pre-check; the unique index
        // on live controller IDs is the real guard.
        if ((error as { code?: string }).code === "23505")
          return fail(
            "A controller with this controller ID already exists",
            "CONFLICT"
          );
        throw error;
      }
    }),

  rotate: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const key = await newKey();
      return getDb().transaction(async tx => {
        const existing = await lockedController(tx, input.id);
        const [row] = await tx
          .update(instanceControllers)
          .set({ keyHash: key.keyHash, keyPrefix: key.keyPrefix })
          .where(eq(instanceControllers.id, existing.id))
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          row.id,
          "UPDATE",
          auditValues(existing),
          auditValues(row)
        );
        return { controller: publicController(row), key: key.rawKey };
      });
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return getDb().transaction(async tx => {
        const existing = await lockedController(tx, input.id);
        if (!existing.isActive)
          return { controller: publicController(existing) };
        const [row] = await tx
          .update(instanceControllers)
          .set({ isActive: false })
          .where(eq(instanceControllers.id, existing.id))
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          row.id,
          "UPDATE",
          auditValues(existing),
          auditValues(row)
        );
        return { controller: publicController(row) };
      });
    }),

  update: adminProcedure
    .input(
      z
        .object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(120).optional(),
          scopes: scopesSchema.optional(),
          isActive: z.boolean().optional(),
        })
        .refine(
          input =>
            input.name !== undefined ||
            input.scopes !== undefined ||
            input.isActive !== undefined,
          { message: "Provide at least one field to update" }
        )
    )
    .mutation(async ({ input, ctx }) => {
      return getDb().transaction(async tx => {
        const existing = await lockedController(tx, input.id);
        const [row] = await tx
          .update(instanceControllers)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          })
          .where(eq(instanceControllers.id, existing.id))
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          row.id,
          "UPDATE",
          auditValues(existing),
          auditValues(row)
        );
        return { controller: publicController(row) };
      });
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return getDb().transaction(async tx => {
        const existing = await lockedController(tx, input.id);
        const [row] = await tx
          .update(instanceControllers)
          .set({ isActive: false, deletedAt: new Date() })
          .where(eq(instanceControllers.id, existing.id))
          .returning();
        await audit(
          tx,
          ctx.user!.id,
          row.id,
          "DELETE",
          auditValues(existing),
          auditValues(row)
        );
        return { success: true as const, id: row.id };
      });
    }),
});
