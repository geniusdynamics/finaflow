// ABOUTME: Verifies idempotent creation of system-managed chart accounts in the shared accounts table.
// ABOUTME: Ensures generated GL accounts carry stable metadata for simple-mode accounting flows.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { accounts, businesses } from "@db/schema";
import { getTestDb } from "../../test/db";
import { ensureSystemAccount } from "../accounting-accounts";

async function cleanupBusiness(accountId: string) {
  const db = getTestDb();
  const [existingBusiness] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.accountId, accountId))
    .limit(1);

  if (existingBusiness) {
    await db.delete(accounts).where(eq(accounts.businessId, existingBusiness.id));
    await db.delete(businesses).where(eq(businesses.id, existingBusiness.id));
  }
}

describe("ensureSystemAccount", () => {
  let accountId = "";

  afterEach(async () => {
    if (accountId) {
      await cleanupBusiness(accountId);
    }
  });

  it("creates one reusable system-generated account per business and system key", async () => {
    const db = getTestDb();
    accountId = `SYSKEY-TEST-${Date.now()}`;
    const slug = `system-account-test-${Date.now()}`;

    const [business] = await db.insert(businesses).values({
      accountId,
      name: "System Account Test Business",
      slug,
      isActive: true,
    } as any).returning();

    const firstId = await ensureSystemAccount({
      businessId: business.id,
      accountType: "expense",
      accountSubType: "operating_expense",
      name: "Operating Expenses",
    });

    const secondId = await ensureSystemAccount({
      businessId: business.id,
      accountType: "expense",
      accountSubType: "operating_expense",
      name: "Operating Expenses",
    });

    expect(secondId).toBe(firstId);

    const [created] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, firstId))
      .limit(1);

    expect(created).toMatchObject({
      businessId: business.id,
      locationId: null,
      accountType: "expense",
      accountSubType: "operating_expense",
      systemKey: "expense:operating_expense",
      isSystemGenerated: true,
      name: "Operating Expenses",
    });
  });
});
