// ABOUTME: Verifies account-level business limits and per-business branch limits are enforced through the shared subscription guard.
// ABOUTME: Exercises the real tRPC callers so business and location creation stay aligned with the active subscription contract.
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";

async function cleanupAccount(accountId: string) {
  const db = getDb();
  await db.execute(`DELETE FROM user_businesses WHERE "userId" IN (SELECT id FROM users WHERE "accountId" = '${accountId}')`);
  await db.execute(`DELETE FROM locations WHERE "businessId" IN (SELECT id FROM businesses WHERE "accountId" = '${accountId}')`);
  await db.execute(`DELETE FROM users WHERE "accountId" = '${accountId}'`);
  await db.execute(`DELETE FROM businesses WHERE "accountId" = '${accountId}'`);
  await db.execute(`DELETE FROM customer_accounts WHERE "accountId" = '${accountId}'`);
}

describe("account subscription enforcement", () => {
  beforeEach(async () => {
    await cleanupAccount("LIMITCO");
    await cleanupAccount("BRANCHCO");
  });

  it("blocks creating a second business when the account has reached its plan limit", async () => {
    const db = getDb();
    const [{ id: accountRefId }] = await db.execute(`
      INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
      VALUES ('LIMITCO', 'Limit Co', 'starter', 'active', 1, 3, 5000)
      RETURNING id
    `).then((result) => result.rows as Array<{ id: number }>);

    const existingBusiness = await db.execute(`
      INSERT INTO businesses ("accountId", "accountRefId", name, slug, plan, "subscriptionStatus", "isActive")
      VALUES ('LIMITCO', ${accountRefId}, 'Limit One', 'limit-one', 'starter', 'active', true)
      RETURNING id
    `);

    const owner = await db.execute(`
      INSERT INTO users (username, name, email, role, "accountId", "accountRefId", "currentBusinessId", "isActive")
      VALUES ('limit-owner', 'Limit Owner', 'limit@example.com', 'owner', 'LIMITCO', ${accountRefId}, ${(existingBusiness.rows[0] as any).id}, true)
      RETURNING id
    `);

    await db.execute(`
      INSERT INTO user_businesses ("userId", "businessId", role, "isActive")
      VALUES (${(owner.rows[0] as any).id}, ${(existingBusiness.rows[0] as any).id}, 'owner', true)
    `);

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/businesses.create"),
      resHeaders: new Headers(),
      user: {
        id: (owner.rows[0] as any).id,
        role: "owner",
        accountId: "LIMITCO",
        accountRefId,
        currentBusinessId: (existingBusiness.rows[0] as any).id,
        currentBusiness: { id: (existingBusiness.rows[0] as any).id, accountId: "LIMITCO", accountRefId },
        businessIds: [(existingBusiness.rows[0] as any).id],
      },
    } as any);

    await expect(caller.businesses.create({
      name: "Limit Two",
      slug: "limit-two",
      businessType: "retail",
      plan: "starter",
    })).rejects.toMatchObject({
      message: "Your current plan allows 1 business. Upgrade to Growth or Pro to add another business.",
      cause: expect.objectContaining({
        code: "SUBSCRIPTION_LIMIT_EXCEEDED",
        entity: "business",
        currentUsage: 1,
        currentLimit: 1,
        upgradeOptions: ["growth", "pro"],
      }),
    });
  });

  it("blocks creating a second branch when the business has reached its plan limit", async () => {
    const db = getDb();
    const [{ id: accountRefId }] = await db.execute(`
      INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
      VALUES ('BRANCHCO', 'Branch Co', 'starter', 'active', 1, 3, 5000)
      RETURNING id
    `).then((result) => result.rows as Array<{ id: number }>);

    const business = await db.execute(`
      INSERT INTO businesses ("accountId", "accountRefId", name, slug, plan, "subscriptionStatus", "isActive", "maxBranches", "maxUsers")
      VALUES ('BRANCHCO', ${accountRefId}, 'Branch One', 'branch-one', 'starter', 'active', true, 1, 3)
      RETURNING id
    `);

    const owner = await db.execute(`
      INSERT INTO users (username, name, email, role, "accountId", "accountRefId", "currentBusinessId", "isActive")
      VALUES ('branch-owner', 'Branch Owner', 'branch@example.com', 'owner', 'BRANCHCO', ${accountRefId}, ${(business.rows[0] as any).id}, true)
      RETURNING id
    `);

    await db.execute(`
      INSERT INTO user_businesses ("userId", "businessId", role, "isActive")
      VALUES (${(owner.rows[0] as any).id}, ${(business.rows[0] as any).id}, 'owner', true)
    `);

    await db.execute(`
      INSERT INTO locations ("businessId", name, slug, "isActive")
      VALUES (${(business.rows[0] as any).id}, 'Main Branch', 'branch-main', true)
    `);

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/locations.create"),
      resHeaders: new Headers(),
      user: {
        id: (owner.rows[0] as any).id,
        role: "owner",
        accountId: "BRANCHCO",
        accountRefId,
        currentBusinessId: (business.rows[0] as any).id,
        currentBusiness: { id: (business.rows[0] as any).id, accountId: "BRANCHCO", accountRefId },
        businessIds: [(business.rows[0] as any).id],
      },
    } as any);

    await expect(caller.locations.create({
      name: "Overflow Branch",
      slug: "branch-overflow",
      address: "Nairobi",
    })).rejects.toMatchObject({
      message: "Your current plan allows 1 branch for this business. Upgrade to Growth or Pro to add another location.",
      cause: expect.objectContaining({
        code: "SUBSCRIPTION_LIMIT_EXCEEDED",
        entity: "location",
        currentUsage: 1,
        currentLimit: 1,
        upgradeOptions: ["growth", "pro"],
      }),
    });
  });
});
