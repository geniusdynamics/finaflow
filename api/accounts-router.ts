import { z } from "zod";
import { createRouter, accountQuery, accountManage, getCurrentBusinessLocationIds } from "./middleware";
import { getDb } from "./queries/connection";
import { accounts, ledgerEntries } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { d } from "./lib/decimal";
import { logAudit } from "./lib/audit";

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
    .input(z.object({ id: z.number(), newBalance: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.id)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = d(acct[0].currentBalance);
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
        } as any);
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
    .input(z.object({ accountId: z.number(), amount: z.string(), description: z.string().optional(), date: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = d(acct[0].currentBalance);
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
        } as any);
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
    .input(z.object({ accountId: z.number(), amount: z.string(), description: z.string().optional(), date: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;
      const acct = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
      if (!acct[0]) throw new Error("Account not found");
      const oldBal = d(acct[0].currentBalance);
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
        } as any);
        await tx.update(accounts).set({ currentBalance: newBal.toFixed(2) }).where(eq(accounts.id, input.accountId));
      });
      return { id: input.accountId, newBalance: newBal.toFixed(2), success: true };
    }),

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

      const totalOut = input.toAccounts.reduce((sum, t) => sum.plus(d(t.amount)), d(0));
      const fromOldBal = d(fromAcct[0].currentBalance);
      if (fromOldBal.lt(totalOut)) throw new Error("Insufficient funds in source account");
      const fromNewBal = fromOldBal.minus(totalOut);

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
        } as any);
        await tx.update(accounts).set({ currentBalance: fromNewBal.toFixed(2) }).where(eq(accounts.id, input.fromAccountId));

        for (const to of input.toAccounts) {
          const toAcct = await tx.select().from(accounts).where(eq(accounts.id, to.accountId)).limit(1);
          if (!toAcct[0]) throw new Error(`Destination account ${to.accountId} not found`);
          const toOldBal = d(toAcct[0].currentBalance);
          const toNewBal = toOldBal.plus(d(to.amount));

          const [creditEntry] = await tx.insert(ledgerEntries).values({
            accountId: to.accountId,
            transactionType: "transfer",
            transactionId: Number(debitEntry.insertId),
            entryType: "credit",
            amount: to.amount,
            balanceAfter: toNewBal.toFixed(2),
            description: to.description || `${input.description} (from ${fromAcct[0].name})`,
            entryDate: new Date(input.date),
            createdBy: userId,
          } as any);
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
});
