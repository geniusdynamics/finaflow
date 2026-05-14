import { getDb } from "../queries/connection";
import { accounts, expenseCategories, items, ledgerEntries } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Decimal from "decimal.js";
import { d } from "./decimal";

interface ExpenseJournalInput {
  expenseId: number;
  businessId: number;
  amount: string;
  expenseCategoryId: number;
  accountId: number;
  entryDate: Date | string;
  description: string;
  isFixedAsset?: boolean;
  usefulLifeMonths?: number;
  depreciationMethod?: "straight_line" | "declining_balance";
  salvageValue?: string;
  assetAccountId?: number;
  userId: number;
}

export async function createExpenseJournalEntry(input: ExpenseJournalInput) {
  const db = getDb();
  const amount = d(input.amount);

  const expenseCategory = await db.query.expenseCategories.findFirst({
    where: and(
      eq(expenseCategories.id, input.expenseCategoryId),
      isNull(expenseCategories.deletedAt)
    ),
  });

  let expenseAccountId = input.accountId;
  if (expenseCategory?.defaultAccountId) {
    expenseAccountId = expenseCategory.defaultAccountId;
  } else {
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.businessId, input.businessId),
        eq(accounts.accountSubType, mapCategoryToSubType(expenseCategory?.accountingClass) as any),
        isNull(accounts.deletedAt)
      ),
    });
    if (account) {
      expenseAccountId = account.id;
    }
  }

  if (input.isFixedAsset && input.assetAccountId) {
    await createFixedAssetEntry(input, expenseAccountId, amount);
  } else {
    await createExpenseJournalEntryInternal(
      input.expenseId,
      input.businessId,
      expenseAccountId,
      input.accountId,
      amount,
      input.entryDate,
      input.description,
      input.userId
    );
  }
}

async function createFixedAssetEntry(
  input: ExpenseJournalInput,
  expenseAccountId: number,
  amount: Decimal
) {
  const db = getDb();

  const assetAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.id, input.assetAccountId!),
      isNull(accounts.deletedAt)
    ),
  });

  if (!assetAccount) {
    throw new Error("Asset account not found");
  }

  const dateStr = input.entryDate instanceof Date 
    ? input.entryDate.toISOString().split("T")[0] 
    : input.entryDate;

  const [item] = await db.insert(items).values({
    businessId: input.businessId,
    name: input.description.substring(0, 255),
    description: input.description,
    itemType: "fixed_asset",
    isFixedAsset: true,
    purchaseDate: dateStr,
    purchasePrice: amount.toFixed(2),
    usefulLifeMonths: input.usefulLifeMonths || 60,
    depreciationMethod: input.depreciationMethod || "straight_line",
    salvageValue: input.salvageValue || "0.00",
    accumulatedDepreciation: "0.00",
    currentBookValue: amount.toFixed(2),
    assetAccountId: input.assetAccountId,
  } as any).returning();

  const cashAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.id, input.accountId),
      isNull(accounts.deletedAt)
    ),
  });

  const assetNewBalance = d(assetAccount.currentBalance || "0").plus(amount);
  const cashNewBalance = cashAccount
    ? d(cashAccount.currentBalance || "0").minus(amount)
    : d("0");

  await db.transaction(async (tx) => {
    await tx.insert(ledgerEntries).values({
      accountId: input.assetAccountId!,
      transactionType: "expense" as any,
      transactionId: input.expenseId,
      entryType: "debit",
      amount: amount.toFixed(2),
      balanceAfter: assetNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: input.userId,
      description: `Fixed Asset: ${input.description}`,
    } as any);

    await tx.update(accounts).set({
      currentBalance: assetNewBalance.toFixed(2),
    }).where(eq(accounts.id, input.assetAccountId!));

    if (cashAccount) {
      await tx.insert(ledgerEntries).values({
        accountId: input.accountId,
        transactionType: "expense" as any,
        transactionId: input.expenseId,
        entryType: "credit",
        amount: amount.toFixed(2),
        balanceAfter: cashNewBalance.toFixed(2),
        entryDate: dateStr,
        createdBy: input.userId,
        description: `Fixed Asset: ${input.description}`,
      } as any);

      await tx.update(accounts).set({
        currentBalance: cashNewBalance.toFixed(2),
      }).where(eq(accounts.id, input.accountId));
    }
  });

  return { itemId: item.id, assetAccountId: input.assetAccountId };
}

async function createExpenseJournalEntryInternal(
  expenseId: number,
  businessId: number,
  expenseAccountId: number,
  cashAccountId: number,
  amount: Decimal,
  entryDate: Date | string,
  description: string,
  userId: number
) {
  const db = getDb();
  const dateStr = entryDate instanceof Date 
    ? entryDate.toISOString().split("T")[0] 
    : entryDate;

  const expenseAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, expenseAccountId), isNull(accounts.deletedAt)),
  });

  const cashAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, cashAccountId), isNull(accounts.deletedAt)),
  });

  if (!expenseAccount || !cashAccount) {
    return;
  }

  const expenseNewBalance = d(expenseAccount.currentBalance || "0").plus(amount);
  const cashNewBalance = d(cashAccount.currentBalance || "0").minus(amount);

  await db.transaction(async (tx) => {
    await tx.insert(ledgerEntries).values({
      accountId: expenseAccountId,
      transactionType: "expense" as any,
      transactionId: expenseId,
      entryType: "debit",
      amount: amount.toFixed(2),
      balanceAfter: expenseNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: description,
    } as any);

    await tx.update(accounts).set({
      currentBalance: expenseNewBalance.toFixed(2),
    }).where(eq(accounts.id, expenseAccountId));

    await tx.insert(ledgerEntries).values({
      accountId: cashAccountId,
      transactionType: "expense" as any,
      transactionId: expenseId,
      entryType: "credit",
      amount: amount.toFixed(2),
      balanceAfter: cashNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: description,
    } as any);

    await tx.update(accounts).set({
      currentBalance: cashNewBalance.toFixed(2),
    }).where(eq(accounts.id, cashAccountId));
  });
}

function mapCategoryToSubType(accountingClass?: string): string {
  switch (accountingClass) {
    case "cogs":
      return "cogs";
    case "operating_expense":
      return "operating_expense";
    case "admin_expense":
      return "admin_expense";
    case "marketing":
      return "marketing_expense";
    case "depreciation":
      return "depreciation_expense";
    default:
      return "operating_expense";
  }
}

export async function createBillJournalEntry(
  billId: number,
  businessId: number,
  categoryId: number,
  amount: string,
  entryDate: Date | string,
  description: string,
  userId: number
) {
  const db = getDb();
  const amountDec = d(amount);

  const expenseCategory = await db.query.expenseCategories.findFirst({
    where: and(
      eq(expenseCategories.id, categoryId),
      isNull(expenseCategories.deletedAt)
    ),
  });

  let expenseAccountId: number | undefined;
  if (expenseCategory?.defaultAccountId) {
    expenseAccountId = expenseCategory.defaultAccountId;
  } else {
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.businessId, businessId),
        eq(accounts.accountSubType, mapCategoryToSubType(expenseCategory?.accountingClass) as any),
        isNull(accounts.deletedAt)
      ),
    });
    if (account) {
      expenseAccountId = account.id;
    }
  }

  const apAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.businessId, businessId),
      eq(accounts.accountSubType, "accounts_payable" as any),
      isNull(accounts.deletedAt)
    ),
  });

  if (!apAccount) {
    return;
  }

  if (!expenseAccountId) {
    return;
  }

  const dateStr = entryDate instanceof Date 
    ? entryDate.toISOString().split("T")[0] 
    : entryDate;

  const expenseAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, expenseAccountId), isNull(accounts.deletedAt)),
  });

  if (!expenseAccount) return;

  const expenseNewBalance = d(expenseAccount.currentBalance || "0").plus(amountDec);
  const apNewBalance = d(apAccount.currentBalance || "0").plus(amountDec);

  await db.transaction(async (tx) => {
    await tx.insert(ledgerEntries).values({
      accountId: expenseAccountId,
      transactionType: "expense" as any,
      transactionId: billId,
      entryType: "debit",
      amount: amountDec.toFixed(2),
      balanceAfter: expenseNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: `Bill: ${description}`,
    } as any);

    await tx.update(accounts).set({
      currentBalance: expenseNewBalance.toFixed(2),
    }).where(eq(accounts.id, expenseAccountId));

    await tx.insert(ledgerEntries).values({
      accountId: apAccount.id,
      transactionType: "bill_payment" as any,
      transactionId: billId,
      entryType: "credit",
      amount: amountDec.toFixed(2),
      balanceAfter: apNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: `Bill: ${description}`,
    } as any);

    await tx.update(accounts).set({
      currentBalance: apNewBalance.toFixed(2),
    }).where(eq(accounts.id, apAccount.id));
  });
}

export async function createBillPaymentJournalEntry(
  billPaymentId: number,
  businessId: number,
  billId: number,
  amount: string,
  accountId: number,
  entryDate: Date | string,
  description: string,
  userId: number
) {
  const db = getDb();
  const amountDec = d(amount);

  const apAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.businessId, businessId),
      eq(accounts.accountSubType, "accounts_payable" as any),
      isNull(accounts.deletedAt)
    ),
  });

  const cashAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), isNull(accounts.deletedAt)),
  });

  if (!apAccount || !cashAccount) {
    return;
  }

  const dateStr = entryDate instanceof Date 
    ? entryDate.toISOString().split("T")[0] 
    : entryDate;

  const apNewBalance = d(apAccount.currentBalance || "0").minus(amountDec);
  const cashNewBalance = d(cashAccount.currentBalance || "0").minus(amountDec);

  await db.transaction(async (tx) => {
    await tx.insert(ledgerEntries).values({
      accountId: apAccount.id,
      transactionType: "bill_payment" as any,
      transactionId: billPaymentId,
      entryType: "debit",
      amount: amountDec.toFixed(2),
      balanceAfter: apNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: `Bill Payment: ${description}`,
    } as any);

    await tx.update(accounts).set({
      currentBalance: apNewBalance.toFixed(2),
    }).where(eq(accounts.id, apAccount.id));

    await tx.insert(ledgerEntries).values({
      accountId: accountId,
      transactionType: "bill_payment" as any,
      transactionId: billPaymentId,
      entryType: "credit",
      amount: amountDec.toFixed(2),
      balanceAfter: cashNewBalance.toFixed(2),
      entryDate: dateStr,
      createdBy: userId,
      description: `Bill Payment: ${description}`,
    } as any);

    await tx.update(accounts).set({
      currentBalance: cashNewBalance.toFixed(2),
    }).where(eq(accounts.id, accountId));
  });
}
