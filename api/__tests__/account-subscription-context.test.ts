// ABOUTME: Verifies account-scoped subscription reads stay stable while switching businesses in the same account.
// ABOUTME: Confirms the account subscription router prefers customer_accounts over legacy business plan state.
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";

type InsertedIdRow = { id: number };
type InsertedBusinessRow = { id: number; name: string };
type CallerContext = Parameters<typeof appRouter.createCaller>[0];

async function resetAccount(accountId: string) {
  const db = getDb();

  await db.execute(`DELETE FROM users WHERE "accountId" = '${accountId}'`);
  await db.execute(`DELETE FROM businesses WHERE "accountId" = '${accountId}'`);
  await db.execute(`DELETE FROM customer_accounts WHERE "accountId" = '${accountId}'`);
}

describe("account subscription context", () => {
  beforeEach(async () => {
    await resetAccount("MULTICO");
  });

  it("returns the same account subscription while switching businesses in the same account", async () => {
    const db = getDb();
    const [{ id: accountRefId }] = await db.execute(`
      INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
      VALUES ('MULTICO', 'Multi Co', 'growth', 'active', 3, 5, 20000)
      RETURNING id
    `).then((result) => result.rows as Array<{ id: number }>);

    const businessRows = await db.execute(`
      INSERT INTO businesses ("accountId", "accountRefId", name, slug, plan, "subscriptionStatus", "isActive")
      VALUES
      ('MULTICO', ${accountRefId}, 'North Co', 'multi-north', 'free', 'expired', true),
      ('MULTICO', ${accountRefId}, 'South Co', 'multi-south', 'pro', 'trial', true)
      RETURNING id, name
    `);

    const userRows = await db.execute(`
      INSERT INTO users (username, name, email, role, "accountId", "accountRefId", "currentBusinessId", "isActive")
      VALUES ('multi-owner', 'Multi Owner', 'multi@example.com', 'owner', 'MULTICO', ${accountRefId}, ${(businessRows.rows[0] as { id: number }).id}, true)
      RETURNING id
    `);

    const callerAContext: CallerContext = {
      req: new Request("http://localhost/api/trpc/accountSubscriptions.mySubscription"),
      resHeaders: new Headers(),
      user: {
        id: (userRows.rows[0] as InsertedIdRow).id,
        role: "owner",
        name: "Multi Owner",
        email: "multi@example.com",
        accountId: "MULTICO",
        accountRefId,
        currentBusinessId: (businessRows.rows[0] as InsertedBusinessRow).id,
        currentBusiness: { id: (businessRows.rows[0] as InsertedBusinessRow).id, accountId: "MULTICO", accountRefId, plan: "growth", features: null, maxBranches: 3, maxUsers: 5 },
        businessIds: businessRows.rows.map((row) => (row as InsertedBusinessRow).id),
      },
    };
    const callerA = appRouter.createCaller(callerAContext);

    const callerBContext: CallerContext = {
      req: new Request("http://localhost/api/trpc/accountSubscriptions.mySubscription"),
      resHeaders: new Headers(),
      user: {
        id: (userRows.rows[0] as InsertedIdRow).id,
        role: "owner",
        name: "Multi Owner",
        email: "multi@example.com",
        accountId: "MULTICO",
        accountRefId,
        currentBusinessId: (businessRows.rows[1] as InsertedBusinessRow).id,
        currentBusiness: { id: (businessRows.rows[1] as InsertedBusinessRow).id, accountId: "MULTICO", accountRefId, plan: "growth", features: null, maxBranches: 3, maxUsers: 5 },
        businessIds: businessRows.rows.map((row) => (row as InsertedBusinessRow).id),
      },
    };
    const callerB = appRouter.createCaller(callerBContext);

    const subscriptionA = await callerA.accountSubscriptions.mySubscription();
    const subscriptionB = await callerB.accountSubscriptions.mySubscription();

    expect(subscriptionA!.plan).toBe("growth");
    expect(subscriptionB!.plan).toBe("growth");
    expect(subscriptionA!.accountId).toBe("MULTICO");
    expect(subscriptionB!.accountId).toBe("MULTICO");
  });
});
