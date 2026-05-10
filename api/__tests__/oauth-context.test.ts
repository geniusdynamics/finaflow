import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createContext } from "../context";
import { signSessionToken } from "../kimi/session";
import { Session } from "@contracts/constants";
import { businesses, userBusinesses, users } from "@db/schema";
import { getDb } from "../queries/connection";
import { eq } from "drizzle-orm";

async function cleanup(unionId: string, accountId: string) {
  const db = getDb();
  const existingUsers = await db.select().from(users).where(eq(users.unionId, unionId));
  for (const user of existingUsers) {
    await db.delete(userBusinesses).where(eq(userBusinesses.userId, user.id));
  }
  await db.delete(users).where(eq(users.unionId, unionId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
}

describe("OAuth context", () => {
  const unionId = "oauth-union-1";
  const accountId = "OAUTHBIZ";

  beforeEach(async () => {
    await cleanup(unionId, accountId);
  });

  afterEach(async () => {
    await cleanup(unionId, accountId);
  });

  it("hydrates ctx.user from the Kimi session cookie", async () => {
    const db = getDb();
    const [business] = await db.insert(businesses).values({
      accountId,
      name: "OAuth Business",
      slug: "oauth-business",
      plan: "pro",
      maxBranches: 99,
      maxUsers: 99,
      isActive: true,
    } as any).returning();

    const [user] = await db.insert(users).values({
      unionId,
      username: "oauth-user",
      name: "OAuth User",
      role: "owner",
      isActive: true,
      currentBusinessId: business.id,
      accountId,
    } as any).returning();

    await db.insert(userBusinesses).values({
      userId: user.id,
      businessId: business.id,
      role: "owner",
      isActive: true,
    } as any);

    const token = await signSessionToken({ unionId, clientId: process.env.APP_ID! });
    const cookie = `${Session.cookieName}=${token}`;
    const req = new Request("http://localhost/api/trpc/auth.me", {
      headers: { cookie },
    });
    const ctx = await createContext({ req, resHeaders: new Headers(), info: {} as any });

    expect(ctx.user?.id).toBe(user.id);
    expect(ctx.user?.currentBusiness?.id).toBe(business.id);
    expect(ctx.user?.businessIds).toEqual([business.id]);
  });
});
