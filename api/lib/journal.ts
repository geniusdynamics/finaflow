import { getDb } from "../queries/connection";
import { journalEntries, journalLines, accounts, ledgerEntries } from "@db/schema";
import { eq, and, isNull, sql, desc, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import { d } from "./decimal";
import type { DbClient } from "./account-subscriptions";

export interface JournalLineInput {
  accountId: number;
  debit: string;
  credit: string;
  description?: string;
}

export interface CreateJournalEntryInput {
  businessId: number;
  entryDate: string;
  description: string;
  reference?: string;
  sourceType?: string;
  sourceId?: number;
  lines: JournalLineInput[];
  createdBy: number;
  postImmediately?: boolean;
}

export async function createJournalEntry(input: CreateJournalEntryInput) {
  const db = getDb();

  const totalDebits = input.lines.reduce(
    (sum, line) => sum.plus(line.debit || "0"),
    d("0")
  );
  const totalCredits = input.lines.reduce(
    (sum, line) => sum.plus(line.credit || "0"),
    d("0")
  );

  if (!totalDebits.eq(totalCredits)) {
    throw new Error(
      `Journal entry must be balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`
    );
  }

  // ABOUTME: Manual journal entries post only against authoritative Chart-of-Accounts
  // entries. Operational accounts (cash/wallet/bank) belong to the transfer module
  // and are not valid targets for free-form journal lines. Reject the entry if any
  // line targets a non-CoA account.
  const accountIds = Array.from(new Set(input.lines.map((l) => l.accountId)));
  const coaRows = await db
    .select({
      id: accounts.id,
      accountType: accounts.accountType,
      isActive: accounts.isActive,
      deletedAt: accounts.deletedAt,
      businessId: accounts.businessId,
    })
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  const coaById = new Map(coaRows.map((r) => [r.id, r]));
  const invalidIds: number[] = [];
  const crossBusinessIds: number[] = [];
  const inactiveIds: number[] = [];
  for (const aid of accountIds) {
    const row = coaById.get(aid);
    if (!row || !row.accountType) {
      invalidIds.push(aid);
      continue;
    }
    if (row.businessId !== input.businessId) {
      crossBusinessIds.push(aid);
      continue;
    }
    if (!row.isActive || row.deletedAt) {
      inactiveIds.push(aid);
    }
  }
  if (invalidIds.length > 0) {
    throw new Error(
      `Journal entry lines must reference active Chart-of-Accounts accounts (not operational accounts). Invalid ids: ${invalidIds.join(", ")}`,
    );
  }
  if (crossBusinessIds.length > 0) {
    throw new Error(
      `Journal entry lines must reference accounts within the current business. Cross-business ids: ${crossBusinessIds.join(", ")}`,
    );
  }
  if (inactiveIds.length > 0) {
    throw new Error(
      `Journal entry lines must reference active accounts. Inactive ids: ${inactiveIds.join(", ")}`,
    );
  }

  const entryNumber = await generateEntryNumber(input.businessId);

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        businessId: input.businessId,
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        reference: input.reference,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdBy: input.createdBy,
        isPosted: input.postImmediately ?? false,
      } satisfies typeof journalEntries.$inferInsert)
      .returning();

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      await tx.insert(journalLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debit: line.debit || "0.00",
        credit: line.credit || "0.00",
        description: line.description,
        lineNumber: i + 1,
      } satisfies typeof journalLines.$inferInsert);
    }

    if (input.postImmediately) {
      await postJournalEntry(entry.id, input.createdBy, tx);
    }

    return entry;
  });
}

export async function postJournalEntry(
  entryId: number,
  postedBy: number,
  tx?: DbClient
) {
  const db = tx || getDb();

  const entry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.id, entryId),
      isNull(journalEntries.deletedAt)
    ),
  });

  if (!entry) throw new Error("Journal entry not found");
  if (entry.isPosted) throw new Error("Journal entry already posted");

  const lines = await db.query.journalLines.findMany({
    where: and(
      eq(journalLines.journalEntryId, entryId),
      isNull(journalLines.deletedAt)
    ),
  });

  return db.transaction(async (trx) => {
    await trx
      .update(journalEntries)
      .set({
        isPosted: true,
        postedBy,
        postedAt: new Date(),
      })
      .where(eq(journalEntries.id, entryId));

    for (const line of lines) {
      const [account] = await trx
        .select()
        .from(accounts)
        .where(eq(accounts.id, line.accountId))
        .limit(1);

      if (!account) throw new Error(`Account ${line.accountId} not found`);

      const currentBalance = d(account.currentBalance || "0");
      const debitAmount = d(line.debit || "0");
      const creditAmount = d(line.credit || "0");

      let newBalance: Decimal;
      if (account.accountType === "asset" || account.accountType === "expense") {
        newBalance = debitAmount.gt(0)
          ? currentBalance.plus(debitAmount)
          : currentBalance.minus(creditAmount);
      } else {
        newBalance = creditAmount.gt(0)
          ? currentBalance.plus(creditAmount)
          : currentBalance.minus(debitAmount);
      }

      await trx.insert(ledgerEntries).values({
        accountId: line.accountId,
        transactionType: "journal",
        transactionId: entryId,
        entryType: debitAmount.gt(0) ? "debit" : "credit",
        amount: debitAmount.gt(0) ? debitAmount.toFixed(2) : creditAmount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: line.description || entry.description,
        refNo: entry.entryNumber || undefined,
        entryDate: entry.entryDate,
        createdBy: postedBy,
      } satisfies typeof ledgerEntries.$inferInsert);

      await trx
        .update(accounts)
        .set({
          currentBalance: newBalance.toFixed(2),
        })
        .where(eq(accounts.id, line.accountId));
    }

    return { success: true };
  });
}

export async function reverseJournalEntry(entryId: number, reversedBy: number) {
  const db = getDb();

  const entry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.id, entryId),
      isNull(journalEntries.deletedAt)
    ),
  });

  if (!entry) throw new Error("Journal entry not found");
  if (!entry.isPosted) throw new Error("Can only reverse posted entries");
  if (entry.isReversed) throw new Error("Entry already reversed");

  const lines = await db.query.journalLines.findMany({
    where: and(
      eq(journalLines.journalEntryId, entryId),
      isNull(journalLines.deletedAt)
    ),
  });

  const reversalLines = lines.map((line) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    description: `Reversal: ${line.description || entry.description}`,
  }));

  return db.transaction(async (tx) => {
    const now = new Date();
    const entryDateStr = now.toISOString().split("T")[0];
    
    const [reversal] = await tx
      .insert(journalEntries)
      .values({
        businessId: entry.businessId,
        entryDate: entryDateStr,
        description: `Reversal of ${entry.entryNumber}`,
        reference: entry.reference,
        sourceType: "journal",
        sourceId: entryId,
        createdBy: reversedBy,
        isPosted: true,
        postedBy: reversedBy,
        postedAt: now,
        isReversed: false,
        reversalOf: entryId,
      } satisfies typeof journalEntries.$inferInsert)
      .returning();

    for (let i = 0; i < reversalLines.length; i++) {
      const line = reversalLines[i];
      await tx.insert(journalLines).values({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        debit: line.debit || "0.00",
        credit: line.credit || "0.00",
        description: line.description,
        lineNumber: i + 1,
      } satisfies typeof journalLines.$inferInsert);
    }

    await tx
      .update(journalEntries)
      .set({
        isReversed: true,
        reversedBy,
      })
      .where(eq(journalEntries.id, entryId));

    await postJournalEntry(reversal.id, reversedBy, tx);

    return reversal;
  });
}

export async function getJournalEntryWithLines(entryId: number) {
  const db = getDb();

  const entry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.id, entryId),
      isNull(journalEntries.deletedAt)
    ),
  });

  if (!entry) throw new Error("Journal entry not found");

  const lines = await db
    .select({
      id: journalLines.id,
      accountId: journalLines.accountId,
      accountName: accounts.name,
      accountCode: accounts.accountCode,
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      lineNumber: journalLines.lineNumber,
    })
    .from(journalLines)
    .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        eq(journalLines.journalEntryId, entryId),
        isNull(journalLines.deletedAt)
      )
    )
    .orderBy(journalLines.lineNumber);

  return { entry, lines };
}

export async function getJournalEntries(opts: {
  businessId: number;
  page?: number;
  pageSize?: number;
  sourceType?: string;
  sourceId?: number;
  startDate?: Date;
  endDate?: Date;
  isPosted?: boolean;
}) {
  const db = getDb();
  const { businessId, page = 1, pageSize = 50, sourceType, sourceId, startDate, endDate, isPosted } = opts;

  const conditions = [eq(journalEntries.businessId, businessId)];

  if (sourceType) {
    conditions.push(eq(journalEntries.sourceType, sourceType));
  }
  if (sourceId) {
    conditions.push(eq(journalEntries.sourceId, sourceId));
  }
  if (startDate) {
    conditions.push(sql`${journalEntries.entryDate} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
  }
  if (isPosted !== undefined) {
    conditions.push(eq(journalEntries.isPosted, isPosted));
  }

  conditions.push(isNull(journalEntries.deletedAt));

  const offset = (page - 1) * pageSize;

  const entries = await db
    .select()
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(and(...conditions));

  return {
    entries,
    total: countResult[0]?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((countResult[0]?.count || 0) / pageSize),
  };
}

async function generateEntryNumber(businessId: number): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;

  const last = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.businessId, businessId),
      sql`${journalEntries.entryNumber} LIKE ${prefix + "%"}`
    ),
    orderBy: (entries, { desc }) => [desc(entries.entryNumber)],
  });

  let nextNum = 1;
  if (last?.entryNumber) {
    const lastNum = parseInt(last.entryNumber.replace(prefix, ""), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export async function unpostJournalEntry(
  entryId: number,
  _userId: number,
) {
  const db = getDb();

  const entry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.id, entryId),
      isNull(journalEntries.deletedAt)
    ),
  });

  if (!entry) throw new Error("Journal entry not found");
  if (!entry.isPosted) throw new Error("Journal entry is not posted");
  if (entry.isReversed) throw new Error("Cannot unpost a reversed entry");

  return db.transaction(async (tx) => {
    const lines = await tx
      .select()
      .from(journalLines)
      .where(
        and(
          eq(journalLines.journalEntryId, entryId),
          isNull(journalLines.deletedAt)
        )
      );

    for (const line of lines) {
      const [account] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, line.accountId))
        .limit(1);

      if (!account) continue;

      const currentBalance = d(account.currentBalance || "0");
      const debitAmount = d(line.debit || "0");
      const creditAmount = d(line.credit || "0");

      let newBalance: Decimal;
      if (account.accountType === "asset" || account.accountType === "expense") {
        newBalance = debitAmount.gt(0)
          ? currentBalance.minus(debitAmount)
          : currentBalance.plus(creditAmount);
      } else {
        newBalance = creditAmount.gt(0)
          ? currentBalance.minus(creditAmount)
          : currentBalance.plus(debitAmount);
      }

      await tx
        .update(accounts)
        .set({
          currentBalance: newBalance.toFixed(2),
        })
        .where(eq(accounts.id, line.accountId));

      await tx
        .delete(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.transactionType, "journal"),
            eq(ledgerEntries.transactionId, entryId),
            eq(ledgerEntries.accountId, line.accountId)
          )
        );
    }

    await tx
      .update(journalEntries)
      .set({
        isPosted: false,
        postedBy: null,
        postedAt: null,
      })
      .where(eq(journalEntries.id, entryId));

    return { success: true };
  });
}
