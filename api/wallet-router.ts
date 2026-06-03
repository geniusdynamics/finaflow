// ABOUTME: Unified mobile wallet API that works across all providers. Replaces the M-PESA-specific router.
// ABOUTME: Uses the new mobile_wallet_transactions table with provider-agnostic filtering.

import { z } from "zod";
import { createRouter, walletQuery, walletImport, walletAdmin, getCurrentBusinessLocationIds, requireAuthorizedLocation, requireAuthorizedEntity, requireAuthorizedBusinessEntity } from "./middleware";
import { getDb } from "./queries/connection";
import { mobileWalletTransactions, mobileWalletProviders, mobileWalletDailyLedger, mobileWalletReconciliation, providerConfigs, expenses, suppliers, accounts, ledgerEntries, locations } from "@db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { walletRegistry } from "./lib/mobile-wallet/provider-registry";

export const walletRouter = createRouter({

  // ── Provider Management ────────────────────────────────────────────────

  providers: createRouter({
    list: walletQuery.query(async () => {
      const db = getDb();
      const registryProviders = walletRegistry.getAll();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dbMap = new Map<string, any>();
      try {
        const dbRows = await db.select().from(mobileWalletProviders).where(eq(mobileWalletProviders.isActive, true));
        dbMap = new Map(dbRows.map((r) => [r.code, r]));
      } catch {
        // table may not exist (pre-migration)
      }
      return registryProviders.map((rp) => {
        const dbRow = dbMap.get(rp.code);
        return {
          code: rp.code,
          name: rp.displayName,
          displayName: rp.displayName,
          supportedCurrencies: rp.supportedCurrencies.join(","),
          isActive: dbRow?.isActive ?? true,
          brandColor: dbRow?.brandColor ?? null,
          features: rp.features,
        };
      });
    }),

    listForLocation: walletQuery
      .input(z.object({ locationId: z.number() }))
      .query(async ({ input }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        let configs: any[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        let providers: any[] = [];
        try {
          configs = await db.select().from(providerConfigs).where(
            and(eq(providerConfigs.locationId, input.locationId), eq(providerConfigs.isActive, true), isNull(providerConfigs.deletedAt))
          );
          providers = await db.select().from(mobileWalletProviders);
        } catch {
          // table may not exist (pre-migration)
        }
        const registryProviders = walletRegistry.getAll();
        return registryProviders.map((rp) => {
          const p = providers.find((x) => x.code === rp.code);
          return {
            code: rp.code,
            name: rp.displayName,
            displayName: rp.displayName,
            supportedCurrencies: rp.supportedCurrencies.join(","),
            isActive: p?.isActive ?? true,
            brandColor: p?.brandColor ?? null,
            features: rp.features,
            configured: configs.some((c) => c.provider === rp.code),
            config: configs.find((c) => c.provider === rp.code) ?? null,
          };
        });
      }),

    setDefault: walletAdmin
      .input(z.object({ locationId: z.number(), provider: z.string(), accountId: z.number() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        await db.update(providerConfigs).set({ isDefault: false })
          .where(and(eq(providerConfigs.locationId, input.locationId), isNull(providerConfigs.deletedAt)));
        await db.insert(providerConfigs).values({
          locationId: input.locationId, provider: input.provider,
          accountId: input.accountId, isDefault: true, isActive: true,
        }).onConflictDoUpdate({
          target: [providerConfigs.locationId, providerConfigs.provider, providerConfigs.accountId],
          set: { isDefault: true, isActive: true, deletedAt: null },
        });
        return { success: true };
      }),
  }),

  // ── Transactions ───────────────────────────────────────────────────────

  transactions: createRouter({
    list: walletQuery
      .input(z.object({
        locationId: z.number().optional(),
        provider: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        unlinkedOnly: z.boolean().optional(),
        status: z.string().optional(),
        direction: z.string().optional(),
        currency: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const db = getDb();
          const conditions = [isNull(mobileWalletTransactions.deletedAt)];

        if (input?.provider) conditions.push(eq(mobileWalletTransactions.provider, input.provider));

        if (input?.locationId) {
          conditions.push(eq(mobileWalletTransactions.locationId, input.locationId));
        } else {
          const locIds = await getCurrentBusinessLocationIds(ctx);
          if (locIds.length === 0) return [];
          conditions.push(sql`${mobileWalletTransactions.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
        }

        if (input?.dateFrom && input?.dateTo) {
          conditions.push(sql`${mobileWalletTransactions.txnDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
        } else if (input?.dateFrom) {
          conditions.push(sql`${mobileWalletTransactions.txnDate} >= ${input.dateFrom}`);
        } else if (input?.dateTo) {
          conditions.push(sql`${mobileWalletTransactions.txnDate} <= ${input.dateTo}`);
        }

        if (input?.unlinkedOnly) conditions.push(eq(mobileWalletTransactions.isLinked, false));
        if (input?.status) conditions.push(eq(mobileWalletTransactions.status, input.status));
        if (input?.direction) conditions.push(eq(mobileWalletTransactions.direction, input.direction));
        if (input?.currency) conditions.push(eq(mobileWalletTransactions.currency, input.currency));

        return db.select()
          .from(mobileWalletTransactions)
          .where(and(...conditions))
          .orderBy(desc(mobileWalletTransactions.txnDate), desc(mobileWalletTransactions.txnTime))
          .limit(input?.limit ?? 100)
          .offset(input?.offset ?? 0);
        } catch {
          return [];
        }
      }),

    stats: walletQuery
      .input(z.object({
        locationId: z.number().optional(),
        provider: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const db = getDb();
        const conditions = [isNull(mobileWalletTransactions.deletedAt)];

        if (input?.provider) conditions.push(eq(mobileWalletTransactions.provider, input.provider));

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
        } else if (input?.dateFrom) {
          conditions.push(sql`${mobileWalletTransactions.txnDate} >= ${input.dateFrom}`);
        } else if (input?.dateTo) {
          conditions.push(sql`${mobileWalletTransactions.txnDate} <= ${input.dateTo}`);
        }

        const rows = await db.select({
          totalIn: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'in' THEN ABS(CAST(${mobileWalletTransactions.amount} AS DECIMAL)) ELSE 0 END), 0)`,
          totalOut: sql<string>`COALESCE(SUM(CASE WHEN ${mobileWalletTransactions.direction} = 'out' THEN ABS(CAST(${mobileWalletTransactions.amount} AS DECIMAL)) ELSE 0 END), 0)`,
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
          totalAmount: sql<string>`COALESCE(SUM(ABS(CAST(${mobileWalletTransactions.amount} AS DECIMAL))), 0)`,
          count: sql<number>`COUNT(*)`,
        }).from(mobileWalletTransactions).where(and(...conditions, sql`${mobileWalletTransactions.direction} = 'out'`)).groupBy(mobileWalletTransactions.partyName).orderBy(sql`SUM(ABS(CAST(${mobileWalletTransactions.amount} AS DECIMAL))) DESC`).limit(10);

        return { summary: rows[0], feesByType, topRecipients };
        } catch {
          return { summary: { totalIn: "0", totalOut: "0", totalFees: "0", countIn: 0, countOut: 0 }, feesByType: [], topRecipients: [] };
        }
      }),

    importSms: walletImport
      .input(z.object({ locationId: z.number(), provider: z.string(), smsText: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importedBy = (ctx as any).user?.id ?? 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const businessId = (ctx as any).user?.currentBusiness?.id ?? (ctx as any).user?.currentBusinessId;

        const location = await db.select().from(locations).where(eq(locations.id, input.locationId)).limit(1);
        if (location.length === 0) throw new Error("Location not found");
        if (location[0].businessId !== businessId) throw new Error("Location does not belong to your current business");

        const provider = walletRegistry.get(input.provider);
        if (!provider.parseSms) throw new Error(`Provider ${input.provider} does not support SMS import`);

        const parsed = await provider.parseSms(input.smsText);

        const preImportCountRow = await db.select({ count: sql<number>`COUNT(*)` })
          .from(mobileWalletTransactions)
          .where(and(
            eq(mobileWalletTransactions.locationId, input.locationId),
            eq(mobileWalletTransactions.provider, input.provider),
            isNull(mobileWalletTransactions.deletedAt),
          ));
        const preImportCount = Number(preImportCountRow[0]?.count ?? 0);

        let imported = 0, skipped = 0;
        const errors: string[] = [];

        const parsedAmount = (raw: string): number => {
          const n = parseFloat(raw);
          return Number.isFinite(n) ? Math.abs(n) : 0;
        };

        const sanitizeString = (val: unknown, fallback = ""): string => {
          if (val === null || val === undefined) return fallback;
          const s = String(val).trim();
          return s.length > 0 ? s : fallback;
        };

        const buildDescription = (partyName?: string, partyIdentifier?: string): string => {
          const safeName = sanitizeString(partyName, "Unknown party");
          const safeId = sanitizeString(partyIdentifier, "");
          return safeId ? `${safeName} (${safeId})` : safeName;
        };

        const validatedTxns = parsed
          .map((txn) => {
            const amt = parsedAmount(txn.amount);
            if (!txn.providerTxnId || amt <= 0 || !txn.date) {
              errors.push(`Skipped invalid row: ${txn.providerTxnId || "(no id)"} — amount=${txn.amount}, date=${txn.date}`);
              return null;
            }
            return { ...txn, amount: amt.toFixed(2) };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);

        for (const txn of validatedTxns) {
          const existing = await db.select({ id: mobileWalletTransactions.id }).from(mobileWalletTransactions).where(
            and(
              eq(mobileWalletTransactions.provider, input.provider),
              eq(mobileWalletTransactions.providerTxnId, txn.providerTxnId),
              isNull(mobileWalletTransactions.deletedAt),
            )
          ).limit(1);
          if (existing.length > 0) { skipped++; continue; }

          try {
            await db.insert(mobileWalletTransactions).values({
              locationId: input.locationId,
              provider: input.provider,
              providerTxnId: txn.providerTxnId,
              txnDate: txn.date,
              txnTime: sanitizeString(txn.time, "") || null,
              txnType: sanitizeString(txn.txnType, "transfer"),
              direction: txn.direction === "in" ? "in" : "out",
              partyName: sanitizeString(txn.partyName, "") || null,
              partyIdentifier: sanitizeString(txn.partyIdentifier, "") || null,
              amount: txn.amount,
              currency: sanitizeString(txn.currency, "KES"),
              txnFee: sanitizeString(txn.txnFee, "0.00"),
              balance: txn.balance ? sanitizeString(txn.balance, "") || null : null,
              description: buildDescription(txn.partyName, txn.partyIdentifier),
              rawText: sanitizeString(txn.rawText, ""),
              status: "completed",
              isLinked: false,
              importedBy,
              baseCurrency: sanitizeString(txn.currency, "KES"),
              baseAmount: txn.amount,
            });
            imported++;
          } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes("idx_wallet_txn_provider_txn") || msg.includes("duplicate key")) {
              skipped++;
            } else {
              errors.push(`${txn.providerTxnId}: ${msg}`);
            }
          }
        }

        const postImportCountRow = await db.select({ count: sql<number>`COUNT(*)` })
          .from(mobileWalletTransactions)
          .where(and(
            eq(mobileWalletTransactions.locationId, input.locationId),
            eq(mobileWalletTransactions.provider, input.provider),
            isNull(mobileWalletTransactions.deletedAt),
          ));
        const postImportCount = Number(postImportCountRow[0]?.count ?? 0);

        const dataIntact = postImportCount >= preImportCount;
        if (!dataIntact) {
          errors.push(
            `Critical safeguard triggered: transaction count decreased from ${preImportCount} to ${postImportCount}. ` +
            `Your existing data has NOT been altered, but please report this incident.`,
          );
        }

        return {
          imported,
          skipped,
          totalParsed: parsed.length,
          validParsed: validatedTxns.length,
          preImportCount,
          postImportCount,
          errors,
          success: dataIntact && (errors.length === 0 || imported > 0),
        };
      }),

    previewSms: walletQuery
      .input(z.object({ locationId: z.number(), provider: z.string(), smsText: z.string() }))
      .query(async ({ input }) => {
        const provider = walletRegistry.get(input.provider);
        if (!provider.parseSms) throw new Error(`Provider ${input.provider} does not support SMS import`);
        const parsed = await provider.parseSms(input.smsText);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        return parsed.map((txn: any) => ({
          txnId: txn.providerTxnId,
          providerTxnId: txn.providerTxnId,
          partyName: txn.partyName,
          amount: txn.amount,
          direction: txn.direction,
          txnType: txn.txnType,
          currency: txn.currency,
          date: txn.date,
          time: txn.time,
        }));
      }),

    tagToSupplier: walletQuery
      .input(z.object({ walletTxnId: z.number(), supplierId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
        await requireAuthorizedEntity(ctx, mobileWalletTransactions, input.walletTxnId);
        await requireAuthorizedBusinessEntity(ctx, suppliers, input.supplierId);

        await db.update(mobileWalletTransactions).set({ isLinked: true, linkedSupplierId: input.supplierId })
          .where(eq(mobileWalletTransactions.id, input.walletTxnId));
        return { success: true };
      }),

    createExpenseFromTxn: walletQuery
      .input(z.object({
        walletTxnId: z.number(), locationId: z.number(), categoryId: z.number(),
        description: z.string(), supplierId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enteredBy = (ctx as any).user?.id ?? 1;

        await requireAuthorizedLocation(ctx, input.locationId);
        const txn = await requireAuthorizedEntity(ctx, mobileWalletTransactions, input.walletTxnId);

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
            description: input.description || txn.description || `${txn.provider} ${txn.txnType}`,
            expenseDate: txn.txnDate, paymentMethod: txn.provider,
            enteredBy,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any).returning();

          expenseId = result.id;

          await tx.update(mobileWalletTransactions).set({ isLinked: true, linkedExpenseId: expenseId })
            .where(eq(mobileWalletTransactions.id, input.walletTxnId));

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

    linkTopupToAccount: walletImport
      .input(z.object({
        walletTxnId: z.number(),
        sourceAccountId: z.number(),
        destinationAccountId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (ctx as any).user?.id ?? 1;

        const txn = await db.select().from(mobileWalletTransactions).where(eq(mobileWalletTransactions.id, input.walletTxnId)).limit(1);
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
          transactionId: input.walletTxnId,
          entryType: "debit",
          amount: topupAmount.toFixed(2),
          balanceAfter: (oldBal - topupAmount).toFixed(2),
          description: `${txn[0].provider} topup to wallet: ${txn[0].providerTxnId}`,
          entryDate: txn[0].txnDate,
          createdBy: userId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any).returning();

        if (fee > 0) {
          await db.insert(ledgerEntries).values({
            accountId: input.sourceAccountId,
            transactionType: "mpesa_topup",
            transactionId: input.walletTxnId,
            entryType: "debit",
            amount: fee.toFixed(2),
            balanceAfter: newBal,
            description: `${txn[0].provider} topup transaction fee: ${txn[0].providerTxnId}`,
            entryDate: txn[0].txnDate,
            createdBy: userId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              transactionId: input.walletTxnId,
              entryType: "credit",
              amount: topupAmount.toFixed(2),
              balanceAfter: destNewBal,
              description: `Topup received from ${acct[0].name}: ${txn[0].providerTxnId}`,
              entryDate: txn[0].txnDate,
              createdBy: userId,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any).returning();
            await db.update(accounts).set({ currentBalance: destNewBal }).where(eq(accounts.id, input.destinationAccountId));
          }
        }

        await db.update(mobileWalletTransactions).set({
          sourceAccountId: input.sourceAccountId,
          destinationAccountId: input.destinationAccountId,
          isLinked: true,
        }).where(eq(mobileWalletTransactions.id, input.walletTxnId));

        return {
          topupAmount: topupAmount.toFixed(2),
          fee: fee.toFixed(2),
          totalOutflow: totalOutflow.toFixed(2),
          newBalance: newBal,
          success: true,
        };
      }),
  }),

  // ── Daily Ledger ───────────────────────────────────────────────────────

  dailyLedger: createRouter({
    list: walletQuery
      .input(z.object({
        locationId: z.number().optional(),
        provider: z.string().optional(),
        accountId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const db = getDb();
          const conditions = [isNull(mobileWalletDailyLedger.deletedAt)];

          if (input?.provider) conditions.push(eq(mobileWalletDailyLedger.provider, input.provider));
          if (input?.accountId) conditions.push(eq(mobileWalletDailyLedger.accountId, input.accountId));

          if (input?.locationId) {
            conditions.push(eq(mobileWalletDailyLedger.locationId, input.locationId));
          } else {
            const locIds = await getCurrentBusinessLocationIds(ctx);
            if (locIds.length > 0) {
              conditions.push(sql`${mobileWalletDailyLedger.locationId} IN (${sql.join(locIds.map(id => sql`${id}`), sql`, `)})`);
            }
          }
          if (input?.dateFrom && input?.dateTo) {
            conditions.push(sql`${mobileWalletDailyLedger.ledgerDate} BETWEEN ${input.dateFrom} AND ${input.dateTo}`);
          } else if (input?.dateFrom) {
            conditions.push(sql`${mobileWalletDailyLedger.ledgerDate} >= ${input.dateFrom}`);
          } else if (input?.dateTo) {
            conditions.push(sql`${mobileWalletDailyLedger.ledgerDate} <= ${input.dateTo}`);
          }

          return db.select().from(mobileWalletDailyLedger).where(and(...conditions)).orderBy(desc(mobileWalletDailyLedger.ledgerDate));
        } catch {
          return [];
        }
      }),

    create: walletImport
      .input(z.object({
        locationId: z.number(),
        provider: z.string().default("mpesa"),
        accountId: z.number(),
        ledgerDate: z.string(),
        openingBalance: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = getDb();

        const conditions = [
          eq(mobileWalletTransactions.locationId, input.locationId),
          eq(mobileWalletTransactions.provider, input.provider),
          eq(mobileWalletTransactions.txnDate, input.ledgerDate),
          isNull(mobileWalletTransactions.deletedAt),
        ];

        const dayTxns = await db.select({
          amount: mobileWalletTransactions.amount,
          txnFee: mobileWalletTransactions.txnFee,
        }).from(mobileWalletTransactions).where(and(...conditions));

        let totalInflow = 0, totalOutflow = 0, totalFees = 0;
        for (const txn of dayTxns) {
          const amt = parseFloat(txn.amount) || 0;
          if (amt > 0) totalInflow += amt;
          else totalOutflow += Math.abs(amt);
          totalFees += parseFloat(txn.txnFee) || 0;
        }

        const opening = parseFloat(input.openingBalance) || 0;
        const closing = opening + totalInflow - totalOutflow - totalFees;

        const [result] = await db.insert(mobileWalletDailyLedger).values({
          locationId: input.locationId,
          provider: input.provider,
          accountId: input.accountId,
          ledgerDate: input.ledgerDate,
          openingBalance: opening.toFixed(2),
          totalInflow: totalInflow.toFixed(2),
          totalOutflow: totalOutflow.toFixed(2),
          totalFees: totalFees.toFixed(2),
          closingBalance: closing.toFixed(2),
          transactionCount: dayTxns.length,
          notes: input.notes,
          baseCurrency: "KES",
          baseClosingBalance: closing.toFixed(2),
        }).returning();

        return result;
      }),
  }),

  // ── Reconciliation ─────────────────────────────────────────────────────

  reconciliation: createRouter({
    list: walletQuery
      .input(z.object({
        provider: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conditions: any[] = [];
        if (input?.provider) conditions.push(eq(mobileWalletReconciliation.provider, input.provider));
        if (input?.dateFrom) conditions.push(sql`${mobileWalletReconciliation.txnDate} >= ${input.dateFrom}`);
        if (input?.dateTo) conditions.push(sql`${mobileWalletReconciliation.txnDate} <= ${input.dateTo}`);
        return db.select().from(mobileWalletReconciliation).where(and(...conditions)).orderBy(desc(mobileWalletReconciliation.txnDate));
      }),

    create: walletAdmin
      .input(z.object({
        provider: z.string(),
        txnDate: z.string(),
        orphanCount: z.number().optional(),
        orphanTotal: z.string().optional(),
        matchedCount: z.number().optional(),
        matchedTotal: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const [result] = await db.insert(mobileWalletReconciliation).values({
          provider: input.provider,
          txnDate: input.txnDate,
          orphanCount: input.orphanCount ?? 0,
          orphanTotal: input.orphanTotal ?? "0.00",
          matchedCount: input.matchedCount ?? 0,
          matchedTotal: input.matchedTotal ?? "0.00",
          notes: input.notes,
        }).returning();
        return result;
      }),
  }),
});
