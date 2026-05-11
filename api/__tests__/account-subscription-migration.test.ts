// ABOUTME: Verifies the account-subscription migration creates one account row per logical account.
// ABOUTME: Confirms the backfill prefers the most recent active or trial subscription state across businesses.
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { businesses, users } from "../../db/schema";
import { getDb } from "../queries/connection";

async function resetAccount(accountId: string) {
  const db = getDb();

  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
  await db.execute(`DELETE FROM customer_accounts WHERE "accountId" = '${accountId}'`);
}

describe("account-level subscription migration", () => {
  beforeEach(async () => {
    await resetAccount("MIGRATECO");
  });

  it("creates one customer account per logical account and keeps the most recent paid or trial state", async () => {
    const db = getDb();

    await db.execute(`
      INSERT INTO businesses ("accountId", name, slug, plan, "subscriptionStatus", "subscriptionExpiry", "features", "isActive")
      VALUES
      ('MIGRATECO', 'Alpha Business', 'migrate-alpha', 'starter', 'expired', NULL, '{}'::json, true),
      ('MIGRATECO', 'Beta Business', 'migrate-beta', 'growth', 'trial', CURRENT_DATE + INTERVAL '5 day', '{"trialExtendedAt":"2026-05-08T10:00:00.000Z"}'::json, true)
    `);

    await db.execute(`
      INSERT INTO users ("username", "name", email, role, "accountId", "isActive")
      VALUES ('migrate-owner', 'Migration Owner', 'migrate@example.com', 'owner', 'MIGRATECO', true)
    `);

    await db.execute(`SELECT run_account_subscription_backfill()`);

    const rows = await db.execute(`
      SELECT "accountId", plan, "subscriptionStatus"
      FROM customer_accounts
      WHERE "accountId" = 'MIGRATECO'
    `);

    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0] as { plan: string }).plan).toBe("growth");
    expect((rows.rows[0] as { subscriptionStatus: string }).subscriptionStatus).toBe("trial");
  });
});
