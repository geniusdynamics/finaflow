// ABOUTME: Verifies expense categories can work in simple mode without a prebuilt chart of accounts.
// ABOUTME: Ensures bill posting can inherit a supplier default category instead of relying on fragile fallbacks.
import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

import { appRouter } from "../router";
import {
  accounts,
  billPayments,
  bills,
  businesses,
  expenseCategories,
  expenses,
  ledgerEntries,
  locations,
  suppliers,
  userBusinesses,
  users,
} from "@db/schema";
import { ensureSystemAccount } from "../lib/accounting-accounts";
import { getTestDb } from "../test/db";

type SeededContext = {
  accountId: string;
  business: { id: number; accountId: string; accountRefId: number | null; plan: string; maxBranches: number | null; maxUsers: number | null; features: unknown };
  user: { id: number; role: string; currentBusinessId: number; accountId: string; accountRefId: number | null };
  location: { id: number };
};

async function seedExpenseContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `EXP-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Expenses ${seed}`,
    slug: `expenses-${seed.toLowerCase()}`,
    plan: "pro",
    maxBranches: 5,
    maxUsers: 10,
    isActive: true,
  } as any).returning();

  const [user] = await db.insert(users).values({
    username: `owner-exp-${seed.toLowerCase()}`,
    name: `Expense Owner ${seed}`,
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
    name: `Expense Branch ${seed}`,
    slug: `expense-branch-${seed.toLowerCase()}`,
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

async function cleanupExpenseContext(accountId: string) {
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

  let billIds: number[] = [];
  if (locationIds.length > 0) {
    const businessBills = await db
      .select({ id: bills.id })
      .from(bills)
      .where(inArray(bills.locationId, locationIds));
    billIds = businessBills.map((bill) => bill.id);
    if (billIds.length > 0) {
      await db.delete(ledgerEntries).where(inArray(ledgerEntries.transactionId, billIds));
    }

    // Also delete ledger entries referencing business accounts before deleting the accounts
    const businessAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.businessId, business.id));
    const accountIds = businessAccounts.map((a) => a.id);
    if (accountIds.length > 0) {
      await db.delete(ledgerEntries).where(inArray(ledgerEntries.accountId, accountIds));
    }
  }

  await db.delete(suppliers).where(eq(suppliers.businessId, business.id));
  await db.delete(expenses).where(eq(expenses.businessId, business.id));
  if (billIds.length > 0) {
    await db.delete(billPayments).where(inArray(billPayments.billId, billIds));
  }
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
    req: new Request("http://localhost/api/trpc/expenses.createCategory"),
    resHeaders: new Headers(),
    user: {
      ...ctx.user,
      currentBusiness: ctx.business,
      businessIds: [ctx.business.id],
    },
  } as any);
}

describe("expense categories dual-mode behavior", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupExpenseContext(accountId);
      }
    }
  });

  it("creates a category by auto-generating the backing expense account when no explicit COA account is supplied", async () => {
    const seed = `AUTO-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    const created = await caller.expenses.createCategory({
      name: "Marketing",
      accountingClass: "marketing",
    });

    const db = getTestDb();
    const [category] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, created.id))
      .limit(1);
    const [defaultAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, category.defaultAccountId!))
      .limit(1);

    expect(defaultAccount).toMatchObject({
      businessId: ctx.business.id,
      accountType: "expense",
      accountSubType: "marketing_expense",
      isSystemGenerated: true,
    });
  });

  it("uses the supplier default category when creating a bill without an explicit category", async () => {
    const seed = `SUPPLIER-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const category = await caller.expenses.createCategory({
      name: "Advertising",
      accountingClass: "marketing",
    });

    const [savedCategory] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, category.id))
      .limit(1);

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const [supplier] = await db.insert(suppliers).values({
      businessId: ctx.business.id,
      locationId: ctx.location.id,
      name: "Ad Vendor",
      autoCategoryId: savedCategory.id,
    } as any).returning();

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      supplierId: supplier.id,
      description: "Campaign design",
      amount: "500.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    const relatedLedgers = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.transactionId, createdBill.id));

    expect(
      relatedLedgers.some(
        (entry) =>
          entry.accountId === savedCategory.defaultAccountId &&
          entry.entryType === "debit" &&
          entry.amount === "500.00",
      ),
    ).toBe(true);
  });

  it("persists an explicit bill category and reuses it when recording bill payments", async () => {
    const seed = `BILLCAT-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const category = await caller.expenses.createCategory({
      name: "Office Supplies",
      accountingClass: "admin_expense",
    });

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Bill Payment Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      categoryId: category.id,
      description: "Printer cartridges",
      amount: "120.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    const [savedBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, createdBill.id))
      .limit(1);

    expect(savedBill.categoryId).toBe(category.id);

    await caller.bills.recordPayment({
      billId: createdBill.id,
      paymentMethod: "cash",
      amount: "120.00",
      paymentDate: "2026-05-12",
      accountId: paymentAccount.id,
    });

    const [paymentExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.billId, createdBill.id), eq(expenses.categoryId, category.id)))
      .limit(1);

    expect(paymentExpense).toBeTruthy();
  });
});

describe("bill category resolution priority", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupExpenseContext(accountId);
      }
    }
  });

  it("uses line item category over bill-level category when items have a single category", async () => {
    const seed = `ITEMCAT-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const billCategory = await caller.expenses.createCategory({
      name: "Bill Level",
      accountingClass: "admin_expense",
    });
    const itemCategory = await caller.expenses.createCategory({
      name: "Item Level",
      accountingClass: "operating_expense",
    });

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Item Cat Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      categoryId: billCategory.id,
      description: "Mixed categories test",
      amount: "200.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Widget",
      quantity: "1",
      unitPrice: "200.00",
      totalPrice: "200.00",
      categoryId: itemCategory.id,
    });

    await caller.bills.recordPayment({
      billId: createdBill.id,
      paymentMethod: "cash",
      amount: "200.00",
      paymentDate: "2026-05-12",
      accountId: paymentAccount.id,
    });

    const [paymentExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.billId, createdBill.id), eq(expenses.categoryId, itemCategory.id)))
      .limit(1);

    expect(paymentExpense).toBeTruthy();
    expect(paymentExpense!.categoryId).toBe(itemCategory.id);

    const billLevelExpense = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.billId, createdBill.id), eq(expenses.categoryId, billCategory.id)))
      .limit(1);
    expect(billLevelExpense.length).toBe(0);
  });

  it("uses line item category when bill has no explicit category", async () => {
    const seed = `ITEMONLY-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const itemCategory = await caller.expenses.createCategory({
      name: "Item Only",
      accountingClass: "operating_expense",
    });

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Item Only Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      description: "Item-only category",
      amount: "150.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Gadget",
      quantity: "2",
      unitPrice: "75.00",
      totalPrice: "150.00",
      categoryId: itemCategory.id,
    });

    await caller.bills.recordPayment({
      billId: createdBill.id,
      paymentMethod: "cash",
      amount: "150.00",
      paymentDate: "2026-05-12",
      accountId: paymentAccount.id,
    });

    const [paymentExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.billId, createdBill.id), eq(expenses.categoryId, itemCategory.id)))
      .limit(1);

    expect(paymentExpense).toBeTruthy();
  });

  it("falls back to bill-level category when items have no categories", async () => {
    const seed = `BILLONLY-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);
    const db = getTestDb();

    const billCategory = await caller.expenses.createCategory({
      name: "Fallback Cat",
      accountingClass: "admin_expense",
    });

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Fallback Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      categoryId: billCategory.id,
      description: "Bill-level category",
      amount: "100.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Plain item",
      quantity: "1",
      unitPrice: "100.00",
      totalPrice: "100.00",
    });

    await caller.bills.recordPayment({
      billId: createdBill.id,
      paymentMethod: "cash",
      amount: "100.00",
      paymentDate: "2026-05-12",
      accountId: paymentAccount.id,
    });

    const [paymentExpense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.billId, createdBill.id), eq(expenses.categoryId, billCategory.id)))
      .limit(1);

    expect(paymentExpense).toBeTruthy();
  });

  it("throws a descriptive error when bill items have conflicting categories", async () => {
    const seed = `CONFLICT-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    const catA = await caller.expenses.createCategory({
      name: "Conflict A",
      accountingClass: "operating_expense",
    });
    const catB = await caller.expenses.createCategory({
      name: "Conflict B",
      accountingClass: "admin_expense",
    });

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "Conflict Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      description: "Conflicting categories",
      amount: "300.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Item A",
      quantity: "1",
      unitPrice: "100.00",
      totalPrice: "100.00",
      categoryId: catA.id,
    });
    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Item B",
      quantity: "1",
      unitPrice: "200.00",
      totalPrice: "200.00",
      categoryId: catB.id,
    });

    await expect(
      caller.bills.recordPayment({
        billId: createdBill.id,
        paymentMethod: "cash",
        amount: "300.00",
        paymentDate: "2026-05-12",
        accountId: paymentAccount.id,
      })
    ).rejects.toThrow(/conflicting categories/i);
  });

  it("throws friendly message when no category is defined anywhere", async () => {
    const seed = `NOCAT-${Date.now()}`;
    const ctx = await seedExpenseContext(seed);
    seededAccountIds.push(ctx.accountId);
    const caller = createCaller(ctx);

    await ensureSystemAccount({
      businessId: ctx.business.id,
      accountType: "liability",
      accountSubType: "accounts_payable",
      name: "Accounts Payable",
    });

    const paymentAccount = await caller.accounts.create({
      locationId: ctx.location.id,
      name: "No Cat Cash",
      type: "cash",
      openingBalance: "1000.00",
      isPaymentMethod: true,
    });

    const createdBill = await caller.bills.create({
      locationId: ctx.location.id,
      description: "No category anywhere",
      amount: "50.00",
      issueDate: "2026-05-10",
      dueDate: "2026-06-10",
    });

    await caller.bills.addItem({
      billId: createdBill.id,
      itemName: "Uncategorized item",
      quantity: "1",
      unitPrice: "50.00",
      totalPrice: "50.00",
    });

    await expect(
      caller.bills.recordPayment({
        billId: createdBill.id,
        paymentMethod: "cash",
        amount: "50.00",
        paymentDate: "2026-05-12",
        accountId: paymentAccount.id,
      })
    ).rejects.toThrow(/kindly define one/i);
  });
});
