# Subscription Management — Task Breakdown

Companion to `spec.md`. Phases are independently shippable; P1 must land before P2, etc.

---

## P1 — Core (schema, API CRUD, list page, calendar toggle)

### Schema & data layer
- [ ] Add `subscriptionCycleEnum`, `subscriptionStatusEnum`, `subscriptionPostingEnum` to `db/schema.ts`
- [ ] Add `subscriptions` table (spec §3.2) with all indexes + `InsertSubscription` types
- [ ] Add `subscriptionPayments` table (spec §3.3) with unique cycle guard
- [ ] Add enums/relations exports, mirror `bills`-style comments
- [ ] Generate migration `db/migrations/00XX_subscriptions.sql` (`CREATE INDEX CONCURRENTLY` + `statement-breakpoint`)
- [ ] Add `db/__tests__/00XX_subscription_migration.test.ts`
- [ ] Add settings keys defaults (`subscriptions_default_notify_days` etc.)

### Shared logic
- [ ] `api/lib/subscriptions.ts`: `advanceDueDate`, `monthlyNormalized`, `cycleProgress`, `projectMonths`, `nextDueAfter`, `isDueSoon`, `isOverdue`
- [ ] `api/lib/subscriptions.ts`: base-currency conversion helper using `getRate`
- [ ] Types for computed row fields (`SubscriptionRowDTO`)

### Router
- [ ] `api/middleware.ts`: `SUBSCRIPTIONS_VIEW/MANAGE/PAY` + role defaults
- [ ] `src/lib/permissions.ts` + `src/pages/Users.tsx` role groups mirrored
- [ ] `api/subscriptions-router.ts`: `list`, `get`, `create`, `update`, `delete`, `clone`
- [ ] `api/subscriptions-router.ts`: `calendar` query (merged-event shape)
- [ ] Branch/business scoping helpers + `requireAuthorizedLocation` guards
- [ ] `logAudit` on all mutations; `api/router.ts` mount; rate limit hook
- [ ] `api/lib/rate-limit.ts`: `subscriptionWriteLimiter`

### UI
- [ ] `src/components/ui/segmented-toggle.tsx`
- [ ] `src/pages/Subscriptions.tsx` shell + summary strip + branch filter
- [ ] Cards view + progress ring + action row/kebab
- [ ] Table view (sortable)
- [ ] `SubscriptionFormDialog.tsx` (add/edit) with category/vendor/branch/account pickers
- [ ] `src/pages/Calendar.tsx`: source toggle (Subscriptions/Bills/Both), merged events, legend, monthly strip
- [ ] `?section=subscriptions` embed in Calendar hub
- [ ] `src/App.tsx` lazy route + `Layout.tsx`/`MobileNavigation.tsx` nav entry (`Repeat` icon)

### Tests (P1)
- [ ] `api/__tests__/subscriptions-math.test.ts`
- [ ] `api/__tests__/subscriptions-router.test.ts` (CRUD, validation, isolation, calendar)
- [ ] `src/pages/__tests__/Subscriptions.test.tsx` (toggle + form + cards)
- [ ] Extend calendar tests for the toggle

### P1 acceptance
- [ ] `npm run check` + `npm run lint` clean
- [ ] CRUD works for business-wide (`locationId=null`) and branch-pinned subscriptions
- [ ] Calendar toggle switches sources with no regression to bills/sales/payroll views
- [ ] Isolation tests prove cross-business and cross-branch invisibility

---

## P2 — Money & reminders

- [ ] `subscriptions.recordPayment` with transactional expense/bill posting per `postingMode`
- [ ] `subscriptions.confirmPayment` for scheduler-pending rows
- [ ] `subscriptions.renew` (advance ± record) + overdue "Needs attention" filter
- [ ] `pause` / `resume` / `cancel` (`cancellationDate`, `cancelReason`, `replacedBySubscriptionId`) + "Replace with…" UI flow
- [ ] `subscriptions.payments.list` + detail-dialog history table
- [ ] `api/lib/subscription-sweep.ts` (due-soon, due-today re-highlight, overdue escalation, auto-advance, trial expiry)
- [ ] Notification clearance on payment (`subscription_paid` reason)
- [ ] Auto-advance + pending-payment UX (Confirm buttons, banner)
- [ ] Dashboard `SubscriptionsCard`
- [ ] `api/__tests__/subscriptions-sweep.test.ts` + payment-posting tests
- [ ] Audit entries verified for every mutation

---

## P3 — Analytics & polish

- [ ] `subscriptions.stats` (KPIs, category split, branch split, projection, upcoming, savings)
- [ ] Stats UI: KPI cards, donuts, Trends & Forecast chart with budget line
- [ ] Split view on `/subscriptions`
- [ ] CSV export (payments + subscriptions) following existing export patterns
- [ ] Email digest (`subscription_due_digest`) via `sendLoggedEmail`
- [ ] Logo upload + SSRF-guarded URL fetch (spec §8.6)
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
