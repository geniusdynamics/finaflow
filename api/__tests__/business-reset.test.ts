// ABOUTME: Comprehensive test suite for the enhanced business transaction reset functionality.
// ABOUTME: Verifies data clearing, record preservation, referential integrity, and audit logging.
import { afterEach, describe, expect, it } from "vitest";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";

import { getTestDb } from "../test/db";
import {
  accounts,
  bills,
  billItems,
  billPayments,
  businesses,
  dailySales,
  dailySalePayments,
  debts,
  expenses,
  expenseItems,
  journalEntries,
  journalLines,
  ledgerEntries,
  locations,
  mpesaTransactions,
  notifications,
  payrollAdvances,
  payrollEntries,
  payrollPeriods,
  suppliers,
  userBusinesses,
  users,
  expenseCategories,
  budgetBucketLines,
  budgetPlanBuckets,
  budgetPlans,
  employees,
  auditLog,
  budgets,
  purchaseOrders,
  purchaseOrderItems,
  recurringBillTemplates,
} from "@db/schema";
import {
  resetBusinessTransactions,
  validatePreReset,
  createResetSnapshot,
} from "../lib/business-reset";

// ─── Test Utilities ──────────────────────────────────────────────────────────

// Helper to handle the union return type of drizzle .returning()
async function firstRow<T>(promise: Promise<unknown>): Promise<T> {
  const result = await promise;
  const rows = Array.isArray(result) ? result : [];
  return rows[0] as T;
}

type SeededContext = {
  accountId: string;
  business: { id: number };
  location: { id: number };
  owner: { id: number; role: string; currentBusinessId: number };
  operationalAccount: { id: number };
  operationalAccountNoBizId: { id: number };
  systemAccount: { id: number };
  journalEntry: { id: number };
  employee: { id: number };
  supplier: { id: number };
  expense: { id: number };
  expenseItem: { id: number };
  sale: { id: number };
  bill: { id: number };
  category: { id: number };
  payrollPeriod: { id: number };
  purchaseOrder: { id: number };
  debt: { id: number };
};

async function seedResetContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `RESET-${seed}`;

  const business = await firstRow<typeof businesses.$inferSelect>(db.insert(businesses).values({
    accountId,
    name: `Reset ${seed}`,
    slug: `reset-${seed.toLowerCase()}`,
    plan: "pro",
    isActive: true,
  } satisfies typeof businesses.$inferInsert).returning());

  const owner = await firstRow<typeof users.$inferSelect>(db.insert(users).values({
    username: `owner-${seed.toLowerCase()}`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id,
    accountId,
  } satisfies typeof users.$inferInsert).returning());

  await db.insert(userBusinesses).values({
    userId: owner.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } satisfies typeof userBusinesses.$inferInsert);

  const location = await firstRow<typeof locations.$inferSelect>(db.insert(locations).values({
    businessId: business.id,
    name: `Main ${seed}`,
    slug: `main-${seed.toLowerCase()}`,
    isActive: true,
    nextBillNumber: 19,
    nextExpenseNumber: 27,
  } satisfies typeof locations.$inferInsert).returning());

  // Create operational (user) account (with businessId set — CoA-linked account)
  const opAccount = await firstRow<typeof accounts.$inferSelect>(db.insert(accounts).values({
    businessId: business.id,
    locationId: location.id,
    name: "Cash Drawer",
    type: "cash",
    currentBalance: "450.00",
    openingBalance: "100.00",
    isActive: true,
  } satisfies typeof accounts.$inferInsert).returning());

  // Create realistic operational account WITHOUT businessId — simulates the production
  // scenario where operational accounts only have locationId set, businessId is NULL
  const operationalAccountNoBizId = await firstRow<typeof accounts.$inferSelect>(db.insert(accounts).values({
    locationId: location.id,
    businessId: null as unknown as undefined,
    name: "M-PESA Till",
    type: "bank_account",
    currentBalance: "4599.00",
    openingBalance: "1000.00",
    isActive: true,
  } satisfies typeof accounts.$inferInsert).returning());

  // Create system account
  const sysAccount = await firstRow<typeof accounts.$inferSelect>(db.insert(accounts).values({
    businessId: business.id,
    locationId: null,
    name: "Expense Clearing",
    type: "bank_account",
    accountType: "expense",
    accountSubType: "operating_expense",
    currentBalance: "900.00",
    openingBalance: "0.00",
    systemKey: "expense:operating_expense",
    isSystemGenerated: true,
    isActive: true,
  } satisfies typeof accounts.$inferInsert).returning());

  // Create expense category (accounts must exist first due to FK constraint)
  const category = await firstRow<typeof expenseCategories.$inferSelect>(db.insert(expenseCategories).values({
    businessId: business.id,
    locationId: location.id,
    name: `Test Category ${seed}`,
    color: "#C73E1D",
    defaultAccountId: sysAccount.id,
    isActive: true,
  } satisfies typeof expenseCategories.$inferInsert).returning());

  // Create supplier
  const supplier = await firstRow<typeof suppliers.$inferSelect>(db.insert(suppliers).values({
    businessId: business.id,
    name: `Supplier ${seed}`,
    currentBalance: "5000.00",
    totalBilled: "10000.00",
    totalPaid: "5000.00",
  } satisfies typeof suppliers.$inferInsert).returning());

  // Create employee
  const employee = await firstRow<typeof employees.$inferSelect>(db.insert(employees).values({
    locationId: location.id,
    fullName: `Employee ${seed}`,
    phone: "0712345678",
    salaryType: "monthly",
    basicSalary: "50000.00",
    employmentDate: "2026-01-01",
    isActive: true,
  } satisfies typeof employees.$inferInsert).returning());

  // Create journal entry
  const entry = await firstRow<typeof journalEntries.$inferSelect>(db.insert(journalEntries).values({
    businessId: business.id,
    entryNumber: `JE-${seed}`,
    entryDate: "2026-05-16",
    description: "Reset me",
    isPosted: true,
    createdBy: owner.id,
  } satisfies typeof journalEntries.$inferInsert).returning());

  await db.insert(journalLines).values({
    journalEntryId: entry.id,
    accountId: sysAccount.id,
    debit: "900.00",
    credit: "0.00",
    lineNumber: 1,
  } satisfies typeof journalLines.$inferInsert);

  await db.insert(ledgerEntries).values({
    accountId: sysAccount.id,
    transactionType: "journal",
    transactionId: entry.id,
    entryType: "debit",
    amount: "900.00",
    balanceAfter: "900.00",
    entryDate: "2026-05-16",
    createdBy: owner.id,
  } satisfies typeof ledgerEntries.$inferInsert);

  // Create daily sale
  const sale = await firstRow<typeof dailySales.$inferSelect>(db.insert(dailySales).values({
    locationId: location.id,
    saleDate: "2026-05-16",
    netSales: "1500.00",
    cashTotal: "1500.00",
    enteredBy: owner.id,
  } satisfies typeof dailySales.$inferInsert).returning());

  await db.insert(dailySalePayments).values({
    dailySaleId: sale.id,
    paymentMethodId: 1,
    amount: "1500.00",
  } satisfies typeof dailySalePayments.$inferInsert);

  // Create expense
  const expense = await firstRow<typeof expenses.$inferSelect>(db.insert(expenses).values({
    locationId: location.id,
    businessId: business.id,
    categoryId: category.id,
    supplierId: supplier.id,
    amount: "250.00",
    description: `Test expense ${seed}`,
    expenseDate: "2026-05-16",
    paymentMethod: "cash",
    accountId: opAccount.id,
    enteredBy: owner.id,
  } satisfies typeof expenses.$inferInsert).returning());

  const expenseItem = await firstRow<typeof expenseItems.$inferSelect>(db.insert(expenseItems).values({
    expenseId: expense.id,
    itemName: `Item ${seed}`,
    quantity: "1.000",
    unitPrice: "250.00",
    totalPrice: "250.00",
    categoryId: category.id,
  } satisfies typeof expenseItems.$inferInsert).returning());

  // Create bill
  const bill = await firstRow<typeof bills.$inferSelect>(db.insert(bills).values({
    locationId: location.id,
    businessId: business.id,
    supplierId: supplier.id,
    amount: "1000.00",
    amountPaid: "0.00",
    balanceDue: "1000.00",
    description: `Test bill ${seed}`,
    issueDate: "2026-05-16",
    dueDate: "2026-06-15",
    status: "pending",
  } satisfies typeof bills.$inferInsert).returning());

  await db.insert(billItems).values({
    billId: bill.id,
    itemName: `Bill Item ${seed}`,
    quantity: "1.000",
    unitPrice: "1000.00",
    totalPrice: "1000.00",
  } satisfies typeof billItems.$inferInsert);

  // Create M-PESA transaction (txnId limited to varchar(20))
  const uniqueTag = `${seed}-${Math.random().toString(36).slice(2, 8)}`;
  await db.insert(mpesaTransactions).values({
    locationId: location.id,
    txnId: `TXN-${uniqueTag}`.slice(0, 20),
    txnDate: "2026-05-16",
    txnType: "topup",
    amount: "500.00",
    description: `Test M-PESA ${seed}`,
    importedBy: owner.id,
  } satisfies typeof mpesaTransactions.$inferInsert);

  // Create payroll period
  const payrollPeriod = await firstRow<typeof payrollPeriods.$inferSelect>(db.insert(payrollPeriods).values({
    locationId: location.id,
    periodName: `May 2026 ${seed}`,
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    paymentDate: "2026-05-25",
    status: "open",
  } satisfies typeof payrollPeriods.$inferInsert).returning());

  await db.insert(payrollEntries).values({
    periodId: payrollPeriod.id,
    employeeId: employee.id,
    basicPay: "50000.00",
    netPay: "45000.00",
    paymentMethod: "wallet",
  } satisfies typeof payrollEntries.$inferInsert);

  await db.insert(payrollAdvances).values({
    employeeId: employee.id,
    amount: "5000.00",
    balanceRemaining: "3000.00",
    requestDate: "2026-05-10",
    status: "approved",
  } satisfies typeof payrollAdvances.$inferInsert);

  await db.insert(budgets).values({
    locationId: location.id,
    categoryId: category.id,
    month: 5,
    year: 2026,
    amount: "5000.00",
  } satisfies typeof budgets.$inferInsert);

  const po = await firstRow<typeof purchaseOrders.$inferSelect>(db.insert(purchaseOrders).values({
    locationId: location.id,
    supplierId: supplier.id,
    poNumber: `PO-${seed}`,
    description: `Test PO ${seed}`,
    status: "draft",
    total: "2000.00",
    createdBy: owner.id,
  } satisfies typeof purchaseOrders.$inferInsert).returning());

  await db.insert(purchaseOrderItems).values({
    poId: po.id,
    itemName: `PO Item ${seed}`,
    quantity: "2.000",
    unitPrice: "1000.00",
    totalPrice: "2000.00",
  } satisfies typeof purchaseOrderItems.$inferInsert);

  // Create recurring bill template
  await db.insert(recurringBillTemplates).values({
    locationId: location.id,
    businessId: business.id,
    description: `Recurring ${seed}`,
    amount: "500.00",
    frequency: "monthly",
    nextDueDate: "2026-06-01",
    isActive: true,
  } satisfies typeof recurringBillTemplates.$inferInsert);

  // Create debt record
  const debt = await firstRow<typeof debts.$inferSelect>(db.insert(debts).values({
    locationId: location.id,
    businessId: business.id,
    creditorName: `Creditor ${seed}`,
    totalAmount: "10000.00",
    paidAmount: "2000.00",
    dueDate: new Date("2026-12-31"),
    status: "active",
    createdBy: owner.id,
  } satisfies typeof debts.$inferInsert).returning());

  // Create notification
  await db.insert(notifications).values({
    userId: owner.id,
    type: "info",
    title: `Test notification ${seed}`,
    message: "This is a test notification",
    severity: "info",
    locationId: location.id,
  } satisfies typeof notifications.$inferInsert);

  return {
    accountId,
    business,
    location,
    owner: { id: owner.id, role: owner.role, currentBusinessId: business.id },
    operationalAccount: opAccount,
    operationalAccountNoBizId,
    systemAccount: sysAccount,
    journalEntry: entry,
    employee,
    supplier,
    expense,
    expenseItem,
    sale,
    bill,
    category,
    payrollPeriod,
    purchaseOrder: po,
    debt,
  };
}

async function cleanupResetContext(accountId: string) {
  const db = getTestDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
  if (!business) return;

  // Clean up in proper dependency order
  const locRows = await db.select({ id: locations.id }).from(locations).where(eq(locations.businessId, business.id));
  const locIds = locRows.map((r) => r.id);

  if (locIds.length > 0) {
    const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
    await db.delete(notifications).where(sql`${notifications.locationId} IN (${locIdSql})`);
    await db.delete(dailySalePayments).where(sql`${dailySalePayments.id} > 0`);
    await db.delete(dailySales).where(sql`${dailySales.locationId} IN (${locIdSql})`);
    await db.delete(budgets).where(sql`${budgets.locationId} IN (${locIdSql})`);
    await db.delete(purchaseOrderItems).where(sql`${purchaseOrderItems.id} > 0`);
    await db.delete(purchaseOrders).where(sql`${purchaseOrders.locationId} IN (${locIdSql})`);
    await db.delete(recurringBillTemplates).where(sql`${recurringBillTemplates.locationId} IN (${locIdSql})`);
    await db.delete(mpesaTransactions).where(sql`${mpesaTransactions.locationId} IN (${locIdSql})`);
    await db.delete(debts).where(sql`${debts.locationId} IN (${locIdSql})`);
  }

  const journalRows = await db.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.businessId, business.id));
  const journalIds = journalRows.map((r) => r.id);
  const accountRows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.businessId, business.id));
  const accountIds = accountRows.map((r) => r.id);
  const expenseRows = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.businessId, business.id));
  const expenseIds = expenseRows.map((r) => r.id);
  const billRows = await db.select({ id: bills.id }).from(bills).where(eq(bills.businessId, business.id));
  const billIds = billRows.map((r) => r.id);
  const employeeRows = await db.select({ id: employees.id }).from(employees).where(eq(employees.locationId, locIds[0]));
  const employeeIds = employeeRows.map((r) => r.id);

  if (employeeIds.length > 0) {
    await db.delete(payrollAdvances).where(inArray(payrollAdvances.employeeId, employeeIds));
  }
  if (expenseIds.length > 0) {
    await db.delete(expenseItems).where(inArray(expenseItems.expenseId, expenseIds));
  }
  if (billIds.length > 0) {
    await db.delete(billItems).where(inArray(billItems.billId, billIds));
    await db.delete(billPayments).where(inArray(billPayments.billId, billIds));
  }
  await db.delete(payrollEntries).where(sql`${payrollEntries.id} > 0`);
  await db.delete(payrollPeriods).where(sql`${payrollPeriods.id} > 0`);

  for (const jId of journalIds) {
    await db.delete(journalLines).where(eq(journalLines.journalEntryId, jId));
  }
  if (accountIds.length > 0) {
    const acctIdSql = sql.join(accountIds.map((id) => sql`${id}`), sql`, `);
    await db.delete(ledgerEntries).where(sql`${ledgerEntries.accountId} IN (${acctIdSql})`);
  }
  await db.delete(journalEntries).where(eq(journalEntries.businessId, business.id));
  await db.delete(expenses).where(eq(expenses.businessId, business.id));
  await db.delete(bills).where(eq(bills.businessId, business.id));
  // Try to clean up budget bucket lines if the table exists (migration 0014+)
  try {
    await db.delete(budgetBucketLines).where(sql`${budgetBucketLines.id} > 0`);
    await db.delete(budgetPlanBuckets).where(sql`${budgetPlanBuckets.id} > 0`);
    await db.delete(budgetPlans).where(sql`${budgetPlans.id} > 0`);
  } catch {
    // budget plan tables don't exist yet (migration 0014 not applied)
  }

  // Delete expense_categories FIRST (FK references accounts.id via defaultAccountId)
  await db.delete(expenseCategories).where(eq(expenseCategories.businessId, business.id));
  await db.delete(accounts).where(eq(accounts.businessId, business.id));
  // Also clean up accounts with only locationId (no businessId)
  if (locIds.length > 0) {
    const locIdSql = sql.join(locIds.map((id) => sql`${id}`), sql`, `);
    await db.delete(accounts).where(and(
      isNull(accounts.businessId),
      sql`${accounts.locationId} IN (${locIdSql})`
    ));
  }
  await db.delete(suppliers).where(eq(suppliers.businessId, business.id));
  await db.delete(employees).where(sql`${employees.id} > 0`);
  await db.delete(locations).where(eq(locations.businessId, business.id));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, business.id));
  await db.delete(auditLog).where(eq(auditLog.tableName, "business_reset"));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.id, business.id));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("resetBusinessTransactions", () => {
  const seededAccountIds: string[] = [];

  afterEach(async () => {
    while (seededAccountIds.length > 0) {
      const accountId = seededAccountIds.pop();
      if (accountId) {
        await cleanupResetContext(accountId);
      }
    }
  });

  // ── Test 1: Comprehensive reset clears all transactional data ────────────

  it("clears all transactional data while preserving setup records", async () => {
    const seed = `COMPREHENSIVE-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const result = await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
      userId: ctx.owner.id,
    });

    expect(result.success).toBe(true);
    expect(result.preserved).toContain("audit_log");
    expect(result.preserved).toContain("accounts (all)");
    expect(result.resetAt).toBeTruthy();

    // Verify system account preserved and balance reset
    const [savedSystemAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, ctx.systemAccount.id))
      .limit(1);
    expect(savedSystemAccount).toBeDefined();
    expect(savedSystemAccount.deletedAt).toBeNull();
    expect(savedSystemAccount.currentBalance).toBe("0.00");
    expect(savedSystemAccount.openingBalance).toBe("0.00");
    expect(savedSystemAccount.isActive).toBe(true);

    // Verify user account preserved with balance reset
    const [savedOperationalAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, ctx.operationalAccount.id))
      .limit(1);
    expect(savedOperationalAccount.deletedAt).toBeNull();
    expect(savedOperationalAccount.isActive).toBe(true);
    expect(savedOperationalAccount.currentBalance).toBe("0.00");
    expect(savedOperationalAccount.openingBalance).toBe("0.00");

    // Verify journal entry hard-deleted
    const journalEntriesAfter = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, ctx.journalEntry.id));
    expect(journalEntriesAfter.length).toBe(0);

    // Verify journal lines hard-deleted
    const journalLinesAfter = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, ctx.journalEntry.id));
    expect(journalLinesAfter.length).toBe(0);

    // Verify ledger entries hard-deleted
    const ledgerAfter = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, ctx.systemAccount.id));
    expect(ledgerAfter.length).toBe(0);

    // Verify daily sale soft-deleted
    const [savedSale] = await db
      .select()
      .from(dailySales)
      .where(eq(dailySales.id, ctx.sale.id))
      .limit(1);
    expect(savedSale.deletedAt).not.toBeNull();

    // Verify expense soft-deleted
    const [savedExpense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, ctx.expense.id))
      .limit(1);
    expect(savedExpense.deletedAt).not.toBeNull();

    // Verify expense items soft-deleted
    const [savedExpenseItem] = await db
      .select()
      .from(expenseItems)
      .where(eq(expenseItems.id, ctx.expenseItem.id))
      .limit(1);
    expect(savedExpenseItem.deletedAt).not.toBeNull();

    // Verify bill soft-deleted
    const [savedBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, ctx.bill.id))
      .limit(1);
    expect(savedBill.deletedAt).not.toBeNull();
    expect(savedBill.status).toBe("cancelled");
    expect(savedBill.balanceDue).toBe("0.00");

    // Verify location counters reset
    const [savedLocation] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, ctx.location.id))
      .limit(1);
    expect(savedLocation.nextBillNumber).toBe(1);
    expect(savedLocation.nextExpenseNumber).toBe(1);

    // Verify supplier balances reset
    const [savedSupplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, ctx.supplier.id))
      .limit(1);
    expect(savedSupplier.currentBalance).toBe("0.00");
    expect(savedSupplier.totalBilled).toBe("0.00");
    expect(savedSupplier.totalPaid).toBe("0.00");

    // Verify debt soft-deleted
    const [savedDebt] = await db
      .select()
      .from(debts)
      .where(eq(debts.id, ctx.debt.id))
      .limit(1);
    expect(savedDebt.deletedAt).not.toBeNull();
    expect(savedDebt.status).toBe("cancelled");

    // Verify audit log entry was written
    const auditEntries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.tableName, "business_reset"), eq(auditLog.recordId, ctx.business.id)));
    expect(auditEntries.length).toBeGreaterThan(0);
    expect(auditEntries[0].action).toBe("DELETE");
  });

  // ── Test 2: Preserved records remain intact ──────────────────────────────

  it("preserves all immutable records after reset", async () => {
    const seed = `PRESERVE-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
      userId: ctx.owner.id,
    });

    // Preserved: locations (still exist)
    const locationsAfter = await db
      .select()
      .from(locations)
      .where(and(eq(locations.businessId, ctx.business.id), isNull(locations.deletedAt)));
    expect(locationsAfter.length).toBeGreaterThan(0);

    // Preserved: expense_categories
    const categoriesAfter = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, ctx.category.id));
    expect(categoriesAfter[0].deletedAt).toBeNull();

    // Preserved: employees (still exist, not deleted)
    const employeesAfter = await db
      .select()
      .from(employees)
      .where(eq(employees.id, ctx.employee.id));
    expect(employeesAfter[0].deletedAt).toBeNull();
    expect(employeesAfter[0].isActive).toBe(true);

    // Preserved: suppliers (still exist)
    const suppliersAfter = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, ctx.supplier.id));
    expect(suppliersAfter[0].deletedAt).toBeNull();
  });

  // ── Test 3: Pre-reset validation works ───────────────────────────────────

  it("validatePreReset returns valid state for a business with data", async () => {
    const seed = `VALIDATE-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const validation = await validatePreReset({
      db,
      businessId: ctx.business.id,
    });

    expect(validation.valid).toBe(true);
    expect(validation.businessExists).toBe(true);
    expect(validation.hasLocations).toBe(true);
    expect(validation.locationCount).toBeGreaterThan(0);
    expect(Array.isArray(validation.warnings)).toBe(true);
  });

  // ── Test 4: Reset snapshot captures correct pre-reset counts ─────────────

  it("createResetSnapshot captures accurate pre-reset record counts", async () => {
    const seed = `SNAPSHOT-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const snapshot = await createResetSnapshot({
      db,
      businessId: ctx.business.id,
    });

    expect(snapshot.businessId).toBe(ctx.business.id);
    expect(snapshot.timestamp).toBeTruthy();
    expect(Number(snapshot.tableCounts.dailySales)).toBeGreaterThan(0);
    expect(Number(snapshot.tableCounts.expenses)).toBeGreaterThan(0);
    expect(Number(snapshot.tableCounts.bills)).toBeGreaterThan(0);
    expect(Number(snapshot.tableCounts.mpesaTransactions)).toBeGreaterThan(0);
    expect(Number(snapshot.tableCounts.journalEntries)).toBeGreaterThan(0);
  });

  // ── Test 5: Return results structure ─────────────────────────────────────

  it("returns complete result structure with per-table counts", async () => {
    const seed = `STRUCTURE-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const result = await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
      userId: ctx.owner.id,
    });

    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();
    expect(result.results.daily_sales).toBeDefined();
    expect(result.results.expenses).toBeDefined();
    expect(result.results.bills).toBeDefined();
    expect(result.results.mpesa_transactions).toBeDefined();
    expect(result.results.journal_entries).toBeDefined();
    expect(result.results.ledger_entries).toBeDefined();
    expect(result.results.locations).toBeDefined();
    expect(result.results.accounts).toBeDefined();
    expect(result.results.suppliers).toBeDefined();

    // Verify counts are correct
    expect(result.results.daily_sales.count).toBe(1);
    expect(result.results.expenses.count).toBe(1);
    expect(result.results.expense_items.count).toBe(1);
    expect(result.results.bills.count).toBe(1);
    expect(result.results.debts.count).toBe(1);
    expect(result.results.mpesa_transactions.count).toBe(1);
    expect(result.results.journal_entries.count).toBe(1);
    expect(result.results.locations.count).toBe(1);

    // All accounts should be reset to zero (none deleted)
    expect(result.results.accounts.count).toBeGreaterThan(0);
    // User accounts are preserved (not soft-deleted)
    expect(result.results.user_accounts.count).toBe(0);
  });

  // ── Test 6: Multiple locations handled correctly ─────────────────────────

  it("handles businesses with multiple locations", async () => {
    const seed = `MULTILOC-${Date.now()}`;
    const db = getTestDb();
    const accountId = `RESET-${seed}`;

    const business = await firstRow<typeof businesses.$inferSelect>(db.insert(businesses).values({
      accountId,
      name: `Multi ${seed}`,
      slug: `multi-${seed.toLowerCase()}`,
      plan: "pro",
      isActive: true,
    } satisfies typeof businesses.$inferInsert).returning());

    const owner = await firstRow<typeof users.$inferSelect>(db.insert(users).values({
      username: `owner-${seed.toLowerCase()}`,
      role: "owner",
      isActive: true,
      currentBusinessId: business.id,
      accountId,
    } satisfies typeof users.$inferInsert).returning());

    await db.insert(userBusinesses).values({
      userId: owner.id,
      businessId: business.id,
      role: "owner",
      isActive: true,
    } satisfies typeof userBusinesses.$inferInsert);

    // Create 3 locations
    const locIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const loc = await firstRow<typeof locations.$inferSelect>(db.insert(locations).values({
        businessId: business.id,
        name: `Branch ${i} ${seed}`,
        slug: `branch-${i}-${seed.toLowerCase()}`,
        isActive: true,
        nextBillNumber: 10 + i,
        nextExpenseNumber: 20 + i,
      } satisfies typeof locations.$inferInsert).returning());
      locIds.push(loc.id);
    }

    seededAccountIds.push(accountId);

    const result = await resetBusinessTransactions({
      db,
      businessId: business.id,
      userId: owner.id,
    });

    expect(result.success).toBe(true);
    expect(result.results.locations.count).toBe(3);

    // Verify all 3 locations have counters reset
    for (const locId of locIds) {
      const [loc] = await db.select().from(locations).where(eq(locations.id, locId)).limit(1);
      expect(loc.nextBillNumber).toBe(1);
      expect(loc.nextExpenseNumber).toBe(1);
    }
  });

  // ── Test 7: Transaction atomicity - if audit fails, reset should still work ─

  it("completes successfully even when no locations exist", async () => {
    const seed = `NOLOC-${Date.now()}`;
    const db = getTestDb();
    const accountId = `RESET-${seed}`;

    const business = await firstRow<typeof businesses.$inferSelect>(db.insert(businesses).values({
      accountId,
      name: `No Loc ${seed}`,
      slug: `noloc-${seed.toLowerCase()}`,
      plan: "pro",
      isActive: true,
    } satisfies typeof businesses.$inferInsert).returning());

    seededAccountIds.push(accountId);

    const result = await resetBusinessTransactions({
      db,
      businessId: business.id,
      userId: 0,
    });

    expect(result.success).toBe(true);
    expect(result.results.daily_sales.count).toBe(0);
    expect(result.results.expenses.count).toBe(0);
    expect(result.results.ledger_entries.count).toBe(0);
    expect(result.results.journal_entries.count).toBe(0);
    expect(result.preserved.length).toBeGreaterThan(0);
  });

  // ── Test 8: Payroll data is properly cleared ─────────────────────────────

  it("clears payroll periods, entries, and advances", async () => {
    const seed = `PAYROLL-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const result = await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
      userId: ctx.owner.id,
    });

    // Payroll periods should be soft-deleted
    const [period] = await db
      .select()
      .from(payrollPeriods)
      .where(eq(payrollPeriods.id, ctx.payrollPeriod.id))
      .limit(1);
    expect(period.deletedAt).not.toBeNull();
    expect(period.status).toBe("cancelled");

    // Payroll entries should be soft-deleted
    const entriesAfter = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.periodId, ctx.payrollPeriod.id));
    expect(entriesAfter.every((e) => e.deletedAt !== null)).toBe(true);

    // Payroll advances should be soft-deleted
    const advancesAfter = await db
      .select()
      .from(payrollAdvances)
      .where(eq(payrollAdvances.employeeId, ctx.employee.id));
    expect(advancesAfter.every((a) => a.deletedAt !== null)).toBe(true);

    // Verify result counts
    expect(result.results.payroll_periods.count).toBe(1);
    expect(result.results.payroll_entries.count).toBe(1);
    expect(result.results.payroll_advances.count).toBe(1);
  });

  // ── Test 9: Budgets, POs, and recurring bills are cleared ────────────────

  it("clears budgets, purchase orders, and recurring bill templates", async () => {
    const seed = `MISC-${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const result = await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
      userId: ctx.owner.id,
    });

    expect(result.results.budgets.count).toBe(1);
    expect(result.results.purchase_orders.count).toBe(1);
    expect(result.results.purchase_order_items.count).toBe(1);
    expect(result.results.recurring_bill_templates.count).toBe(1);

    // Verify PO items cleared
    const poItemsAfter = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, ctx.purchaseOrder.id));
    expect(poItemsAfter.every((i) => i.deletedAt !== null)).toBe(true);
  });
});
