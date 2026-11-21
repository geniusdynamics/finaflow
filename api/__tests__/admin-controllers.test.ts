// ABOUTME: Exercises the superadmin FinaBill controller register end to end.
// ABOUTME: Pins one-time key exposure, hashing, rotation, revocation and superadmin gating.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { auditLog, instanceControllers, users } from "@db/schema";
import { appRouter } from "../router";
import { adminControllersRouter } from "../admin-controllers-router";
import {
  hashInstanceKey,
  instanceKeyPrefix,
  resolveInstanceKeyMiddleware,
  type InstanceVariables,
} from "../lib/instance-auth";

type CallerContext = {
  req: Request;
  resHeaders: Headers;
  user?: typeof users.$inferSelect;
};

function context(user?: typeof users.$inferSelect): CallerContext {
  return {
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
    user,
  };
}

const fixtureId = `CTRL-${Date.now()}`;
const controllerIds: string[] = [];
let admin: typeof users.$inferSelect;
let owner: typeof users.$inferSelect;

function nextControllerId(label: string) {
  const id = `${fixtureId}-${label}`;
  controllerIds.push(id);
  return id;
}

beforeAll(async () => {
  const db = getDb();
  [admin] = await db
    .insert(users)
    .values({
      username: `${fixtureId}-admin`,
      accountId: process.env.SUPER_ADMIN_ACCOUNT,
      role: "owner",
    })
    .returning();
  [owner] = await db
    .insert(users)
    .values({
      username: `${fixtureId}-owner`,
      accountId: fixtureId,
      role: "owner",
    })
    .returning();
});

afterAll(async () => {
  if (!admin || !owner) return;
  const db = getDb();
  await db
    .delete(auditLog)
    .where(
      and(
        eq(auditLog.tableName, "instance_controller"),
        inArray(auditLog.changedBy, [admin.id, owner.id])
      )
    );
  if (controllerIds.length > 0)
    await db
      .delete(instanceControllers)
      .where(inArray(instanceControllers.controllerId, controllerIds));
  await db.delete(users).where(inArray(users.id, [admin.id, owner.id]));
});

async function storedRow(id: number) {
  const [row] = await getDb()
    .select()
    .from(instanceControllers)
    .where(eq(instanceControllers.id, id));
  return row;
}

/** Drives the real FinaBill authentication middleware for a key/controller pair. */
const authApp = new Hono<{ Variables: InstanceVariables }>();
authApp.get("/probe", resolveInstanceKeyMiddleware(), c =>
  c.json({ ok: true })
);

async function authStatus(key: string, controllerId: string) {
  const response = await authApp.request("/probe", {
    headers: {
      authorization: `Bearer ${key}`,
      "x-fina-controller-id": controllerId,
    },
  });
  return response.status;
}

describe("admin FinaBill controllers", () => {
  it("returns a fic_ key once and never exposes the hash in the register", async () => {
    const adminCaller = adminControllersRouter.createCaller(context(admin));
    const controllerId = nextControllerId("create");

    const created = await adminCaller.create({
      name: "FinaBill platform",
      controllerId,
      scopes: ["instance:read", "instance:manage"],
    });

    expect(created.key).toMatch(/^fic_/);
    expect(created.controller).toMatchObject({
      name: "FinaBill platform",
      controllerId,
      scopes: ["instance:read", "instance:manage"],
      isActive: true,
    });
    expect(created.controller.keyPrefix).toBe(instanceKeyPrefix(created.key));
    expect("key" in created.controller).toBe(false);
    expect("keyHash" in created.controller).toBe(false);

    const listed = await adminCaller.list();
    const row = listed.find(item => item.id === created.controller.id);
    expect(row).toBeTruthy();
    expect("key" in row!).toBe(false);
    expect("keyHash" in row!).toBe(false);
    expect(row!.keyPrefix).toBe(created.controller.keyPrefix);

    const stored = await storedRow(created.controller.id);
    expect(stored.keyHash).not.toBe(created.key);
    expect(stored.keyHash).toBe(await hashInstanceKey(created.key));
    expect(stored.keyPrefix).toBe(created.controller.keyPrefix);
    expect(await authStatus(created.key, controllerId)).toBe(200);
    // The controller header must match the key's stored controller ID.
    expect(await authStatus(created.key, "SOMEONE-ELSE")).toBe(401);
  });

  it("rejects a duplicate controller ID until the old row is deleted", async () => {
    const adminCaller = adminControllersRouter.createCaller(context(admin));
    const controllerId = nextControllerId("duplicate");

    const first = await adminCaller.create({
      name: "First controller",
      controllerId,
      scopes: ["instance:read"],
    });

    await expect(
      adminCaller.create({
        name: "Duplicate controller",
        controllerId,
        scopes: ["instance:read"],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // A revoked row still owns the controller ID (unique index on live rows).
    await adminCaller.revoke({ id: first.controller.id });
    await expect(
      adminCaller.create({
        name: "Replacement controller",
        controllerId,
        scopes: ["instance:read"],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await adminCaller.remove({ id: first.controller.id });
    const replacement = await adminCaller.create({
      name: "Replacement controller",
      controllerId,
      scopes: ["instance:read"],
    });
    expect(replacement.controller.id).not.toBe(first.controller.id);
    expect(replacement.controller.isActive).toBe(true);
  });

  it("rotates the key and invalidates the previous one", async () => {
    const adminCaller = adminControllersRouter.createCaller(context(admin));
    const controllerId = nextControllerId("rotate");

    const created = await adminCaller.create({
      name: "Rotating controller",
      controllerId,
      scopes: ["instance:manage"],
    });
    const before = await storedRow(created.controller.id);

    const rotated = await adminCaller.rotate({ id: created.controller.id });
    expect(rotated.key).toMatch(/^fic_/);
    expect(rotated.key).not.toBe(created.key);
    expect(rotated.controller.keyPrefix).toBe(instanceKeyPrefix(rotated.key));

    const after = await storedRow(created.controller.id);
    expect(after.keyHash).not.toBe(before.keyHash);
    expect(after.keyPrefix).toBe(rotated.controller.keyPrefix);
    // The old key no longer resolves through the auth lookup.
    expect(await hashInstanceKey(created.key)).not.toBe(after.keyHash);
    expect(await hashInstanceKey(rotated.key)).toBe(after.keyHash);
    expect(await authStatus(created.key, controllerId)).toBe(401);
    expect(await authStatus(rotated.key, controllerId)).toBe(200);
  });

  it("revokes and removes a controller while keeping its audit trail", async () => {
    const adminCaller = adminControllersRouter.createCaller(context(admin));
    const controllerId = nextControllerId("revoke");

    const created = await adminCaller.create({
      name: "Revocable controller",
      controllerId,
      scopes: ["instance:read"],
    });

    const revoked = await adminCaller.revoke({ id: created.controller.id });
    expect(revoked.controller.isActive).toBe(false);
    expect((await storedRow(created.controller.id)).isActive).toBe(false);
    expect(await authStatus(created.key, controllerId)).toBe(401);

    await adminCaller.remove({ id: created.controller.id });
    const listed = await adminCaller.list();
    expect(listed.some(item => item.id === created.controller.id)).toBe(false);

    const auditRows = await getDb()
      .select({ action: auditLog.action, newValues: auditLog.newValues })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tableName, "instance_controller"),
          eq(auditLog.recordId, created.controller.id)
        )
      );
    expect(auditRows.map(row => row.action)).toEqual(
      expect.arrayContaining(["CREATE", "UPDATE", "DELETE"])
    );
    for (const row of auditRows)
      expect(row.newValues).not.toHaveProperty("keyHash");
  });

  it("requires authentication and a superadmin account", async () => {
    const anonymous = adminControllersRouter.createCaller(context());
    await expect(anonymous.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const ownerCaller = appRouter.createCaller(context(owner));
    await expect(ownerCaller.admin.controllers.list()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("validates scopes and allows renaming", async () => {
    const adminCaller = adminControllersRouter.createCaller(context(admin));
    const controllerId = nextControllerId("update");

    await expect(
      adminCaller.create({
        name: "Invalid scopes",
        controllerId,
        scopes: [],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const created = await adminCaller.create({
      name: "Before rename",
      controllerId: nextControllerId("update-ok"),
      scopes: ["instance:read"],
    });
    const updated = await adminCaller.update({
      id: created.controller.id,
      name: "After rename",
      scopes: ["instance:read", "instance:manage"],
    });
    expect(updated.controller.name).toBe("After rename");
    expect(updated.controller.scopes).toEqual([
      "instance:read",
      "instance:manage",
    ]);
  });
});
