import { z } from "zod";
import { createRouter, accountQuery, accountManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { accounts, ledgerEntries } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

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
    .query(async ({ input }) => {
      const db = getDb();
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
    .mutation(async ({ input }) => {
      const db = getDb();
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
      });
      return { id: Number(result.insertId), success: true };
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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...updates } = input;
      await db.update(accounts).set(updates).where(eq(accounts.id, id));
      return { success: true };
    }),

  adjustBalance: accountManage
    .input(z.object({
      id: z.number(),
      newBalance: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.id)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = parseFloat(acct[0].currentBalance);
      const newBal = parseFloat(input.newBalance);
      const diff = newBal - oldBal;

      const entryType = diff >= 0 ? "credit" : "debit";
      const [ledgerResult] = await db.insert(ledgerEntries).values({
        accountId: input.id,
        transactionType: "deposit",
        transactionId: input.id,
        entryType,
        amount: Math.abs(diff).toFixed(2),
        balanceAfter: input.newBalance,
        description: input.reason || `Balance adjustment from ${oldBal.toFixed(2)} to ${newBal.toFixed(2)}`,
        entryDate: new Date(),
        createdBy: userId,
      } as any);

      await db.update(accounts).set({ currentBalance: input.newBalance }).where(eq(accounts.id, input.id));
      return { id: Number(ledgerResult.insertId), newBalance: input.newBalance, success: true };
    }),

  recordDrawing: accountManage
    .input(z.object({
      accountId: z.number(),
      amount: z.string(),
      description: z.string().optional(),
      date: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = parseFloat(acct[0].currentBalance);
      const amount = parseFloat(input.amount);
      const newBal = (oldBal - amount).toFixed(2);

      const [result] = await db.insert(ledgerEntries).values({
        accountId: input.accountId,
        transactionType: "drawing",
        transactionId: input.accountId,
        entryType: "debit",
        amount: input.amount,
        balanceAfter: newBal,
        description: input.description || "Owner drawing",
        entryDate: new Date(input.date),
        createdBy: userId,
      } as any);

      await db.update(accounts).set({ currentBalance: newBal }).where(eq(accounts.id, input.accountId));
      return { id: Number(result.insertId), newBalance: newBal, success: true };
    }),

  recordDeposit: accountManage
    .input(z.object({
      accountId: z.number(),
      amount: z.string(),
      description: z.string().optional(),
      date: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = parseFloat(acct[0].currentBalance);
      const amount = parseFloat(input.amount);
      const newBal = (oldBal + amount).toFixed(2);

      const [result] = await db.insert(ledgerEntries).values({
        accountId: input.accountId,
        transactionType: "deposit",
        transactionId: input.accountId,
        entryType: "credit",
        amount: input.amount,
        balanceAfter: newBal,
        description: input.description || "Deposit",
        entryDate: new Date(input.date),
        createdBy: userId,
      } as any);

      await db.update(accounts).set({ currentBalance: newBal }).where(eq(accounts.id, input.accountId));
      return { id: Number(result.insertId), newBalance: newBal, success: true };
    }),

  // Transfer from account A to accounts B, C, etc. with balanced debits=credits
  transfer: accountManage
    .input(z.object({
      fromAccountId: z.number(),
      description: z.string(),
      date: z.string(),
      toAccounts: z.array(z.object({
        accountId: z.number(),
        amount: z.string(),
        description: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      const fromAcct = await db.select().from(accounts).where(eq(accounts.id, input.fromAccountId)).limit(1);
      if (!fromAcct[0]) throw new Error("Source account not found");

      const totalOut = input.toAccounts.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const fromOldBal = parseFloat(fromAcct[0].currentBalance);
      if (fromOldBal < totalOut) throw new Error("Insufficient funds in source account");

      const fromNewBal = (fromOldBal - totalOut).toFixed(2);

      // Debit source account once for total
      const [debitEntry] = await db.insert(ledgerEntries).values({
        accountId: input.fromAccountId,
        transactionType: "transfer",
        transactionId: input.fromAccountId,
        entryType: "debit",
        amount: totalOut.toFixed(2),
        balanceAfter: fromNewBal,
        description: `${input.description} (to ${input.toAccounts.length} account${input.toAccounts.length > 1 ? 's' : ''})`,
        entryDate: new Date(input.date),
        createdBy: userId,
      } as any);

      await db.update(accounts).set({ currentBalance: fromNewBal }).where(eq(accounts.id, input.fromAccountId));

      // Credit each destination account
      const results: { accountId: number; amount: string; newBalance: string }[] = [];
      for (const to of input.toAccounts) {
        const toAcct = await db.select().from(accounts).where(eq(accounts.id, to.accountId)).limit(1);
        if (!toAcct[0]) throw new Error(`Destination account ${to.accountId} not found`);
        const toOldBal = parseFloat(toAcct[0].currentBalance);
        const toNewBal = (toOldBal + parseFloat(to.amount)).toFixed(2);

        const [creditEntry] = await db.insert(ledgerEntries).values({
          accountId: to.accountId,
          transactionType: "transfer",
          transactionId: Number(debitEntry.insertId),
          entryType: "credit",
          amount: to.amount,
          balanceAfter: toNewBal,
          description: to.description || `${input.description} (from ${fromAcct[0].name})`,
          entryDate: new Date(input.date),
          createdBy: userId,
        } as any);

        await db.update(accounts).set({ currentBalance: toNewBal }).where(eq(accounts.id, to.accountId));
        results.push({ accountId: to.accountId, amount: to.amount, newBalance: toNewBal });
      }

      return {
        totalTransferred: totalOut.toFixed(2),
        fromNewBalance: fromNewBal,
        toResults: results,
        success: true,
      };
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
});
