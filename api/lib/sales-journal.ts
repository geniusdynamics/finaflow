import { getDb } from "../queries/connection";
import { accounts, ledgerEntries, revenueCategories } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import { d } from "./decimal";

interface DailySalesJournalInput {
  dailySalesId: number;
  businessId: number;
  salesDate: Date | string;
  breakdown: {
    cash?: string;
    mpesa?: string;
    bankTransfer?: string;
    card?: string;
  };
  salesType?: "food" | "beverage" | "delivery" | "other";
  userId: number;
}

export async function createDailySalesJournalEntry(input: DailySalesJournalInput) {
  const db = getDb();
  const dateStr = input.salesDate instanceof Date 
    ? input.salesDate.toISOString().split("T")[0] 
    : input.salesDate;

  const salesRevenueAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.businessId, input.businessId),
      eq(accounts.accountSubType, "sales_revenue" as any),
      isNull(accounts.deletedAt)
    ),
  });

  if (!salesRevenueAccount) {
    return;
  }

  const revenueCategory = await db.query.revenueCategories.findFirst({
    where: and(
      eq(revenueCategories.businessId, input.businessId),
      isNull(revenueCategories.deletedAt)
    ),
  });

  let revenueAccountId = salesRevenueAccount.id;
  if (revenueCategory?.incomeAccountId) {
    revenueAccountId = revenueCategory.incomeAccountId;
  } else if (input.salesType) {
    const typeAccountMap: Record<string, string> = {
      food: "sales_revenue",
      beverage: "sales_revenue",
      delivery: "service_revenue",
      other: "other_income",
    };
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.businessId, input.businessId),
        eq(accounts.accountSubType, typeAccountMap[input.salesType] as any),
        isNull(accounts.deletedAt)
      ),
    });
    if (account) {
      revenueAccountId = account.id;
    }
  }

  const typeToSubtype: Record<string, string> = {
    cash: "cash",
    mpesa: "cash",
    bankTransfer: "bank",
    card: "bank",
  };

  await db.transaction(async (tx) => {
    for (const [paymentType, amount] of Object.entries(input.breakdown)) {
      if (!amount || parseFloat(amount) === 0) continue;

      const amountDec = d(amount);

      const cashAccount = await tx.query.accounts.findFirst({
        where: and(
          eq(accounts.businessId, input.businessId),
          eq(accounts.accountSubType, typeToSubtype[paymentType] as any),
          isNull(accounts.deletedAt)
        ),
      });

      if (!cashAccount) continue;

      const cashNewBalance = d(cashAccount.currentBalance || "0").plus(amountDec);

      await tx.insert(ledgerEntries).values({
        accountId: cashAccount.id,
        transactionType: "sale" as any,
        transactionId: input.dailySalesId,
        entryType: "debit",
        amount: amountDec.toFixed(2),
        balanceAfter: cashNewBalance.toFixed(2),
        entryDate: dateStr,
        createdBy: input.userId,
        description: `Daily Sales - ${paymentType}`,
      } as any);

      await tx.update(accounts).set({
        currentBalance: cashNewBalance.toFixed(2),
      }).where(eq(accounts.id, cashAccount.id));

      const revenueNewBalance = d(revenueAccountId === cashAccount.id 
        ? cashAccount.currentBalance 
        : (await tx.query.accounts.findFirst({
          where: eq(accounts.id, revenueAccountId)
        }))?.currentBalance || "0"
      ).plus(amountDec);

      await tx.insert(ledgerEntries).values({
        accountId: revenueAccountId,
        transactionType: "sale" as any,
        transactionId: input.dailySalesId,
        entryType: "credit",
        amount: amountDec.toFixed(2),
        balanceAfter: revenueNewBalance.toFixed(2),
        entryDate: dateStr,
        createdBy: input.userId,
        description: `Daily Sales - ${paymentType}`,
      } as any);

      if (revenueAccountId !== cashAccount.id) {
        await tx.update(accounts).set({
          currentBalance: revenueNewBalance.toFixed(2),
        }).where(eq(accounts.id, revenueAccountId));
      }
    }
  });
}
