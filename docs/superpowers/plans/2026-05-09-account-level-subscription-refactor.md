# Account-Level Subscription Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move subscription ownership from `businesses` to a real account entity, enforce plan limits consistently for business and location creation, and make subscription UI stable across business switching.

**Architecture:** Add a real `customer_accounts` table while keeping the human-facing `accountId` slug on that table and preserving legacy business subscription fields for dual-read fallback. Move all subscription reads and writes through shared account-scoped helpers, then rewire signup, business creation, location creation, lifecycle processing, and the settings UI to use the account as the canonical source of truth.

**Tech Stack:** Drizzle ORM, PostgreSQL, tRPC, Hono, React 19, TypeScript, Vitest

---

## File Map

- Create: `d:\DevCenter\abuilds\fina\finaflow\db\migrations\0001_account_level_subscriptions.sql`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\lib\account-subscriptions.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\lib\subscription-enforcement.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\account-subscriptions-router.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-migration.test.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-enforcement.test.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-context.test.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\schema.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\relations.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\local-auth-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\businesses-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\locations-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\payment-methods-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\lib\subscriptions.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\middleware.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\src\pages\Settings.tsx`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\test\setup.ts`

### Task 1: Lock In Migration Behavior With Failing Tests

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-migration.test.ts`
- Modify later: `d:\DevCenter\abuilds\fina\finaflow\db\migrations\0001_account_level_subscriptions.sql`
- Modify later: `d:\DevCenter\abuilds\fina\finaflow\api\test\setup.ts`

- [ ] **Step 1: Write the failing migration validation test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../queries/connection";
import { businesses, users } from "@db/schema";
import { eq } from "drizzle-orm";

async function resetAccount(accountId: string) {
  const db = getDb();
  await db.execute(`DELETE FROM customer_accounts WHERE "accountId" = '${accountId}'`);
  await db.delete(users).where(eq(users.accountId, accountId));
  await db.delete(businesses).where(eq(businesses.accountId, accountId));
}

describe("account-level subscription migration", () => {
  beforeEach(async () => {
    await resetAccount("MIGRATECO");
  });

  it("creates one customer account per logical account and keeps the most recent paid or trial state", async () => {
    const db = getDb();

    await db.execute(`
      INSERT INTO businesses ("accountId", name, slug, plan, "subscriptionStatus", "subscriptionExpiry", "features", "isActive")
      VALUES
      ('MIGRATECO', 'Alpha Business', 'migrate-alpha', 'starter', 'expired', NULL, '{}'::json, true),
      ('MIGRATECO', 'Beta Business', 'migrate-beta', 'growth', 'trial', CURRENT_DATE + INTERVAL '5 day', '{"trialExtendedAt":"2026-05-08T10:00:00.000Z"}'::json, true)
    `);

    await db.execute(`
      INSERT INTO users ("username", "name", email, role, "accountId", "isActive")
      VALUES ('migrate-owner', 'Migration Owner', 'migrate@example.com', 'owner', 'MIGRATECO', true)
    `);

    await db.execute(`SELECT run_account_subscription_backfill()`);

    const rows = await db.execute(`
      SELECT "accountId", plan, "subscriptionStatus"
      FROM customer_accounts
      WHERE "accountId" = 'MIGRATECO'
    `);

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].plan).toBe("growth");
    expect(rows.rows[0].subscriptionStatus).toBe("trial");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- api/__tests__/account-subscription-migration.test.ts`
Expected: FAIL because `customer_accounts` and `run_account_subscription_backfill()` do not exist yet.

- [ ] **Step 3: Add test-database bootstrap hook for the new migration file**

```ts
const migrationFiles = [
  path.resolve(import.meta.dirname, "../../db/migrations/0000_magical_logan.sql"),
  path.resolve(import.meta.dirname, "../../db/migrations/0001_account_level_subscriptions.sql"),
];

for (const migrationPath of migrationFiles) {
  const sql = fs.readFileSync(migrationPath, "utf8").replaceAll("--> statement-breakpoint", "");
  await testPool.query(sql);
}
```

- [ ] **Step 4: Run the focused test again**

Run: `npm test -- api/__tests__/account-subscription-migration.test.ts`
Expected: FAIL on the missing SQL definitions, not on test setup.

### Task 2: Add the Account Schema and Migration SQL

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\db\migrations\0001_account_level_subscriptions.sql`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\schema.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\relations.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-migration.test.ts`

- [ ] **Step 1: Add the Drizzle table definition**

```ts
export const customerAccounts = pgTable("customer_accounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 20 }).default("free").notNull(),
  maxBusinesses: integer("maxBusinesses").default(1).notNull(),
  maxUsers: integer("maxUsers").default(1).notNull(),
  maxTransactionsPerMonth: integer("maxTransactionsPerMonth").default(100).notNull(),
  features: json("features"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 20 }).default("active").notNull(),
  subscriptionExpiry: date("subscriptionExpiry"),
  isActive: boolean("isActive").default(true).notNull(),
  migratedAt: timestamp("migratedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  accountIdIdx: uniqueIndex("idx_customer_accounts_accountId").on(table.accountId),
}));
```

- [ ] **Step 2: Add the new foreign-key columns to users, businesses, and payment methods**

```ts
accountRefId: bigint("accountRefId", { mode: "number" }),
```

Apply that field to:

- `users`
- `businesses`
- `paymentMethods`

- [ ] **Step 3: Add the SQL migration**

```sql
CREATE TABLE IF NOT EXISTS "customer_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "accountId" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "plan" varchar(20) DEFAULT 'free' NOT NULL,
  "maxBusinesses" integer DEFAULT 1 NOT NULL,
  "maxUsers" integer DEFAULT 1 NOT NULL,
  "maxTransactionsPerMonth" integer DEFAULT 100 NOT NULL,
  "features" json,
  "subscriptionStatus" varchar(20) DEFAULT 'active' NOT NULL,
  "subscriptionExpiry" date,
  "isActive" boolean DEFAULT true NOT NULL,
  "migratedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp,
  CONSTRAINT "customer_accounts_accountId_unique" UNIQUE("accountId")
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "accountRefId" bigint;

ALTER TABLE "users" ADD CONSTRAINT "users_accountRefId_customer_accounts_id_fk"
  FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_accountRefId_customer_accounts_id_fk"
  FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_accountRefId_customer_accounts_id_fk"
  FOREIGN KEY ("accountRefId") REFERENCES "customer_accounts"("id");
```

- [ ] **Step 4: Add the backfill function that picks the most recent paid or trial state**

```sql
CREATE OR REPLACE FUNCTION run_account_subscription_backfill()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  account_row record;
BEGIN
  FOR account_row IN
    SELECT
      b."accountId",
      COALESCE(MAX(b.name), b."accountId") AS name
    FROM businesses b
    WHERE b."deletedAt" IS NULL
    GROUP BY b."accountId"
  LOOP
    INSERT INTO "customer_accounts" (
      "accountId", name, plan, "subscriptionStatus", "subscriptionExpiry",
      "maxBusinesses", "maxUsers", "maxTransactionsPerMonth", features, "migratedAt"
    )
    SELECT
      account_row."accountId",
      account_row.name,
      winner.plan,
      winner."subscriptionStatus",
      winner."subscriptionExpiry",
      CASE winner.plan WHEN 'free' THEN 1 WHEN 'starter' THEN 1 WHEN 'growth' THEN 3 WHEN 'pro' THEN 10 ELSE 99 END,
      COALESCE(winner."maxUsers", CASE winner.plan WHEN 'free' THEN 1 WHEN 'starter' THEN 3 WHEN 'growth' THEN 5 WHEN 'pro' THEN 99 ELSE 99 END),
      COALESCE(winner."maxTransactionsPerMonth", CASE winner.plan WHEN 'free' THEN 100 WHEN 'starter' THEN 5000 WHEN 'growth' THEN 20000 ELSE 999999 END),
      winner.features,
      now()
    FROM (
      SELECT b.*
      FROM businesses b
      WHERE b."accountId" = account_row."accountId" AND b."deletedAt" IS NULL
      ORDER BY
        CASE WHEN b."subscriptionStatus" IN ('active', 'trial') THEN 0 ELSE 1 END,
        COALESCE(b."updatedAt", b."createdAt") DESC,
        b.id DESC
      LIMIT 1
    ) winner
    ON CONFLICT ("accountId") DO UPDATE SET
      plan = EXCLUDED.plan,
      "subscriptionStatus" = EXCLUDED."subscriptionStatus",
      "subscriptionExpiry" = EXCLUDED."subscriptionExpiry",
      "maxBusinesses" = EXCLUDED."maxBusinesses",
      "maxUsers" = EXCLUDED."maxUsers",
      "maxTransactionsPerMonth" = EXCLUDED."maxTransactionsPerMonth",
      features = EXCLUDED.features,
      "migratedAt" = EXCLUDED."migratedAt";

    UPDATE users u
    SET "accountRefId" = ca.id
    FROM "customer_accounts" ca
    WHERE u."accountId" = ca."accountId" AND ca."accountId" = account_row."accountId";

    UPDATE businesses b
    SET "accountRefId" = ca.id
    FROM "customer_accounts" ca
    WHERE b."accountId" = ca."accountId" AND ca."accountId" = account_row."accountId";

    UPDATE payment_methods pm
    SET "accountRefId" = ca.id
    FROM businesses b
    JOIN "customer_accounts" ca ON ca."id" = b."accountRefId"
    WHERE pm."businessId" = b.id AND b."accountId" = account_row."accountId";
  END LOOP;
END;
$$;
```

- [ ] **Step 5: Run the migration test**

Run: `npm test -- api/__tests__/account-subscription-migration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the schema checkpoint**

```bash
git add db/schema.ts db/relations.ts db/migrations/0001_account_level_subscriptions.sql api/test/setup.ts api/__tests__/account-subscription-migration.test.ts
git commit -m "feat: add account-level subscription schema"
```

### Task 3: Build Dual-Read Account Subscription Helpers

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\lib\account-subscriptions.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\lib\subscriptions.ts`
- Test later: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-context.test.ts`

- [ ] **Step 1: Write the failing dual-read and business-switch consistency test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";

describe("account subscription context", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.execute(`DELETE FROM customer_accounts WHERE "accountId" = 'MULTICO'`);
    await db.execute(`DELETE FROM businesses WHERE "accountId" = 'MULTICO'`);
    await db.execute(`DELETE FROM users WHERE "accountId" = 'MULTICO'`);
  });

  it("returns the same account subscription while switching businesses in the same account", async () => {
    const db = getDb();
    const [{ id: accountRefId }] = await db.execute(`
      INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
      VALUES ('MULTICO', 'Multi Co', 'growth', 'active', 3, 5, 20000)
      RETURNING id
    `).then((result) => result.rows as Array<{ id: number }>);

    const businessRows = await db.execute(`
      INSERT INTO businesses ("accountId", "accountRefId", name, slug, plan, "subscriptionStatus", "isActive")
      VALUES
      ('MULTICO', ${accountRefId}, 'North Co', 'multi-north', 'free', 'expired', true),
      ('MULTICO', ${accountRefId}, 'South Co', 'multi-south', 'pro', 'trial', true)
      RETURNING id, name
    `);

    const userRows = await db.execute(`
      INSERT INTO users (username, name, email, role, "accountId", "accountRefId", "currentBusinessId", "isActive")
      VALUES ('multi-owner', 'Multi Owner', 'multi@example.com', 'owner', 'MULTICO', ${accountRefId}, ${(businessRows.rows[0] as any).id}, true)
      RETURNING id
    `);

    const callerA = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/accountSubscriptions.mySubscription"),
      resHeaders: new Headers(),
      user: {
        id: (userRows.rows[0] as any).id,
        role: "owner",
        accountId: "MULTICO",
        accountRefId,
        currentBusinessId: (businessRows.rows[0] as any).id,
        currentBusiness: { id: (businessRows.rows[0] as any).id, accountId: "MULTICO" },
        businessIds: businessRows.rows.map((row: any) => row.id),
      },
    } as any);

    const callerB = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/accountSubscriptions.mySubscription"),
      resHeaders: new Headers(),
      user: {
        id: (userRows.rows[0] as any).id,
        role: "owner",
        accountId: "MULTICO",
        accountRefId,
        currentBusinessId: (businessRows.rows[1] as any).id,
        currentBusiness: { id: (businessRows.rows[1] as any).id, accountId: "MULTICO" },
        businessIds: businessRows.rows.map((row: any) => row.id),
      },
    } as any);

    const subscriptionA = await callerA.accountSubscriptions.mySubscription();
    const subscriptionB = await callerB.accountSubscriptions.mySubscription();

    expect(subscriptionA.plan).toBe("growth");
    expect(subscriptionB.plan).toBe("growth");
    expect(subscriptionA.accountId).toBe("MULTICO");
    expect(subscriptionB.accountId).toBe("MULTICO");
  });
});
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- api/__tests__/account-subscription-context.test.ts`
Expected: FAIL because `accountSubscriptions` router and dual-read helpers do not exist.

- [ ] **Step 3: Implement the shared helper module**

```ts
// ABOUTME: Resolves canonical account-level subscription state with migration-era fallback to legacy business rows.
// ABOUTME: Provides one account-scoped API for reads, writes, and limit calculations across signup and settings.
import { and, eq, isNull, sql } from "drizzle-orm";
import { businesses, customerAccounts, paymentMethods, userBusinesses, users } from "@db/schema";
import { getPlanConfig, getSubscriptionState, mergeSubscriptionState, quotaLabel } from "./subscriptions";

export async function getAccountSubscription(db: ReturnType<typeof import("../queries/connection").getDb>, options: {
  accountRefId?: number | null;
  accountId?: string | null;
  fallbackBusinessId?: number | null;
}) {
  if (options.accountRefId) {
    const [account] = await db.select().from(customerAccounts).where(and(eq(customerAccounts.id, options.accountRefId), isNull(customerAccounts.deletedAt))).limit(1);
    if (account) return { source: "account" as const, account };
  }

  if (options.accountId) {
    const [account] = await db.select().from(customerAccounts).where(and(eq(customerAccounts.accountId, options.accountId), isNull(customerAccounts.deletedAt))).limit(1);
    if (account) return { source: "account" as const, account };
  }

  if (options.fallbackBusinessId) {
    const [business] = await db.select().from(businesses).where(and(eq(businesses.id, options.fallbackBusinessId), isNull(businesses.deletedAt))).limit(1);
    if (business) return { source: "business" as const, business };
  }

  throw new Error("Account subscription not found");
}

export async function getAccountUsage(db: ReturnType<typeof import("../queries/connection").getDb>, accountId: string) {
  const [businessCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(businesses)
    .where(and(eq(businesses.accountId, accountId), isNull(businesses.deletedAt)));
  const [userCount] = await db.select({ count: sql<number>`COUNT(DISTINCT ${users.id})` }).from(users)
    .where(and(eq(users.accountId, accountId), isNull(users.deletedAt), eq(users.isActive, true)));

  return {
    businessCount: businessCount?.count ?? 0,
    userCount: userCount?.count ?? 0,
  };
}
```

- [ ] **Step 4: Add the account-scoped router**

```ts
export const accountSubscriptionsRouter = createRouter({
  mySubscription: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const resolved = await getAccountSubscription(db, {
      accountRefId: ctx.user?.accountRefId ?? null,
      accountId: ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? null,
      fallbackBusinessId: ctx.user?.currentBusiness?.id ?? ctx.user?.currentBusinessId ?? null,
    });

    const accountId = resolved.source === "account" ? resolved.account.accountId : resolved.business.accountId;
    const plan = resolved.source === "account" ? resolved.account.plan : resolved.business.plan;
    const planInfo = getPlanConfig(plan);
    const usage = await getAccountUsage(db, accountId);

    return {
      accountId,
      plan,
      planLabel: planInfo.label,
      maxBusinesses: resolved.source === "account" ? resolved.account.maxBusinesses : planInfo.maxBusinesses,
      maxUsers: resolved.source === "account" ? resolved.account.maxUsers : resolved.business.maxUsers ?? planInfo.maxUsers,
      maxBranches: planInfo.maxBranches,
      maxTransactionsPerMonth: resolved.source === "account"
        ? resolved.account.maxTransactionsPerMonth
        : resolved.business.maxTransactionsPerMonth ?? planInfo.transactionQuota,
      transactionQuotaLabel: quotaLabel(
        resolved.source === "account"
          ? resolved.account.maxTransactionsPerMonth
          : resolved.business.maxTransactionsPerMonth ?? planInfo.transactionQuota,
      ),
      currentBusinesses: usage.businessCount,
      currentUsers: usage.userCount,
      subscriptionStatus: resolved.source === "account" ? resolved.account.subscriptionStatus : resolved.business.subscriptionStatus,
      subscriptionExpiry: resolved.source === "account" ? resolved.account.subscriptionExpiry : resolved.business.subscriptionExpiry,
      features: resolved.source === "account" ? resolved.account.features : resolved.business.features,
      source: resolved.source,
    };
  }),
});
```

- [ ] **Step 5: Wire the router into the root router**

```ts
import { accountSubscriptionsRouter } from "./account-subscriptions-router";

export const appRouter = createRouter({
  accountSubscriptions: accountSubscriptionsRouter,
  accounts: accountsRouter,
  auth: authRouter,
  businesses: businessesRouter,
  // keep the rest unchanged
});
```

- [ ] **Step 6: Run the focused test**

Run: `npm test -- api/__tests__/account-subscription-context.test.ts`
Expected: PASS

### Task 4: Refactor Signup and Auth Lookup to Create and Use Accounts

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\local-auth-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\db\schema.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\local-auth-registration.test.ts`

- [ ] **Step 1: Extend the existing registration test to require account-row creation**

```ts
const accountRows = await db.execute(`
  SELECT id, "accountId", plan
  FROM customer_accounts
  WHERE "accountId" = 'ALICEVENTURES'
`);

expect(accountRows.rows).toHaveLength(1);
expect(accountRows.rows[0].plan).toBe("pro");
```

- [ ] **Step 2: Run the focused registration test**

Run: `npm test -- api/__tests__/local-auth-registration.test.ts`
Expected: FAIL because registration still only inserts `businesses` and `users`.

- [ ] **Step 3: Update account availability and lookup to query customer accounts first**

```ts
const [account] = await db.select().from(customerAccounts)
  .where(and(eq(customerAccounts.accountId, input.accountId.toUpperCase()), isNull(customerAccounts.deletedAt)))
  .limit(1);

if (!account) throw new Error("Account not found");

const businessRows = await db.select().from(businesses)
  .where(and(eq(businesses.accountRefId, account.id), isNull(businesses.deletedAt)));
```

- [ ] **Step 4: Create the account first inside the registration transaction**

```ts
const [accountRow] = await tx.insert(customerAccounts).values({
  accountId,
  name: businessName,
  plan,
  maxBusinesses: getPlanConfig(plan).maxBusinesses,
  maxUsers,
  maxTransactionsPerMonth,
  subscriptionStatus,
  subscriptionExpiry,
  features: {},
  isActive: true,
} as any).returning({ id: customerAccounts.id, accountId: customerAccounts.accountId });

const [userRow] = await tx.insert(users).values({
  name: input.name,
  username: input.username,
  email: input.email,
  passwordHash,
  role: "owner",
  isActive: true,
  phone: input.phone || null,
  accountId,
  accountRefId: accountRow.id,
} as any).returning({ id: users.id });

const [businessRow] = await tx.insert(businesses).values({
  accountId,
  accountRefId: accountRow.id,
  name: businessName,
  slug: `biz-${input.username}-${Date.now()}`,
  plan,
  maxBranches,
  maxUsers,
  maxTransactionsPerMonth,
  subscriptionStatus,
  subscriptionExpiry,
  isActive: true,
} as any).returning({ id: businesses.id });
```

- [ ] **Step 5: Update `me`, `login`, and `switchBusiness` to return `accountRefId`**

```ts
return {
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  email: user.email,
  accountId: currentBusiness?.accountId ?? user.accountId ?? null,
  accountRefId: user.accountRefId ?? currentBusiness?.accountRefId ?? null,
  currentBusinessId: effectiveCurrentBusinessId,
  currentBusiness,
  businessIds: bizIds,
};
```

- [ ] **Step 6: Run the focused registration test**

Run: `npm test -- api/__tests__/local-auth-registration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the auth checkpoint**

```bash
git add api/local-auth-router.ts api/__tests__/local-auth-registration.test.ts db/schema.ts
git commit -m "feat: create customer accounts during signup"
```

### Task 5: Centralize Plan Enforcement for Business and Location Creation

**Files:**
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\lib\subscription-enforcement.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\businesses-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\locations-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\middleware.ts`
- Create: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-enforcement.test.ts`

- [ ] **Step 1: Write the failing enforcement test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";

describe("account subscription enforcement", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.execute(`DELETE FROM customer_accounts WHERE "accountId" IN ('LIMITCO', 'GROWTHCO')`);
    await db.execute(`DELETE FROM businesses WHERE "accountId" IN ('LIMITCO', 'GROWTHCO')`);
    await db.execute(`DELETE FROM users WHERE "accountId" IN ('LIMITCO', 'GROWTHCO')`);
    await db.execute(`DELETE FROM locations WHERE slug LIKE 'limit-%' OR slug LIKE 'growth-%'`);
  });

  it("blocks creating a second business when the account has reached its plan limit", async () => {
    const db = getDb();
    const [{ id: accountRefId }] = await db.execute(`
      INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
      VALUES ('LIMITCO', 'Limit Co', 'starter', 'active', 1, 3, 5000)
      RETURNING id
    `).then((result) => result.rows as Array<{ id: number }>);

    const existingBusiness = await db.execute(`
      INSERT INTO businesses ("accountId", "accountRefId", name, slug, plan, "subscriptionStatus", "isActive")
      VALUES ('LIMITCO', ${accountRefId}, 'Limit One', 'limit-one', 'starter', 'active', true)
      RETURNING id
    `);

    const owner = await db.execute(`
      INSERT INTO users (username, name, email, role, "accountId", "accountRefId", "currentBusinessId", "isActive")
      VALUES ('limit-owner', 'Limit Owner', 'limit@example.com', 'owner', 'LIMITCO', ${accountRefId}, ${(existingBusiness.rows[0] as any).id}, true)
      RETURNING id
    `);

    await db.execute(`
      INSERT INTO user_businesses ("userId", "businessId", role, "isActive")
      VALUES (${(owner.rows[0] as any).id}, ${(existingBusiness.rows[0] as any).id}, 'owner', true)
    `);

    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc/businesses.create"),
      resHeaders: new Headers(),
      user: {
        id: (owner.rows[0] as any).id,
        role: "owner",
        accountId: "LIMITCO",
        accountRefId,
        currentBusinessId: (existingBusiness.rows[0] as any).id,
        currentBusiness: { id: (existingBusiness.rows[0] as any).id, accountId: "LIMITCO", accountRefId },
        businessIds: [(existingBusiness.rows[0] as any).id],
      },
    } as any);

    await expect(caller.businesses.create({
      name: "Limit Two",
      slug: "limit-two",
      businessType: "retail",
      plan: "starter",
    })).rejects.toMatchObject({
      message: "Your current plan allows 1 business. Upgrade to Growth or Pro to add another business.",
      data: expect.objectContaining({
        code: "SUBSCRIPTION_LIMIT_EXCEEDED",
        entity: "business",
        upgradeOptions: ["growth", "pro"],
      }),
    });
  });
});
```

- [ ] **Step 2: Run the focused enforcement test**

Run: `npm test -- api/__tests__/account-subscription-enforcement.test.ts`
Expected: FAIL because business and location mutations do not use account-level enforcement.

- [ ] **Step 3: Implement the shared enforcement helper**

```ts
// ABOUTME: Enforces account-scoped business limits and per-business branch limits with one shared error contract.
// ABOUTME: Keeps business creation, location creation, and future user invites aligned on subscription rules.
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { businesses, locations } from "@db/schema";
import { getAccountSubscription, getAccountUsage } from "./account-subscriptions";
import { getPlanConfig } from "./subscriptions";

function buildUpgradeOptions(kind: "business" | "location", currentLimit: number) {
  if (kind === "business" && currentLimit < 3) return ["growth", "pro"];
  if (kind === "business" && currentLimit < 10) return ["pro"];
  if (kind === "location" && currentLimit < 5) return ["growth", "pro"];
  if (kind === "location" && currentLimit < 99) return ["pro"];
  return [];
}

export async function assertCanCreateBusiness(db: ReturnType<typeof import("../queries/connection").getDb>, accountId: string, accountRefId?: number | null) {
  const resolved = await getAccountSubscription(db, { accountId, accountRefId: accountRefId ?? null });
  const usage = await getAccountUsage(db, accountId);
  const currentLimit = resolved.source === "account" ? resolved.account.maxBusinesses : getPlanConfig(resolved.business.plan).maxBusinesses;

  if (usage.businessCount >= currentLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your current plan allows ${currentLimit} business. Upgrade to Growth or Pro to add another business.`,
      cause: {
        code: "SUBSCRIPTION_LIMIT_EXCEEDED",
        entity: "business",
        currentPlan: resolved.source === "account" ? resolved.account.plan : resolved.business.plan,
        currentUsage: usage.businessCount,
        currentLimit,
        upgradeOptions: buildUpgradeOptions("business", currentLimit),
      },
    });
  }

  return resolved;
}

export async function assertCanCreateLocation(db: ReturnType<typeof import("../queries/connection").getDb>, businessId: number, accountId: string, accountRefId?: number | null) {
  const resolved = await getAccountSubscription(db, { accountId, accountRefId: accountRefId ?? null, fallbackBusinessId: businessId });
  const plan = resolved.source === "account" ? resolved.account.plan : resolved.business.plan;
  const maxBranches = getPlanConfig(plan).maxBranches;
  const [locationCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(locations)
    .where(and(eq(locations.businessId, businessId), isNull(locations.deletedAt)));

  if ((locationCount?.count ?? 0) >= maxBranches) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your current plan allows ${maxBranches} branch for this business. Upgrade to Growth or Pro to add another location.`,
      cause: {
        code: "SUBSCRIPTION_LIMIT_EXCEEDED",
        entity: "location",
        currentPlan: plan,
        currentUsage: locationCount?.count ?? 0,
        currentLimit: maxBranches,
        upgradeOptions: buildUpgradeOptions("location", maxBranches),
      },
    });
  }
}
```

- [ ] **Step 4: Wire the enforcement into `businesses.create`**

```ts
await assertCanCreateBusiness(db, ctx.user!.accountId ?? ctx.user!.currentBusiness?.accountId ?? "", ctx.user!.accountRefId ?? null);

const [result] = await db.insert(businesses).values({
  ...input,
  accountId: ctx.user!.accountId,
  accountRefId: ctx.user!.accountRefId,
  referralCode: generateReferralCode(),
  maxBranches: getPlanConfig(input.plan).maxBranches,
  maxUsers: getPlanConfig(input.plan).maxUsers,
} as any).returning();
```

- [ ] **Step 5: Wire the enforcement into `locations.create`**

```ts
await assertCanCreateLocation(
  db,
  businessId,
  ctx.user?.accountId ?? ctx.user?.currentBusiness?.accountId ?? "",
  ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null,
);

const [result] = await db.insert(locations).values({
  name: input.name,
  slug: input.slug,
  address: input.address,
  phone: input.phone,
  email: input.email,
  businessId,
} as any).returning();
```

- [ ] **Step 6: Run the focused enforcement test**

Run: `npm test -- api/__tests__/account-subscription-enforcement.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the enforcement checkpoint**

```bash
git add api/lib/subscription-enforcement.ts api/businesses-router.ts api/locations-router.ts api/__tests__/account-subscription-enforcement.test.ts api/middleware.ts
git commit -m "feat: enforce account subscription limits"
```

### Task 6: Move Lifecycle and Payment-Method Checks to the Account

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\lib\subscriptions.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\payment-methods-router.ts`
- Modify: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\subscriptions.test.ts`

- [ ] **Step 1: Update the subscription test to seed account-level payment methods**

```ts
const [{ id: accountRefId }] = await db.execute(`
  INSERT INTO customer_accounts ("accountId", name, plan, "subscriptionStatus", "maxBusinesses", "maxUsers", "maxTransactionsPerMonth")
  VALUES ('PAIDCO', 'Paid Co', 'pro', 'trial', 10, 99, 999999)
  RETURNING id
`).then((result) => result.rows as Array<{ id: number }>);

await db.insert(paymentMethods).values({
  accountRefId,
  businessId: business.id,
  name: "Visa Card",
  code: "CARD",
  isActive: true,
} as any);
```

- [ ] **Step 2: Run the subscription suite**

Run: `npm test -- api/__tests__/subscriptions.test.ts`
Expected: FAIL because lifecycle reads still use `paymentMethods.businessId`.

- [ ] **Step 3: Refactor lifecycle writes to use the account row**

```ts
export async function hasPaymentMethodOnFile(
  db: ReturnType<typeof import("../queries/connection").getDb>,
  accountRefId: number | null,
  fallbackBusinessId?: number | null,
): Promise<boolean> {
  if (accountRefId) {
    const rows = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.accountRefId, accountRefId), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
      .limit(1);
    if (rows.length > 0) return true;
  }

  if (fallbackBusinessId) {
    const rows = await db.select({ id: paymentMethods.id }).from(paymentMethods)
      .where(and(eq(paymentMethods.businessId, fallbackBusinessId), eq(paymentMethods.isActive, true), isNull(paymentMethods.deletedAt)))
      .limit(1);
    return rows.length > 0;
  }

  return false;
}
```

- [ ] **Step 4: Update `syncTrialState`, `extendBusinessTrial`, and `processTrialLifecycle` to write `customer_accounts`**

```ts
await db.update(customerAccounts).set({
  subscriptionStatus: "expired",
  subscriptionExpiry: null,
  plan: "free",
  maxBusinesses: getPlanConfig("free").maxBusinesses,
  maxUsers: getPlanConfig("free").maxUsers,
  maxTransactionsPerMonth: getPlanConfig("free").transactionQuota,
  features: mergeSubscriptionState(account.features, { trialDowngradedAt: now.toISOString() }),
}).where(eq(customerAccounts.id, account.id));
```

- [ ] **Step 5: Mirror payment method ownership on create**

```ts
await db.insert(paymentMethods).values({
  businessId: currentBusinessId,
  accountRefId: ctx.user?.accountRefId ?? ctx.user?.currentBusiness?.accountRefId ?? null,
  name: input.name,
  code: input.code,
  color: input.color,
  sortOrder: input.sortOrder ?? 0,
  isActive: true,
} as any);
```

- [ ] **Step 6: Run the focused subscription suite**

Run: `npm test -- api/__tests__/subscriptions.test.ts`
Expected: PASS

### Task 7: Make Settings Use One Account-Scoped Subscription View

**Files:**
- Modify: `d:\DevCenter\abuilds\fina\finaflow\src\pages\Settings.tsx`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-context.test.ts`

- [ ] **Step 1: Switch the page query from business-scoped to account-scoped**

```tsx
const { data: subscription } = trpc.accountSubscriptions.mySubscription.useQuery();
const changePlan = trpc.accountSubscriptions.changePlan.useMutation({
  onSuccess: (data) => {
    toast.success(data.message);
    utils.accountSubscriptions.mySubscription.invalidate();
  },
  onError: (err) => {
    toast.error(err.message);
  },
});
```

- [ ] **Step 2: Update all references from `tier` to `subscription`**

```tsx
<p className="text-lg font-semibold text-[#2D2A26]">{PLAN_DETAILS[subscription.plan]?.label ?? subscription.plan}</p>
<p className="mt-1 font-mono text-lg font-semibold text-[#2D2A26]">
  {subscription.currentBusinesses} / {subscription.maxBusinesses === 99 ? "∞" : subscription.maxBusinesses}
</p>
```

- [ ] **Step 3: Add one explicit account-wide context label**

```tsx
<p className="text-xs text-[#8D8A87]">
  Subscription applies to all businesses under account <span className="font-mono text-[#2D2A26]">{subscription.accountId}</span>
</p>
```

- [ ] **Step 4: Run the account-context suite and lint the page**

Run: `npm test -- api/__tests__/account-subscription-context.test.ts`
Expected: PASS

Run: `npx eslint src/pages/Settings.tsx`
Expected: PASS

### Task 8: Final Validation and Rollout Notes

**Files:**
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-migration.test.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-enforcement.test.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\account-subscription-context.test.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\subscriptions.test.ts`
- Test: `d:\DevCenter\abuilds\fina\finaflow\api\__tests__\local-auth-registration.test.ts`

- [ ] **Step 1: Run the migration suite**

Run: `npm test -- api/__tests__/account-subscription-migration.test.ts`
Expected: PASS

- [ ] **Step 2: Run the enforcement suite**

Run: `npm test -- api/__tests__/account-subscription-enforcement.test.ts`
Expected: PASS

- [ ] **Step 3: Run the account-context suite**

Run: `npm test -- api/__tests__/account-subscription-context.test.ts`
Expected: PASS

- [ ] **Step 4: Run the existing subscription and registration suites**

Run: `npm test -- api/__tests__/subscriptions.test.ts api/__tests__/local-auth-registration.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, or only unrelated pre-existing failures that already existed before this work.

- [ ] **Step 6: Run type-check**

Run: `npm run check`
Expected: PASS for changed files, or only unrelated pre-existing failures outside this refactor.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: PASS for changed files, or only unrelated pre-existing failures outside this refactor.

- [ ] **Step 8: Commit only the implementation files**

```bash
git add db/schema.ts db/relations.ts db/migrations/0001_account_level_subscriptions.sql api/lib/account-subscriptions.ts api/lib/subscription-enforcement.ts api/account-subscriptions-router.ts api/local-auth-router.ts api/businesses-router.ts api/locations-router.ts api/payment-methods-router.ts api/lib/subscriptions.ts api/router.ts api/middleware.ts api/test/setup.ts api/__tests__/account-subscription-migration.test.ts api/__tests__/account-subscription-enforcement.test.ts api/__tests__/account-subscription-context.test.ts api/__tests__/subscriptions.test.ts api/__tests__/local-auth-registration.test.ts src/pages/Settings.tsx docs/superpowers/plans/2026-05-09-account-level-subscription-refactor.md
git commit -m "feat: move subscriptions to the account level"
```

## Self-Review

- Spec coverage:
  - account-level binding: covered in Tasks 2, 3, and 4
  - business creation validation: covered in Task 5
  - location limit enforcement: covered in Task 5
  - UI consistency across business switching: covered in Tasks 3 and 7
  - data migration and continuity: covered in Tasks 1 and 2
  - testing requirements: covered in Tasks 1, 3, 5, 6, and 8
- Placeholder scan:
  - no `TBD`, `TODO`, or “implement later” placeholders remain
  - every command uses an exact file path or concrete command
- Type consistency:
  - the new table is consistently named `customerAccounts` in TypeScript and `customer_accounts` in SQL
  - the new router is consistently named `accountSubscriptions`
  - the new foreign key is consistently named `accountRefId`

Plan complete and saved to `docs/superpowers/plans/2026-05-09-account-level-subscription-refactor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
