// ABOUTME: Backward-compatible M-PESA proxy that delegates to the new mobile_wallet_transactions table.
// ABOUTME: All queries filter by provider='mpesa' and map fields to the legacy format for the frontend.
import { z } from "zod";
import { createRouter, mpesaQuery, mpesaImport, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { mobileWalletTransactions, expenses, suppliers, accounts, ledgerEntries, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { walletRegistry } from "./lib/mobile-wallet/provider-registry";

function mapToOldFormat(t: any) {
  const amount = parseFloat(t.amount);
  return {
    id: t.id,
    locationId: t.locationId,
    txnId: t.providerTxnId,
    txnDate: t.txnDate,
    txnTime: t.txnTime,
    txnType: t.txnType,
    partyName: t.partyName,
    partyIdentifier: t.partyIdentifier,
    amount: t.direction === "out" ? `-${Math.abs(amount).toFixed(2)}` : Math.abs(amount).toFixed(2),
    currency: t.currency ?? "KES",
    direction: t.direction,
    txnFee: t.txnFee,
    balance: t.balance,
    description: t.description,
    rawText: t.rawText,
    isLinked: t.isLinked,
    linkedExpenseId: t.linkedExpenseId,
    linkedSupplierId: t.linkedSupplierId,
    sourceAccountId: t.sourceAccountId,
    destinationAccountId: t.destinationAccountId,
    importedBy: t.importedBy,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function mapStatsRow(r: any) {
  return {
    totalIn: r.totalIn ?? "0",
    totalOut: r.totalOut ?? "0",
    totalFees: r.totalFees ?? "0",
    countIn: r.countIn ?? 0,
    countOut: r.countOut ?? 0,
  };
}

export const mpesaRouter = createRouter({
  list: mpesaQuery
    .input(z.object({
      locationId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      unlinkedOnly: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [eq(mobileWalletTransactions.provider, "mpesa"), isNull(mobileWalletTransactions.deletedAt)];

      if (input?.locationId) {
        conditions.push(eq(mobileWalletTransactions.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length === 0) return [];
        conditions.push(sql`${mobileWalletTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }

      if (input?.dateFrom && input?.dateTo) {
        conditions.push(sql`${mobileWalletTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      }

      if (input?.unlinkedOnly) conditions.push(eq(mobileWalletTransactions.isLinked, false));

      const results = await db.select()
        .from(mobileWalletTransactions)
        .where(and(...conditions))
        .orderBy(desc(mobileWalletTransactions.txnDate), desc(mobileWalletTransactions.txnTime));

      return results.map(mapToOldFormat);
    }),

  stats: mpesaQuery
    .input(z.object({
      locationId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [eq(mobileWalletTransactions.provider, "mpesa"), isNull(mobileWalletTransactions.deletedAt)];

      if (input?.locationId) {
        conditions.push(eq(mobileWalletTransactions.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${mobileWalletTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      if (input?.dateFrom && input?.dateTo) {
        conditions.push(sql`${mobileWalletTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      }

      const rows = await db.select({
        totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'in' THEN CAST(${mobileWalletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'out' THEN CAST(${mobileWalletTransactions.amount} AS DECIMAL) ELSE 0 END), 0)`,
        totalFees: sql<string>`COALESCE(SUM(CAST(${mobileWalletTransactions.txnFee} AS DECIMAL)), 0)`,
        countIn: sql<number>`COUNT(CASE WHEN ${mobileWalletTransactions.direction} = 'in' THEN 1 END)`,
        countOut: sql<number>`COUNT(CASE WHEN ${mobileWalletTransactions.direction} = 'out' THEN 1 END)`,
      }).from(mobileWalletTransactions).where(and(...conditions));

      const feesByType = await db.select({
        txnType: mobileWalletTransactions.txnType,
        totalFees: sql<string>`COALESCE(SUM(CAST(${mobileWalletTransactions.txnFee} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mobileWalletTransactions).where(and(...conditions)).groupBy(mobileWalletTransactions.txnType);

      const topRecipients = await db.select({
        partyName: mobileWalletTransactions.partyName,
        totalAmount: sql<string>`COALESCE(SUM(CAST(${mobileWalletTransactions.amount} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mobileWalletTransactions).where(and(...conditions, sql`${mobileWalletTransactions.direction} = 'out'`)).groupBy(mobileWalletTransactions.partyName).orderBy(sql`SUM(CAST(${mobileWalletTransactions.amount} AS DECIMAL)) DESC`).limit(10);

      return { summary: mapStatsRow(rows[0]), feesByType, topRecipients };
    }),

  importSms: mpesaImport
    .input(z.object({ locationId: z.number(), smsText: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const importedBy = (ctx as any).user?.id ?? 1;
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;

      const location = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (location.length === 0) throw new Error("Location not found");
      if (location[0].businessId !== businessId) throw new Error("Location does not belong to your current business");

      const provider = walletRegistry.get("mpesa");
      if (!provider.parseSms) throw new Error("M-PESA provider does not support SMS import");

      const parsed = await provider.parseSms(input.smsText);

      let imported = 0, skipped = 0;
      const errors: string[] = [];

      for (const txn of parsed) {
        const existing = await db.select().from(mobileWalletTransactions).where(
          and(eq(mobileWalletTransactions.provider, "mpesa"), eq(mobileWalletTransactions.providerTxnId, txn.providerTxnId))
        ).limit(1);
        if (existing.length > 0) { skipped++; continue; }

        try {
          await db.insert(mobileWalletTransactions).values({
            locationId: input.locationId,
            provider: "mpesa",
            providerTxnId: txn.providerTxnId,
            txnDate: txn.date,
            txnTime: txn.time,
            txnType: txn.txnType,
            direction: txn.direction,
            partyName: txn.partyName,
            partyIdentifier: txn.partyIdentifier,
            amount: Math.abs(parseFloat(txn.amount)).toFixed(2),
            currency: txn.currency ?? "KES",
            txnFee: txn.txnFee ?? "0.00",
            balance: txn.balance,
            description: txn.partyIdentifier ? `${txn.partyName} (${txn.partyIdentifier})` : txn.partyName,
            rawText: txn.rawText,
            status: "completed",
            isLinked: false,
            importedBy,
            baseCurrency: txn.currency ?? "KES",
            baseAmount: Math.abs(parseFloat(txn.amount)).toFixed(2),
          } as any).returning();
          imported++;
        } catch (e) {
          errors.push(`${txn.providerTxnId}: ${(e as Error).message}`);
        }
      }

      return { imported, skipped, totalParsed: parsed.length, errors, success: true };
    }),

  tagToSupplier: mpesaQuery
    .input(z.object({ mpesaTxnId: z.number(), supplierId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, mobileWalletTransactions, input.mpesaTxnId);
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);

      await db.update(mobileWalletTransactions).set({ isLinked: true, linkedSupplierId: input.supplierId })
        .where(eq(mobileWalletTransactions.id, input.mpesaTxnId));
      return { success: true };
    }),

  createExpenseFromTxn: mpesaQuery
    .input(z.object({
      mpesaTxnId: z.number(), locationId: z.number(), categoryId: z.number(),
      description: z.string(), supplierId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const enteredBy = (ctx as any).user?.id ?? 1;

      await requireAuthorizedLocation(ctx, input.locationId);
      const txn = await requireAuthorizedEntity(ctx, mobileWalletTransactions, input.mpesaTxnId);

      if (input.supplierId) {
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);
      }

      const amount = Math.abs(parseFloat(txn.amount)).toFixed(2);

      let expenseId = 0;
      let expenseNumber = "";

      await db.transaction(async (tx) => {
        const loc = await tx.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
        const nextNum = loc[0]?.nextExpenseNumber ?? 1;
        expenseNumber = `EXP-${String(nextNum).padStart(4, "0")}`;
        await tx.update(locations).set({ nextExpenseNumber: nextNum + 1 }).where(eq(locations.id, input.locationId));

        const [result] = await tx.insert(expenses).values({
          locationId: input.locationId, categoryId: input.categoryId,
          supplierId: input.supplierId, amount,
          expenseNumber,
          description: input.description || txn.description || `M-PESA ${txn.txnType}`,
          expenseDate: txn.txnDate, paymentMethod: "mpesa",
          enteredBy,
        } as any).returning();

        expenseId = result.id;

        await tx.update(mobileWalletTransactions).set({ isLinked: true, linkedExpenseId: expenseId })
          .where(eq(mobileWalletTransactions.id, input.mpesaTxnId));

        if (input.supplierId) {
          const sup = await tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
          if (sup[0]) {
            const newPaid = (parseFloat(sup[0].totalPaid) + parseFloat(amount)).toFixed(2);
            const newBal = (parseFloat(sup[0].currentBalance) - parseFloat(amount)).toFixed(2);
            await tx.update(suppliers).set({ totalPaid: newPaid, currentBalance: newBal }).where(eq(suppliers.id, input.supplierId));
          }
        }
      });

      return { expenseId, expenseNumber, success: true };
    }),

  linkTopupToAccount: mpesaImport
    .input(z.object({
      mpesaTxnId: z.number(),
      sourceAccountId: z.number(),
      destinationAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      const txn = await db.select().from(mobileWalletTransactions).where(eq(mobileWalletTransactions.id, input.mpesaTxnId)).limit(1);
      if (!txn[0]) throw new Error("Wallet transaction not found");
      if (txn[0].txnType !== "topup") throw new Error("Only topup transactions can be linked to a bank account");

      const acct = await db.select().from(accounts).where(eq(accounts.id, input.sourceAccountId)).limit(1);
      if (!acct[0]) throw new Error("Source account not found");

      const topupAmount = Math.abs(parseFloat(txn[0].amount));
      const fee = parseFloat(txn[0].txnFee);
      const totalOutflow = topupAmount + fee;
      const oldBal = parseFloat(acct[0].currentBalance);
      const newBal = (oldBal - totalOutflow).toFixed(2);

      await db.insert(ledgerEntries).values({
        accountId: input.sourceAccountId,
        transactionType: "mpesa_topup",
        transactionId: input.mpesaTxnId,
        entryType: "debit",
        amount: topupAmount.toFixed(2),
        balanceAfter: (oldBal - topupAmount).toFixed(2),
        description: `M-PESA topup to wallet: ${txn[0].providerTxnId}`,
        entryDate: txn[0].txnDate,
        createdBy: userId,
      } as any).returning();

      if (fee > 0) {
        await db.insert(ledgerEntries).values({
          accountId: input.sourceAccountId,
          transactionType: "mpesa_topup",
          transactionId: input.mpesaTxnId,
          entryType: "debit",
          amount: fee.toFixed(2),
          balanceAfter: newBal,
          description: `M-PESA topup transaction fee: ${txn[0].providerTxnId}`,
          entryDate: txn[0].txnDate,
          createdBy: userId,
        } as any).returning();
      }

      await db.update(accounts).set({ currentBalance: newBal }).where(eq(accounts.id, input.sourceAccountId));

      if (input.destinationAccountId) {
        const destAcct = await db.select().from(accounts).where(eq(accounts.id, input.destinationAccountId)).limit(1);
        if (destAcct[0]) {
          const destOldBal = parseFloat(destAcct[0].currentBalance);
          const destNewBal = (destOldBal + topupAmount).toFixed(2);
          await db.insert(ledgerEntries).values({
            accountId: input.destinationAccountId,
            transactionType: "mpesa_topup",
            transactionId: input.mpesaTxnId,
            entryType: "credit",
            amount: topupAmount.toFixed(2),
            balanceAfter: destNewBal,
            description: `Topup received from ${acct[0].name}: ${txn[0].providerTxnId}`,
            entryDate: txn[0].txnDate,
            createdBy: userId,
          } as any).returning();
          await db.update(accounts).set({ currentBalance: destNewBal }).where(eq(accounts.id, input.destinationAccountId));
        }
      }

      await db.update(mobileWalletTransactions).set({
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        isLinked: true,
      }).where(eq(mobileWalletTransactions.id, input.mpesaTxnId));

      return {
        topupAmount: topupAmount.toFixed(2),
        fee: fee.toFixed(2),
        totalOutflow: totalOutflow.toFixed(2),
        newBalance: newBal,
        success: true,
      };
    }),
});
