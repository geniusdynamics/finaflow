# Subscription Management — Detailed Implementation Spec

**Status:** Audited 2026-10-16 — all file/line references re-verified against the codebase; naming collision, notification fan-out and posting-location gaps fixed (see §4, §6.1, §7.4)
**Target:** Finaflow business accounts (multi-branch), NOT households
**Inspiration:** Wallos (open-source subscription tracker) at `D:\DevCenter\abuilds\fina\Wallos-main` — patterns learned, household concepts deliberately dropped
**Companion docs:** `tasks.md` (phased build plan), `checklist.md` (verification)

---

## 1. Summary

Businesses now carry recurring software costs everywhere: SaaS (Google Workspace, Slack, QuickBooks), infrastructure (AWS, Vercel, DigitalOcean), domains & SSL, email, monitoring, insurance, licences, security subscriptions. Today Finaflow tracks only accounts-payable **bills**, which are one-shot obligations materialized from recurring templates. Subscriptions behave differently:

- They have a **vendor, a cadence, a next-due date, and a lifecycle** (active → paused → cancelled → replaced).
- They are **forecast-relevant**: "what will we spend on tooling over the next 12 months?"
- They are frequently **branch-scoped** (a POS licence for Malindi, a server for the Nairobi branch) or **business-wide** (the company's Google Workspace tenant).

This feature adds a first-class **Subscription Management** module that reuses Finaflow's existing engines: expense categories, suppliers, multi-currency + FX converter, money accounts, notifications lifecycle, budgets, permissions, audit logging, and the calendar hub.

### Goals

1. Full subscription lifecycle: create, edit, clone, pause/resume, cancel (with cancellation date), renew, replace (successor tracking), soft-delete ("archive").
2. **Branch-aware scope**: each subscription is either business-wide ("Main") or pinned to one branch, mirroring `budgets.locationId` nullability (`db/schema.ts:1101`).
3. **Calendar hub toggle**: one calendar surface showing **Subscriptions only**, **Bills only**, or **Both** — toggle chips above the view.
4. Recurring-cost analytics: monthly/yearly normalization, cost per day, average cost, most/cheapest expensive, due-this-month, category split, **branch split**, 12-month projection vs budget.
5. Notifications: due-soon (per-subscription lead days), due today, overdue, trial ending — on the existing notifications lifecycle (fade/re-highlight/clear-on-payment).
6. Payments: record payment → optionally post to ledger via an **expense** or **bill** so subscription spend flows into accounting (P&L, budgets) without double entry.

### Non-goals (explicit)

- **No household / payer-member splitting.** Wallos models `payer_user_id → household(id)`. We replace that concept with **branch scope** (`locationId`, null = business-wide).
- **No payment credential storage / auto-debit.** We remind and record; we do not charge cards.
- **Not Finaflow's own SaaS billing.** `customer_accounts` + `api/account-subscriptions-router.ts` (plans/trials for tenants) is a separate system and is not touched.
- **⚠️ Name-collision note (binding):** the tenant-billing system already owns `api/lib/subscriptions.ts` (plan limits, `processTrialLifecycle`), `api/lib/account-subscriptions.ts`, `api/lib/subscription-enforcement.ts`, `api/account-subscriptions-router.ts`, and `api/__tests__/subscriptions.test.ts`. None of these may be modified or shadowed. All new shared code for THIS feature lives in uniquely named modules: `api/lib/subscription-math.ts` (pure math), `api/lib/subscription-posting.ts` (ledger posting), `api/lib/subscription-sweep.ts` (scheduler). Router `api/subscriptions-router.ts` is unambiguous and fine.
- No bank-feed matching in Phase 1 (possible Phase 3 via existing integration plumbing).

---

## 2. What we learned from Wallos (and how we adapt it)

Wallos is a single-user PHP/SQLite subscription tracker. We keep its proven mechanics and formulas; we drop its household concept and re-host everything on Finaflow's multi-tenant, multi-branch, decimal.js accounting stack.

| Wallos mechanism | Source (Wallos) | Finaflow adaptation |
|---|---|---|
| `subscriptions` row: name, logo, price, currency_id, next_payment, cycle, frequency, notes, payment_method_id, category_id, notify, notify_days_before, inactive, auto_renew, url, start_date, cancellation_date, replacement_subscription_id | `endpoints/cronjobs/createdatabase.php:26-46`, `migrations/000004,000008,000019,000023,000025` | Same shape, business-scoped: `businessId` + nullable `locationId`, vendor → existing `suppliers`, category → existing `expenseCategories`, money account → existing `accounts` |
| Cycle model: 5 cycles (daily/weekly/monthly/yearly/one-time) × frequency N | `includes/list_subscriptions.php:6-20` | Richer: interval unit (day/week/month/year) × interval count + `one_time`, so "every 90 days", "every 2 months", "every 2 years" are first-class |
| Monthly normalization: daily `p×30/f`, weekly `p×4.35/f`, monthly `p/f`, yearly `p/(12f)`, one-time `0` | `includes/stats_calculations.php:6-24` (verified 2026-10-16) | Kept verbatim for the "Monthly Cost" KPI (Wallos parity); the 12-month projection instead **walks real due dates** (accurate, handles month-length) |
| Progress within cycle: days since last payment ÷ cycle days, walking back N cycles when `next_payment` is stale | `includes/list_subscriptions.php:22-63` | Kept; computed server-side and returned on `list`/`get` |
| Auto-advance: cron pushes `next_payment` forward for `auto_renew=1` subs | `endpoints/cronjobs/updatenextpayment.php:36-44` | Scheduler advances `nextDueDate` and writes a **pending** `subscriptionPayments` row (`confirmed=false`) — user confirms, then expense/bill posting happens. No surprise ledger entries |
| Manual renewal + overdue: `inactive=0 AND auto_renew=0 AND next_payment < now` | `index.php:85-92`, `endpoints/subscription/renew.php:20` | Overdue = `status='active' AND nextDueDate < today`; manual-renew list is default view filter "Needs attention" |
| One-time purchases excluded from recurring totals, upcoming lists, renewals; shown only on their exact calendar date | `upcoming_payments.php:48`, `upcoming_cancellations.php:23`, `renew.php:20`, `calendar.php:200-206` | Same exclusion rules, encoded in shared query helpers |
| Cancellations: `cancellation_date` + `replacement_subscription_id` successor tracking | `endpoints/subscription/add.php:420-458` | Kept, plus `cancelledAt`, `cancelReason`, and a "Replace with…" flow on the card menu |
| Savings from inactive subs (count + monthly + yearly) | `index.php:467-501` | Kept as "Paused/Cancelled savings" KPI |
| Upcoming payments (enabled, within N days, setting-driven limit) & upcoming cancellations (30-day window) | `includes/upcoming_payments.php`, `upcoming_cancellations.php` | Dashboard card + `/subscriptions` "Due soon" strip |
| Per-subscription `notify_days_before` with `-1` sentinel = use global setting | `migrations/000019.php:7-11`, `000025` | `notifyDaysBefore` integer, `NULL` = business default (setting), `0` = on the day |
| Calendar: month grid, day chips, monthly stats (active count, total cost, amount due), over-budget warning | `calendar.php:244-321` | Rebuilt in `Calendar.tsx` with the **type toggle** (Subscriptions/Bills/Both) |
| Stats: overview KPI cards, category donut, household donut → **branch donut**, trends & forecast 12-month bar chart with budget line, heaviest month, months-over-budget | `stats.php`, `includes/stats_extra_calculations.php` | Same visuals, fed by a new `subscriptions.stats` procedure; budget line reads the active `budgetPlans` model (`db/schema.ts:1115`; legacy `budgets` at `:1099` is NOT used) |
| Logo handling: upload or SSRF-guarded URL fetch, theme variants | `endpoints/subscription/add.php:30-93`, `includes/ssrf_helper.php` | Phase 3: upload to existing logo/brand-asset pattern; URL fetch only behind strict SSRF rules (public IPs only, no redirects to private ranges) |
| List UX: card grid with flip actions (edit/clone/renew/delete) + progress bar | `includes/list_subscriptions.php:325-390` | Card grid with progress ring + kebab/quick actions via our Dialog system; plus Table and Split views |

**Not carried over:** `household` table, `payer_user_id`, per-member notification routing, per-member stats. Branch (`locationId`) takes over that dimension.

---

## 3. Data model (`db/schema.ts` + Drizzle migration)

Conventions followed (all verified 2026-10-16): `serial` PKs, `bigint(..., { mode: "number" })` FKs, `numeric(15,2)` money, `date` string columns for business dates / `timestamp` for lifecycle columns, nullable `locationId` = business-wide (same as `budgets.locationId`, `db/schema.ts:1101`), `businessId` on every row, soft delete via `deletedAt`, partial indexes for hot paths (`bills` pattern, `db/schema.ts:488-497`).

### 3.1 New enums

```ts
export const subscriptionCycleEnum = pgEnum("subscription_cycle", ["day", "week", "month", "year"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "paused", "cancelled", "expired"]);
export const subscriptionPostingEnum = pgEnum("subscription_posting", ["none", "expense", "bill"]); // how a due cycle posts to accounting
```

### 3.2 `subscriptions`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `businessId` | bigint, indexed | tenant scope |
| `locationId` | bigint **nullable** → `locations.id`, `onDelete: "set null"` | `NULL` = whole business ("Main"); otherwise one branch. Mirrors `budgets` |
| `postingLocationId` | bigint **nullable** → `locations.id` (set null) | **Required when `postingMode != "none"` and `locationId` IS NULL.** `expenses.locationId` and `bills.locationId` are both NOT NULL (schema `:371-411`, `:464-497`), so a business-wide subscription must declare which branch its expense/bill rows land on. When `locationId` is set, posting uses `locationId` and this column is ignored |
| `name` | varchar(255) notNull | e.g. "Google Workspace", "AWS Production" |
| `description` | text | optional |
| `vendorId` | bigint → `suppliers.id` (set null) | reuse supplier registry as vendor |
| `categoryId` | bigint → `expenseCategories.id` (set null) | reuse category engine |
| `amount` | numeric(15,2) notNull | cycle price |
| `currency` | varchar(3) default "KES" | per-subscription currency incl. USD |
| `cycleUnit` | `subscriptionCycleEnum` notNull | day/week/month/year |
| `cycleCount` | integer default 1 notNull | "every 2 months" ⇒ unit=month, count=2 |
| `isOneTime` | boolean default false | excluded from recurring totals/upcoming |
| `startDate` | date notNull | |
| `nextDueDate` | date notNull | drives calendar + reminders; indexed |
| `autoRenew` | boolean default false | scheduler auto-advances + writes pending payment |
| `status` | `subscriptionStatusEnum` default "active" notNull | |
| `cancellationDate` | date nullable | Wallos parity |
| `cancelledAt` | timestamp nullable | |
| `cancelReason` | varchar(255) nullable | |
| `replacedBySubscriptionId` | bigint self-FK (set null), nullable | successor tracking (Wallos `replacement_subscription_id`) |
| `trialEndsAt` | date nullable | trial-expiry notifications |
| `defaultAccountId` | bigint → `accounts.id` (set null) | default money account for payments |
| `postingMode` | `subscriptionPostingEnum` default "expense" | `expense` = confirm payment creates an expense (P&L); `bill` = creates a bill in AP; `none` = reminder only |
| `externalSystem` | varchar(50) nullable | future integrations (mirrors `bills.externalSystem`, schema `:496`) |
| `externalId` | varchar(100) nullable | future integrations |
| `url` | varchar(255) nullable | management console link |
| `logoUrl` | text nullable | Phase 3 upload/URL fetch |
| `notifyEnabled` | boolean default true | |
| `notifyDaysBefore` | integer nullable | NULL = business default, 0 = day-of |
| `notes` | text nullable | |
| `createdBy` / `updatedBy` | bigint → `users.id` | |
| `createdAt` / `updatedAt` / `deletedAt` | timestamps | `updatedAt` with `$onUpdate` |

Indexes: `idx_subscriptions_business_deleted (businessId, deletedAt) WHERE deletedAt IS NULL`, `idx_subscriptions_location_deleted (locationId, deletedAt)`, `idx_subscriptions_next_due (businessId, nextDueDate, status) WHERE deletedAt IS NULL`, `idx_subscriptions_category (categoryId)`, `uq_subscriptions_business_external (businessId, externalSystem, externalId) WHERE externalId IS NOT NULL AND deletedAt IS NULL` (mirrors `uq_bills_business_external`, `db/schema.ts:496`).

### 3.3 `subscriptionPayments` (payment history — the “did we actually pay?” ledger)

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `subscriptionId` | bigint notNull → `subscriptions.id` (no action) | |
| `businessId`, `locationId` | bigint (denormalized from parent for scoped queries) | `locationId` = posting location actually used (parent `locationId` or `postingLocationId`) |
| `cycleDueDate` | date notNull | which cycle this satisfies (idempotency key: subscriptionId + cycleDueDate unique) |
| `amount` | numeric(15,2) notNull | |
| `currency` | varchar(3) notNull | |
| `paidDate` | date **nullable** | `NULL` while `confirmed=false` (scheduler-created pending row is not yet paid); set on `recordPayment`/`confirmPayment` |
| `accountId` | bigint → `accounts.id` | money account actually used |
| `paymentMethod` | `paymentMethod2Enum` | cash / mpesa / bank_transfer / card / wallet (`db/schema.ts:39`) |
| `reference` | varchar(100) | M-Pesa code, invoice no. |
| `confirmed` | boolean default true | `false` = auto-generated by scheduler, awaiting user confirmation |
| `expenseId` | bigint → `expenses.id` (set null) | set when `postingMode='expense'` |
| `billId` | bigint → `bills.id` (set null) | set when `postingMode='bill'` |
| `journalEntryId` | bigint → `journalEntries.id` (set null) | if posted via bill/expense wiring |
| `notes` | text | |
| `recordedBy` | bigint → `users.id` | |
| `createdAt` / `updatedAt` / `deletedAt` | timestamps | |

Indexes: `idx_sub_payments_subscription (subscriptionId, cycleDueDate)`, unique `uq_sub_payments_cycle (subscriptionId, cycleDueDate) WHERE deletedAt IS NULL`, `idx_sub_payments_business_date (businessId, paidDate)`.

### 3.4 Business settings (new `app_settings` keys — reuse existing settings store)

- `subscriptions_default_notify_days` (default `7`)
- `subscriptions_default_currency` (defaults to business base currency)
- `subscriptions_show_progress` (bool, Wallos parity setting)

---

## 4. Recurrence & money math (all via `decimal.js`)

New shared module: **`api/lib/subscription-math.ts`** — pure functions, unit-testable, no DB access. (NOT `api/lib/subscriptions.ts` — that path is taken by tenant-billing code, see §1 name-collision note.) Ledger posting lives separately in **`api/lib/subscription-posting.ts`**.

### 4.1 `advanceDueDate(due: string, unit, count): string`

Adds `count` units to a `YYYY-MM-DD` date with **month-end clamping**: `2026-01-31 + 1 month → 2026-02-28`; clamp forward-only from the current due date (documented Phase 1 limitation; anchor-preserving mode is a Phase 3 refinement).

### 4.2 `monthlyNormalized(amount, unit, count): Decimal` — Wallos parity (`stats_calculations.php:6-24`)

| Unit | Formula |
|---|---|
| day | `amount × 30 / count` |
| week | `amount × 4.35 / count` |
| month | `amount / count` |
| year | `amount / (12 × count)` |
| one-time | `0` (excluded) |

Returned as string (`toFixed(2)`) to the client; all sums use `Decimal`, never `parseFloat` (repo convention, `api/lib/decimal.ts`).

### 4.3 `cycleProgress(nextDueDate, unit, count): number` (0–100)

Wallos parity (`list_subscriptions.php:22-63`): `cycleDays` from unit (day=count, week=7×count, month=30×count, year=365×count); walk back whole cycles from `nextDueDate` until the window contains today; `progress = clamp(floor(daysSinceLastPayment / cycleDays × 100), 0, 100)`. One-time ⇒ `0`.

### 4.4 `projectMonths(subs, months, today): { month: "2026-11", total: Decimal }[]`

Walks **actual due dates** from `nextDueDate` forward (≤12 months), advancing via `advanceDueDate` (skip one-time; skip paused/cancelled beyond their `cancellationDate`). Feeds the Trends & Forecast chart, "Heaviest upcoming month", and "Months over budget" vs the **`budgetPlans`** model (`budgetPlans` + `budgetPlanBuckets` + `budgetBucketLines`, `db/schema.ts:1115+`; this is the model `api/budgets-router.ts` and `api/reports-router.ts` actually use — legacy `budgets` at `:1099` is deprecated and must not be referenced).

### 4.5 Multi-currency

Each subscription keeps its own `currency`. KPI/sums convert to the business base currency via the existing converter — `api/lib/currency-converter.ts` `getRate()` (`:70-106`), whose precedence is: **cache → DB (direct row, then inverse) → provider (persisted) → cross-rate via base currency → throw**. Original amount+currency always shown alongside converted. If a rate is unavailable, the row is excluded from totals and the UI shows a "conversion unavailable" chip.

### 4.6 Derived fields returned by `list`/`get` (computed, not stored)

`monthlyNormalized`, `yearlyNormalized`, `progress`, `daysUntilDue` (negative = overdue), `isDueSoon` (≤ notifyDaysBefore), `isOverdue`, `branchName` (null = "Whole business"), `vendorName`, `categoryName`, `postingModeLabel`.

---

## 5. API surface — `api/subscriptions-router.ts`

New router mounted in `api/router.ts` as `subscriptions`.

| Procedure | Type | Purpose / key inputs |
|---|---|---|
| `subscriptions.list` | query | Filters: `locationId?` (omit = all branches), `scope?: "all" \| "main" \| "branch"` (`main` = business-wide rows only; `branch` requires `locationId`) — explicit `scope` param, no `0` sentinel (see §11.5); `status?`, `categoryId?`, `cycleUnit?`, `vendorId?`, `search?`, `sort` (next_due / amount / name / category), `page`/`pageSize`. Returns rows + computed fields + `totals` (monthly/yearly normalized in base currency). |
| `subscriptions.get` | query | Single + payment history (last 12) + successor/predecessor names. |
| `subscriptions.create` | mutation | Validates branch ∈ `getCurrentBusinessLocationIds`, category/vendor/account ownership, amount > 0, cycleCount 1–365, `postingLocationId` present when `postingMode != "none"` and `locationId` is null. Audit `CREATE`. |
| `subscriptions.update` | mutation | Partial; guards ownership of old and new `locationId` (and `postingLocationId`); recompute `nextDueDate` only when schedule fields change (or explicit flag). Audit `UPDATE`. |
| `subscriptions.delete` | mutation | Soft-delete (`deletedAt`), audit `DELETE`; hidden from all lists/calendar/stats. |
| `subscriptions.clone` | mutation | Wallos parity (`clone.php`): copies config, resets dates, " (copy)" suffix. |
| `subscriptions.pause` / `.resume` | mutations | Status transitions; resume shifts `nextDueDate` forward to first future cycle. |
| `subscriptions.cancel` | mutation | Sets `status='cancelled'`, `cancellationDate`, `cancelReason`, optional `replacedBySubscriptionId`. Audit. |
| `subscriptions.renew` | mutation | Manual renewal (Wallos `renew.php`): advances `nextDueDate` one cycle, optionally records payment, in one `db.transaction()`. |
| `subscriptions.recordPayment` | mutation | Inserts `subscriptionPayments` (unique cycle guard) and, per `postingMode`, creates an expense or bill via `api/lib/subscription-posting.ts` **inside `db.transaction()`**; returns linked ids. Audit. |
| `subscriptions.confirmPayment` | mutation | Confirms a scheduler-created pending payment (sets `paidDate`) → posts to accounting. |
| `subscriptions.payments.list` | query | Paginated history with branch/category filters. |
| `subscriptions.stats` | query | KPI block + `categorySplit[]` + `branchSplit[]` + `projection[12]` + `upcoming[]` + `savings`; all converted to base currency. |
| `subscriptions.calendar` | query | `{ dateFrom, dateTo, locationId?, scope? }` → events `{ id, name, amount, currency, date, type: "subscription", isOverdue, branchName }`. Merged client-side with bill data: `dashboard.billCalendar` (`api/dashboard-router.ts:187-201`) returns raw rows `{ bills, recurring, today }` and the Calendar page builds event objects today — keep that split (subscription events pre-shaped is fine, but merge happens in `Calendar.tsx`, matching how `bills`/`recurring` are consumed at `Calendar.tsx:50-53`). |

**Permissions:** add to `api/middleware.ts:27` (PERMISSIONS):
`SUBSCRIPTIONS_VIEW: "subscriptions:view"`, `SUBSCRIPTIONS_MANAGE: "subscriptions:manage"`, `SUBSCRIPTIONS_PAY: "subscriptions:pay"`. Defaults: owner/admin/manager = all three; employee = view + pay; viewer = view. Mirror in `src/lib/permissions.ts` and add a "Subscriptions" group to `PERMISSION_GROUPS` in `src/pages/Users.tsx:67-89`.

⚠️ **Role-permission DB overrides:** the hardcoded `ROLE_PERMISSIONS` in `api/middleware.ts:79-135` is only the fallback — real permissions can be stored per-business in the `rolePermissions` table (`db/schema.ts:172`, loaded via `loadRolePermissionsFromDb`, `api/middleware.ts:151`). The phase migration/rollout must **merge the three new permissions into existing `rolePermissions` rows** (or ship an admin-visible grant step); otherwise existing businesses with custom role config get zero subscription access. Frontend note: `src/lib/permissions.ts` currently has a frontend-only `budgets:view` asymmetry vs the backend — do not replicate that pattern; keep both sides identical.

**Middleware:** reuse `getCurrentBusinessLocationIds` (`api/middleware.ts:575`) + `requireAuthorizedLocation` (`api/middleware.ts:593`) — both defined in `api/middleware.ts`, consumed bills-router-style (`api/bills-router.ts` imports them at its top) — for every read/write; mutations log via `logAudit` (`api/lib/audit.ts:4`); CSRF and rate limiting apply automatically — add a dedicated `createEndpointRateLimiter("subscription-write", { windowMs: 60_000, max: 120 })` in `api/lib/rate-limit.ts` (mirror `lookupAccountLimiter`, `api/lib/rate-limit.ts:73`).

**Migration:** Drizzle-generated `db/migrations/<NNNN>_subscriptions.sql` — **use the next free migration number (currently `0030_finabill_sync_expansion.sql` is highest; beware: the repo already has duplicate `0017_`/`0018_` numbers from mixed naming conventions, so do NOT pick a number that collides)** — using `CREATE INDEX CONCURRENTLY` + `--> statement-breakpoint` (as `0017_steep_tarantula.sql` does), plus a migration test in the style of `db/__tests__/0014_budget_plan_model_migration.test.ts` named `db/__tests__/00XX_subscription_migration.test.ts`. Tests run against a shared Postgres (`vitest.config.ts`: `fileParallelism: false`, `maxWorkers: 1`, setup `api/test/setup.ts`) — keep migration tests self-contained and idempotent.

---

## 6. Scheduler & notifications

### 6.1 Daily sweep — `api/lib/subscription-sweep.ts`

**Scheduling (verified 2026-10-16):** there is NO bill-reminder cron in this codebase — overdue bill notifications are generated on-demand per user in `api/notifications-router.ts:47+` (`generateOverdueBillNotificationsForUser`). The actual scheduled-job pattern is plain `setInterval` started at boot: `runTrialLifecycleJob()` (`api/boot.ts:610-632`, `.unref()`, immediate first run, `clearInterval` on shutdown `:686-687`) and `startExchangeRateSync()` (`api/lib/exchange-rate-sync.ts:33`). Follow that pattern exactly: export `runSubscriptionSweepJob()` and start it from `api/boot.ts` (daily interval + immediate first run + shutdown cleanup). No cron library, no new infrastructure.

**Notification fan-out (binding):** `notifications` rows are **per-user** (`userId` notNull, `db/schema.ts:1338+`). The sweep therefore fans out: for each due/overdue event it upserts one notification **per eligible user**. Eligible = active users of the business holding `subscriptions:view` whose `userLocations` assignment covers the subscription's `locationId` (business-wide rows: all such users), plus the subscription's `createdBy` if still active. Upsert key per user: `(userId, entityType='subscription', entityId, type, cycleDueDate)` — mirrors the bill upsert key in `api/notifications-router.ts:78-89`.

Idempotent by design:

1. **Due-soon reminders** — for each `status='active'` sub where `nextDueDate - notifyDaysBefore ≤ today ≤ nextDueDate`: upsert per the fan-out rule above — never duplicates (mirrors bill overdue upsert pattern, `api/notifications-router.ts:47-127`).
2. **Due today** — same row re-highlighted per user (`highlightState='highlighted'`, `lastHighlightedAt` bump) rather than a new row — reuses `api/lib/notification-lifecycle.ts:91-131`.
3. **Overdue escalation** — `nextDueDate < today && status='active'`: severity `warning` → `critical` after 3 days (no info stage); link `/subscriptions?highlight=<id>`; banner-eligible via existing banner query rules.
4. **Auto-advance** — `autoRenew=true && nextDueDate ≤ today`: advance `nextDueDate` by one cycle + insert `subscriptionPayments` row `confirmed=false`, `paidDate=NULL` (unique `(subscriptionId, cycleDueDate)` makes replays safe).
5. **Trial expiry** — `trialEndsAt` within 3 days: info notification.
6. **Clearance on payment** — when `recordPayment`/`confirmPayment` succeeds, archive/clear pending notifications for that subscription **for all users** (mirror `api/lib/notification-clearance.ts:16-60` bill-paid clearance, with a new `notificationClearedReasonEnum` value `subscription_paid`; existing enum values at `db/schema.ts:1330-1336`).

### 6.2 Notification payloads

Each row is created **per eligible user** (see §6.1) and carries `locationId`, `entityType='subscription'`, `entityId`, `linkUrl='/subscriptions?highlight=<id>'` — so existing unread badges (`idx_notifications_user_highlight`), banners, and priority ordering work unchanged.

| Event | type | severity | priority | title |
|---|---|---|---|---|
| Due in N days | `subscription_due_soon` | info | 0 | `Google Workspace renews in 3 days (KES 1,200)` |
| Due today | `subscription_due` | warning | 0 | `AWS Production is due today` |
| Overdue ≥3d | `subscription_overdue` | critical | 0 | `DigitalOcean renewal overdue by 5 days` |
| Trial ending | `subscription_trial_ending` | info | 0 | `Figma trial ends in 2 days` |
| Auto-renew charged (pending confirmation) | `subscription_pending_payment` | warning | 0 | `Confirm AWS payment (auto-renewed)` |

### 6.3 Email (Phase 2)

Reuse `sendLoggedEmail` (`api/lib/logged-email.ts:10`) + `emailLogs`: add `emailLogTypeEnum` value `subscription_due_digest` (enum at `db/schema.ts:51-58`). One digest email per business per day (07:00 local) listing due-soon + overdue rows; respects `notifyEnabled`. No new SMTP work. (Note: tenant trial reminders in `api/lib/subscriptions.ts` use raw `sendEmail` — do NOT copy that; use `sendLoggedEmail`.)

---

## 7. UI

Palette/typography follow existing conventions (serif headings, `#C73E1D` primary, `#F5EDE6` background, `#D4A854` accent; `formatKES`/`formatDate`/`getLocalDateString` from `src/lib/utils.ts:8/17/28`).

### 7.1 Calendar hub — the type toggle (headline feature)

`src/pages/Calendar.tsx` currently has `view: "all" | "bills" | "sales" | "payroll"` (`:16`). New design:

- **Source toggle chips above the view** (segmented control, 44px touch targets, right-aligned on desktop / full-width scrollable row on mobile):
  `[ Subscriptions ] [ Bills ] [ Both ]` — default **Both**.
  - Implemented as new state `sources: { subscriptions: boolean; bills: boolean }` with a `SegmentedToggle` component (`src/components/ui/segmented-toggle.tsx`, new, built from existing button styles).
  - When **Subscriptions**: fetch `subscriptions.calendar` only; hide sales/expense/payroll chips and events (focused renewal view).
  - When **Bills**: today's behaviour (`dashboard.billCalendar`, `api/dashboard-router.ts:187-201` — returns `{ bills, recurring, today }` raw rows; `Calendar.tsx:50-53` builds the event objects).
  - When **Both**: merge both queries; subscription events get a distinct indigo/violet chip + repeat icon, bill events keep orange; legend shows both.
- **Subscription event chip** shows: logo/initial avatar, name, amount, and a per-type color; overdue = red border + `OVERDUE` tag; due-today = solid fill. Clicking opens the subscription detail dialog (`?highlight=<id>` scrolls + pulses the card, matching notification links).
- **Month header**: unchanged month nav; add a compact monthly strip under the header: `N subscriptions due · KES X subscriptions + KES Y bills = KES Z` (Wallos `calendar-monthly-stats`, `calendar.php:302-321`), with an over-budget warning line when `projects > budgets` (Wallos `calendar.php:290-299`), budget read from `budgetPlans`.
- **Section wiring**: the Calendar hub already hosts `?section=payments` (`Calendar.tsx:11-28`). Add optional `?section=subscriptions` as a third embed that renders the subscription calendar preset (toggle locked to Subscriptions) for deep links from notifications.
- Keep existing view chips (sales/expenses/payroll) available inside "Both" mode as secondary filters — no regression to current calendar users.

### 7.2 `/subscriptions` page — `src/pages/Subscriptions.tsx`

- **Header row**: title + count, `Add Subscription` (permission-gated), branch selector (`LocationSelector`, with "All branches" and "Whole business" options), view switcher `Cards | Table | Split` (Wallos list + split-view inspiration), search input.
- **Filter bar**: status pills (All / Active / Due soon / Overdue / Paused / Cancelled), category dropdown (reuses `ExpenseCategorySelector` data), cycle dropdown, vendor dropdown, sort dropdown.
- **Summary strip** (top): `Monthly Cost`, `Yearly Cost`, `Due this month`, `Overdue count` — Wallos overview cards (`overview dashabord.png` reference), all base-currency converted with original-currency footnote.
- **Cards view**: grid of cards; each card = logo/initial, name, branch chip (or "Whole business"), category chip, `KES 1,200 / month`, next-due countdown (`in 3 days` / `OVERDUE 5d`), progress ring (`cycleProgress`, toggleable via settings). Actions row: `Renew`, `Mark paid`, `Edit`, `Clone`, `Pause`, `Replace`, `Delete` — Wallos flip-card actions (`list_subscriptions.php:325-390`) flattened into a visible action row + kebab menu (dialog-based, no flip animation).
- **Table view**: sortable columns Name · Vendor · Branch · Category · Amount · Currency · Cycle · Next due · Progress · Status · actions.
- **Split view**: left pane list (compact rows), right pane detail (Wallos split view): payment history table, projected yearly cost, notes, URL link, change log (audit).
- **Add/Edit dialog** (`SubscriptionFormDialog.tsx`): Name; logo (Phase 3 upload, Phase 1 initial-avatar fallback); Vendor (`QuickSupplierDialog` reuse); Category (`ExpenseCategorySelector` + `QuickCategoryDialog` reuse); Amount + Currency (existing currency picker); Cycle (unit select + count input + "One-time" checkbox with a "repeatable/one-off" segmented control); Start date; Next due date (auto-suggested = start + one cycle); Auto-renew switch; Notify switch + days-before (blank = business default); Default money account (filtered by method like `Bills.tsx` `PAYMENT_METHOD_ACCOUNT_TYPES:29-34`); Branch (`LocationSelector` + "Whole business" option); Posting mode (Reminder only / Create expense / Create bill) — **when Branch = "Whole business" and posting mode ≠ Reminder only, show a required "Post to branch" field (`postingLocationId`)**; URL; Notes. Validation mirrors bills forms with `toast` errors.
- **Detail dialog**: header, KPIs (`monthlyNormalized`, `yearlyNormalized`, total paid to date), payment history table with `Confirm` buttons on pending rows, `Mark paid` CTA, successor link ("Replaced by Vercel Pro →").
- **Nav**: add `{ path: "/subscriptions", label: "Subscriptions", icon: Repeat, perms: [SUBSCRIPTIONS_VIEW] }` to `allNavItems` in `src/components/Layout.tsx:19` and to `MobileNavigation.tsx`; lazy route + `ProtectedRoute` (with `requiredPermission`) + per-route `ErrorBoundary` in `src/App.tsx`. **Note:** pages wrap themselves in `<Layout>` (e.g. `Dashboard.tsx:78`, `Bills.tsx:253`); `AuthLayout` is intentionally unused and `api/__tests__/frontend-regressions.test.ts:28-32` asserts routes are NOT wrapped in it — do not "fix" that.

### 7.3 Stats & analytics (Wallos stats screen, adapted)

Rendered as a "Subscriptions" tab/section (reuse the vertical-nav pattern from `src/pages/Settings.tsx:79,239-293` or the hub `?section=` pattern):

- **KPI cards** (Wallos `overview dashabord.png` parity): Active Subscriptions · Monthly Cost · Yearly Cost · Cost per Day · Average Monthly Subscription Cost · Most Expensive (with logo) · Cheapest (with logo) · Amount Due This Month · Paused/Cancelled Savings (monthly + yearly).
- **Split donuts**:
  - *Category Split* — monthly cost per `expenseCategories` category, legend `Cloud Services (KES 3,390)` style.
  - *Branch Split* — replaces Wallos "Household Split" (`split view.png`): monthly cost per branch + a "Whole business" slice.
  - Donuts rendered with the existing chart stack — recharts (`recharts ^2.15.4`, `src/components/ui/chart.tsx` wrapper, see `src/features/reports/*PieChart.tsx` and `src/features/dashboard/CashflowTrendCard.tsx`). No new chart dependency.
- **Trends & Forecast** (Wallos `trends and focasts.png` parity):
  - Cards: `Heaviest Upcoming Month` (name + amount + month) and `Months Over Budget (Next 12)`.
  - Bar chart: 12-month projection from `subscriptions.stats.projection`, with a dashed budget-line from **`budgetPlans`** when the business has budgets set for subscription categories.
- **Upcoming panel**: next due list (7/30-day toggle) + upcoming cancellations (30-day window, Wallos `upcoming_cancellations.php` parity).
- **Dashboard integration**: a `SubscriptionsCard` in `src/features/dashboard/` — "Due this week: N · KES X" with a link to `/subscriptions`, placed near `BillsPipelineCard`; renders only when the business has ≥1 subscription. Follow the existing card pattern (presentational shadcn `Card` wrapper, exported props type, computation in a sibling `*.ts` module, re-export via `index.ts` barrel).

### 7.4 Booking semantics (how spend reaches the ledger)

| `postingMode` | On `recordPayment` / `confirmPayment` |
|---|---|
| `expense` (default) | Creates a row in existing `expenses` (categoryId = subscription category, accountId = money account, supplierId = vendor, description = `<name> — <cycle due date>`, `expenseDate = paidDate`) inside the same transaction; stores `expenseId`; expense posting logic handles ledger/journal as it already does. |
| `bill` | Creates a `bills` row (supplierId, categoryId, description, amount, issueDate=today, dueDate=cycleDueDate, status `paid` after payment) + `billPayments` row, reusing bills-router service logic; stores `billId`. Use when credit terms/finance needs the AP trail. |
| `none` | History only (no P&L impact) — for cost monitoring without accounting impact. |

**Posting location (binding):** `expenses.locationId` and `bills.locationId` are NOT NULL. For branch-pinned subscriptions, use `subscriptions.locationId`. For business-wide subscriptions (`locationId IS NULL`), use `subscriptions.postingLocationId` — which is validated as required whenever `postingMode != "none"` and the sub is business-wide (§3.2, §5). The resolved location is also denormalized onto `subscriptionPayments.locationId`. A business-wide subscription with `postingMode != "none"` and no `postingLocationId` must be rejected at create/update AND defensively at posting time.

Double-posting guard: `subscriptionPayments` unique `(subscriptionId, cycleDueDate)` prevents two posts for the same cycle; `expenseId`/`billId` set-null FKs keep history if the expense/bill is deleted.

---

## 8. Security & data isolation (must-haves)

1. **Business isolation** — every query filtered by `businessId` from `ctx.user`; every `locationId`/`postingLocationId` validated against `getCurrentBusinessLocationIds(ctx)` (`api/middleware.ts:575`); `requireAuthorizedLocation` (`api/middleware.ts:593`) on writes (bills-router consumption pattern).
2. **Branch leakage tests** — two businesses + branches; subscription in branch A must be invisible/immutable to branch B's users (pattern: `api/__tests__/recurring-bills-isolation.test.ts`).
3. **Permission gating** — `SUBSCRIPTIONS_VIEW/MANAGE/PAY` enforced server-side (not just hidden UI); employees with `subscriptions:view` only see subscriptions of branches they are assigned to (reuse `userLocations` assignment logic, as bills does). Remember the `rolePermissions` DB-override merge (§5) so gating is actually reachable for existing businesses.
4. **Notification fan-out isolation** — sweep-created notifications must only land on eligible users of the same business/branch scope (§6.1); add a test that no notification row is created for users outside the business.
5. **CSRF + rate limiting** — automatic via existing middleware; new write limiter (§5).
6. **Audit logging** — `logAudit` on create/update/delete/cancel/renew/payment with before/after diff summary (`api/lib/audit.ts:4`).
7. **Logo fetch (Phase 3)** — if implemented: https/http only, DNS-resolve then reject private/reserved/loopback IPs (IPv4+IPv6), manual redirect handling re-validating each hop, 5s timeout, 2MB max, content-type allowlist (png/jpg/webp/gif), stored locally — mirrors Wallos `ssrf_helper.php` + `add.php:30-93`. Never fetch at render time.
8. **No secrets** — no payment credentials stored anywhere in this module.

## 9. Testing plan

Command set (repo conventions): `npm test`, `npx vitest run api/__tests__/subscriptions-*.test.ts`, `npm run check`, `npm run lint`. Vitest runs against a shared Postgres with `fileParallelism: false` / `maxWorkers: 1` and 30s test / 120s hook timeouts (`vitest.config.ts`, setup `api/test/setup.ts`); coverage thresholds (api only): 80% lines/functions/statements, 75% branches — new modules must not drop coverage below these. Note `api/__tests__/subscriptions.test.ts` already exists and covers tenant billing — do not modify it; new files use the `subscriptions-math|router|sweep` names below.

**Unit — `api/__tests__/subscriptions-math.test.ts`** (pure `api/lib/subscription-math.ts`):
- `advanceDueDate` month-end clamping (Jan 31 → Feb 28/29 → Mar 28/31), leap year, year cycles, count>1.
- `monthlyNormalized` parity with Wallos table (4.2) including one-time ⇒ 0.
- `cycleProgress` incl. stale next-due walk-back (Wallos `list_subscriptions.php:46-62` scenario).
- `projectMonths` across year boundary, skips one-time, respects cancellation date.

**Integration — `api/__tests__/subscriptions-router.test.ts`**:
- CRUD + validation failures (bad branch, foreign category/vendor/account, amount ≤ 0, business-wide + `postingMode != "none"` without `postingLocationId`).
- Branch + business isolation matrix (A↔B invisible, mismatch rejected).
- `renew` advances exactly one cycle and (with `record:true`) creates payment + expense via `postingMode='expense'` in one transaction; failure rolls back both.
- `recordPayment` twice for the same cycle → second call rejected by unique guard.
- Posting location: business-wide sub posts expense with `postingLocationId`; branch-pinned sub posts with `locationId`.
- `calendar` returns events only within range and only for authorized branches; one-time only on exact date.
- `stats` totals correctness for mixed currencies (mocked rate), category/branch splits sum to monthly total.

**Sweep — `api/__tests__/subscriptions-sweep.test.ts`**:
- Due-soon creates exactly one notification per (user, cycle) across repeated runs (idempotency).
- Fan-out scope: only eligible users (same business, branch assignment) receive rows; unrelated users get none.
- Auto-advance creates pending payment (`paidDate=NULL`) + advances date; replay-safe.
- Overdue escalation `warning` → `critical` at 3 days.
- Payment clears pending notifications for all users.

**UI — `src/pages/__tests__/Subscriptions.test.tsx`** (+ extend `Calendar` tests):
- Toggle = Subscriptions hides bill chips; Bills hides subscription chips; Both shows both + legend.
- Form validation (missing name/amount/next-due; "Whole business" + posting mode without "Post to branch"), branch "Whole business" option persists `locationId=null`.
- Progress ring renders from `progress` field.

## 10. Rollout phases (details in `tasks.md`)

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1 — Core** | Schema + migration, `api/lib/subscription-math.ts`, router (list/get/create/update/delete/clone + calendar), `/subscriptions` page (Cards/Table + add/edit dialog), Calendar hub toggle, permissions (+ rolePermissions merge), nav | CRUD works end-to-end; calendar toggle ships; isolation + math tests green |
| **P2 — Money & reminders** | Payments + posting (expense/bill), renew/confirm flows, sweep + notifications, pause/cancel/replace, dashboard card | Payment posts to accounting atomically; notifications fire once per user per cycle; sweep tests green |
| **P3 — Analytics & polish** | Stats screen (KPIs, donuts, forecast), split view, CSV export, email digest, logo upload/fetch | Stats parity with Wallos reference screenshots; digest emails logged |
| **P4 — Integrations (optional)** | v1 API scopes `subscriptions:read/write`, bank-feed matching hooks, budget auto-provision for subscription categories | Scopes documented in `docs/api-reference/openapi.yaml` |

## 11. Open questions (decide before P2)

1. **Auto-renew ledger behaviour** — confirm the "advance + pending payment + user confirms" model (recommended, avoids surprise expenses) vs auto-posting expenses immediately. (Spec text assumes the recommended model.)
2. **Default posting mode** — expense (recommended, and the schema default) vs bill for most businesses?
3. **Logo URL fetching in P1 or P3** — P3 recommended (initial-avatar letters in P1 are sufficient).
4. **Budget linkage** — should subscription forecast count only subscription categories, or all categories for the "Months over budget" KPI? (Recommended: subscription categories only, to avoid double-counting bills that are separately budgeted. Spec text assumes this. Either way, read **`budgetPlans`**, never legacy `budgets`.)
5. **`locationId=0` sentinel** for "whole business only" filter — **resolved by 2026-10-16 audit: no sentinel; explicit `scope: "all" | "main" | "branch"` param (§5).** Reopen only if API consumers prefer otherwise.
6. **Notification fan-out recipients** — spec assumes users with `subscriptions:view` + branch assignment (+ `createdBy`). Alternative: notify only `createdBy` + owner/admins. Decide before P2 sweep work. (Note `subscriptions_default_notify_days` etc. are per-business, not per-user.)
7. **Business-wide posting location** — spec assumes a required `postingLocationId` on the subscription. Alternative: prompt for the branch at "Mark paid" time. The column approach (recommended) keeps auto-renew confirmation one click.
