// ABOUTME: Integration tests for the machine-to-machine instance control API used by FinaBill.
// ABOUTME: Covers key scopes, controller identity, account controls, protections, and audit rows.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  auditLog,
  businesses,
  customerAccounts,
  instanceControllers,
  users,
} from "@db/schema";
import {
  generateInstanceKey,
  hashInstanceKey,
  instanceKeyPrefix,
} from "../lib/instance-auth";
import instanceRouter from "../routes/v1/instance";

const suffix = `${Date.now()}`;
const accountId = `INSTCTRL-${suffix}`;
const superAdminAccountId =
  process.env.SUPER_ADMIN_ACCOUNT || "SUPERADMIN-TEST-ACCOUNT";

type Controller = {
  rawKey: string;
  controllerId: string;
  id: number;
};

function auth(controller: Controller) {
  return {
    Authorization: `Bearer ${controller.rawKey}`,
    "X-Fina-Controller-Id": controller.controllerId,
    "Content-Type": "application/json",
  };
}

describe("v1 instance control API", () => {
  const db = getDb();
  const app = new Hono();
  let account: typeof customerAccounts.$inferSelect;
  let business: typeof businesses.$inferSelect;
  let owner: typeof users.$inferSelect;
  let employee: typeof users.$inferSelect;
  let superAccount: typeof customerAccounts.$inferSelect | undefined;
  let createdSuperAccount = false;
  let main: Controller;
  let readOnly: Controller;
  let manageOnly: Controller;
  let revoked: Controller;
  let deleted: Controller;
  const controllerIds: number[] = [];

  async function createController(input: {
    name: string;
    controllerId: string;
    scopes: string[];
    isActive?: boolean;
    deletedAt?: Date;
  }): Promise<Controller> {
    const rawKey = generateInstanceKey();
    const [row] = await db
      .insert(instanceControllers)
      .values({
        name: input.name,
        controllerId: input.controllerId,
        keyHash: await hashInstanceKey(rawKey),
        keyPrefix: instanceKeyPrefix(rawKey),
        scopes: input.scopes,
        isActive: input.isActive ?? true,
        deletedAt: input.deletedAt ?? null,
      })
      .returning();
    controllerIds.push(row.id);
    return { rawKey, controllerId: input.controllerId, id: row.id };
  }

  beforeAll(async () => {
    [account] = await db
      .insert(customerAccounts)
      .values({
        accountId,
        name: "Instance control fixture",
        plan: "pro",
      })
      .returning();

    [business] = await db
      .insert(businesses)
      .values({
        accountId,
        accountRefId: account.id,
        name: "Instance control business",
        slug: `instctrl-${suffix}`,
        plan: "pro",
      })
      .returning();

    [owner] = await db
      .insert(users)
      .values({
        username: `${accountId}-owner`,
        name: "Instance Owner",
        email: `${accountId.toLowerCase()}-owner@example.test`,
        accountId,
        accountRefId: account.id,
        role: "owner",
      })
      .returning();

    [employee] = await db
      .insert(users)
      .values({
        username: `${accountId}-employee`,
        name: "Instance Employee",
        email: `${accountId.toLowerCase()}-employee@example.test`,
        accountId,
        accountRefId: account.id,
        role: "employee",
      })
      .returning();

    const [existingSuper] = await db
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.accountId, superAdminAccountId))
      .limit(1);
    if (existingSuper) {
      superAccount = existingSuper;
    } else {
      [superAccount] = await db
        .insert(customerAccounts)
        .values({
          accountId: superAdminAccountId,
          name: "Instance control superadmin fixture",
          plan: "pro",
        })
        .returning();
      createdSuperAccount = true;
    }

    main = await createController({
      name: "Instance control maintainer",
      controllerId: `FNB-${suffix}`,
      scopes: ["instance:read", "instance:manage"],
    });
    readOnly = await createController({
      name: "Instance control reader",
      controllerId: `FNB-READ-${suffix}`,
      scopes: ["instance:read"],
    });
    manageOnly = await createController({
      name: "Instance control manager",
      controllerId: `FNB-MANAGE-${suffix}`,
      scopes: ["instance:manage"],
    });
    revoked = await createController({
      name: "Instance control revoked",
      controllerId: `FNB-REVOKED-${suffix}`,
      scopes: ["instance:read", "instance:manage"],
      isActive: false,
    });
    deleted = await createController({
      name: "Instance control deleted",
      controllerId: `FNB-DELETED-${suffix}`,
      scopes: ["instance:read", "instance:manage"],
      deletedAt: new Date(),
    });

    app.route("/instance", instanceRouter);
  });

  afterAll(async () => {
    if (!account) return;
    const recordIds = [account.id, owner?.id, employee?.id].filter(
      (id): id is number => typeof id === "number"
    );
    if (recordIds.length) {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.tableName, "instance_control"),
            inArray(auditLog.recordId, recordIds)
          )
        );
    }
    if (controllerIds.length) {
      await db
        .delete(instanceControllers)
        .where(inArray(instanceControllers.id, controllerIds));
    }
    if (business) {
      await db.delete(businesses).where(eq(businesses.id, business.id));
    }
    await db.delete(users).where(eq(users.accountId, accountId));
    await db
      .delete(customerAccounts)
      .where(eq(customerAccounts.id, account.id));
    if (createdSuperAccount && superAccount) {
      await db
        .delete(customerAccounts)
        .where(eq(customerAccounts.id, superAccount.id));
    }
  });

  it("reports health for a read-scoped controller", async () => {
    const response = await app.request("/instance/health", {
      headers: auth(main),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        product: string;
        version: string;
        accountCount: number;
        userCount: number;
        serverTime: string;
      };
    };
    expect(body.data.product).toBe("finaflow");
    expect(body.data.version).toBeTruthy();
    expect(body.data.accountCount).toBeGreaterThanOrEqual(1);
    expect(body.data.userCount).toBeGreaterThanOrEqual(2);
    expect(Number.isNaN(Date.parse(body.data.serverTime))).toBe(false);

    const [used] = await db
      .select()
      .from(instanceControllers)
      .where(eq(instanceControllers.id, main.id));
    expect(used.lastUsedAt).toBeInstanceOf(Date);
  });

  it("lists and reads accounts without exposing credentials", async () => {
    const list = await app.request(`/instance/accounts?search=${accountId}`, {
      headers: auth(main),
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      data: Array<{
        accountId: string;
        plan: string;
        businessCount: number;
        userCount: number;
        billingHoldAt: string | null;
      }>;
      meta: { pagination: { total: number } };
    };
    expect(listBody.meta.pagination.total).toBe(1);
    expect(listBody.data[0]).toMatchObject({
      accountId,
      plan: "pro",
      businessCount: 1,
      userCount: 2,
      billingHoldAt: null,
    });

    const detail = await app.request(`/instance/accounts/${accountId}`, {
      headers: auth(main),
    });
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as {
      data: {
        account: { accountId: string; plan: string };
        businesses: Array<{ slug: string }>;
        users: Array<Record<string, unknown>>;
      };
    };
    expect(detailBody.data.account).toMatchObject({ accountId, plan: "pro" });
    expect(detailBody.data.businesses.map(row => row.slug)).toContain(
      `instctrl-${suffix}`
    );
    expect(detailBody.data.users).toHaveLength(2);
    for (const user of detailBody.data.users) {
      expect(user).not.toHaveProperty("passwordHash");
    }

    const usersResponse = await app.request(
      `/instance/users?accountId=${accountId}`,
      { headers: auth(main) }
    );
    expect(usersResponse.status).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      data: Array<{ id: number; accountId: string; role: string }>;
      meta: { pagination: { total: number } };
    };
    expect(usersBody.meta.pagination.total).toBe(2);
    expect(usersBody.data.map(row => row.id).sort()).toEqual(
      [owner.id, employee.id].sort()
    );

    const missing = await app.request("/instance/accounts/DOES-NOT-EXIST", {
      headers: auth(main),
    });
    expect(missing.status).toBe(404);
  });

  it("rejects missing credentials, a mismatched controller, scopes, and revoked keys", async () => {
    const noAuth = await app.request("/instance/accounts");
    expect(noAuth.status).toBe(401);

    const noController = await app.request("/instance/accounts", {
      headers: { Authorization: `Bearer ${main.rawKey}` },
    });
    expect(noController.status).toBe(401);

    const wrongController = await app.request("/instance/accounts", {
      headers: {
        ...auth(main),
        "X-Fina-Controller-Id": `FNB-WRONG-${suffix}`,
      },
    });
    expect(wrongController.status).toBe(401);

    const readOnlyMutation = await app.request(
      `/instance/accounts/${accountId}/hold`,
      {
        method: "POST",
        headers: auth(readOnly),
        body: JSON.stringify({ reason: "Should not be allowed" }),
      }
    );
    expect(readOnlyMutation.status).toBe(403);

    const manageOnlyRead = await app.request("/instance/accounts", {
      headers: auth(manageOnly),
    });
    expect(manageOnlyRead.status).toBe(403);

    const revokedRead = await app.request("/instance/health", {
      headers: auth(revoked),
    });
    expect(revokedRead.status).toBe(401);

    const deletedRead = await app.request("/instance/health", {
      headers: auth(deleted),
    });
    expect(deletedRead.status).toBe(401);

    const [stillActive] = await db
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.id, account.id));
    expect(stillActive.billingHoldAt).toBeNull();
  });

  it("holds and resumes an account and writes instance_control audits", async () => {
    const held = await app.request(`/instance/accounts/${accountId}/hold`, {
      method: "POST",
      headers: auth(main),
      body: JSON.stringify({ reason: "Instance control hold test" }),
    });
    expect(held.status).toBe(200);
    const heldBody = (await held.json()) as {
      data: { accountId: string; billingHoldAt: string | null };
    };
    expect(heldBody.data.accountId).toBe(accountId);
    expect(heldBody.data.billingHoldAt).toBeTruthy();

    const heldList = await app.request(
      `/instance/accounts?access=held&search=${accountId}`,
      { headers: auth(main) }
    );
    const heldListBody = (await heldList.json()) as {
      meta: { pagination: { total: number } };
    };
    expect(heldListBody.meta.pagination.total).toBe(1);

    const resumed = await app.request(
      `/instance/accounts/${accountId}/resume`,
      {
        method: "POST",
        headers: auth(main),
        body: JSON.stringify({ reason: "Instance control resume test" }),
      }
    );
    expect(resumed.status).toBe(200);
    const resumedBody = (await resumed.json()) as {
      data: { billingHoldAt: string | null };
    };
    expect(resumedBody.data.billingHoldAt).toBeNull();

    const audits = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tableName, "instance_control"),
          eq(auditLog.recordId, account.id)
        )
      );
    expect(audits).toHaveLength(2);
    expect(audits.map(row => row.changedBy)).toEqual([null, null]);
    expect(
      audits
        .map(row => (row.newValues as { operation: string }).operation)
        .sort()
    ).toEqual(["billing_hold", "restore_access"]);
    for (const row of audits) {
      expect((row.newValues as { accountId: string }).accountId).toBe(
        accountId
      );
    }
  });

  it("changes the plan, validates expiry, and audits the change", async () => {
    const changed = await app.request(`/instance/accounts/${accountId}/plan`, {
      method: "POST",
      headers: auth(main),
      body: JSON.stringify({
        plan: "growth",
        reason: "Instance control plan test",
      }),
    });
    expect(changed.status).toBe(200);
    const changedBody = (await changed.json()) as {
      data: { plan: string; subscriptionStatus: string };
    };
    expect(changedBody.data.plan).toBe("growth");

    const [stored] = await db
      .select()
      .from(customerAccounts)
      .where(eq(customerAccounts.id, account.id));
    expect(stored.plan).toBe("growth");

    const invalidDate = await app.request(
      `/instance/accounts/${accountId}/plan`,
      {
        method: "POST",
        headers: auth(main),
        body: JSON.stringify({
          plan: "growth",
          expiresOn: "2026-02-30",
          reason: "Invalid expiry test",
        }),
      }
    );
    expect(invalidDate.status).toBe(400);

    const planAudits = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tableName, "instance_control"),
          eq(auditLog.recordId, account.id)
        )
      );
    const operations = planAudits.map(
      row => (row.newValues as { operation: string }).operation
    );
    expect(operations).toContain("plan_change");

    const plans = await app.request("/instance/plans", { headers: auth(main) });
    expect(plans.status).toBe(200);
    const plansBody = (await plans.json()) as {
      data: Array<{ plan: string; maxBusinesses: number }>;
    };
    expect(plansBody.data.map(row => row.plan)).toEqual([
      "free",
      "starter",
      "growth",
      "pro",
    ]);
  });

  it("toggles staff status and protects the last active owner", async () => {
    const disabled = await app.request(
      `/instance/users/${employee.id}/status`,
      {
        method: "POST",
        headers: auth(main),
        body: JSON.stringify({
          accountId,
          isActive: false,
          reason: "Instance control staff test",
        }),
      }
    );
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({
      data: { id: employee.id, isActive: false },
    });

    const [storedEmployee] = await db
      .select()
      .from(users)
      .where(eq(users.id, employee.id));
    expect(storedEmployee.isActive).toBe(false);

    const reenabled = await app.request(
      `/instance/users/${employee.id}/status`,
      {
        method: "POST",
        headers: auth(main),
        body: JSON.stringify({
          accountId,
          isActive: true,
          reason: "Instance control staff test",
        }),
      }
    );
    expect(reenabled.status).toBe(200);

    const lastOwner = await app.request(`/instance/users/${owner.id}/status`, {
      method: "POST",
      headers: auth(main),
      body: JSON.stringify({
        accountId,
        isActive: false,
        reason: "Instance control last owner test",
      }),
    });
    expect(lastOwner.status).toBe(400);
    const lastOwnerBody = (await lastOwner.json()) as {
      error: { code: string; message: string };
    };
    expect(lastOwnerBody.error.code).toBe("BAD_REQUEST");
    expect(lastOwnerBody.error.message).toContain("last active owner");

    const userAudits = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.tableName, "instance_control"),
          eq(auditLog.recordId, employee.id)
        )
      );
    expect(userAudits).toHaveLength(2);
    for (const row of userAudits) {
      expect(row.changedBy).toBeNull();
      expect((row.newValues as { operation: string }).operation).toBe(
        "user_status"
      );
    }
  });

  it("protects the platform superadmin account", async () => {
    const response = await app.request(
      `/instance/accounts/${superAdminAccountId}/hold`,
      {
        method: "POST",
        headers: auth(main),
        body: JSON.stringify({ reason: "Protected account attempt" }),
      }
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("protected");
  });
});
