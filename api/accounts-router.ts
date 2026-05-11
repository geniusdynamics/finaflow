import { z } from "zod";
import { createRouter, accountQuery, accountManage, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { accounts, ledgerEntries } from "@db/schema";
import { eq, and, isNull, desc, asc, gte, lt, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { logAudit } from "./lib/audit";
import { notFutureDateString } from "./lib/future-date";
import { toLocalDateKey } from "./lib/date-key";

export const drawingInputSchema = z.object({
  accountId: z.number(),
  amount: z.string(),
  description: z.string().optional(),
  date: notFutureDateString("Drawing date"),
});

export const depositInputSchema = z.object({
  accountId: z.number(),
  amount: z.string(),
  description: z.string().optional(),
  date: notFutureDateString("Deposit date"),
});

export const transferInputSchema = z.object({
  fromAccountId: z.number(),
  description: z.string(),
  date: notFutureDateString("Transfer date"),
  toAccounts: z
    .array(
      z.object({
        accountId: z.number(),
        amount: z.string(),
        description: z.string().optional(),
      })
    )
    .min(1),
});

export const accountsRouter = createRouter({
  list: accountQuery.query(async ({ ctx }) => {
    const db = getDb();
    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) return [];
    return db.select().from(accounts).where(
      and(sql`${accounts.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`, isNull(accounts.deletedAt))
    );
  }),

  getByLocation: accountQuery
    .input(z.object({ locationId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      return db.select().from(accounts).where(and(eq(accounts.locationId, input.locationId), isNull(accounts.deletedAt)));
    }),

  create: accountManage
    .input(z.object({
      locationId: z.number(),
      name: z.string().min(1).max(100),
      type: z.enum(["cash", "mpesa", "bank_account"]),
      accountCode: z.string().max(20).optional(),
      accountNumber: z.string().max(100).optional(),
      openingBalance: z.string().optional(),
      isPaymentMethod: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedLocation(ctx, input.locationId);
      const ob = input.openingBalance ?? "0.00";
      const existing = await db.select().from(accounts).where(
        and(eq(accounts.locationId, input.locationId), eq(accounts.name, input.name), eq(accounts.type, input.type), isNull(accounts.deletedAt))
      ).limit(1);
      if (existing.length > 0) {
        throw new Error(`Account "${input.name}" of type ${input.type} already exists for this location`);
      }
      const [result] = await db.insert(accounts).values({
        locationId: input.locationId, name: input.name, type: input.type,
        accountCode: input.accountCode, accountNumber: input.accountNumber,
        openingBalance: ob, currentBalance: ob,
        isPaymentMethod: input.isPaymentMethod ?? false,
      }).returning();
      return { id: result.id, success: true };
    }),

  update: accountManage
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      accountCode: z.string().max(20).optional(),
      accountNumber: z.string().max(100).optional(),
      isPaymentMethod: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, accounts, input.id);
      const { id, ...updates } = input;
      await db.update(accounts).set(updates).where(eq(accounts.id, id));
      return { success: true };
    }),

  adjustBalance: accountManage
    .input(z.object({ id: z.number(), newBalance: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await requireAuthorizedEntity(ctx, accounts, input.id);
      const oldBal = d(acct.currentBalance);
      const newBal = d(input.newBalance);
      const diff = newBal.minus(oldBal);

      await db.transaction(async (tx) => {
        const entryType = diff.gte(0) ? "credit" : "debit";
        const [ledgerResult] = await tx.insert(ledgerEntries).values({
          accountId: input.id,
          transactionType: "deposit",
          transactionId: input.id,
          entryType,
          amount: diff.abs().toFixed(2),
          balanceAfter: input.newBalance,
          description: input.reason || `Balance adjustment from ${oldBal.toFixed(2)} to ${newBal.toFixed(2)}`,
          entryDate: new Date(),
          createdBy: userId,
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: input.newBalance }).where(eq(accounts.id, input.id));
      });

      await logAudit({
        userId,
        action: "UPDATE",
        resource: "accounts",
        resourceId: input.id,
        details: { action: "balance_adjustment", from: oldBal.toFixed(2), to: newBal.toFixed(2), reason: input.reason },
      });

      return { id: input.id, newBalance: input.newBalance, success: true };
    }),

  recordDrawing: accountManage
    .input(drawingInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
      const oldBal = d(acct.currentBalance);
      const amount = d(input.amount);
      const newBal = oldBal.minus(amount);

      await db.transaction(async (tx) => {
        const [result] = await tx.insert(ledgerEntries).values({
          accountId: input.accountId,
          transactionType: "drawing",
          transactionId: input.accountId,
          entryType: "debit",
          amount: input.amount,
          balanceAfter: newBal.toFixed(2),
          description: input.description || "Owner drawing",
          entryDate: new Date(input.date),
          createdBy: userId,
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, input.accountId));
      });

      await logAudit({
        userId,
        action: "UPDATE",
        resource: "accounts",
        resourceId: input.accountId,
        details: { action: "drawing", amount: input.amount },
      });

      return { id: input.accountId, newBalance: newBal.toFixed(2), success: true };
    }),

  recordDeposit: accountManage
    .input(depositInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await requireAuthorizedEntity(ctx, accounts, input.accountId);
      const oldBal = d(acct.currentBalance);
      const amount = d(input.amount);
      const newBal = oldBal.plus(amount);

      await db.transaction(async (tx) => {
        const [result] = await tx.insert(ledgerEntries).values({
          accountId: input.accountId,
          transactionType: "deposit",
          transactionId: input.accountId,
          entryType: "credit",
          amount: input.amount,
          balanceAfter: newBal.toFixed(2),
          description: input.description || "Deposit",
          entryDate: new Date(input.date),
          createdBy: userId,
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, input.accountId));
      });
      return { id: input.accountId, newBalance: newBal.toFixed(2), success: true };
    }),

  transfer: accountManage
    .input(transferInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      const fromAcct = await requireAuthorizedEntity(ctx, accounts, input.fromAccountId);

      const totalOut = input.toAccounts.reduce((sum, t) => sum.plus(d(t.amount)), d(0));
      const fromOldBal = d(fromAcct.currentBalance);
      if (fromOldBal.lt(totalOut)) throw new Error("Insufficient funds in source account");
      const fromNewBal = fromOldBal.minus(totalOut);

      // Validate all destination accounts belong to the active business before starting tx
      const toAcctMap = new Map();
      for (const to of input.toAccounts) {
        const toAcct = await requireAuthorizedEntity(ctx, accounts, to.accountId);
        toAcctMap.set(to.accountId, toAcct);
      }

      const results: { accountId: number; amount: string; newBalance: string }[] = [];

      await db.transaction(async (tx) => {
        const [debitEntry] = await tx.insert(ledgerEntries).values({
          accountId: input.fromAccountId,
          transactionType: "transfer",
          transactionId: input.fromAccountId,
          entryType: "debit",
          amount: totalOut.toFixed(2),
          balanceAfter: fromNewBal.toFixed(2),
          description: `${input.description} (to ${input.toAccounts.length} account${input.toAccounts.length > 1 ? 's' : ''})`,
          entryDate: new Date(input.date),
          createdBy: userId,
        } as any).returning();
        await tx.update(accounts).set({ currentBalance: fromNewBal.toFixed(2) }).where(eq(accounts.id, input.fromAccountId));

        for (const to of input.toAccounts) {
          const toAcct = toAcctMap.get(to.accountId);
          const toOldBal = d(toAcct.currentBalance);
          const toNewBal = toOldBal.plus(d(to.amount));

          const [creditEntry] = await tx.insert(ledgerEntries).values({
            accountId: to.accountId,
            transactionType: "transfer",
            transactionId: debitEntry.id,
            entryType: "credit",
            amount: to.amount,
            balanceAfter: toNewBal.toFixed(2),
            description: to.description || `${input.description} (from ${fromAcct.name})`,
            entryDate: new Date(input.date),
            createdBy: userId,
          } as any).returning();
          await tx.update(accounts).set({ currentBalance: toNewBal.toFixed(2) }).where(eq(accounts.id, to.accountId));
          results.push({ accountId: to.accountId, amount: to.amount, newBalance: toNewBal.toFixed(2) });
        }
      });

      await logAudit({
        userId,
        action: "UPDATE",
        resource: "accounts",
        details: { action: "transfer", from: input.fromAccountId, total: totalOut.toFixed(2), to: results },
      });

      return { totalTransferred: totalOut.toFixed(2), fromNewBalance: fromNewBal.toFixed(2), toResults: results, success: true };
    }),

  delete: accountManage
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(accounts).set({ deletedAt: new Date() }).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  ledger: accountQuery
    .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(ledgerEntries).where(
        and(eq(ledgerEntries.accountId, input.accountId), isNull(ledgerEntries.deletedAt))
      ).orderBy(desc(ledgerEntries.createdAt)).limit(input.limit);
    }),

  balanceHistory: accountQuery
    .input(
      z.object({
        days: z.number().min(7).max(365).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const locIds = await getCurrentBusinessLocationIds(ctx);
      if (locIds.length === 0) {
        return { fromDate: "", toDate: "", series: [], accountMeta: [] };
      }

      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (input.days - 1));

      const scopedAccounts = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          type: accounts.type,
          openingBalance: accounts.openingBalance,
        })
        .from(accounts)
        .where(
          and(
            sql`${accounts.locationId} IN (${sql.join(
              locIds.map((id) => sql`${id}`),
              sql`, `
            )})`,
            isNull(accounts.deletedAt)
          )
        )
        .orderBy(asc(accounts.name));

      if (scopedAccounts.length === 0) {
        return {
          fromDate: toLocalDateKey(startDate),
          toDate: toLocalDateKey(endDate),
          series: [],
          accountMeta: [],
        };
      }

      const accountIds = scopedAccounts.map((account) => account.id);

      const rangeEntries = await db
        .select({
          accountId: ledgerEntries.accountId,
          entryDate: ledgerEntries.entryDate,
          balanceAfter: ledgerEntries.balanceAfter,
          createdAt: ledgerEntries.createdAt,
        })
        .from(ledgerEntries)
        .where(
          and(
            sql`${ledgerEntries.accountId} IN (${sql.join(
              accountIds.map((id) => sql`${id}`),
              sql`, `
            )})`,
            isNull(ledgerEntries.deletedAt),
            gte(ledgerEntries.entryDate, toLocalDateKey(startDate)),
            lt(ledgerEntries.entryDate, toLocalDateKey(new Date(endDate.getTime() + 24 * 60 * 60 * 1000)))
          )
        )
        .orderBy(asc(ledgerEntries.accountId), asc(ledgerEntries.entryDate), asc(ledgerEntries.createdAt));

      const preRangeLastBalances = await Promise.all(
        accountIds.map(async (accountId) => {
          const [entry] = await db
            .select({
              accountId: ledgerEntries.accountId,
              balanceAfter: ledgerEntries.balanceAfter,
            })
            .from(ledgerEntries)
            .where(
              and(
                eq(ledgerEntries.accountId, accountId),
                isNull(ledgerEntries.deletedAt),
                lt(ledgerEntries.entryDate, toLocalDateKey(startDate))
              )
            )
            .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt))
            .limit(1);
          return { accountId, balanceAfter: entry?.balanceAfter };
        })
      );

      const accountStartBalances = new Map<number, string>();
      scopedAccounts.forEach((account) => {
        const preRange = preRangeLastBalances.find((balance) => balance.accountId === account.id);
        accountStartBalances.set(account.id, preRange?.balanceAfter ?? account.openingBalance);
      });

      const accountEntriesByDate = new Map<number, Map<string, string>>();
      for (const entry of rangeEntries) {
        if (!accountEntriesByDate.has(entry.accountId)) {
          accountEntriesByDate.set(entry.accountId, new Map<string, string>());
        }
        const dayKey = toLocalDateKey(entry.entryDate);
        accountEntriesByDate.get(entry.accountId)!.set(dayKey, entry.balanceAfter);
      }

      const accountMeta = scopedAccounts.map((account) => ({
        id: account.id,
        key: `account_${account.id}`,
        name: account.name,
        type: account.type,
      }));

      const currentBalances = new Map<number, string>(accountStartBalances);
      const series: Array<Record<string, string | number>> = [];
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const dateKey = toLocalDateKey(cursor);
        let cashTotal = d(0);
        let bankTotal = d(0);
        let mpesaTotal = d(0);
        const row: Record<string, string | number> = { date: dateKey };

        for (const account of scopedAccounts) {
          const dayBalance = accountEntriesByDate.get(account.id)?.get(dateKey);
          if (dayBalance !== undefined) {
            currentBalances.set(account.id, dayBalance);
          }
          const latestBalance = currentBalances.get(account.id) ?? "0.00";
          row[`account_${account.id}`] = Number(latestBalance);
          if (account.type === "cash") {
            cashTotal = cashTotal.plus(d(latestBalance));
          } else if (account.type === "mpesa") {
            mpesaTotal = mpesaTotal.plus(d(latestBalance));
          } else {
            bankTotal = bankTotal.plus(d(latestBalance));
          }
        }

        row.cashTotal = Number(cashTotal.toFixed(2));
        row.bankTotal = Number(bankTotal.toFixed(2));
        row.mpesaTotal = Number(mpesaTotal.toFixed(2));
        row.totalBalance = Number(cashTotal.plus(bankTotal).plus(mpesaTotal).toFixed(2));
        series.push(row);
        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        fromDate: toLocalDateKey(startDate),
        toDate: toLocalDateKey(endDate),
        accountMeta,
        series,
      };
    }),
});
