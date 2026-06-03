// ABOUTME: Provides shared helpers for generated system-managed chart accounts.
// ABOUTME: Builds stable keys and creates backing GL accounts consistently for simple-mode flows.
// ABOUTME: Now supports coaId back-linking and wallet-account CoA entries.
import { and, eq, isNull } from "drizzle-orm";

import { accounts, type AccountSubType, type AccountType } from "@db/schema";
import { getDb } from "../queries/connection";
import { getCoaSystemKeyForType, getDefaultCoaNameForType, type OperationalAccountType } from "./accounting-maps";

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
  operationalType?: OperationalAccountType;
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

export async function ensureSystemAccount(input: EnsureSystemAccountInput): Promise<{ id: number; coaId: number }> {
  const db = getDb();
  const systemKey = buildSystemAccountKey(input.accountType, input.accountSubType);

  const existing = await db
    .select({ id: accounts.id, coaId: accounts.coaId })
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
    return { id: existing[0].id, coaId: existing[0].coaId ?? existing[0].id };
  }

  // Fallback: look for an existing account with matching accountSubType but no systemKey.
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
    return { id: fallback[0].id, coaId: fallback[0].id };
  }

  // Use the operational type to determine the correct default name if provided
  const name = input.operationalType
    ? getDefaultCoaNameForType(input.operationalType)
    : input.name;

  const [created] = await db
    .insert(accounts)
    .values({
      businessId: input.businessId,
      locationId: null,
      name,
      type: getDefaultOperationalType(input.accountType, input.accountSubType),
      accountCode: input.accountCodeHint,
      description: `System-managed ${input.accountType} account for ${name}`,
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

  return { id: created.id, coaId: created.id };
}

/** Finds the CoA entry ID for a given operational account type and business. */
export async function findCoaEntryForOperationalType(
  businessId: number,
  operationalType: OperationalAccountType,
): Promise<number | null> {
  const db = getDb();
  const systemKey = getCoaSystemKeyForType(operationalType);

  const entry = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.businessId, businessId),
        eq(accounts.systemKey, systemKey),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);

  return entry[0]?.id ?? null;
}
