// ABOUTME: Verifies business transaction reset clears newly added accounting records and resets balances.
// ABOUTME: Protects the Businesses reset action from leaving journal, ledger, and system-managed account residue behind.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { getTestDb } from "../test/db";
import {
  accounts,
  businesses,
  journalEntries,
  journalLines,
  ledgerEntries,
  locations,
  userBusinesses,
  users,
} from "@db/schema";
import { resetBusinessTransactions } from "../lib/business-reset";

type SeededContext = {
  accountId: string;
  business: { id: number };
  location: { id: number };
  owner: { id: number; role: string; currentBusinessId: number };
  operationalAccount: { id: number };
  systemAccount: { id: number };
  journalEntry: { id: number };
};

async function seedResetContext(seed: string): Promise<SeededContext> {
  const db = getTestDb();
  const accountId = `RESET-${seed}`;

  const [business] = await db.insert(businesses).values({
    accountId,
    name: `Reset ${seed}`,
    slug: `reset-${seed.toLowerCase()}`,
    plan: "pro",
    isActive: true,
  } as any).returning();

  const [owner] = await db.insert(users).values({
    username: `owner-${seed.toLowerCase()}`,
    role: "owner",
    isActive: true,
    currentBusinessId: business.id,
    accountId,
  } as any).returning();

  await db.insert(userBusinesses).values({
    userId: owner.id,
    businessId: business.id,
    role: "owner",
    isActive: true,
  } as any);

  const locRows = await db.insert(locations).values({
    businessId: business.id,
    name: `Main ${seed}`,
    slug: `main-${seed.toLowerCase()}`,
    isActive: true,
    nextBillNumber: 19,
    nextExpenseNumber: 27,
  } as any).returning();
  const [location] = locRows as any[];

  const opRows = await db.insert(accounts).values({
    businessId: business.id,
    locationId: location.id,
    name: "Cash Drawer",
    type: "cash",
    currentBalance: "450.00",
    openingBalance: "100.00",
    isActive: true,
  } as any).returning();
  const [operationalAccount] = opRows as any[];

  const sysRows = await db.insert(accounts).values({
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
  } as any).returning();
  const [systemAccount] = sysRows as any[];

  const entryRows = await db.insert(journalEntries).values({
    businessId: business.id,
    entryNumber: `JE-${seed}`,
    entryDate: "2026-05-16",
    description: "Reset me",
    isPosted: true,
    createdBy: owner.id,
  } as any).returning();
  const [entry] = entryRows as any[];

  await db.insert(journalLines).values({
    journalEntryId: entry.id,
    accountId: systemAccount.id,
    debit: "900.00",
    credit: "0.00",
    lineNumber: 1,
  } as any);

  await db.insert(ledgerEntries).values({
    accountId: systemAccount.id,
    transactionType: "journal",
    transactionId: entry.id,
    entryType: "debit",
    amount: "900.00",
    balanceAfter: "900.00",
    entryDate: "2026-05-16",
    createdBy: owner.id,
  } as any);

  return {
    accountId,
    business,
    location,
    owner: { id: owner.id, role: owner.role, currentBusinessId: business.id },
    operationalAccount,
    systemAccount,
    journalEntry: entry,
  };
}

async function cleanupResetContext(accountId: string) {
  const db = getTestDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.accountId, accountId)).limit(1);
  if (!business) return;

  const journalRows = await db.select({ id: journalEntries.id }).from(journalEntries).where(eq(journalEntries.businessId, business.id));
  const journalIds = journalRows.map((row) => row.id);
  const accountRows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.businessId, business.id));
  const accountIds = accountRows.map((row) => row.id);

  if (accountIds.length > 0) {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.accountId, accountIds[0]));
    for (const accountIdToDelete of accountIds.slice(1)) {
      await db.delete(ledgerEntries).where(eq(ledgerEntries.accountId, accountIdToDelete));
    }
  }

  for (const journalId of journalIds) {
    await db.delete(journalLines).where(eq(journalLines.journalEntryId, journalId));
  }
  await db.delete(journalEntries).where(eq(journalEntries.businessId, business.id));
  await db.delete(accounts).where(eq(accounts.businessId, business.id));
  await db.delete(locations).where(eq(locations.businessId, business.id));
  await db.delete(userBusinesses).where(eq(userBusinesses.businessId, business.id));
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.id, business.id));
}

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

  it("clears journal and ledger activity and resets both operational and system-managed balances", async () => {
    const seed = `${Date.now()}`;
    const ctx = await seedResetContext(seed);
    seededAccountIds.push(ctx.accountId);
    const db = getTestDb();

    const result = await resetBusinessTransactions({
      db,
      businessId: ctx.business.id,
    });

    const [savedJournalEntry] = await db.select().from(journalEntries).where(eq(journalEntries.id, ctx.journalEntry.id)).limit(1);
    const [savedSystemAccount] = await db.select().from(accounts).where(eq(accounts.id, ctx.systemAccount.id)).limit(1);
    const [savedOperationalAccount] = await db.select().from(accounts).where(eq(accounts.id, ctx.operationalAccount.id)).limit(1);
    const [savedLocation] = await db.select().from(locations).where(eq(locations.id, ctx.location.id)).limit(1);
    const deletedLedgerRows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.accountId, ctx.systemAccount.id));

    expect(result.success).toBe(true);
    expect(savedJournalEntry.deletedAt).not.toBeNull();
    expect(savedSystemAccount.currentBalance).toBe("0.00");
    expect(savedOperationalAccount.deletedAt).not.toBeNull();
    expect(savedOperationalAccount.isActive).toBe(false);
    expect(savedOperationalAccount.currentBalance).toBe("0.00");
    expect(savedLocation.nextBillNumber).toBe(1);
    expect(savedLocation.nextExpenseNumber).toBe(1);
    expect(deletedLedgerRows.every((row) => row.deletedAt !== null)).toBe(true);
    expect(result.results.user_accounts?.count).toBe(1);
  });
});
