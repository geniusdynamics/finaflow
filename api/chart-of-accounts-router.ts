import { z } from "zod";
import { createRouter, accountQuery, accountManage } from "./middleware";
import { getDb } from "./queries/connection";
import { accounts } from "@db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export const chartOfAccountsRouter = createRouter({
  list: accountQuery
    .input(z.object({ businessId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const allAccounts = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)))
        .orderBy(accounts.accountCode);

      const grouped = {
        asset: allAccounts.filter((a) => a.accountType === "asset"),
        liability: allAccounts.filter((a) => a.accountType === "liability"),
        equity: allAccounts.filter((a) => a.accountType === "equity"),
        revenue: allAccounts.filter((a) => a.accountType === "revenue"),
        expense: allAccounts.filter((a) => a.accountType === "expense"),
        unclassified: allAccounts.filter((a) => !a.accountType),
      };

      const summary: Record<string, { count: number; total: number }> = {};
      for (const [type, accts] of Object.entries(grouped)) {
        summary[type] = {
          count: accts.length,
          total: accts.reduce((s, a) => s + (parseFloat(a.currentBalance || "0") || 0), 0),
        };
      }

      return { grouped, summary };
    }),

  getByType: accountQuery
    .input(z.object({ businessId: z.number(), accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]) }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(accounts)
        .where(and(eq(accounts.businessId, input.businessId), eq(accounts.accountType, input.accountType), isNull(accounts.deletedAt)))
        .orderBy(accounts.accountCode);
    }),

  create: accountManage
    .input(
      z.object({
        businessId: z.number(),
        locationId: z.number().optional(),
        name: z.string().min(1).max(100),
        accountCode: z.string().max(20),
        description: z.string().optional(),
        accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
        accountSubType: z.string().optional(),
        isContra: z.boolean().default(false),
        parentAccountId: z.number().optional(),
        openingBalance: z.string().default("0.00"),
        type: z.enum(["cash", "wallet", "bank_account"]).optional(),
        isPaymentMethod: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const existing = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.businessId, input.businessId),
          eq(accounts.accountCode, input.accountCode),
          isNull(accounts.deletedAt)
        ),
      });

      if (existing) throw new Error("Account code already exists");

      const rows = await db
        .insert(accounts)
        .values({
          businessId: input.businessId,
          locationId: input.locationId,
          name: input.name,
          accountCode: input.accountCode,
          description: input.description,
          accountType: input.accountType,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
          accountSubType: input.accountSubType as any,
          isContra: input.isContra,
          parentAccountId: input.parentAccountId,
          openingBalance: input.openingBalance,
          currentBalance: input.openingBalance,
          type: input.type || "bank_account",
          isPaymentMethod: input.isPaymentMethod,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .returning();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = (rows as any[])[0];

      return account;
    }),

  update: accountManage
    .input(
      z.object({
        id: z.number(),
        businessId: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        accountSubType: z.string().optional(),
        isContra: z.boolean().optional(),
        parentAccountId: z.number().optional(),
        externalId: z.string().optional(),
        externalSystem: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.id), isNull(accounts.deletedAt)),
      });

      if (!account) throw new Error("Account not found");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.accountSubType !== undefined) updates.accountSubType = input.accountSubType;
      if (input.isContra !== undefined) updates.isContra = input.isContra;
      if (input.parentAccountId !== undefined) updates.parentAccountId = input.parentAccountId;
      if (input.externalId !== undefined) updates.externalId = input.externalId;
      if (input.externalSystem !== undefined) updates.externalSystem = input.externalSystem;

      await db.update(accounts).set(updates).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  delete: accountManage
    .input(z.object({ id: z.number(), businessId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.id), isNull(accounts.deletedAt)),
      });

      if (!account) throw new Error("Account not found");
      if (account.currentBalance && parseFloat(account.currentBalance) !== 0) {
        throw new Error("Cannot delete account with non-zero balance");
      }

      await db.update(accounts).set({ deletedAt: new Date() }).where(eq(accounts.id, input.id));
      return { success: true };
    }),

  getAccountBalance: accountQuery
    .input(z.object({ id: z.number(), businessId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const account = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, input.id), isNull(accounts.deletedAt)),
      });

      if (!account) throw new Error("Account not found");

      return { account, normalBalance: getNormalBalance(account.accountType || "") };
    }),

  validateCode: accountQuery
    .input(z.object({ businessId: z.number(), accountCode: z.string(), excludeId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditions: any[] = [
        eq(accounts.businessId, input.businessId),
        eq(accounts.accountCode, input.accountCode),
        isNull(accounts.deletedAt),
      ];

      const existing = await db.query.accounts.findFirst({ where: and(...conditions) });

      if (existing && existing.id !== input.excludeId) {
        return { valid: false, message: "Account code already exists" };
      }
      return { valid: true };
    }),

  getNextAccountCode: accountQuery
    .input(z.object({ businessId: z.number(), accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]) }))
    .query(async ({ input }) => {
      const db = getDb();
      const codeRanges: Record<string, { start: number; prefix: string }> = {
        asset: { start: 1000, prefix: "1" },
        liability: { start: 2000, prefix: "2" },
        equity: { start: 3000, prefix: "3" },
        revenue: { start: 4000, prefix: "4" },
        expense: { start: 5000, prefix: "5" },
      };

      const range = codeRanges[input.accountType];
      const existing = await db
        .select({ accountCode: accounts.accountCode })
        .from(accounts)
        .where(and(eq(accounts.businessId, input.businessId), isNull(accounts.deletedAt)))
        .orderBy(desc(accounts.accountCode));

      let nextCode = range.start;
      for (const acc of existing) {
        if (acc.accountCode && acc.accountCode.startsWith(range.prefix)) {
          const codeNum = parseInt(acc.accountCode, 10);
          if (!isNaN(codeNum) && codeNum >= range.start) {
            nextCode = codeNum + 1;
            break;
          }
        }
      }

      return { nextCode: String(nextCode) };
    }),
});

function getNormalBalance(accountType: string): "debit" | "credit" {
  switch (accountType) {
    case "asset":
    case "expense":
      return "debit";
    case "liability":
    case "equity":
    case "revenue":
      return "credit";
    default:
      return "debit";
  }
}
