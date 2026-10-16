# Subscription Management — Task Breakdown

Companion to `spec.md`. Phases are independently shippable; P1 must land before P2, etc.

> **Naming rule (from spec §1):** `api/lib/subscriptions.ts` is taken by tenant-billing code — never modify or shadow it, nor `api/lib/account-subscriptions.ts`, `api/lib/subscription-enforcement.ts`, `api/account-subscriptions-router.ts`, or `api/__tests__/subscriptions.test.ts`. New shared code: `api/lib/subscription-math.ts`, `api/lib/subscription-posting.ts`, `api/lib/subscription-sweep.ts`.

---

## P1 — Core (schema, API CRUD, list page, calendar toggle)

### Schema & data layer
- [ ] Add `subscriptionCycleEnum`, `subscriptionStatusEnum`, `subscriptionPostingEnum` to `db/schema.ts`
- [ ] Add `subscriptions` table (spec §3.2) with all indexes + `InsertSubscription` types — incl. `postingLocationId`, `externalSystem`, `externalId`
- [ ] Add `subscriptionPayments` table (spec §3.3) with unique cycle guard (`paidDate` nullable for pending rows)
- [ ] Add enums/relations exports, mirror `bills`-style comments
- [ ] Generate migration `db/migrations/<NNNN>_subscriptions.sql` using the **next free migration number (highest today: `0030_finabill_sync_expansion.sql`; do not collide with the existing duplicate `0017_`/`0018_` numbers)** with `CREATE INDEX CONCURRENTLY` + `statement-breakpoint`
- [ ] Add `db/__tests__/00XX_subscription_migration.test.ts` (style of `db/__tests__/0014_budget_plan_model_migration.test.ts`)
- [ ] Add settings keys defaults (`subscriptions_default_notify_days` etc.)

### Shared logic
- [ ] `api/lib/subscription-math.ts` (pure, no DB): `advanceDueDate`, `monthlyNormalized`, `cycleProgress`, `projectMonths`, `nextDueAfter`, `isDueSoon`, `isOverdue`
- [ ] `api/lib/subscription-math.ts`: base-currency conversion helper using `getRate` (cache → DB → provider → cross-rate precedence)
- [ ] Types for computed row fields (`SubscriptionRowDTO`)

### Router
- [ ] `api/middleware.ts`: `SUBSCRIPTIONS_VIEW/MANAGE/PAY` + role defaults (owner/admin/manager: all; employee: view+pay; viewer: view)
- [ ] Merge the 3 new permissions into existing `rolePermissions` DB rows (spec §5 — DB-override businesses otherwise get no access)
- [ ] `src/lib/permissions.ts` + `src/pages/Users.tsx` `PERMISSION_GROUPS` mirrored exactly (no frontend-only permission asymmetry)
- [ ] `api/subscriptions-router.ts`: `list`, `get`, `create`, `update`, `delete`, `clone`
- [ ] `api/subscriptions-router.ts`: `calendar` query (merged-event shape); `list`/`calendar` use explicit `scope: "all" | "main" | "branch"` (no `0` sentinel)
- [ ] Validation: `postingLocationId` required when `postingMode != "none"` and `locationId` is null (spec §7.4)
- [ ] Branch/business scoping helpers via `requireAuthorizedLocation` + `getCurrentBusinessLocationIds` (`api/middleware.ts:575/593`)
- [ ] `logAudit` on all mutations; `api/router.ts` mount; rate limit hook
- [ ] `api/lib/rate-limit.ts`: `subscriptionWriteLimiter` (`createEndpointRateLimiter("subscription-write", { windowMs: 60_000, max: 120 })`)

### UI
- [ ] `src/components/ui/segmented-toggle.tsx`
- [ ] `src/pages/Subscriptions.tsx` shell + summary strip + branch filter
- [ ] Cards view + progress ring + action row/kebab
- [ ] Table view (sortable)
- [ ] `SubscriptionFormDialog.tsx` (add/edit) with category/vendor/branch/account pickers + "Post to branch" field for business-wide subs with posting enabled
- [ ] `src/pages/Calendar.tsx`: source toggle (Subscriptions/Bills/Both), merged events, legend, monthly strip (budget line reads `budgetPlans`)
- [ ] `?section=subscriptions` embed in Calendar hub
- [ ] `src/App.tsx` lazy route + `ProtectedRoute` + per-route `ErrorBoundary`; `Layout.tsx` `allNavItems` + `MobileNavigation.tsx` nav entry (`Repeat` icon). Pages wrap themselves in `<Layout>` — `AuthLayout` is unused and forbidden by `api/__tests__/frontend-regressions.test.ts`

### Tests (P1)
- [ ] `api/__tests__/subscriptions-math.test.ts`
- [ ] `api/__tests__/subscriptions-router.test.ts` (CRUD, validation, isolation, calendar, posting-location validation)
- [ ] `src/pages/__tests__/Subscriptions.test.tsx` (toggle + form + cards)
- [ ] Extend calendar tests for the toggle

### P1 acceptance
- [ ] `npm run check` + `npm run lint` clean
- [ ] CRUD works for business-wide (`locationId=null`) and branch-pinned subscriptions
- [ ] Calendar toggle switches sources with no regression to bills/sales/payroll views
- [ ] Isolation tests prove cross-business and cross-branch invisibility

---

## P2 — Money & reminders

- [ ] `api/lib/subscription-posting.ts`: `subscriptions.recordPayment` with transactional expense/bill posting per `postingMode` (posting location per spec §7.4)
- [ ] `subscriptions.confirmPayment` for scheduler-pending rows (sets `paidDate`)
- [ ] `subscriptions.renew` (advance ± record) + overdue "Needs attention" filter
- [ ] `pause` / `resume` / `cancel` (`cancellationDate`, `cancelReason`, `replacedBySubscriptionId`) + "Replace with…" UI flow
- [ ] `subscriptions.payments.list` + detail-dialog history table
- [ ] `api/lib/subscription-sweep.ts` (due-soon, due-today re-highlight, overdue escalation warning→critical at 3d, auto-advance with `paidDate=NULL` pending row, trial expiry) — **per-user fan-out** per spec §6.1
- [ ] `runSubscriptionSweepJob()` wired into `api/boot.ts` on daily `setInterval` (mirror `runTrialLifecycleJob` pattern, `api/boot.ts:610-632`)
- [ ] Notification clearance on payment for all users (`subscription_paid` reason in `notificationClearedReasonEnum`)
- [ ] Auto-advance + pending-payment UX (Confirm buttons, banner)
- [ ] Dashboard `SubscriptionsCard` (existing `src/features/dashboard/` card pattern)
- [ ] `api/__tests__/subscriptions-sweep.test.ts` (idempotency, fan-out scope, escalation) + payment-posting tests (incl. atomic rollback + posting location)
- [ ] Audit entries verified for every mutation

---

## P3 — Analytics & polish

- [ ] `subscriptions.stats` (KPIs, category split, branch split, projection, upcoming, savings) — budget comparisons read `budgetPlans`
- [ ] Stats UI: KPI cards, donuts (recharts, existing chart stack), Trends & Forecast chart with budget line
- [ ] Split view on `/subscriptions`
- [ ] CSV export (payments + subscriptions) following existing export patterns
- [ ] Email digest (`subscription_due_digest`) via `sendLoggedEmail` (`api/lib/logged-email.ts`)
- [ ] Logo upload + SSRF-guarded URL fetch (spec §8.7)
- [ ] Progress-ring business setting

---

## P4 — Integrations (optional)

- [ ] v1 API scopes `subscriptions:read` / `subscriptions:write` (`api/lib/api-scopes.ts`, `docs/api-reference/openapi.yaml`)
- [ ] Shared service extraction (`api/lib/integration-service.ts` pattern) if v1 routes added
- [ ] Budget auto-provisioning for subscription categories
- [ ] Bank-feed matching hooks (design only in this pass)

---

## Changelog & docs
- [ ] CHANGELOG entries per phase under `[Unreleased]` (append-only convention)
- [ ] Screenshots/QA notes for the calendar toggle in the phase PR description
- [ ] Resolve remaining spec §11 open questions (#1–#4, #6–#7) and update spec
