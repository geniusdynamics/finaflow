import { z } from "zod";
import { createRouter, mpesaQuery, mpesaImport, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { mpesaTransactions, expenses, suppliers, accounts, ledgerEntries, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

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
      const conditions = [isNull(mpesaTransactions.deletedAt)];
      
      // Filter by location - either specific location or all business locations
      if (input?.locationId) {
        conditions.push(eq(mpesaTransactions.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        console.log('[MPESA LIST] Business location IDs:', locIds);
        if (locIds.length === 0) {
          console.log('[MPESA LIST] No locations found for current business');
          return [];
        }
        conditions.push(sql`${mpesaTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      // Date filtering - always apply if dates are provided
      if (input?.dateFrom && input?.dateTo) {
        console.log('[MPESA LIST] Date filter:', input.dateFrom, 'to', input.dateTo);
        conditions.push(sql`${mpesaTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      } else {
        console.log('[MPESA LIST] No date filter applied. dateFrom:', input?.dateFrom, 'dateTo:', input?.dateTo);
      }
      
      if (input?.unlinkedOnly) conditions.push(eq(mpesaTransactions.isLinked, false));
      
      const results = await db.select().from(mpesaTransactions).where(and(...conditions)).orderBy(desc(mpesaTransactions.txnDate), desc(mpesaTransactions.txnTime));
      console.log('[MPESA LIST] Found', results.length, 'transactions');
      return results;
    }),

  stats: mpesaQuery
    .input(z.object({ 
      locationId: z.number().optional(), 
      dateFrom: z.string().optional(), 
      dateTo: z.string().optional() 
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conditions = [isNull(mpesaTransactions.deletedAt)];
      if (input?.locationId) {
        conditions.push(eq(mpesaTransactions.locationId, input.locationId));
      } else {
        const locIds = await getCurrentBusinessLocationIds(ctx);
        if (locIds.length > 0) {
          conditions.push(sql`${mpesaTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }
      }
      if (input?.dateFrom && input?.dateTo) {
        console.log('[MPESA STATS] Date filter:', input.dateFrom, 'to', input.dateTo);
        conditions.push(sql`${mpesaTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
      }
      const rows = await db.select({
        totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} > 0 THEN ${mpesaTransactions.amount} ELSE 0 END), 0)`,
        totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${mpesaTransactions.amount} < 0 THEN ABS(${mpesaTransactions.amount}) ELSE 0 END), 0)`,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        countIn: sql<number>`COUNT(CASE WHEN ${mpesaTransactions.amount} > 0 THEN 1 END)`,
        countOut: sql<number>`COUNT(CASE WHEN ${mpesaTransactions.amount} < 0 THEN 1 END)`,
      }).from(mpesaTransactions).where(and(...conditions));

      const feesByType = await db.select({
        txnType: mpesaTransactions.txnType,
        totalFees: sql<string>`COALESCE(SUM(${mpesaTransactions.txnFee}), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mpesaTransactions).where(and(...conditions)).groupBy(mpesaTransactions.txnType);

      const topRecipients = await db.select({
        partyName: mpesaTransactions.partyName,
        totalAmount: sql<string>`COALESCE(SUM(ABS(${mpesaTransactions.amount})), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(mpesaTransactions).where(and(...conditions, sql`${mpesaTransactions.amount} < 0`)).groupBy(mpesaTransactions.partyName).orderBy(sql`SUM(ABS(${mpesaTransactions.amount})) DESC`).limit(10);

      return { summary: rows[0], feesByType, topRecipients };
    }),

  importSms: mpesaImport
    .input(z.object({ locationId: z.number(), smsText: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const importedBy = (ctx as any).user?.id ?? 1;
      const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;
      
      console.log('[MPESA IMPORT] Starting import for locationId:', input.locationId, 'businessId:', businessId);
      
      // Validate that the location belongs to the current business
      const location = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
      if (location.length === 0) {
        throw new Error("Location not found");
      }
      if (location[0].businessId !== businessId) {
        throw new Error(`Location does not belong to your current business. Location businessId: ${location[0].businessId}, Current businessId: ${businessId}`);
      }
      
      const { parseMpesaSmsBulk } = await import("./mpesa-parser");
      const parsed = parseMpesaSmsBulk(input.smsText);
      console.log('[MPESA IMPORT] Parsed', parsed.length, 'transactions');
      
      let imported = 0, skipped = 0;
      const errors: string[] = [];

      for (const txn of parsed) {
        const existing = await db.select().from(mpesaTransactions).where(eq(mpesaTransactions.txnId, txn.txnId)).limit(1);
        if (existing.length > 0) { 
          console.log('[MPESA IMPORT] Skipping duplicate:', txn.txnId);
          skipped++; 
          continue; 
        }
        try {
          const txnDateStr = txn.date; // Should be YYYY-MM-DD format
          console.log('[MPESA IMPORT] Importing:', txn.txnId, 'date:', txnDateStr, 'amount:', txn.amount);
          
          await db.insert(mpesaTransactions).values({
            locationId: input.locationId, 
            txnId: txn.txnId,
            txnDate: txnDateStr, // Store as string in YYYY-MM-DD format
            txnTime: txn.time, 
            txnType: txn.txnType,
            partyName: txn.partyName,
            amount: txn.direction === "out" ? `-${txn.amount}` : txn.amount,
            txnFee: txn.txnFee, 
            balance: txn.balance,
            description: txn.partyIdentifier ? `${txn.partyName} (${txn.partyIdentifier})` : txn.partyName,
            rawText: txn.rawText, 
            isLinked: false, 
            importedBy,
          } as any).returning();
          imported++;
        } catch (e) { 
          console.error('[MPESA IMPORT] Error importing', txn.txnId, ':', e);
          errors.push(`${txn.txnId}: ${(e as Error).message}`); 
        }
      }
      
      console.log('[MPESA IMPORT] Complete. Imported:', imported, 'Skipped:', skipped, 'Errors:', errors.length);
      return { imported, skipped, totalParsed: parsed.length, errors, success: true };
    }),

  tagToSupplier: mpesaQuery
    .input(z.object({ mpesaTxnId: z.number(), supplierId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await requireAuthorizedEntity(ctx, mpesaTransactions, input.mpesaTxnId);
      await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);

      await db.update(mpesaTransactions).set({ isLinked: true, linkedSupplierId: input.supplierId })
        .where(eq(mpesaTransactions.id, input.mpesaTxnId));
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
      const txn = await requireAuthorizedEntity(ctx, mpesaTransactions, input.mpesaTxnId);
      
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
          mpesaTxnId: txn.txnId, enteredBy,
        } as any).returning();
        
        expenseId = result.id;

        await tx.update(mpesaTransactions).set({ isLinked: true, linkedExpenseId: expenseId })
          .where(eq(mpesaTransactions.id, input.mpesaTxnId));

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

  // Link a topup to source bank account AND destination M-PESA wallet
  linkTopupToAccount: mpesaImport
    .input(z.object({
      mpesaTxnId: z.number(),
      sourceAccountId: z.number(),
      destinationAccountId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = (ctx as any).user?.id ?? 1;

      const txn = await db.select().from(mpesaTransactions).where(eq(mpesaTransactions.id, input.mpesaTxnId)).limit(1);
      if (!txn[0]) throw new Error("M-PESA transaction not found");
      if (txn[0].txnType !== "topup") throw new Error("Only topup transactions can be linked to a bank account");

      const acct = await db.select().from(accounts).where(eq(accounts.id, input.sourceAccountId)).limit(1);
      if (!acct[0]) throw new Error("Source account not found");

      const topupAmount = Math.abs(parseFloat(txn[0].amount));
      const fee = parseFloat(txn[0].txnFee);
      const totalOutflow = topupAmount + fee;
      const oldBal = parseFloat(acct[0].currentBalance);
      const newBal = (oldBal - totalOutflow).toFixed(2);

      // Record outflow from bank account for the topup amount
      const [ledger1] = await db.insert(ledgerEntries).values({
        accountId: input.sourceAccountId,
        transactionType: "mpesa_topup",
        transactionId: input.mpesaTxnId,
        entryType: "debit",
        amount: topupAmount.toFixed(2),
        balanceAfter: (oldBal - topupAmount).toFixed(2),
        description: `M-PESA topup to wallet: ${txn[0].txnId}`,
        entryDate: txn[0].txnDate,
        createdBy: userId,
      } as any).returning();

      // Record fee as separate ledger entry
      if (fee > 0) {
        await db.insert(ledgerEntries).values({
          accountId: input.sourceAccountId,
          transactionType: "mpesa_topup",
          transactionId: input.mpesaTxnId,
          entryType: "debit",
          amount: fee.toFixed(2),
          balanceAfter: newBal,
          description: `M-PESA topup transaction fee: ${txn[0].txnId}`,
          entryDate: txn[0].txnDate,
          createdBy: userId,
        } as any).returning();
      }

      // Update source account balance
      await db.update(accounts).set({ currentBalance: newBal }).where(eq(accounts.id, input.sourceAccountId));

      // If destination wallet specified, credit it
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
            description: `Topup received from ${acct[0].name}: ${txn[0].txnId}`,
            entryDate: txn[0].txnDate,
            createdBy: userId,
          } as any).returning();
          await db.update(accounts).set({ currentBalance: destNewBal }).where(eq(accounts.id, input.destinationAccountId));
        }
      }

      // Update M-PESA transaction with source and destination accounts
      await db.update(mpesaTransactions).set({
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        isLinked: true,
      }).where(eq(mpesaTransactions.id, input.mpesaTxnId));

      return {
        topupAmount: topupAmount.toFixed(2),
        fee: fee.toFixed(2),
        totalOutflow: totalOutflow.toFixed(2),
        newBalance: newBal,
        success: true,
      };
    }),
});
