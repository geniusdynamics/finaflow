// ABOUTME: tRPC router for Subscription Management — CRUD, lifecycle (pause/cancel/replace/clone),
// ABOUTME: payment recording with accounting posting, calendar events, and stats/projection analytics.
import { z } from "zod";
import {
  createRouter,
  subscriptionsView,
  subscriptionsManage,
  subscriptionsPay,
  budgetManage,
  getCurrentBusinessLocationIds,
  requireAuthorizedLocation,
} from "./middleware";
import { getDb } from "./queries/connection";
import {
  accounts,
  appSettings,
  budgetBucketLines,
  budgetPlanBuckets,
  budgetPlans,
  businessCurrencies,
  expenseCategories,
  locations,
  subscriptionPayments,
  subscriptions,
  suppliers,
  type Subscription,
} from "@db/schema";
import { and, asc, desc, eq, inArray, isNull, like, or, count, type SQL } from "drizzle-orm";
import { d, Decimal } from "./lib/decimal";
import {
  advanceDueDate,
  monthlyNormalized,
  yearlyNormalized,
  cycleProgress,
  projectMonths,
  daysBetween,
  isOverdue as isOverdueMath,
  isDueSoon as isDueSoonMath,
  parsePositiveAmount as parseAmount,
  type CycleUnit,
  type SubscriptionSchedule,
} from "./lib/subscription-math";
import { postSubscriptionPayment, type SubscriptionPaymentMethod } from "./lib/subscription-posting";
import { recordPaymentInTx } from "./lib/subscription-service";
import { clearNotificationsForSubscription } from "./lib/notification-clearance";
import { currencyConverter } from "./lib/currency-converter";
import { logAudit } from "./lib/audit";

// ── Input building blocks ────────────────────────────────────────────────────

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const amountStr = z.string().min(1);
const cycleUnit = z.enum(["day", "week", "month", "year"]);
const statusEnum = z.enum(["active", "paused", "cancelled", "expired"]);
const postingMode = z.enum(["none", "expense", "bill"]);
const paymentMethod = z.enum(["cash", "wallet", "bank_transfer", "card"]);
const scopeEnum = z.enum(["all", "main", "branch"]);

const subscriptionFields = {
  locationId: z.number().nullable().optional(),
  postingLocationId: z.number().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  vendorId: z.number().nullable().optional(),
  categoryId: z.number().nullable().optional(),
  amount: amountStr,
  currency: z.string().length(3).default("KES"),
  cycleUnit,
  cycleCount: z.number().int().min(1).max(365).default(1),
  isOneTime: z.boolean().default(false),
  startDate: dateStr,
  nextDueDate: dateStr,
  autoRenew: z.boolean().default(false),
  trialEndsAt: dateStr.nullable().optional(),
  defaultAccountId: z.number().nullable().optional(),
  postingMode: postingMode.default("expense"),
  externalSystem: z.string().max(50).nullable().optional(),
  externalId: z.string().max(100).nullable().optional(),
  url: z.string().max(255).nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  notifyEnabled: z.boolean().default(true),
  notifyDaysBefore: z.number().int().min(0).max(90).nullable().optional(),
  notes: z.string().nullable().optional(),
};

const createInput = z.object(subscriptionFields);
const updateInput = z.object(subscriptionFields).partial().extend({ id: z.number(), recalculateNextDue: z.boolean().optional() });

const listInput = z.object({
  locationId: z.number().optional(),
  scope: scopeEnum.default("all"),
  status: statusEnum.optional(),
  categoryId: z.number().optional(),
  cycleUnit: cycleUnit.optional(),
  vendorId: z.number().optional(),
  search: z.string().max(255).optional(),
  sort: z.enum(["next_due", "amount", "name", "category"]).default("next_due"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

// ── Small helpers ────────────────────────────────────────────────────────────

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

 
function getBusinessId(ctx: { user?: any }): number {
  const businessId = ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId;
  if (!businessId) throw new Error("No active business selected");
  return businessId;
}

async function getSubscriptionSetting(
  db: ReturnType<typeof getDb>,
  businessId: number,
  key: string,
  fallback: string,
): Promise<string> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(and(eq(appSettings.businessId, businessId), eq(appSettings.key, key)))
    .limit(1);
  return rows[0]?.value ?? fallback;
}

async function getBaseCurrency(db: ReturnType<typeof getDb>, businessId: number): Promise<string> {
  const rows = await db
    .select({ currency: businessCurrencies.currency })
    .from(businessCurrencies)
    .where(
      and(
        eq(businessCurrencies.businessId, businessId),
        eq(businessCurrencies.isBaseCurrency, true),
        eq(businessCurrencies.isActive, true),
      ),
    )
    .limit(1);
  return rows[0]?.currency ?? "KES";
}

/** Per-currency → base rate map; currencies without a rate map to null (row excluded from totals). */
async function buildRateMap(
  currencies: string[],
  base: string,
): Promise<Map<string, Decimal | null>> {
  const rates = new Map<string, Decimal | null>();
  for (const currency of new Set(currencies)) {
    if (currency === base) {
      rates.set(currency, d(1));
      continue;
    }
    try {
      rates.set(currency, await currencyConverter.getRate(currency, base));
    } catch {
      rates.set(currency, null);
    }
  }
  return rates;
}

function toBase(amount: Decimal, currency: string, rates: Map<string, Decimal | null>): Decimal | null {
  const rate = rates.get(currency);
  return rate ? amount.times(rate) : null;
}

/** Human label for the posting mode. */
function postingModeLabel(mode: Subscription["postingMode"]): string {
  return mode === "expense" ? "Create expense" : mode === "bill" ? "Create bill" : "Reminder only";
}

interface NameMaps {
  branchNames: Map<number, string>;
  vendorNames: Map<number, string>;
  categoryNames: Map<number, string>;
}

async function loadNameMaps(db: ReturnType<typeof getDb>, businessId: number): Promise<NameMaps> {
  const [locs, vends, cats] = await Promise.all([
    db.select({ id: locations.id, name: locations.name }).from(locations).where(eq(locations.businessId, businessId)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.businessId, businessId)),
    db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.businessId, businessId)),
  ]);
  return {
    branchNames: new Map(locs.map((l) => [l.id, l.name])),
    vendorNames: new Map(vends.map((v) => [v.id, v.name])),
    categoryNames: new Map(cats.map((c) => [c.id, c.name])),
  };
}

interface ComputedRow {
  monthlyNormalized: string;
  yearlyNormalized: string;
  convertedMonthly: string | null;
  convertedYearly: string | null;
  progress: number;
  daysUntilDue: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  branchName: string | null;
  vendorName: string | null;
  categoryName: string | null;
  postingModeLabel: string;
}

function decorateRow(
  row: Subscription,
  names: NameMaps,
  rates: Map<string, Decimal | null>,
  defaultNotifyDays: number,
  today: string,
): Subscription & ComputedRow {
  const monthly = row.isOneTime ? d(0) : monthlyNormalized(row.amount, row.cycleUnit as CycleUnit, row.cycleCount);
  const yearly = row.isOneTime ? d(0) : yearlyNormalized(row.amount, row.cycleUnit as CycleUnit, row.cycleCount);
  const convertedMonthly = toBase(monthly, row.currency, rates);
  const convertedYearly = toBase(yearly, row.currency, rates);
  const daysUntilDue = daysBetween(row.nextDueDate, today);
  const notifyDays = row.notifyDaysBefore ?? defaultNotifyDays;
  return {
    ...row,
    monthlyNormalized: monthly.toFixed(2),
    yearlyNormalized: yearly.toFixed(2),
    convertedMonthly: convertedMonthly ? convertedMonthly.toFixed(2) : null,
    convertedYearly: convertedYearly ? convertedYearly.toFixed(2) : null,
    progress: cycleProgress(row.nextDueDate, row.cycleUnit as CycleUnit, row.cycleCount, today, row.isOneTime),
    daysUntilDue,
    isDueSoon: isDueSoonMath(row.nextDueDate, notifyDays, today),
    isOverdue: isOverdueMath(row.nextDueDate, row.status, today),
    branchName: row.locationId ? (names.branchNames.get(row.locationId) ?? null) : null,
    vendorName: row.vendorId ? (names.vendorNames.get(row.vendorId) ?? null) : null,
    categoryName: row.categoryId ? (names.categoryNames.get(row.categoryId) ?? null) : null,
    postingModeLabel: postingModeLabel(row.postingMode),
  };
}

/** Location-scope conditions for reads: business-wide rows always visible, branch rows per grants. */
async function scopeConditions(
   
  ctx: { user?: any },
  businessId: number,
  opts: { locationId?: number; scope?: "all" | "main" | "branch" } = {},
): Promise<SQL[]> {
  const conditions: SQL[] = [eq(subscriptions.businessId, businessId), isNull(subscriptions.deletedAt)];
  if (opts.scope === "main") {
    conditions.push(isNull(subscriptions.locationId));
  } else if (opts.locationId) {
    await requireAuthorizedLocation(ctx, opts.locationId);
    conditions.push(eq(subscriptions.locationId, opts.locationId));
  } else {
    const locIds = await getCurrentBusinessLocationIds(ctx);
    if (locIds.length === 0) {
      conditions.push(isNull(subscriptions.locationId));
    } else {
      conditions.push(or(isNull(subscriptions.locationId), inArray(subscriptions.locationId, locIds)) as SQL);
    }
  }
  return conditions;
}

/** Fetch a subscription and assert the caller may see/mutate it. */
async function getSubscriptionChecked(
   
  ctx: { user?: any },
  id: number,
): Promise<Subscription> {
  const db = getDb();
  const businessId = getBusinessId(ctx);
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.businessId, businessId), isNull(subscriptions.deletedAt)))
    .limit(1);
  if (!row) throw new Error("Subscription not found");
  if (row.locationId) {
    await requireAuthorizedLocation(ctx, row.locationId);
  }
  return row;
}

function validatePostingRule(input: {
  locationId?: number | null;
  postingLocationId?: number | null;
  postingMode: Subscription["postingMode"];
}): void {
  if (input.postingMode === "none") return;
  if (input.locationId) return;
  if (!input.postingLocationId) {
    throw new Error("Business-wide subscriptions that post to accounting need a 'Post to branch' (postingLocationId)");
  }
}

async function assertOwned(
  table: "category" | "vendor" | "account",
  id: number,
  businessId: number,
): Promise<void> {
  const db = getDb();
  const rows =
    table === "category"
      ? await db.select({ id: expenseCategories.id, businessId: expenseCategories.businessId }).from(expenseCategories).where(eq(expenseCategories.id, id))
      : table === "vendor"
        ? await db.select({ id: suppliers.id, businessId: suppliers.businessId }).from(suppliers).where(eq(suppliers.id, id))
        : await db.select({ id: accounts.id, businessId: accounts.businessId }).from(accounts).where(eq(accounts.id, id));
  const row: { id: number; businessId: number | null } | undefined = rows[0];
  if (!row) throw new Error(`${table} not found`);
  if (row.businessId != null && row.businessId !== businessId) {
    throw new Error(`${table} does not belong to the active business`);
  }
}

/** DB payment methods may include legacy 'mpesa'; map to the payment set the posting layer accepts. */
function normalizePaymentMethod(method: string | null): SubscriptionPaymentMethod {
  if (method === "cash" || method === "wallet" || method === "bank_transfer" || method === "card") return method;
  return "wallet";
}

/** First due date on/after `today` walking from startDate by the cycle. */
function firstFutureDue(startDate: string, unit: CycleUnit, count: number, today: string): string {
  let due = startDate;
  let guard = 0;
  while (due < today && guard < 1000) {
    due = advanceDueDate(due, unit, count);
    guard++;
  }
  return due;
}

// ── Router ──────────────────────────────────────────────────────────────────

export const subscriptionsRouter = createRouter({
  list: subscriptionsView.input(listInput).query(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const today = todayStr();
    const conditions = await scopeConditions(ctx, businessId, input);

    if (input.status) conditions.push(eq(subscriptions.status, input.status));
    if (input.categoryId) conditions.push(eq(subscriptions.categoryId, input.categoryId));
    if (input.cycleUnit) conditions.push(eq(subscriptions.cycleUnit, input.cycleUnit));
    if (input.vendorId) conditions.push(eq(subscriptions.vendorId, input.vendorId));
    if (input.search) conditions.push(like(subscriptions.name, `%${input.search}%`));

    const orderBy =
      input.sort === "amount"
        ? desc(subscriptions.amount)
        : input.sort === "name"
          ? asc(subscriptions.name)
          : input.sort === "category"
            ? asc(subscriptions.categoryId)
            : asc(subscriptions.nextDueDate);

    const [totalRow] = await db.select({ value: count() }).from(subscriptions).where(and(...conditions));
    const total = totalRow?.value ?? 0;

    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    const [names, base, defaultNotifyDaysRaw] = await Promise.all([
      loadNameMaps(db, businessId),
      getBaseCurrency(db, businessId),
      getSubscriptionSetting(db, businessId, "subscriptions_default_notify_days", "7"),
    ]);
    const defaultNotifyDays = Number(defaultNotifyDaysRaw) || 7;
    const rates = await buildRateMap(rows.map((r) => r.currency), base);

    const decorated = rows.map((r) => decorateRow(r, names, rates, defaultNotifyDays, today));
    const totals = decorated.reduce(
      (acc, r) => {
        if (r.convertedMonthly) acc.monthly = acc.monthly.plus(d(r.convertedMonthly));
        else if (r.monthlyNormalized !== "0.00") acc.conversionUnavailable += 1;
        return acc;
      },
      { monthly: d(0), conversionUnavailable: 0 },
    );

    return {
      rows: decorated,
      totals: {
        monthly: totals.monthly.toFixed(2),
        yearly: totals.monthly.times(12).toFixed(2),
        currency: base,
        conversionUnavailable: totals.conversionUnavailable,
      },
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }),

  get: subscriptionsView.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const today = todayStr();
    const row = await getSubscriptionChecked(ctx, input.id);

    const [names, base, defaultNotifyDaysRaw, payments, successor, predecessor] = await Promise.all([
      loadNameMaps(db, businessId),
      getBaseCurrency(db, businessId),
      getSubscriptionSetting(db, businessId, "subscriptions_default_notify_days", "7"),
      db
        .select()
        .from(subscriptionPayments)
        .where(and(eq(subscriptionPayments.subscriptionId, row.id), isNull(subscriptionPayments.deletedAt)))
        .orderBy(desc(subscriptionPayments.cycleDueDate))
        .limit(12),
      row.replacedBySubscriptionId
        ? db.select({ name: subscriptions.name }).from(subscriptions).where(eq(subscriptions.id, row.replacedBySubscriptionId)).limit(1)
        : Promise.resolve([] as { name: string }[]),
      db.select({ name: subscriptions.name }).from(subscriptions).where(eq(subscriptions.replacedBySubscriptionId, row.id)).limit(1),
    ]);

    const rates = await buildRateMap([row.currency], base);
    return {
      ...decorateRow(row, names, rates, Number(defaultNotifyDaysRaw) || 7, today),
      payments,
      paymentCount: payments.length,
      successorName: successor[0]?.name ?? null,
      predecessorName: predecessor[0]?.name ?? null,
    };
  }),

  create: subscriptionsManage.input(createInput).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    parseAmount(input.amount);
    if (input.locationId) await requireAuthorizedLocation(ctx, input.locationId);
    if (input.postingLocationId) await requireAuthorizedLocation(ctx, input.postingLocationId);
    validatePostingRule(input);
    if (input.categoryId) await assertOwned("category", input.categoryId, businessId);
    if (input.vendorId) await assertOwned("vendor", input.vendorId, businessId);
    if (input.defaultAccountId) await assertOwned("account", input.defaultAccountId, businessId);

    const [row] = await db
      .insert(subscriptions)
      .values({
        ...input,
        businessId,
        amount: parseAmount(input.amount).toFixed(2),
        createdBy: userId,
        updatedBy: userId,
      } as typeof subscriptions.$inferInsert)
      .returning();

    await logAudit({
      userId,
      businessId,
      action: "CREATE",
      resource: "subscriptions",
      resourceId: row.id,
      details: { name: input.name, amount: input.amount, currency: input.currency, locationId: input.locationId ?? null, postingMode: input.postingMode },
    });
    return { id: row.id, success: true };
  }),

  update: subscriptionsManage.input(updateInput).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    const existing = await getSubscriptionChecked(ctx, input.id);

    const { id, recalculateNextDue, ...changes } = input;
    if (changes.amount !== undefined) parseAmount(changes.amount);
    if (changes.locationId !== undefined && changes.locationId !== null) {
      await requireAuthorizedLocation(ctx, changes.locationId);
    }
    if (changes.postingLocationId) await requireAuthorizedLocation(ctx, changes.postingLocationId);
    if (changes.categoryId) await assertOwned("category", changes.categoryId, businessId);
    if (changes.vendorId) await assertOwned("vendor", changes.vendorId, businessId);
    if (changes.defaultAccountId) await assertOwned("account", changes.defaultAccountId, businessId);

    const merged = { ...existing, ...changes };
    validatePostingRule(merged);

    // nextDueDate recomputes when the schedule changes without an explicit date, or on request.
    const scheduleChanged =
      (changes.cycleUnit !== undefined && changes.cycleUnit !== existing.cycleUnit) ||
      (changes.cycleCount !== undefined && changes.cycleCount !== existing.cycleCount);
    if (changes.nextDueDate === undefined && (recalculateNextDue === true || scheduleChanged)) {
      changes.nextDueDate = firstFutureDue(
        merged.startDate,
        merged.cycleUnit as CycleUnit,
        merged.cycleCount,
        todayStr(),
      );
    }

    await db
      .update(subscriptions)
      .set({ ...changes, ...(changes.amount !== undefined ? { amount: parseAmount(changes.amount).toFixed(2) } : {}), updatedBy: userId })
      .where(eq(subscriptions.id, id));

    await logAudit({
      userId,
      businessId,
      action: "UPDATE",
      resource: "subscriptions",
      resourceId: id,
      details: { changed: Object.keys(changes), before: pickAuditValues(existing, changes), after: pickAuditValues(merged, changes) },
    });
    return { id, success: true };
  }),

  delete: subscriptionsManage.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    await getSubscriptionChecked(ctx, input.id);
    await db.update(subscriptions).set({ deletedAt: new Date(), updatedBy: userId }).where(eq(subscriptions.id, input.id));
    await logAudit({ userId, businessId, action: "DELETE", resource: "subscriptions", resourceId: input.id });
    return { success: true };
  }),

  clone: subscriptionsManage.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    const source = await getSubscriptionChecked(ctx, input.id);
    const today = todayStr();

    const [row] = await db
      .insert(subscriptions)
      .values({
        businessId,
        locationId: source.locationId,
        postingLocationId: source.postingLocationId,
        name: `${source.name} (copy)`.slice(0, 255),
        description: source.description,
        vendorId: source.vendorId,
        categoryId: source.categoryId,
        amount: source.amount,
        currency: source.currency,
        cycleUnit: source.cycleUnit,
        cycleCount: source.cycleCount,
        isOneTime: source.isOneTime,
        startDate: today,
        nextDueDate: source.isOneTime ? today : advanceDueDate(today, source.cycleUnit as CycleUnit, source.cycleCount),
        autoRenew: source.autoRenew,
        status: "active",
        defaultAccountId: source.defaultAccountId,
        postingMode: source.postingMode,
        url: source.url,
        logoUrl: source.logoUrl,
        notifyEnabled: source.notifyEnabled,
        notifyDaysBefore: source.notifyDaysBefore,
        notes: source.notes,
        createdBy: userId,
        updatedBy: userId,
      } as typeof subscriptions.$inferInsert)
      .returning();

    await logAudit({ userId, businessId, action: "CREATE", resource: "subscriptions", resourceId: row.id, details: { clonedFrom: source.id } });
    return { id: row.id, success: true };
  }),

  pause: subscriptionsManage.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    const row = await getSubscriptionChecked(ctx, input.id);
    if (row.status !== "active") throw new Error("Only active subscriptions can be paused");
    await db.update(subscriptions).set({ status: "paused", updatedBy: userId }).where(eq(subscriptions.id, input.id));
    await logAudit({ userId, businessId, action: "UPDATE", resource: "subscriptions", resourceId: input.id, details: { status: "paused" } });
    return { success: true };
  }),

  resume: subscriptionsManage.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    const row = await getSubscriptionChecked(ctx, input.id);
    if (row.status !== "paused") throw new Error("Only paused subscriptions can be resumed");
    const today = todayStr();
    const nextDueDate = row.isOneTime
      ? row.nextDueDate
      : firstFutureDue(row.nextDueDate < today ? today : row.nextDueDate, row.cycleUnit as CycleUnit, row.cycleCount, today);
    await db.update(subscriptions).set({ status: "active", nextDueDate, updatedBy: userId }).where(eq(subscriptions.id, input.id));
    await logAudit({ userId, businessId, action: "UPDATE", resource: "subscriptions", resourceId: input.id, details: { status: "active", nextDueDate } });
    return { success: true };
  }),

  cancel: subscriptionsManage
    .input(
      z.object({
        id: z.number(),
        cancellationDate: dateStr.optional(),
        cancelReason: z.string().max(255).optional(),
        replacedBySubscriptionId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const userId = ctx.user?.id ?? 0;
      const row = await getSubscriptionChecked(ctx, input.id);
      if (row.status === "cancelled") throw new Error("Subscription is already cancelled");
      if (input.replacedBySubscriptionId) {
        if (input.replacedBySubscriptionId === input.id) throw new Error("A subscription cannot replace itself");
        await getSubscriptionChecked(ctx, input.replacedBySubscriptionId);
      }
      const cancellationDate = input.cancellationDate ?? todayStr();
      await db
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancellationDate,
          cancelledAt: new Date(),
          cancelReason: input.cancelReason ?? null,
          replacedBySubscriptionId: input.replacedBySubscriptionId ?? null,
          updatedBy: userId,
        })
        .where(eq(subscriptions.id, input.id));
      await logAudit({
        userId,
        businessId,
        action: "UPDATE",
        resource: "subscriptions",
        resourceId: input.id,
        details: { status: "cancelled", cancellationDate, cancelReason: input.cancelReason ?? null, replacedBy: input.replacedBySubscriptionId ?? null },
      });
      return { success: true };
    }),

  renew: subscriptionsPay
    .input(
      z.object({
        id: z.number(),
        record: z.boolean().default(false),
        paidDate: dateStr.optional(),
        accountId: z.number().optional(),
        paymentMethod: paymentMethod.optional(),
        reference: z.string().max(100).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const userId = ctx.user?.id ?? 0;
      const row = await getSubscriptionChecked(ctx, input.id);
      if (row.isOneTime) throw new Error("One-time purchases cannot be renewed");
      if (row.status === "cancelled") throw new Error("Cancelled subscriptions cannot be renewed");

      const paidDate = input.paidDate ?? todayStr();
      const result = await db.transaction(async (tx) => {
        const nextDueDate = advanceDueDate(row.nextDueDate, row.cycleUnit as CycleUnit, row.cycleCount);
        await tx.update(subscriptions).set({ nextDueDate, updatedBy: userId }).where(eq(subscriptions.id, row.id));
        if (!input.record) return { paymentId: null as number | null, expenseId: null, billId: null, nextDueDate };
        return recordPaymentInTx(tx, {
          subscription: row,
          cycleDueDate: row.nextDueDate,
          amount: row.amount,
          paidDate,
          accountId: input.accountId ?? row.defaultAccountId ?? null,
          paymentMethod: input.paymentMethod ?? "bank_transfer",
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          userId,
          businessId,
          advance: false,
        }).then((r) => ({ ...r, nextDueDate }));
      });

      await logAudit({
        userId,
        businessId,
        action: "UPDATE",
        resource: "subscriptions",
        resourceId: row.id,
        details: { renewed: true, recorded: input.record, nextDueDate: result.nextDueDate, paymentId: result.paymentId },
      });
      return { id: row.id, ...result, success: true };
    }),

  recordPayment: subscriptionsPay
    .input(
      z.object({
        subscriptionId: z.number(),
        cycleDueDate: dateStr.optional(),
        amount: amountStr.optional(),
        paidDate: dateStr.optional(),
        accountId: z.number().optional(),
        paymentMethod,
        reference: z.string().max(100).optional(),
        notes: z.string().optional(),
        advance: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const userId = ctx.user?.id ?? 0;
      const row = await getSubscriptionChecked(ctx, input.subscriptionId);
      const cycleDueDate = input.cycleDueDate ?? row.nextDueDate;

      const result = await db.transaction((tx) =>
        recordPaymentInTx(tx, {
          subscription: row,
          cycleDueDate,
          amount: input.amount ?? row.amount,
          paidDate: input.paidDate ?? todayStr(),
          accountId: input.accountId ?? row.defaultAccountId ?? null,
          paymentMethod: input.paymentMethod,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          userId,
          businessId,
          advance: input.advance && cycleDueDate === row.nextDueDate,
        }),
      );

      await logAudit({
        userId,
        businessId,
        action: "CREATE",
        resource: "subscription_payments",
        resourceId: result.paymentId,
        details: { subscriptionId: row.id, cycleDueDate, amount: input.amount ?? row.amount, expenseId: result.expenseId, billId: result.billId },
      });
      return { ...result, success: true };
    }),

  confirmPayment: subscriptionsPay.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const businessId = getBusinessId(ctx);
    const userId = ctx.user?.id ?? 0;
    const [payment] = await db
      .select()
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.id, input.id), eq(subscriptionPayments.businessId, businessId), isNull(subscriptionPayments.deletedAt)))
      .limit(1);
    if (!payment) throw new Error("Payment not found");
    const row = await getSubscriptionChecked(ctx, payment.subscriptionId);
    if (payment.confirmed) throw new Error("Payment is already confirmed");

    const result = await db.transaction(async (tx) => {
      const paidDate = payment.paidDate ?? todayStr();
      const posted = await postSubscriptionPayment(tx, {
        subscription: row,
        amount: payment.amount,
        cycleDueDate: payment.cycleDueDate,
        paidDate,
        accountId: payment.accountId,
        paymentMethod: normalizePaymentMethod(payment.paymentMethod),
        reference: payment.reference,
        notes: payment.notes,
        userId,
      });
      await tx
        .update(subscriptionPayments)
        .set({ confirmed: true, paidDate, expenseId: posted.expenseId, billId: posted.billId })
        .where(eq(subscriptionPayments.id, payment.id));
      return posted;
    });

    await clearNotificationsForSubscription(db, { subscriptionId: row.id });
    await logAudit({
      userId,
      businessId,
      action: "UPDATE",
      resource: "subscription_payments",
      resourceId: payment.id,
      details: { confirmed: true, subscriptionId: row.id, expenseId: result.expenseId, billId: result.billId },
    });
    return { id: payment.id, ...result, success: true };
  }),

  payments: createRouter({
    list: subscriptionsView
      .input(
        z.object({
          subscriptionId: z.number().optional(),
          locationId: z.number().optional(),
          confirmed: z.boolean().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(200).default(50),
        }),
      )
      .query(async ({ input, ctx }) => {
        const db = getDb();
        const businessId = getBusinessId(ctx);
        const conditions: SQL[] = [eq(subscriptionPayments.businessId, businessId), isNull(subscriptionPayments.deletedAt)];
        if (input.subscriptionId) {
          await getSubscriptionChecked(ctx, input.subscriptionId);
          conditions.push(eq(subscriptionPayments.subscriptionId, input.subscriptionId));
        } else {
          const locIds = await getCurrentBusinessLocationIds(ctx);
          if (locIds.length === 0) {
            conditions.push(isNull(subscriptionPayments.locationId));
          } else {
            conditions.push(
              or(isNull(subscriptionPayments.locationId), inArray(subscriptionPayments.locationId, locIds)) as SQL,
            );
          }
        }
        if (input.locationId) {
          await requireAuthorizedLocation(ctx, input.locationId);
          conditions.push(eq(subscriptionPayments.locationId, input.locationId));
        }
        if (input.confirmed !== undefined) conditions.push(eq(subscriptionPayments.confirmed, input.confirmed));

        const [totalRow] = await db.select({ value: count() }).from(subscriptionPayments).where(and(...conditions));
        const rows = await db
          .select()
          .from(subscriptionPayments)
          .where(and(...conditions))
          .orderBy(desc(subscriptionPayments.cycleDueDate))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize);
        const total = totalRow?.value ?? 0;
        return { rows, total, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) };
      }),
  }),

  calendar: subscriptionsView
    .input(
      z.object({
        dateFrom: dateStr,
        dateTo: dateStr,
        locationId: z.number().optional(),
        scope: scopeEnum.default("all"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const today = todayStr();
      const conditions = await scopeConditions(ctx, businessId, input);
      conditions.push(inArray(subscriptions.status, ["active", "paused"]));
      const rows = await db.select().from(subscriptions).where(and(...conditions));
      const names = await loadNameMaps(db, businessId);

      interface CalendarEvent {
        id: number;
        date: string;
        name: string;
        amount: string;
        currency: string;
        type: "subscription";
        isOverdue: boolean;
        isDueToday: boolean;
        isOneTime: boolean;
        branchName: string | null;
      }
      const events: CalendarEvent[] = [];
      for (const row of rows) {
        for (const date of occurrencesInRange(row, input.dateFrom, input.dateTo)) {
          events.push({
            id: row.id,
            date,
            name: row.name,
            amount: row.amount,
            currency: row.currency,
            type: "subscription" as const,
            isOverdue: row.status === "active" && date < today,
            isDueToday: date === today,
            isOneTime: row.isOneTime,
            branchName: row.locationId ? (names.branchNames.get(row.locationId) ?? null) : null,
          });
        }
      }
      return { events };
    }),

  stats: subscriptionsView
    .input(z.object({ locationId: z.number().optional(), scope: scopeEnum.default("all") }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const today = todayStr();
      const conditions = await scopeConditions(ctx, businessId, input ?? {});
      const rows = await db.select().from(subscriptions).where(and(...conditions));
      return computeStats(rows, businessId, today);
    }),

  /**
   * P4 budget auto-provisioning: add budget lines for subscription categories that a
   * DRAFT budget plan is missing. Conservative by design — draft plans only, existing
   * lines are never modified, and amounts match budgets.create semantics (the same
   * per-period amount on every bucket).
   */
  autoProvisionBudgets: budgetManage
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const businessId = getBusinessId(ctx);
      const userId = ctx.user?.id ?? 0;

      const [plan] = await db
        .select()
        .from(budgetPlans)
        .where(and(eq(budgetPlans.id, input.planId), isNull(budgetPlans.deletedAt)))
        .limit(1);
      if (!plan) throw new Error("Budget plan not found");
      if (plan.status !== "draft") throw new Error("Only draft budget plans can be auto-provisioned");
      if (plan.locationId != null) await requireAuthorizedLocation(ctx, plan.locationId);

      const conditions = await scopeConditions(ctx, businessId, plan.locationId != null ? { locationId: plan.locationId } : {});
      const rows = await db.select().from(subscriptions).where(and(...conditions));
      const [base, names] = await Promise.all([getBaseCurrency(db, businessId), loadNameMaps(db, businessId)]);
      const rates = await buildRateMap(rows.map((r) => r.currency), base);

      const perCategory = new Map<number, Decimal>();
      for (const r of rows) {
        if (r.status !== "active" || r.isOneTime || !r.categoryId) continue;
        const monthly = toBase(monthlyNormalized(r.amount, r.cycleUnit as CycleUnit, r.cycleCount), r.currency, rates);
        if (!monthly) continue;
        perCategory.set(r.categoryId, (perCategory.get(r.categoryId) ?? d(0)).plus(monthly));
      }
      if (perCategory.size === 0) throw new Error("No active subscriptions with categories to provision");

      const buckets = await db.select().from(budgetPlanBuckets).where(eq(budgetPlanBuckets.planId, plan.id));
      if (buckets.length === 0) throw new Error("Budget plan has no buckets");

      let created = 0;
      await db.transaction(async (tx) => {
        for (const bucket of buckets) {
          const existing = await tx
            .select({ categoryId: budgetBucketLines.categoryId })
            .from(budgetBucketLines)
            .where(eq(budgetBucketLines.bucketId, bucket.id));
          const have = new Set(existing.map((l) => l.categoryId));
          for (const [categoryId, monthly] of perCategory) {
            if (have.has(categoryId)) continue;
            await tx.insert(budgetBucketLines).values({ bucketId: bucket.id, categoryId, amount: monthly.toFixed(2) });
            created += 1;
          }
        }
      });

      await logAudit({
        userId,
        businessId,
        action: "CREATE",
        resource: "budget_bucket_lines",
        resourceId: plan.id,
        details: { created, categories: [...perCategory.keys()] },
      });
      return {
        planId: plan.id,
        created,
        categories: [...perCategory.entries()].map(([categoryId, monthly]) => ({
          categoryId,
          categoryName: names.categoryNames.get(categoryId) ?? null,
          amount: monthly.toFixed(2),
        })),
      };
    }),
});

// ── Payment + stats internals ───────────────────────────────────────────────

function occurrencesInRange(row: Subscription, dateFrom: string, dateTo: string): string[] {
  const out: string[] = [];
  if (row.isOneTime) {
    if (row.nextDueDate >= dateFrom && row.nextDueDate <= dateTo) out.push(row.nextDueDate);
    return out;
  }
  if (row.status === "paused") return out;
  let due = row.nextDueDate;
  let guard = 0;
  while (due <= dateTo && guard < 500) {
    if (due >= dateFrom) out.push(due);
    due = advanceDueDate(due, row.cycleUnit as CycleUnit, row.cycleCount);
    guard++;
  }
  return out;
}

function pickAuditValues(row: Subscription, changes: Partial<Subscription>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) {
    out[key] = (row as unknown as Record<string, unknown>)[key] ?? null;
  }
  return out;
}

async function computeStats(rows: Subscription[], businessId: number, today: string) {
  const db = getDb();
  const [names, base, defaultNotifyDaysRaw] = await Promise.all([
    loadNameMaps(db, businessId),
    getBaseCurrency(db, businessId),
    getSubscriptionSetting(db, businessId, "subscriptions_default_notify_days", "7"),
  ]);
  const defaultNotifyDays = Number(defaultNotifyDaysRaw) || 7;
  const rates = await buildRateMap(rows.map((r) => r.currency), base);

  const decorated = rows.map((r) => decorateRow(r, names, rates, defaultNotifyDays, today));
  const active = decorated.filter((r) => r.status === "active" && !r.isOneTime);
  const inactive = decorated.filter((r) => (r.status === "paused" || r.status === "cancelled") && !r.isOneTime);

  const sum = (list: typeof decorated, pick: (r: (typeof decorated)[number]) => string | null): Decimal =>
    list.reduce((acc, r) => {
      const v = pick(r);
      return v ? acc.plus(d(v)) : acc;
    }, d(0));

  const monthlyTotal = sum(active, (r) => r.convertedMonthly);
  const yearlyTotal = sum(active, (r) => r.convertedYearly);
  const activeCount = active.length;

  const byMonthly = [...active].filter((r) => r.convertedMonthly !== null).sort((a, b) => d(b.convertedMonthly!).cmp(d(a.convertedMonthly!)));

  const monthPrefix = today.slice(0, 7);
  const dueThisMonth = active
    .filter((r) => r.nextDueDate.startsWith(monthPrefix))
    .reduce((acc, r) => {
      const converted = toBase(d(r.amount), r.currency, rates);
      return converted ? acc.plus(converted) : acc;
    }, d(0));

  const categorySplitMap = new Map<number | null, Decimal>();
  const branchSplitMap = new Map<number | null, Decimal>();
  for (const r of active) {
    const monthly = d(r.convertedMonthly ?? "0");
    categorySplitMap.set(r.categoryId ?? null, (categorySplitMap.get(r.categoryId ?? null) ?? d(0)).plus(monthly));
    branchSplitMap.set(r.locationId ?? null, (branchSplitMap.get(r.locationId ?? null) ?? d(0)).plus(monthly));
  }

  const schedule: SubscriptionSchedule[] = [];
  for (const r of active) {
    const convertedAmount = toBase(d(r.amount), r.currency, rates);
    if (!convertedAmount) continue;
    schedule.push({
      id: r.id,
      amount: convertedAmount.toFixed(2),
      currency: base,
      cycleUnit: r.cycleUnit as CycleUnit,
      cycleCount: r.cycleCount,
      isOneTime: r.isOneTime,
      nextDueDate: r.nextDueDate,
      status: r.status,
      cancellationDate: r.cancellationDate,
    });
  }
  const projection = projectMonths(schedule, 12, today);

  const budgetByMonth = await getSubscriptionBudgetByMonth(businessId, rows, projection.map((p) => p.month));
  const monthsOverBudget = projection.filter((p) => {
    const budget = budgetByMonth.get(p.month);
    return budget && budget.gt(0) && p.total.gt(budget);
  }).length;
  const heaviest = projection.reduce<{ month: string; total: Decimal } | null>(
    (best, p) => (!best || p.total.gt(best.total) ? { month: p.month, total: p.total } : best),
    null,
  );

  const upcoming = active
    .filter((r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 30)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .map((r) => ({ id: r.id, name: r.name, amount: r.amount, currency: r.currency, nextDueDate: r.nextDueDate, daysUntilDue: r.daysUntilDue }));
  const upcomingCancellations = decorated
    .filter((r) => r.cancellationDate && r.status === "active" && daysBetween(r.cancellationDate, today) >= 0 && daysBetween(r.cancellationDate, today) <= 30)
    .map((r) => ({ id: r.id, name: r.name, cancellationDate: r.cancellationDate as string }));

  return {
    baseCurrency: base,
    kpis: {
      activeCount,
      pausedCancelledCount: inactive.length,
      monthlyTotal: monthlyTotal.toFixed(2),
      yearlyTotal: yearlyTotal.toFixed(2),
      costPerDay: monthlyTotal.div(30).toFixed(2),
      averageMonthly: activeCount ? monthlyTotal.div(activeCount).toFixed(2) : "0.00",
      dueThisMonth: dueThisMonth.toFixed(2),
      mostExpensive: byMonthly[0]
        ? { id: byMonthly[0].id, name: byMonthly[0].name, amount: byMonthly[0].amount, currency: byMonthly[0].currency, monthly: byMonthly[0].convertedMonthly, logoUrl: byMonthly[0].logoUrl }
        : null,
      cheapest: byMonthly.length
        ? { id: byMonthly[byMonthly.length - 1].id, name: byMonthly[byMonthly.length - 1].name, amount: byMonthly[byMonthly.length - 1].amount, currency: byMonthly[byMonthly.length - 1].currency, monthly: byMonthly[byMonthly.length - 1].convertedMonthly, logoUrl: byMonthly[byMonthly.length - 1].logoUrl }
        : null,
      savingsMonthly: sum(inactive, (r) => r.convertedMonthly).toFixed(2),
      savingsYearly: sum(inactive, (r) => r.convertedYearly).toFixed(2),
    },
    categorySplit: [...categorySplitMap.entries()].map(([categoryId, monthly]) => ({
      categoryId,
      categoryName: categoryId ? (names.categoryNames.get(categoryId) ?? null) : null,
      monthly: monthly.toFixed(2),
    })),
    branchSplit: [...branchSplitMap.entries()].map(([locationId, monthly]) => ({
      locationId,
      branchName: locationId ? (names.branchNames.get(locationId) ?? null) : null,
      monthly: monthly.toFixed(2),
    })),
    projection: projection.map((p) => ({
      month: p.month,
      total: p.total.toFixed(2),
      budget: budgetByMonth.get(p.month)?.toFixed(2) ?? null,
    })),
    heaviestMonth: heaviest ? { month: heaviest.month, total: heaviest.total.toFixed(2) } : null,
    monthsOverBudget,
    upcoming,
    upcomingCancellations,
    conversionUnavailable: decorated.filter((r) => !r.isOneTime && r.convertedMonthly === null).length,
  };
}

/**
 * Budget per calendar month for subscription categories (budgetPlans model).
 * Buckets cover calendar months startMonth..endMonth within their plan's fiscalYearStart year
 * (wrapping when startMonth > endMonth crosses the year boundary).
 */
async function getSubscriptionBudgetByMonth(
  businessId: number,
  rows: Subscription[],
  months: string[],
): Promise<Map<string, Decimal>> {
  const db = getDb();
  const out = new Map<string, Decimal>();
  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((v): v is number => v != null))];
  if (categoryIds.length === 0 || months.length === 0) return out;

  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))];
  const plans = await db
    .select()
    .from(budgetPlans)
    .where(
      and(
        inArray(budgetPlans.fiscalYearStart, years),
        inArray(budgetPlans.status, ["active", "locked"]),
        isNull(budgetPlans.deletedAt),
      ),
    );
  if (plans.length === 0) return out;

  const planIds = plans.map((p) => p.id);
  const buckets = await db.select().from(budgetPlanBuckets).where(inArray(budgetPlanBuckets.planId, planIds));
  const bucketIds = buckets.map((b) => b.id);
  const lines =
    bucketIds.length > 0
      ? await db
          .select({ bucketId: budgetBucketLines.bucketId, categoryId: budgetBucketLines.categoryId, amount: budgetBucketLines.amount })
          .from(budgetBucketLines)
          .where(and(inArray(budgetBucketLines.bucketId, bucketIds), inArray(budgetBucketLines.categoryId, categoryIds)))
      : [];
  const linesByBucket = new Map<number, Decimal>();
  for (const line of lines) {
    linesByBucket.set(line.bucketId, (linesByBucket.get(line.bucketId) ?? d(0)).plus(d(line.amount)));
  }

  for (const monthKey of months) {
    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    let total = d(0);
    for (const plan of plans) {
      if (plan.fiscalYearStart !== year) continue;
      for (const bucket of buckets) {
        if (bucket.planId !== plan.id) continue;
        const covers =
          bucket.startMonth <= bucket.endMonth
            ? month >= bucket.startMonth && month <= bucket.endMonth
            : month >= bucket.startMonth || month <= bucket.endMonth;
        if (covers) {
          total = total.plus(linesByBucket.get(bucket.id) ?? d(0));
        }
      }
    }
    out.set(monthKey, total);
  }
  return out;
}
