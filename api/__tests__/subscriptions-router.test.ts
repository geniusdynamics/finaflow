// ABOUTME: Integration tests for the subscriptions router â€” CRUD, validation, tenant/branch isolation,
// ABOUTME: permission gating, payment posting to accounting (atomicity + posting location), calendar and stats.
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import {
  accounts,
  billPayments,
  bills,
  budgetBucketLines,
  budgetPlanBuckets,
  budgetPlans,
  businesses,
  expenseCategories,
  expenses,
  ledgerEntries,
  locations,
  subscriptionPayments,
  subscriptions,
  suppliers,
  userBusinesses,
  userLocations,
  users,
} from "@db/schema";
import { eq, sql } from "drizzle-orm";

type UserRow = typeof users.$inferSelect;
type BusinessRow = typeof businesses.$inferSelect;

interface CallerOptions {
  assignedLocationIds?: number[];
  enforceUserLocation?: boolean;
}

function makeAuthedCaller(user: UserRow, business: BusinessRow, bizIds: number[], opts: CallerOptions = {}) {
  const ctx = {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user: {
      ...user,
      currentBusiness: { ...business, accountRefId: null },
      businessIds: bizIds,
      assignedLocationIds: opts.assignedLocationIds,
      enforceUserLocation: opts.enforceUserLocation ?? false,
      allocationRightsProfile: null,
      accessSource: "owned" as const,
    },
  };
  return appRouter.createCaller(ctx);
}

describe("Subscriptions router", () => {
  let db: ReturnType<typeof getDb>;
  let bizA: BusinessRow;
  let bizB: BusinessRow;
  let locA1: typeof locations.$inferSelect;
  let locA2: typeof locations.$inferSelect;
  let locB: typeof locations.$inferSelect;
  let ownerA: UserRow;
  let managerA1: UserRow;
  let employeeA: UserRow;
  let viewerA: UserRow;
  let ownerB: UserRow;
  let catA: typeof expenseCategories.$inferSelect;
  let catNoAccount: typeof expenseCategories.$inferSelect;
  let catB: typeof expenseCategories.$inferSelect;
  let vendorA: typeof suppliers.$inferSelect;
  let vendorB: typeof suppliers.$inferSelect;
  let cashA1: typeof accounts.$inferSelect;
  let cashA2: typeof accounts.$inferSelect;
  let expenseAcctA: { id: number };

  let callerOwnerA: ReturnType<typeof appRouter.createCaller>;
  let callerManagerA1: ReturnType<typeof appRouter.createCaller>;
  let callerEmployeeA: ReturnType<typeof appRouter.createCaller>;
  let callerViewerA: ReturnType<typeof appRouter.createCaller>;
  let callerOwnerB: ReturnType<typeof appRouter.createCaller>;

  const baseSub = {
    name: "Google Workspace",
    amount: "1200.00",
    currency: "KES",
    cycleUnit: "month" as const,
    cycleCount: 1,
    startDate: "2026-01-01",
    nextDueDate: "2026-11-01",
    postingMode: "none" as const,
    notifyEnabled: true,
    isOneTime: false,
    autoRenew: false,
  };

  beforeAll(async () => {
    db = getDb();

    // Clean leftovers from previous runs.
    for (const prefix of ["SUBROUT_A", "SUBROUT_B"]) {
      const existingBiz = await db.select({ id: businesses.id }).from(businesses).where(sql`${businesses.slug} LIKE ${prefix + "%"}`);
      for (const b of existingBiz) {
        await db.delete(subscriptionPayments).where(eq(subscriptionPayments.businessId, b.id));
        await db.delete(subscriptions).where(eq(subscriptions.businessId, b.id));
        await db.delete(billPayments).where(sql`${billPayments.billId} IN (SELECT "id" FROM "bills" WHERE "businessId" = ${b.id})`);
        await db.delete(bills).where(eq(bills.businessId, b.id));
        await db.delete(expenses).where(eq(expenses.businessId, b.id));
        await db.delete(expenseCategories).where(eq(expenseCategories.businessId, b.id));
        const locs = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, b.id));
        for (const l of locs) {
          const acctIds = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.locationId, l.id));
          for (const a of acctIds) {
            await db.delete(ledgerEntries).where(eq(ledgerEntries.accountId, a.id));
          }
        }
        for (const l of locs) {
          await db.delete(accounts).where(eq(accounts.locationId, l.id));
        }
        await db.delete(locations).where(eq(locations.businessId, b.id));
        await db.delete(suppliers).where(eq(suppliers.businessId, b.id));
        await db.delete(userBusinesses).where(eq(userBusinesses.businessId, b.id));
        await db.delete(businesses).where(eq(businesses.id, b.id));
      }
      await db.delete(users).where(sql`${users.username} LIKE ${"sub-rout-" + prefix.toLowerCase().slice(-2) + "%"}`);
    }

    [bizA] = await db.insert(businesses).values({ accountId: "SUBROUT_A", name: "Subs Router A", slug: "SUBROUT_A_main", plan: "pro", isActive: true } as never).returning();
    [bizB] = await db.insert(businesses).values({ accountId: "SUBROUT_B", name: "Subs Router B", slug: "SUBROUT_B_main", plan: "pro", isActive: true } as never).returning();

    [locA1] = await db.insert(locations).values({ businessId: bizA.id, name: "Subs A Branch 1", slug: "subrout-a-b1", isActive: true, nextBillNumber: 1, nextExpenseNumber: 1 } as never).returning();
    [locA2] = await db.insert(locations).values({ businessId: bizA.id, name: "Subs A Branch 2", slug: "subrout-a-b2", isActive: true, nextBillNumber: 1, nextExpenseNumber: 1 } as never).returning();
    [locB] = await db.insert(locations).values({ businessId: bizB.id, name: "Subs B Branch", slug: "subrout-b-b1", isActive: true, nextBillNumber: 1, nextExpenseNumber: 1 } as never).returning();

    [ownerA] = await db.insert(users).values({ username: "sub-rout-a-owner", name: "Sub Owner A", role: "owner", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [managerA1] = await db.insert(users).values({ username: "sub-rout-a-manager", name: "Sub Manager A1", role: "manager", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [employeeA] = await db.insert(users).values({ username: "sub-rout-a-employee", name: "Sub Employee A", role: "employee", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [viewerA] = await db.insert(users).values({ username: "sub-rout-a-viewer", name: "Sub Viewer A", role: "viewer", isActive: true, currentBusinessId: bizA.id } as never).returning();
    [ownerB] = await db.insert(users).values({ username: "sub-rout-b-owner", name: "Sub Owner B", role: "owner", isActive: true, currentBusinessId: bizB.id } as never).returning();

    for (const [u, b] of [[ownerA, bizA], [managerA1, bizA], [employeeA, bizA], [viewerA, bizA], [ownerB, bizB]] as const) {
      await db.insert(userBusinesses).values({ userId: u.id, businessId: b.id, role: u.role, isActive: true } as never);
    }
    await db.insert(userLocations).values({ userId: managerA1.id, locationId: locA1.id, isActive: true } as never);

    [expenseAcctA] = await db.insert(accounts).values({ name: "Subs Expense Acct A", type: "bank_account", businessId: bizA.id, locationId: locA1.id, currentBalance: "0.00" } as never).returning({ id: accounts.id });
    [cashA1] = await db.insert(accounts).values({ name: "Subs Cash A1", type: "cash", businessId: bizA.id, locationId: locA1.id, currentBalance: "10000.00" } as never).returning() as typeof accounts.$inferSelect[];
    [cashA2] = await db.insert(accounts).values({ name: "Subs Cash A2", type: "cash", businessId: bizA.id, locationId: locA2.id, currentBalance: "10000.00" } as never).returning() as typeof accounts.$inferSelect[];

    [catA] = await db.insert(expenseCategories).values({ businessId: bizA.id, name: "Subs Cat A", defaultAccountId: expenseAcctA.id } as never).returning();
    [catNoAccount] = await db.insert(expenseCategories).values({ businessId: bizA.id, name: "Subs Cat No Account" } as never).returning();
    [catB] = await db.insert(expenseCategories).values({ businessId: bizB.id, name: "Subs Cat B" } as never).returning();

    [vendorA] = await db.insert(suppliers).values({ businessId: bizA.id, name: "Subs Vendor A", currentBalance: "0.00", totalPaid: "0.00" } as never).returning();
    [vendorB] = await db.insert(suppliers).values({ businessId: bizB.id, name: "Subs Vendor B", currentBalance: "0.00", totalPaid: "0.00" } as never).returning();

    callerOwnerA = makeAuthedCaller(ownerA, bizA, [bizA.id]);
    callerManagerA1 = makeAuthedCaller(managerA1, bizA, [bizA.id], { assignedLocationIds: [locA1.id], enforceUserLocation: true });
    callerEmployeeA = makeAuthedCaller(employeeA, bizA, [bizA.id]);
    callerViewerA = makeAuthedCaller(viewerA, bizA, [bizA.id]);
    callerOwnerB = makeAuthedCaller(ownerB, bizB, [bizB.id]);
  });

  // â”€â”€ CRUD + validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("creates business-wide and branch-pinned subscriptions with computed fields on get", async () => {
    const wide = await callerOwnerA.subscriptions.create({
      ...baseSub,
      locationId: null,
      postingLocationId: locA1.id,
      categoryId: catA.id,
      vendorId: vendorA.id,
    });
    const pinned = await callerOwnerA.subscriptions.create({ ...baseSub, name: "POS Licence", locationId: locA1.id, categoryId: catA.id });

    const fetched = await callerOwnerA.subscriptions.get({ id: wide.id });
    expect(fetched.name).toBe("Google Workspace");
    expect(fetched.locationId).toBeNull();
    expect(fetched.branchName).toBeNull();
    expect(fetched.monthlyNormalized).toBe("1200.00");
    expect(fetched.yearlyNormalized).toBe("14400.00");
    expect(fetched.vendorName).toBe("Subs Vendor A");
    expect(fetched.categoryName).toBe("Subs Cat A");
    expect(fetched.postingModeLabel).toBe("Reminder only");
    expect(typeof fetched.progress).toBe("number");
    expect(typeof fetched.daysUntilDue).toBe("number");

    const pinnedFetched = await callerOwnerA.subscriptions.get({ id: pinned.id });
    expect(pinnedFetched.branchName).toBe("Subs A Branch 1");
  });

  it("validates amount, cycleCount, branch, and cross-business references", async () => {
    await expect(callerOwnerA.subscriptions.create({ ...baseSub, amount: "0" })).rejects.toThrow(/greater than zero/);
    await expect(callerOwnerA.subscriptions.create({ ...baseSub, amount: "abc" })).rejects.toThrow(/Invalid amount/);
    await expect(
      callerOwnerA.subscriptions.create({ ...baseSub, cycleCount: 0, locationId: null }),
    ).rejects.toThrow();
    await expect(callerOwnerA.subscriptions.create({ ...baseSub, locationId: locB.id })).rejects.toThrow(/does not belong/);
    await expect(callerOwnerA.subscriptions.create({ ...baseSub, locationId: null, categoryId: catB.id })).rejects.toThrow(/does not belong/);
    await expect(callerOwnerA.subscriptions.create({ ...baseSub, locationId: null, vendorId: vendorB.id })).rejects.toThrow(/does not belong/);
  });

  it("requires a posting branch for business-wide subscriptions that post to accounting", async () => {
    await expect(
      callerOwnerA.subscriptions.create({ ...baseSub, locationId: null, postingMode: "expense", categoryId: catA.id }),
    ).rejects.toThrow(/Post to branch/);
    const ok = await callerOwnerA.subscriptions.create({
      ...baseSub,
      locationId: null,
      postingMode: "expense",
      postingLocationId: locA1.id,
      categoryId: catA.id,
    });
    expect(ok.id).toBeGreaterThan(0);
  });

  // â”€â”€ Isolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("hides subscriptions across businesses and rejects cross-business access", async () => {
    const subA = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Secret A", locationId: locA1.id });
    const listB = await callerOwnerB.subscriptions.list({});
    expect(listB.rows.find((r) => r.id === subA.id)).toBeUndefined();
    await expect(callerOwnerB.subscriptions.get({ id: subA.id })).rejects.toThrow(/not found/i);
    await expect(callerOwnerB.subscriptions.update({ id: subA.id, name: "Hacked" })).rejects.toThrow(/not found/i);
    await expect(callerOwnerB.subscriptions.delete({ id: subA.id })).rejects.toThrow(/not found/i);
    await expect(callerOwnerB.subscriptions.recordPayment({ subscriptionId: subA.id, paymentMethod: "cash" })).rejects.toThrow(/not found/i);
  });

  it("restricts branch-assigned users to their branches while keeping business-wide rows visible", async () => {
    const onA1 = await callerOwnerA.subscriptions.create({ ...baseSub, name: "On A1", locationId: locA1.id });
    const onA2 = await callerOwnerA.subscriptions.create({ ...baseSub, name: "On A2", locationId: locA2.id });
    const wide = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Wide", locationId: null });

    const list = await callerManagerA1.subscriptions.list({});
    const ids = list.rows.map((r) => r.id);
    expect(ids).toContain(onA1.id);
    expect(ids).toContain(wide.id);
    expect(ids).not.toContain(onA2.id);

    await expect(callerManagerA1.subscriptions.get({ id: onA2.id })).rejects.toThrow(/does not belong/);
    await expect(callerManagerA1.subscriptions.update({ id: onA2.id, name: "Nope" })).rejects.toThrow(/does not belong/);
    await expect(callerManagerA1.subscriptions.create({ ...baseSub, locationId: locA2.id })).rejects.toThrow(/does not belong/);
  });

  // â”€â”€ Permission gating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("enforces permissions server-side (employee cannot manage, viewer can only view)", async () => {
    await expect(callerEmployeeA.subscriptions.create({ ...baseSub, locationId: locA1.id })).rejects.toThrow(/permission/i);
    await expect(callerEmployeeA.subscriptions.list({})).rejects.toThrow(/permission/i);

    const viewerList = await callerViewerA.subscriptions.list({});
    expect(viewerList.rows.length).toBeGreaterThanOrEqual(0);
    await expect(callerViewerA.subscriptions.create({ ...baseSub, locationId: locA1.id })).rejects.toThrow(/permission/i);
    await expect(callerViewerA.subscriptions.delete({ id: 1 })).rejects.toThrow(/permission/i);
  });

  // â”€â”€ Payments + posting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("records a payment that posts an expense atomically and advances the schedule", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "AWS Production",
      locationId: locA1.id,
      categoryId: catA.id,
      vendorId: vendorA.id,
      postingMode: "expense",
      nextDueDate: "2026-11-01",
      cycleUnit: "month",
      cycleCount: 1,
    });

    const cashBefore = await db.select({ balance: accounts.currentBalance }).from(accounts).where(eq(accounts.id, cashA1.id));
    const result = await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: sub.id,
      paidDate: "2026-11-01",
      accountId: cashA1.id,
      paymentMethod: "cash",
      reference: "MPESA-123",
    });
    expect(result.paymentId).toBeGreaterThan(0);
    expect(result.expenseId).toBeGreaterThan(0);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(payments).toHaveLength(1);
    expect(payments[0].confirmed).toBe(true);
    expect(payments[0].paidDate).toBe("2026-11-01");
    expect(payments[0].expenseId).toBe(result.expenseId);
    expect(payments[0].locationId).toBe(locA1.id);

    const [expense] = await db.select().from(expenses).where(eq(expenses.id, result.expenseId!));
    expect(expense.amount).toBe("1200.00");
    expect(expense.locationId).toBe(locA1.id);
    expect(expense.supplierId).toBe(vendorA.id);

    const cashAfter = await db.select({ balance: accounts.currentBalance }).from(accounts).where(eq(accounts.id, cashA1.id));
    expect(Number(cashAfter[0].balance)).toBeCloseTo(Number(cashBefore[0].balance) - 1200, 2);

    const after = await callerOwnerA.subscriptions.get({ id: sub.id });
    expect(after.nextDueDate).toBe("2026-12-01");
  });

  it("rejects a second payment for the same cycle", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Duplicate Guard",
      locationId: locA1.id,
      categoryId: catA.id,
      postingMode: "none",
      nextDueDate: "2026-12-05",
    });
    await callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, cycleDueDate: "2026-12-05", paymentMethod: "cash", advance: false, allowEarly: true });
    await expect(
      callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, cycleDueDate: "2026-12-05", paymentMethod: "cash", advance: false }),
    ).rejects.toThrow(/already recorded/);
  });

  it("blocks marking the same subscription paid again until the next cycle is due (unless pay-early)", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "No Double Pay",
      locationId: locA1.id,
      postingMode: "none",
      nextDueDate: "2027-05-01",
      cycleUnit: "month",
      cycleCount: 1,
    });

    // Pay the cycle that is due (paid-date matches the cycle date).
    const first = await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: sub.id,
      paidDate: "2027-05-01",
      paymentMethod: "cash",
    });
    expect(first.paymentId).toBeGreaterThan(0);

    // The schedule advanced a cycle; marking paid again today must be refused.
    await expect(
      callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, paymentMethod: "cash" }),
    ).rejects.toThrow(/isn't due until/);

    // Explicit "Pay early" confirmation is still allowed (prepayment workflow).
    const early = await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: sub.id,
      paymentMethod: "cash",
      allowEarly: true,
    });
    expect(early.paymentId).toBeGreaterThan(0);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(payments).toHaveLength(2);

    // The list exposes the last paid date so the card can show payment state.
    const listed = await callerOwnerA.subscriptions.list({ search: "No Double Pay" });
    expect(listed.rows[0].lastPaidDate).toBe("2027-05-01");
  });

  it("defaults new subscriptions to bill posting and accrues expense/AP when settled", async () => {
    const { postingMode: _omitPostingMode, ...withoutPostingMode } = baseSub;
    const created = await callerOwnerA.subscriptions.create({
      ...withoutPostingMode,
      name: "Bill Mode Default",
      locationId: locA1.id,
      categoryId: catA.id,
      nextDueDate: "2027-09-01",
    });
    const row = await callerOwnerA.subscriptions.get({ id: created.id });
    expect(row.postingMode).toBe("bill");

    const result = await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: created.id,
      accountId: cashA1.id,
      paymentMethod: "cash",
      allowEarly: true,
    });
    expect(result.billId).toBeGreaterThan(0);
    expect(result.expenseId).toBeNull();

    const [bill] = await db.select().from(bills).where(eq(bills.id, result.billId!));
    expect(bill.externalSystem).toBe("subscription");
    expect(bill.externalId).toBe(`${created.id}:2027-09-01`);
    expect(bill.status).toBe("paid");

    const payments = await db.select().from(billPayments).where(eq(billPayments.billId, bill.id));
    expect(payments).toHaveLength(1);

    // Accrual entries must exist (expense debit + AP credit), otherwise AP would be debited
    // without ever being credited.
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.transactionId, bill.id));
    expect(entries.some((e) => e.entryType === "debit")).toBe(true);
    expect(entries.some((e) => e.entryType === "credit")).toBe(true);
  });

  it("rolls back payment and expense together when posting fails mid-way", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Broken Category",
      locationId: locA1.id,
      categoryId: catNoAccount.id,
      postingMode: "expense",
      nextDueDate: "2027-01-10",
    });

    await expect(
      callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, accountId: cashA1.id, paymentMethod: "cash", allowEarly: true }),
    ).rejects.toThrow(/not linked to a chart of accounts/);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(payments).toHaveLength(0);
    const expensesAfter = await db.select().from(expenses).where(eq(expenses.businessId, bizA.id));
    expect(expensesAfter.find((e) => e.description?.includes("Broken Category"))).toBeUndefined();
  });

  it("posts business-wide subscriptions to their declared posting branch", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Wide Posting",
      locationId: null,
      postingLocationId: locA2.id,
      categoryId: catA.id,
      postingMode: "expense",
      nextDueDate: "2027-02-01",
    });
    const result = await callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, accountId: cashA2.id, paymentMethod: "cash", allowEarly: true });
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, result.expenseId!));
    expect(expense.locationId).toBe(locA2.id);
  });

  it("posts nothing for postingMode 'none'", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Reminder Only",
      locationId: locA1.id,
      categoryId: catA.id,
      postingMode: "none",
      nextDueDate: "2027-03-01",
    });
    const result = await callerOwnerA.subscriptions.recordPayment({ subscriptionId: sub.id, paymentMethod: "cash", allowEarly: true });
    expect(result.expenseId).toBeNull();
    expect(result.billId).toBeNull();
  });

  it("posts a payment as a fully paid bill when postingMode is 'bill'", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "AP Posting",
      locationId: locA1.id,
      categoryId: catA.id,
      vendorId: vendorA.id,
      postingMode: "bill",
      nextDueDate: "2027-07-15",
    });
    const result = await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: sub.id,
      accountId: cashA1.id,
      paymentMethod: "cash",
      allowEarly: true,
    });
    expect(result.billId).toBeGreaterThan(0);

    const [bill] = await db.select().from(bills).where(eq(bills.id, result.billId!));
    expect(bill.status).toBe("paid");
    expect(bill.amountPaid).toBe("1200.00");
    expect(bill.locationId).toBe(locA1.id);

    const payments = await db.select().from(billPayments).where(eq(billPayments.billId, result.billId!));
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe("1200.00");
  });

  it("renews exactly one cycle and can record the payment in the same step", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Renewable",
      locationId: locA1.id,
      categoryId: catA.id,
      postingMode: "none",
      nextDueDate: "2026-11-15",
      cycleUnit: "month",
      cycleCount: 2,
    });
    const renewed = await callerOwnerA.subscriptions.renew({ id: sub.id, record: true, paidDate: "2026-11-15", paymentMethod: "cash" });
    expect(renewed.nextDueDate).toBe("2027-01-15");
    expect(renewed.paymentId).toBeGreaterThan(0);

    const payments = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.subscriptionId, sub.id));
    expect(payments).toHaveLength(1);
    expect(payments[0].cycleDueDate).toBe("2026-11-15");
  });

  it("confirms a scheduler-pending payment and posts it", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Auto Renew",
      locationId: locA1.id,
      categoryId: catA.id,
      postingMode: "expense",
      nextDueDate: "2027-04-01",
    });
    const [pending] = await db
      .insert(subscriptionPayments)
      .values({
        subscriptionId: sub.id,
        businessId: bizA.id,
        locationId: locA1.id,
        cycleDueDate: "2027-04-01",
        amount: "1200.00",
        currency: "KES",
        confirmed: false,
        paymentMethod: "bank_transfer",
        recordedBy: ownerA.id,
      } as never)
      .returning();

    const result = await callerOwnerA.subscriptions.confirmPayment({ id: pending.id });
    expect(result.expenseId).toBeGreaterThan(0);
    const [confirmed] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, pending.id));
    expect(confirmed.confirmed).toBe(true);
    expect(confirmed.paidDate).toBeTruthy();
  });

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("supports pause/resume/cancel and rejects invalid transitions", async () => {
    const sub = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Lifecycle", locationId: locA1.id, nextDueDate: "2026-11-20" });
    await callerOwnerA.subscriptions.pause({ id: sub.id });
    let row = await callerOwnerA.subscriptions.get({ id: sub.id });
    expect(row.status).toBe("paused");
    await expect(callerOwnerA.subscriptions.pause({ id: sub.id })).rejects.toThrow(/Only active/);

    await callerOwnerA.subscriptions.resume({ id: sub.id });
    row = await callerOwnerA.subscriptions.get({ id: sub.id });
    expect(row.status).toBe("active");

    await callerOwnerA.subscriptions.cancel({ id: sub.id, cancelReason: "Too expensive", cancellationDate: "2026-11-25" });
    row = await callerOwnerA.subscriptions.get({ id: sub.id });
    expect(row.status).toBe("cancelled");
    expect(row.cancelReason).toBe("Too expensive");
    expect(row.cancellationDate).toBe("2026-11-25");
    await expect(callerOwnerA.subscriptions.cancel({ id: sub.id })).rejects.toThrow(/already cancelled/);
  });

  it("clones a subscription with reset dates and a (copy) suffix", async () => {
    const sub = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Clonable", locationId: locA1.id, categoryId: catA.id, notes: "keep me" });
    const cloned = await callerOwnerA.subscriptions.clone({ id: sub.id });
    const row = await callerOwnerA.subscriptions.get({ id: cloned.id });
    expect(row.name).toBe("Clonable (copy)");
    expect(row.notes).toBe("keep me");
    expect(row.status).toBe("active");
  });

  // â”€â”€ Calendar + stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("returns calendar events in range with one-time subs only on their exact date", async () => {
    const recurring = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Cal Recurring", locationId: locA1.id, nextDueDate: "2027-05-05", cycleUnit: "month", cycleCount: 1, isOneTime: false });
    const oneTime = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Cal OneTime", locationId: locA1.id, nextDueDate: "2027-05-20", isOneTime: true });
    const outOfRange = await callerOwnerA.subscriptions.create({ ...baseSub, name: "Cal Out", locationId: locA1.id, nextDueDate: "2027-08-10", cycleUnit: "month", cycleCount: 1 });

    const { events } = await callerOwnerA.subscriptions.calendar({ dateFrom: "2027-05-01", dateTo: "2027-05-31" });
    const recurringDates = events.filter((e) => e.id === recurring.id).map((e) => e.date);
    expect(recurringDates).toContain("2027-05-05");
    const oneTimeDates = events.filter((e) => e.id === oneTime.id).map((e) => e.date);
    expect(oneTimeDates).toEqual(["2027-05-20"]);
    expect(events.find((e) => e.id === outOfRange.id)).toBeUndefined();
  });

  it("computes stats with mixed-currency conversion via real seeded rates", async () => {
    const statsBiz = await callerOwnerA.subscriptions.stats({});
    const monthlyTotal = Number(statsBiz.kpis.monthlyTotal);
    expect(monthlyTotal).toBeGreaterThan(0);

    const splitSum = statsBiz.categorySplit.reduce((acc, s) => acc + Number(s.monthly), 0);
    expect(splitSum).toBeCloseTo(monthlyTotal, 1);
    const branchSum = statsBiz.branchSplit.reduce((acc, s) => acc + Number(s.monthly), 0);
    expect(branchSum).toBeCloseTo(monthlyTotal, 1);
    expect(statsBiz.projection.length).toBeGreaterThan(0);
    expect(statsBiz.projection.length).toBeLessThanOrEqual(12);
    expect(statsBiz.baseCurrency).toBe("KES");
    expect(statsBiz.kpis.activeCount).toBeGreaterThan(0);
    expect(statsBiz.kpis.costPerDay).toBeTruthy();
    expect(statsBiz.kpis.savingsMonthly).toBeTruthy();
  });

  it("filters the list by status and search", async () => {
    await callerOwnerA.subscriptions.create({ ...baseSub, name: "Filter Me", locationId: locA1.id, nextDueDate: "2027-06-01" });
    const filtered = await callerOwnerA.subscriptions.list({ search: "Filter Me" });
    expect(filtered.rows.length).toBeGreaterThanOrEqual(1);
    expect(filtered.rows.every((r) => r.name.includes("Filter Me"))).toBe(true);

    const paused = await callerOwnerA.subscriptions.list({ status: "paused" });
    expect(paused.rows.every((r) => r.status === "paused")).toBe(true);
  });

  it("exposes calendar month statistics with counts, converted totals and payment-netted amount due", async () => {
    const sub = await callerOwnerA.subscriptions.create({
      ...baseSub,
      name: "Month Stats Sub",
      amount: "1000.00",
      cycleUnit: "month",
      cycleCount: 1,
      locationId: locA1.id,
      postingMode: "none",
      nextDueDate: "2027-08-05",
    });

    const before = await callerOwnerA.subscriptions.stats({});
    const aug = before.monthStats.find((m) => m.month === "2027-08");
    expect(aug).toBeTruthy();
    expect(aug!.dueCount).toBeGreaterThanOrEqual(1);
    expect(Number(aug!.total)).toBeGreaterThanOrEqual(1000);
    expect(Number(aug!.amountDue)).toBeLessThanOrEqual(Number(aug!.total));
    expect(before.monthStats.length).toBeLessThanOrEqual(12);
    expect(before.monthStats.every((m) => /^\d{4}-\d{2}$/.test(m.month))).toBe(true);

    // Paying the cycle nets it off "amount due" but not "total".
    await callerOwnerA.subscriptions.recordPayment({
      subscriptionId: sub.id,
      cycleDueDate: "2027-08-05",
      paymentMethod: "cash",
      advance: false,
      allowEarly: true,
    });
    const after = await callerOwnerA.subscriptions.stats({});
    const augAfter = after.monthStats.find((m) => m.month === "2027-08")!;
    expect(Number(augAfter.total)).toBeCloseTo(Number(aug!.total), 2);
    expect(Number(augAfter.amountDue)).toBeCloseTo(Number(aug!.amountDue) - 1000, 2);
  });

  it("auto-provisions budget lines for subscription categories on a draft plan only", async () => {
    const [plan] = await db.insert(budgetPlans).values({ locationId: locA1.id, fiscalYearStart: 2027, period: "monthly", status: "draft" } as never).returning();
    const [bucket] = await db
      .insert(budgetPlanBuckets)
      .values({ planId: plan.id, bucketType: "month", bucketIndex: 0, startMonth: 1, endMonth: 1, label: "Jan" } as never)
      .returning();

    const result = await callerOwnerA.subscriptions.autoProvisionBudgets({ planId: plan.id });
    expect(result.created).toBeGreaterThan(0);

    const lines = await db.select().from(budgetBucketLines).where(eq(budgetBucketLines.bucketId, bucket.id));
    expect(lines.length).toBe(result.created);
    expect(lines.every((l) => Number(l.amount) > 0)).toBe(true);

    // Idempotent: a second run adds nothing.
    const again = await callerOwnerA.subscriptions.autoProvisionBudgets({ planId: plan.id });
    expect(again.created).toBe(0);

    // Active plans are protected.
    await db.update(budgetPlans).set({ status: "active" }).where(eq(budgetPlans.id, plan.id));
    await expect(callerOwnerA.subscriptions.autoProvisionBudgets({ planId: plan.id })).rejects.toThrow(/draft/);

    await db.delete(budgetBucketLines).where(eq(budgetBucketLines.bucketId, bucket.id));
    await db.delete(budgetPlanBuckets).where(eq(budgetPlanBuckets.planId, plan.id));
    await db.delete(budgetPlans).where(eq(budgetPlans.id, plan.id));
  });
});
