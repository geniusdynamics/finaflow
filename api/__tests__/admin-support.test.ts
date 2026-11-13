// ABOUTME: Verifies admin support authorization through the public tRPC support interface.
// ABOUTME: Keeps ordinary business owners from accessing platform account controls.
import { describe, it, expect } from "vitest";
import { adminSupportRouter } from "../admin-support-router";

describe("admin support access", () => {
  it("requires authentication for account directories", async () => {
    const caller = adminSupportRouter.createCaller({
      req: new Request("http://localhost"),
      resHeaders: new Headers(),
    });
    await expect(caller.listAccounts({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

import { beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  customerAccounts,
  users,
  accountRenewalRequests,
  auditLog,
  businesses,
} from "@db/schema";
import { appRouter } from "../router";

const fixtureAccountId = `SUPPORT-${Date.now()}`;
let actor: typeof users.$inferSelect;
let owner: typeof users.$inferSelect;
let account: typeof customerAccounts.$inferSelect;
function context(user: typeof users.$inferSelect) {
  return {
    req: new Request("http://localhost"),
    resHeaders: new Headers(),
    user,
  };
}
beforeAll(async () => {
  const db = getDb();
  [account] = await db
    .insert(customerAccounts)
    .values({
      accountId: fixtureAccountId,
      name: "Support fixture",
      plan: "pro",
    })
    .returning();
  [actor] = await db
    .insert(users)
    .values({
      username: `${fixtureAccountId}-admin`,
      accountId: process.env.SUPER_ADMIN_ACCOUNT,
      role: "owner",
    })
    .returning();
  [owner] = await db
    .insert(users)
    .values({
      username: `${fixtureAccountId}-owner`,
      accountId: fixtureAccountId,
      accountRefId: account.id,
      role: "owner",
    })
    .returning();
});
afterAll(async () => {
  if (!account) return;
  const db = getDb();
  await db
    .delete(accountRenewalRequests)
    .where(eq(accountRenewalRequests.accountRefId, account.id));
  await db.delete(auditLog).where(eq(auditLog.changedBy, actor.id));
  await db.delete(auditLog).where(eq(auditLog.changedBy, owner.id));
  await db.delete(businesses).where(eq(businesses.accountId, fixtureAccountId));
  await db.delete(users).where(inArray(users.id, [actor.id, owner.id]));
  await db.delete(customerAccounts).where(eq(customerAccounts.id, account.id));
});

it("keeps a manual hold across plan changes, deduplicates renewal requests, and rejects stale review", async () => {
  const admin = adminSupportRouter.createCaller(context(actor));
  const billing = appRouter.createCaller(context(owner)).billing;
  const held = await admin.setAccountBillingHold({
    accountId: fixtureAccountId,
    reason: "Verify renewal",
  });
  expect(held.billingHoldAt).toBeInstanceOf(Date);
  const changed = await admin.changeAccountPlan({
    accountId: fixtureAccountId,
    plan: "growth",
    reason: "Support entitlement",
  });
  expect(changed.billingHoldAt).toEqual(held.billingHoldAt);
  const [one, two] = await Promise.all([
    billing.requestRenewal({ paymentReference: "reference-1" }),
    billing.requestRenewal({}),
  ]);
  expect(one.id).toBe(two.id);
  const restored = await admin.restoreAccountAccess({
    accountId: fixtureAccountId,
    holdAt: held.billingHoldAt!.toISOString(),
    reason: "Payment verified externally",
  });
  expect(restored.billingHoldAt).toBeNull();
  expect((await billing.summary()).request?.status).toBe("approved");
  await admin.setAccountBillingHold({
    accountId: fixtureAccountId,
    reason: "Second review",
  });
  await expect(
    admin.restoreAccountAccess({
      accountId: fixtureAccountId,
      holdAt: held.billingHoldAt!.toISOString(),
      reason: "Stale action",
    })
  ).rejects.toMatchObject({ code: "CONFLICT" });
});

it("protects the last owner and validates future trial dates", async () => {
  const admin = adminSupportRouter.createCaller(context(actor));
  await expect(
    admin.setUserStatus({
      accountId: fixtureAccountId,
      userId: owner.id,
      isActive: false,
      reason: "Disable",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(
    admin.adjustAccountTrial({
      accountId: fixtureAccountId,
      plan: "pro",
      expiresOn: "2026-02-30",
      reason: "Invalid date",
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

it("rejects an over-limit downgrade without changing account entitlements", async () => {
  const db = getDb();
  const temporaryUsers = await db
    .insert(users)
    .values(
      [1, 2, 3].map(index => ({
        username: `${fixtureAccountId}-limit-${index}`,
        accountId: fixtureAccountId,
        role: "employee" as const,
      }))
    )
    .returning({ id: users.id });
  try {
    const admin = adminSupportRouter.createCaller(context(actor));
    const before = await appRouter
      .createCaller(context(owner))
      .billing.summary();
    await expect(
      admin.changeAccountPlan({
        accountId: fixtureAccountId,
        plan: "starter",
        reason: "Check limits",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const after = await appRouter
      .createCaller(context(owner))
      .billing.summary();
    expect(after.account.plan).toBe(before.account.plan);
    expect(after.account.billingHoldAt).toEqual(before.account.billingHoldAt);
  } finally {
    await db.delete(users).where(
      inArray(
        users.id,
        temporaryUsers.map(user => user.id)
      )
    );
  }
});
