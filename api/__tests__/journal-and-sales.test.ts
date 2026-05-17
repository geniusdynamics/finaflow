// ABOUTME: Verifies journal creation uses the active business context correctly and that sales posting stays balanced.
// ABOUTME: Prevents duplicate revenue credits when one sale is split across multiple payment methods.
import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray, and } from "drizzle-orm";

import { appRouter } from "../router";
import {
  accounts,
  businesses,
  dailySalePayments,
  dailySales,
  journalEntries,
  journalLines,
  ledgerEntries,
  locationPaymentMethods,
  locations,
  paymentMethods,
  userBusinesses,
  users,
} from "@db/schema";
import { getTestDb } from "../test/db";

type SeededContext = {
  accountId: string;
  business: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  user: { id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null };
  location: { id: number };
};

async function seedAccountingContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `JRN-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Journal ${seed}`,
    slug: `journal-${seed.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } as any).returning();

  const [user] = await db.insert(users).values({
    username: `owner-jrn-${seed.toLowerCase()}`,
    name: `Journal Owner ${seed}`,
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

  const [location] = await db.insert(locations).values({
    businessId: business.id,
    name: `Sales Branch ${seed}`,
    slug: `sales-branch-${seed.toLowerCase()}`,
    isActive: true,
  } as any).returning();

  return {
    accountId,
    business,
    user: {
      id: user.id,
      role: user.role,
      currentBusinessId: business.id,
      accountId,
      accountRefId: user.accountRefId,
    },
    location,
  };
}

async function cleanupAccountingContext(accountId: string) {
  const db = getTestDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.accountId, accountId))
    .limit(1);

  if (!business) {
    return;
  }

  const businessLocations = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, business.id));
  const locationIds = businessLocations.map((location) => location.id);

  if (locationIds.length > 0) {
    const salesRows = await db
      .select({ id: dailySales.id })
      .from(dailySales)
      .where(inArray(dailySales.locationId, locationIds));
    const saleIds = salesRows.map((sale) => sale.id);
    if (saleIds.length > 0) {
      await db.delete(dailySalePayments).where(inArray(dailySalePayments.dailySaleId, saleIds));
      await db.delete(ledgerEntries).where(inArray(ledgerEntries.transactionId, saleIds));
      await db.delete(dailySales).where(inArray(dailySales.id, saleIds));
    }

    await db
      .delete(locationPaymentMethods)
      .where(inArray(locationPaymentMethods.locationId, locationIds));
  }

  const journalRows = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.businessId, business.id));
  const journalIds = journalRows.map((entry) => entry.id);
  if (journalIds.length > 0) {
    await db.delete(journalLines).where(inArray(journalLines.journalEntryId, journalIds));
    await db.delete(journalEntries).where(inArray(journalEntries.id, journalIds));
  }

  await db.delete(paymentMethods).where(eq(paymentMethods.businessId, business.id));
  await db.delete(accounts).where(eq(accounts.businessId, business.id));
  await db.delete(locations).where(eq(locations.businessId, business.id));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, business.id));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.id, business.id));
}

function createCaller(ctx: SeededContext) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/journal.create"),
    resHeaders: new Headers(),
    user: {
      ...ctx.user,
      currentBusiness: ctx.business,
      businessIds: [ctx.business.id],
    },
  } as any);
}

describe("journal router and daily sales posting", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupAccountingContext(accountId);
      }
    }
  });

  it("creates a journal entry using the supplied business id", async () => {
    const seed = `ENTRY-${Date.now()}`;
    const ctx = await seedAccountingContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const [debitAccount] = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Cash",
      type: "cash",
      accountType: "asset",
      accountSubType: "cash",
      currentBalance: "0.00",
      openingBalance: "0.00",
    } as any).returning();

    const [creditAccount] = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Sales Revenue",
      type: "bank_account",
      accountType: "revenue",
      accountSubType: "sales_revenue",
      currentBalance: "0.00",
      openingBalance: "0.00",
    } as any).returning();

    const entry = await caller.journal.create({
      businessId: ctx.business.id,
      entryDate: "2026-05-10",
      description: "Manual adjustment",
      lines: [
        { accountId: debitAccount.id, debit: "250.00", credit: "0.00" },
        { accountId: creditAccount.id, debit: "0.00", credit: "250.00" },
      ],
      postImmediately: false,
    });

    expect(entry.businessId).toBe(ctx.business.id);
  });

  it("credits revenue exactly once when a sale has multiple payment lines", async () => {
    const seed = `SALE-${Date.now()}`;
    const ctx = await seedAccountingContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const cashAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Front Cash",
      type: "cash",
      openingBalance: "0.00",
      isPaymentMethod: true,
    });
    const bankAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Card Bank",
      type: "bank_account",
      openingBalance: "0.00",
      isPaymentMethod: true,
    });

    const [revenueAccount] = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Sales Revenue",
      type: "bank_account",
      accountType: "revenue",
      accountSubType: "sales_revenue",
      currentBalance: "0.00",
      openingBalance: "0.00",
    } as any).returning();

    const cashMethod = await caller.paymentMethods.create({
      name: "Cash",
      code: `CASH-${seed}`,
      color: "#008800",
      sortOrder: 1,
    });
    const cardMethod = await caller.paymentMethods.create({
      name: "Card",
      code: `CARD-${seed}`,
      color: "#000088",
      sortOrder: 2,
    });

    await caller.paymentMethods.assignToLocation({
      locationId: ctx.location.id,
      paymentMethodId: cashMethod.id,
      linkedAccountId: cashAccount.id,
    });
    await caller.paymentMethods.assignToLocation({
      locationId: ctx.location.id,
      paymentMethodId: cardMethod.id,
      linkedAccountId: bankAccount.id,
    });

    const sale = await caller.dailySales.create({
      locationId: ctx.location.id,
      saleDate: "2026-05-10",
      payments: [
        { paymentMethodId: cashMethod.id, amount: "100.00" },
        { paymentMethodId: cardMethod.id, amount: "50.00" },
      ],
      discountAmount: "0.00",
      voidAmount: "0.00",
      unpaidAmount: "0.00",
      salesType: "food",
    });

    const revenueCredits = await db
      .select()
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.transactionId, sale.id),
          eq(ledgerEntries.accountId, revenueAccount.id),
          eq(ledgerEntries.entryType, "credit"),
        ),
      );

    expect(revenueCredits).toHaveLength(1);
    expect(revenueCredits[0]?.amount).toBe("150.00");
  });
});
