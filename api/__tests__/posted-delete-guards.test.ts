// ABOUTME: Verifies posted accounting records cannot be silently deleted after hitting the ledger.
// ABOUTME: Protects expense and bill history until explicit reversal workflows handle corrections.
import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

import { appRouter } from "../router";
import {
  accounts,
  bills,
  businesses,
  expenseCategories,
  expenses,
  ledgerEntries,
  locations,
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

type Row = { id: number };

interface CallerUser {
  id: number;
  role: string;
  currentBusinessId: number;
  accountId: string;
  accountRefId: number | null;
  currentBusiness: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  businessIds: number[];
}

interface CallerContext {
  req: Request;
  resHeaders: Headers;
  user: CallerUser;
}

async function seedDeleteContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `DEL-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Delete Guard ${seed}`,
    slug: `delete-guard-${seed.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } satisfies typeof businesses.$inferInsert).returning();

  const [user] = await db.insert(users).values({
    username: `owner-del-${seed.toLowerCase()}`,
    name: `Delete Guard Owner ${seed}`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id,
    accountId,
  } satisfies typeof users.$inferInsert).returning();

  await db.insert(userBusinesses).values({
    userId: user.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } satisfies typeof userBusinesses.$inferInsert);

  const [location] = await db.insert(locations).values({
    businessId: business.id,
    name: `Delete Branch ${seed}`,
    slug: `delete-branch-${seed.toLowerCase()}`,
    isActive: true,
  } satisfies typeof locations.$inferInsert).returning();

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

async function cleanupDeleteContext(accountId: string) {
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

  const expenseRows = locationIds.length
    ? await db.select({ id: expenses.id }).from(expenses).where(inArray(expenses.locationId, locationIds))
    : [];
  const expenseIds = expenseRows.map((row) => row.id);

  const billRows = locationIds.length
    ? await db.select({ id: bills.id }).from(bills).where(inArray(bills.locationId, locationIds))
    : [];
  const billIds = billRows.map((row) => row.id);

  const allTxnIds = [...expenseIds, ...billIds];
  if (allTxnIds.length > 0) {
    await db.delete(ledgerEntries).where(inArray(ledgerEntries.transactionId, allTxnIds));
  }

  await db.delete(expenses).where(eq(expenses.businessId, business.id));
  await db.delete(bills).where(eq(bills.businessId, business.id));
  await db.delete(expenseCategories).where(eq(expenseCategories.businessId, business.id));
  await db.delete(accounts).where(eq(accounts.businessId, business.id));
  await db.delete(locations).where(eq(locations.businessId, business.id));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, business.id));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.id, business.id));
}

function createCaller(ctx: SeededContext) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc/expenses.delete"),
    resHeaders: new Headers(),
    user: {
      ...ctx.user,
      currentBusiness: ctx.business,
      businessIds: [ctx.business.id],
    },
  } as any);
}

describe("posted record delete guards", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupDeleteContext(accountId);
      }
    }
  });

  it("rejects deleting an expense that already posted ledger entries", async () => {
    const seed = `EXP-${Date.now()}`;
    const ctx = await seedDeleteContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const acctRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: ctx.location.id,
      name: "Expense Cash",
      type: "cash",
      accountType: "asset",
      accountSubType: "cash",
      currentBalance: "1000.00",
      openingBalance: "1000.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [account] = acctRows as Row[];

    const [category] = await db.insert(expenseCategories).values({
      businessId: ctx.business.id,
      name: "Ops",
      accountingClass: "operating_expense",
      defaultAccountId: account.id,
    } satisfies typeof expenseCategories.$inferInsert).returning();

    const [expense] = await db.insert(expenses).values({
      locationId: ctx.location.id,
      businessId: ctx.business.id,
      categoryId: category.id,
      amount: "200.00",
      description: "Posted expense",
      expenseDate: "2026-05-10",
      paymentMethod: "cash",
      enteredBy: ctx.user.id,
    } satisfies typeof expenses.$inferInsert).returning();

    await db.insert(ledgerEntries).values({
      accountId: account.id,
      transactionType: "expense",
      transactionId: expense.id,
      entryType: "credit",
      amount: "200.00",
      balanceAfter: "800.00",
      entryDate: "2026-05-10",
      createdBy: ctx.user.id,
    } satisfies typeof ledgerEntries.$inferInsert);

    await expect(caller.expenses.delete({ id: expense.id })).rejects.toThrow(/reverse|posted/i);
  });

  it("reverses a posted expense and records the reversal trail", async () => {
    const seed = `REVEXP-${Date.now()}`;
    const ctx = await seedDeleteContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const cashRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: ctx.location.id,
      name: "Reversal Cash",
      type: "cash",
      accountType: "asset",
      accountSubType: "cash",
      currentBalance: "800.00",
      openingBalance: "1000.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [cashAccount] = cashRows as Row[];

    const expenseRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Office Expense",
      type: "bank_account",
      accountType: "expense",
      accountSubType: "operating_expense",
      currentBalance: "200.00",
      openingBalance: "0.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [expenseAccount] = expenseRows as Row[];

    const [category] = await db.insert(expenseCategories).values({
      businessId: ctx.business.id,
      name: "Ops",
      accountingClass: "operating_expense",
      defaultAccountId: expenseAccount.id,
    } satisfies typeof expenseCategories.$inferInsert).returning();

    const [expense] = await db.insert(expenses).values({
      locationId: ctx.location.id,
      businessId: ctx.business.id,
      categoryId: category.id,
      amount: "200.00",
      description: "Expense to reverse",
      expenseDate: "2026-05-10",
      paymentMethod: "cash",
      accountId: cashAccount.id,
      enteredBy: ctx.user.id,
    } satisfies typeof expenses.$inferInsert).returning();

    await db.insert(ledgerEntries).values([
      {
        accountId: cashAccount.id,
        transactionType: "expense",
        transactionId: expense.id,
        entryType: "credit",
        amount: "200.00",
        balanceAfter: "800.00",
        entryDate: "2026-05-10",
        createdBy: ctx.user.id,
      },
      {
        accountId: expenseAccount.id,
        transactionType: "expense",
        transactionId: expense.id,
        entryType: "debit",
        amount: "200.00",
        balanceAfter: "200.00",
        entryDate: "2026-05-10",
        createdBy: ctx.user.id,
      },
    ] satisfies Array<typeof ledgerEntries.$inferInsert>);

    await caller.expenses.reverse({ id: expense.id, reason: "Duplicate" });

    const [savedExpense] = await db.select().from(expenses).where(eq(expenses.id, expense.id)).limit(1);
    const reversedEntries = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.transactionId, expense.id), eq(ledgerEntries.description, "Reversal: Duplicate")));

    expect(savedExpense.reversedAt).not.toBeNull();
    expect(reversedEntries).toHaveLength(2);
  });

  it("rejects deleting a bill that already posted ledger entries", async () => {
    const seed = `BILL-${Date.now()}`;
    const ctx = await seedDeleteContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const acctRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Accounts Payable",
      type: "bank_account",
      accountType: "liability",
      accountSubType: "accounts_payable",
      currentBalance: "0.00",
      openingBalance: "0.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [account] = acctRows as Row[];

    const [bill] = await db.insert(bills).values({
      locationId: ctx.location.id,
      businessId: ctx.business.id,
      description: "Posted bill",
      amount: "300.00",
      balanceDue: "300.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    } satisfies typeof bills.$inferInsert).returning();

    await db.insert(ledgerEntries).values({
      accountId: account.id,
      transactionType: "bill_payment",
      transactionId: bill.id,
      entryType: "credit",
      amount: "300.00",
      balanceAfter: "300.00",
      entryDate: "2026-05-10",
      createdBy: ctx.user.id,
    } satisfies typeof ledgerEntries.$inferInsert);

    await expect(caller.bills.delete({ id: bill.id })).rejects.toThrow(/reverse|posted/i);
  });

  it("reverses a posted bill that has no payments", async () => {
    const seed = `REVBILL-${Date.now()}`;
    const ctx = await seedDeleteContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const apRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Accounts Payable",
      type: "bank_account",
      accountType: "liability",
      accountSubType: "accounts_payable",
      currentBalance: "300.00",
      openingBalance: "0.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [apAccount] = apRows as Row[];

    const expAcctRows = await db.insert(accounts).values({
      businessId: ctx.business.id,
      locationId: null,
      name: "Ops Expense",
      type: "bank_account",
      accountType: "expense",
      accountSubType: "operating_expense",
      currentBalance: "300.00",
      openingBalance: "0.00",
    } satisfies typeof accounts.$inferInsert).returning();
    const [expenseAccount] = expAcctRows as Row[];

    const [category] = await db.insert(expenseCategories).values({
      businessId: ctx.business.id,
      name: "Ops",
      accountingClass: "operating_expense",
      defaultAccountId: expenseAccount.id,
    } satisfies typeof expenseCategories.$inferInsert).returning();

    const [bill] = await db.insert(bills).values({
      locationId: ctx.location.id,
      businessId: ctx.business.id,
      categoryId: category.id,
      description: "Posted bill",
      amount: "300.00",
      balanceDue: "300.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    } satisfies typeof bills.$inferInsert).returning();

    await db.insert(ledgerEntries).values([
      {
        accountId: expenseAccount.id,
        transactionType: "expense",
        transactionId: bill.id,
        entryType: "debit",
        amount: "300.00",
        balanceAfter: "300.00",
        entryDate: "2026-05-10",
        createdBy: ctx.user.id,
      },
      {
        accountId: apAccount.id,
        transactionType: "bill_payment",
        transactionId: bill.id,
        entryType: "credit",
        amount: "300.00",
        balanceAfter: "300.00",
        entryDate: "2026-05-10",
        createdBy: ctx.user.id,
      },
    ] satisfies Array<typeof ledgerEntries.$inferInsert>);

    await caller.bills.reverse({ id: bill.id, reason: "Vendor error" });

    const [savedBill] = await db.select().from(bills).where(eq(bills.id, bill.id)).limit(1);
    expect(savedBill.reversedAt).not.toBeNull();
    expect(savedBill.status).toBe("cancelled");
  });
});
