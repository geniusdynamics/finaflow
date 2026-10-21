// ABOUTME: Integration tests for the daily subscription digest email — one logged send per business per day,
// ABOUTME: notifyEnabled respected, and nothing sent when no renewals are due inside the digest window.
import { describe, expect, it, beforeAll } from "vitest";
import { getDb } from "../queries/connection";
import { sendSubscriptionDigestEmails } from "../lib/subscription-digest";
import { appSettings, businesses, emailLogs, locations, subscriptions, userBusinesses, users } from "@db/schema";
import { and, eq, sql } from "drizzle-orm";

describe("Subscription digest email", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: typeof businesses.$inferSelect;
  let locA: typeof locations.$inferSelect;
  let ownerA: typeof users.$inferSelect;

  const digestDay = new Date("2027-07-10T07:00:00");

  beforeAll(async () => {
    db = getDb();

    for (const prefix of ["SUBDIGEST_A"]) {
      const existingBiz = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const b of existingBiz) {
        await db.delete(subscriptions).where(eq(subscriptions.businessId, b.id));
        await db.delete(appSettings).where(eq(appSettings.businessId, b.id));
        await db.delete(locations).where(eq(locations.businessId, b.id));
        await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
        await db.delete(businesses).where(eq(businesses.id, b.id));
      }
      await db.delete(users).where(sql`${users.username} LIKE 'sub-digest-%'`);
      await db.delete(emailLogs).where(eq(emailLogs.type, "subscription_due_digest"));
    }

    [bizA] = await db.insert(businesses).values({ accountId: "SUBDIGEST_A", name: "Subs Digest A", slug: "SUBDIGEST_A_main", plan: "pro", isActive: true } as never).returning();
    [locA] = await db.insert(locations).values({ businessId: bizA.id, name: "Digest Branch", slug: "subdigest-a-b1", isActive: true } as never).returning();
    [ownerA] = await db
      .insert(users)
      .values({ username: "sub-digest-owner", name: "Digest Owner", email: "digest-owner@example.test", role: "owner", isActive: true, currentBusinessId: bizA.id } as never)
      .returning();
    await db.insert(userBusinesses).values({ userId: ownerA.id, businessId: bizA.id, role: "owner", isActive: true } as never);
  });

  async function insertSub(overrides: Record<string, unknown>) {
    const [row] = await db
      .insert(subscriptions)
      .values({
        businessId: bizA.id,
        locationId: locA.id,
        name: "Digest Sub",
        amount: "100.00",
        currency: "KES",
        cycleUnit: "month",
        cycleCount: 1,
        isOneTime: false,
        startDate: "2027-01-01",
        nextDueDate: "2027-07-13",
        autoRenew: false,
        status: "active",
        postingMode: "none",
        notifyEnabled: true,
        createdBy: ownerA.id,
        ...overrides,
      } as never)
      .returning();
    return row;
  }

  it("logs one digest email per business per day and skips repeat runs", async () => {
    await insertSub({ name: "Due Soon Digest", nextDueDate: "2027-07-13" });

    const first = await sendSubscriptionDigestEmails(db, digestDay);
    expect(first).toBeGreaterThan(0);

    const logs = await db.select().from(emailLogs).where(eq(emailLogs.type, "subscription_due_digest"));
    expect(logs.length).toBe(first);

    const second = await sendSubscriptionDigestEmails(db, digestDay);
    expect(second).toBe(0);
    const logsAfter = await db.select().from(emailLogs).where(eq(emailLogs.type, "subscription_due_digest"));
    expect(logsAfter.length).toBe(logs.length);
  });

  it("respects notifyEnabled and sends nothing when nothing is due", async () => {
    await db.delete(appSettings).where(and(eq(appSettings.businessId, bizA.id), eq(appSettings.key, "subscriptions_last_digest_date")));
    // Turn off notifications on every sub and move dues beyond the window.
    await db.update(subscriptions).set({ notifyEnabled: false, nextDueDate: "2027-12-01" }).where(eq(subscriptions.businessId, bizA.id));

    const sent = await sendSubscriptionDigestEmails(db, digestDay);
    expect(sent).toBe(0);

    const sub = await insertSub({ name: "Quiet Sub", nextDueDate: "2027-07-11", notifyEnabled: false });
    expect(sub.id).toBeGreaterThan(0);
    const sentAgain = await sendSubscriptionDigestEmails(db, digestDay);
    expect(sentAgain).toBe(0);
  });
});
