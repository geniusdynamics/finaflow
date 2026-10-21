// ABOUTME: Resolves statement rows to a business's expense categories using system keys and learned rules.
// ABOUTME: Returns null when nothing matches; statement import never creates categories on its own.

import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { expenseCategories, locations, mobileWalletTransactions, walletCategoryRules } from "@db/schema";
import { getDb } from "../../queries/connection";
import { resolveCategory, type CategoryCandidate } from "@shared/statements/categorize/taxonomy";
import type { ParsedStatementRow } from "@shared/statements/types";

export interface CategoryRule {
  id: number;
  matchType: string;
  pattern: string;
  categoryId: number;
  priority: number;
}

export interface CategoryContext {
  candidates: CategoryCandidate[];
  rules: CategoryRule[];
}

export interface ResolvedCategory {
  categoryId: number | null;
  source: "none" | "rule" | "learned" | "manual";
  confidence: number;
  ruleId?: number;
}

export async function loadCategoryContext(
  businessId: number,
  locationId: number,
  provider: string,
): Promise<CategoryContext> {
  const db = getDb();

  const categories = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name, locationId: expenseCategories.locationId })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.businessId, businessId),
        eq(expenseCategories.isActive, true),
        isNull(expenseCategories.deletedAt),
      ),
    );

  // Location-specific categories win over business-wide ones with the same name.
  const ordered = [...categories].sort((a, b) => {
    const aLocal = a.locationId === locationId ? 0 : 1;
    const bLocal = b.locationId === locationId ? 0 : 1;
    return aLocal - bLocal;
  });

  const rules = await db
    .select({
      id: walletCategoryRules.id,
      matchType: walletCategoryRules.matchType,
      pattern: walletCategoryRules.pattern,
      categoryId: walletCategoryRules.categoryId,
      priority: walletCategoryRules.priority,
    })
    .from(walletCategoryRules)
    .where(
      and(
        eq(walletCategoryRules.businessId, businessId),
        eq(walletCategoryRules.isActive, true),
        isNull(walletCategoryRules.deletedAt),
        or(
          isNull(walletCategoryRules.provider),
          eq(walletCategoryRules.provider, provider),
        ),
      ),
    )
    .orderBy(desc(walletCategoryRules.priority), asc(walletCategoryRules.createdAt));

  return {
    candidates: ordered.map((c) => ({ id: c.id, name: c.name })),
    rules,
  };
}

function ruleMatches(rule: CategoryRule, row: ParsedStatementRow): boolean {
  const haystack = `${row.details} ${row.counterpartyName ?? ""}`.toLowerCase();
  const pattern = rule.pattern.toLowerCase();
  if (rule.matchType === "exact") {
    return haystack === pattern || (row.counterpartyName ?? "").toLowerCase() === pattern;
  }
  if (rule.matchType === "regex") {
    try {
      return new RegExp(rule.pattern, "i").test(haystack);
    } catch {
      return false;
    }
  }
  return haystack.includes(pattern);
}

/** Resolves one row: learned rule first, then the system category key. */
export function resolveRowCategory(
  row: ParsedStatementRow,
  context: CategoryContext,
): ResolvedCategory {
  const rule = context.rules.find((candidate) => ruleMatches(candidate, row));
  if (rule) {
    return { categoryId: rule.categoryId, source: "learned", confidence: 1, ruleId: rule.id };
  }

  const match = resolveCategory(row.categoryKey, context.candidates);
  if (match) {
    return { categoryId: match.id, source: "rule", confidence: row.categoryConfidence };
  }

  return { categoryId: null, source: "none", confidence: 0 };
}

export async function setWalletCategory(input: {
  businessId: number;
  walletTxnId: number;
  categoryId: number | null;
  rememberMerchant?: boolean;
  userId?: number | null;
}): Promise<{ categoryId: number | null; ruleId?: number } | null> {
  const db = getDb();
  const [txn] = await db
    .select({
      id: mobileWalletTransactions.id,
      locationId: mobileWalletTransactions.locationId,
      provider: mobileWalletTransactions.provider,
      partyName: mobileWalletTransactions.partyName,
      description: mobileWalletTransactions.description,
    })
    .from(mobileWalletTransactions)
    .where(and(eq(mobileWalletTransactions.id, input.walletTxnId), isNull(mobileWalletTransactions.deletedAt)))
    .limit(1);
  if (!txn) return null;

  const [location] = await db
    .select({ businessId: locations.businessId })
    .from(locations)
    .where(eq(locations.id, txn.locationId))
    .limit(1);
  if (!location || location.businessId !== input.businessId) return null;

  if (input.categoryId !== null) {
    const [category] = await db
      .select({ id: expenseCategories.id })
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.id, input.categoryId),
          eq(expenseCategories.businessId, input.businessId),
          isNull(expenseCategories.deletedAt),
        ),
      )
      .limit(1);
    if (!category) {
      throw new Error("That category does not belong to this business.");
    }
  }

  let ruleId: number | undefined;

  await db.transaction(async (tx) => {
    await tx
      .update(mobileWalletTransactions)
      .set({
        categoryId: input.categoryId,
        classificationSource: input.categoryId === null ? "none" : "manual",
        classificationConfidence: input.categoryId === null ? null : "1.000",
      })
      .where(eq(mobileWalletTransactions.id, input.walletTxnId));

    if (input.rememberMerchant && input.categoryId !== null) {
      const pattern = (txn.partyName ?? txn.description ?? "").trim().replace(/\s+/g, " ").slice(0, 255);
      if (pattern) {
        const [existing] = await tx
          .select({ id: walletCategoryRules.id })
          .from(walletCategoryRules)
          .where(
            and(
              eq(walletCategoryRules.businessId, input.businessId),
              eq(walletCategoryRules.provider, txn.provider),
              eq(walletCategoryRules.matchType, "contains"),
              eq(walletCategoryRules.pattern, pattern),
              isNull(walletCategoryRules.deletedAt),
            ),
          )
          .limit(1);

        if (existing) {
          await tx
            .update(walletCategoryRules)
            .set({ categoryId: input.categoryId, isActive: true, deletedAt: null })
            .where(eq(walletCategoryRules.id, existing.id));
          ruleId = existing.id;
        } else {
          const [created] = await tx
            .insert(walletCategoryRules)
            .values({
              businessId: input.businessId,
              provider: txn.provider,
              matchType: "contains",
              pattern,
              categoryId: input.categoryId,
              source: "user",
              priority: 1000,
              createdBy: input.userId ?? undefined,
            })
            .returning({ id: walletCategoryRules.id });
          ruleId = created.id;
        }
      }
    }
  });

  return { categoryId: input.categoryId, ruleId };
}

export async function listCategoryRules(input: { businessId: number }) {
  const db = getDb();
  return db
    .select({
      id: walletCategoryRules.id,
      provider: walletCategoryRules.provider,
      matchType: walletCategoryRules.matchType,
      pattern: walletCategoryRules.pattern,
      categoryId: walletCategoryRules.categoryId,
      categoryName: expenseCategories.name,
      hitCount: walletCategoryRules.hitCount,
      createdAt: walletCategoryRules.createdAt,
    })
    .from(walletCategoryRules)
    .leftJoin(expenseCategories, eq(walletCategoryRules.categoryId, expenseCategories.id))
    .where(
      and(
        eq(walletCategoryRules.businessId, input.businessId),
        eq(walletCategoryRules.isActive, true),
        isNull(walletCategoryRules.deletedAt),
      ),
    )
    .orderBy(desc(walletCategoryRules.createdAt))
    .limit(200);
}

export async function deleteCategoryRule(input: { businessId: number; ruleId: number }): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .update(walletCategoryRules)
    .set({ deletedAt: new Date(), isActive: false })
    .where(
      and(
        eq(walletCategoryRules.id, input.ruleId),
        eq(walletCategoryRules.businessId, input.businessId),
        isNull(walletCategoryRules.deletedAt),
      ),
    )
    .returning({ id: walletCategoryRules.id });
  return deleted.length > 0;
}
