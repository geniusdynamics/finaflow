// ABOUTME: Exercises billing holds through all shared tRPC procedure families.
// ABOUTME: Uses isolated customer fixtures to verify recovery and tenant access boundaries.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { customerAccounts } from "@db/schema";
import { getDb } from "../queries/connection";
import { createRouter, authedQuery, accountQuery, ownerQuery, publicQuery } from "../middleware";

const accountId = `HOLD-MIDDLEWARE-${Date.now()}`;
const router = createRouter({
  authenticated: authedQuery.query(() => "private"),
  permission: accountQuery.query(() => "private"),
  owner: ownerQuery.query(() => "private"),
  billing: createRouter({ summary: publicQuery.query(() => "recovery") }),
});
function caller(role: string, isActive = true) {
  return router.createCaller({ req: new Request("http://localhost"), resHeaders: new Headers(), user: { id: 999991, role, accountId, isActive } });
}
beforeAll(async () => {
  await getDb().insert(customerAccounts).values({ accountId, name: "Hold Middleware Fixture", billingHoldAt: new Date() });
});
afterAll(async () => { await getDb().delete(customerAccounts).where(eq(customerAccounts.accountId, accountId)); });
describe("manual billing hold middleware", () => {
  it("blocks authenticated, permission and owner procedure families", async () => {
    const owner = caller("owner");
    await expect(owner.authenticated()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.permission()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(owner.owner()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("permits billing recovery for owner/admin and rejects staff and disabled owners", async () => {
    await expect(caller("owner").billing.summary()).resolves.toBe("recovery");
    await expect(caller("admin").billing.summary()).resolves.toBe("recovery");
    await expect(caller("employee").billing.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("owner", false).billing.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("resumes still-valid identities after explicit restoration", async () => {
    await getDb().update(customerAccounts).set({ billingHoldAt: null }).where(eq(customerAccounts.accountId, accountId));
    await expect(caller("owner").authenticated()).resolves.toBe("private");
  });
});
