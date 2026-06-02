// ABOUTME: Provides shared helpers for generated system-managed chart accounts.
// ABOUTME: Builds stable keys and creates backing GL accounts consistently for simple-mode flows.
import { and, eq, isNull } from "drizzle-orm";

import { accounts, type AccountSubType, type AccountType } from "@db/schema";
import { getDb } from "../queries/connection";

export function buildSystemAccountKey(
  accountType: AccountType,
  accountSubType: AccountSubType,
): string {
  return `${accountType}:${accountSubType}`;
}

interface EnsureSystemAccountInput {
  businessId: number;
  accountType: AccountType;
  accountSubType: AccountSubType;
  name: string;
  accountCodeHint?: string;
}

function getDefaultOperationalType(accountType: AccountType, accountSubType: AccountSubType) {
  if (accountType === "asset" && accountSubType === "cash") {
    return "cash" as const;
  }

  if (accountType === "asset" && accountSubType === "bank") {
    return "bank_account" as const;
  }

  return "bank_account" as const;
}

export async function ensureSystemAccount(input: EnsureSystemAccountInput): Promise<number> {
  const db = getDb();
  const systemKey = buildSystemAccountKey(input.accountType, input.accountSubType);

  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, input.businessId),
        eq(accounts.systemKey, systemKey),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  // Fallback: look for an existing account with matching accountSubType but no systemKey.
  // This handles seeded accounts created before systemKey was introduced.
  const fallback = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, input.businessId),
        eq(accounts.accountType, input.accountType),
        eq(accounts.accountSubType, input.accountSubType),
        isNull(accounts.systemKey),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);

  if (fallback[0]) {
    await db
      .update(accounts)
      .set({ systemKey })
      .where(eq(accounts.id, fallback[0].id));
    return fallback[0].id;
  }

  const [created] = await db
    .insert(accounts)
    .values({
      businessId: input.businessId,
      locationId: null,
      name: input.name,
      type: getDefaultOperationalType(input.accountType, input.accountSubType),
      accountCode: input.accountCodeHint,
      description: `System-managed ${input.accountType} account for ${input.name}`,
      systemKey,
      accountType: input.accountType,
      accountSubType: input.accountSubType,
      openingBalance: "0.00",
      currentBalance: "0.00",
      isPaymentMethod: false,
      isSystemGenerated: true,
      isContra: false,
      isActive: true,
    } satisfies typeof accounts.$inferInsert)
    .returning({ id: accounts.id });

  return created.id;
}
