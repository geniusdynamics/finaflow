// ABOUTME: Reverses direct ledger-posted accounting source rows without deleting their history.
// ABOUTME: Creates equal-and-opposite ledger entries and updates account balances consistently.
import { eq } from "drizzle-orm";

import { accounts, ledgerEntries } from "@db/schema";
import type { DbClient } from "./account-subscriptions";
import { d } from "./decimal";

interface ReverseLedgerEntriesInput {
  db: DbClient;
  transactionId: number;
  userId: number;
  reason: string;
}

export async function reverseLedgerEntriesForTransaction(input: ReverseLedgerEntriesInput) {
  const originalEntries = await input.db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.transactionId, input.transactionId));

  if (originalEntries.length === 0) {
    throw new Error("Only posted records with ledger entries can be reversed.");
  }

  for (const entry of originalEntries) {
    const [account] = await input.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, entry.accountId))
      .limit(1);

    if (!account) {
      continue;
    }

    const amount = d(entry.amount || "0");
    const reversalEntryType = entry.entryType === "debit" ? "credit" : "debit";
    const currentBalance = d(account.currentBalance || "0");
    const newBalance =
      reversalEntryType === "debit"
        ? currentBalance.plus(amount)
        : currentBalance.minus(amount);

    await input.db.insert(ledgerEntries).values({
      accountId: entry.accountId,
      transactionType: entry.transactionType,
      transactionId: input.transactionId,
      entryType: reversalEntryType,
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      entryDate: entry.entryDate,
      createdBy: input.userId,
      refNo: entry.refNo,
      description: `Reversal: ${input.reason}`,
    } satisfies typeof ledgerEntries.$inferInsert);

    await input.db
      .update(accounts)
      .set({ currentBalance: newBalance.toFixed(2) })
      .where(eq(accounts.id, entry.accountId));
  }

  return { reversedCount: originalEntries.length };
}
