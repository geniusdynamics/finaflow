# Workflow Log

Chronological log of agent work batches. Each entry records what was done and the exact files created or modified, for traceability.

---

## 2026-10-16 — Subscription Management: spec audit + full implementation (P1–P4)

### What was done
Audited the `.trae/specs/subscription-management/` spec against the live codebase (all file/line references re-verified), fixed the audit findings (name collision, per-user notification fan-out, business-wide posting-location gap, stale references, migration numbering trap), then implemented the complete feature per the approved spec: data layer, money math, accounting posting, tRPC router, scheduler + notifications + digest email, full UI (page, form dialog, stats, calendar toggle, dashboard card), and the v1 external REST API with scopes.

### Decisions taken (user-approved)
- Role defaults follow repo convention: employee keeps only `sales:create`; viewer gets `subscriptions:view`; owner/admin/manager get all three subscription permissions.
- Scope: P1–P4 complete (v1 scopes + REST routes + budget auto-provision included; bank-feed matching documented as design-only).

### Files created
| File | Purpose |
|---|---|
| `db/migrations/0031_subscription_management.sql` | Tables, enums, indexes, `role_permissions` merge (idempotent) |
| `db/__tests__/0031_subscription_migration.test.ts` | Migration file-content + wiring tests |
| `api/lib/subscription-math.ts` | Pure Wallos-parity math (advanceDueDate, monthlyNormalized, cycleProgress, projectMonths, parsePositiveAmount) |
| `api/lib/subscription-posting.ts` | Posts payments as expense (P&L) or paid bill (AP) via ledgerEntries mechanics |
| `api/lib/subscription-service.ts` | Shared `recordPaymentInTx` (tRPC + v1 REST) |
| `api/lib/subscription-sweep.ts` | Daily sweep: notifications fan-out, escalation, auto-renew pending payments, trial expiry |
| `api/lib/subscription-digest.ts` | One logged digest email per business per day |
| `api/subscriptions-router.ts` | tRPC router (CRUD, lifecycle, payments, calendar, stats, autoProvisionBudgets) |
| `api/routes/v1/subscriptions.ts` | External REST: list, payments list, POST payments (scoped) |
| `api/__tests__/subscriptions-math.test.ts` | 60 unit tests |
| `api/__tests__/subscriptions-router.test.ts` | 20 integration tests (CRUD, isolation, permissions, posting, calendar, stats, budgets) |
| `api/__tests__/subscriptions-sweep.test.ts` | 7 sweep tests (fan-out, idempotency, escalation, auto-renew, clearance) |
| `api/__tests__/subscriptions-digest.test.ts` | 2 digest tests |
| `api/__tests__/subscriptions-v1.test.ts` | 5 REST tests (auth, scopes, 409 conflicts, tenant isolation) |
| `src/pages/Subscriptions.tsx` | `/subscriptions` page (cards/table/split/stats, filters, dialogs, CSV export) |
| `src/components/SubscriptionFormDialog.tsx` | Add/edit dialog incl. "Post to branch" rule + `addCycle` helper |
| `src/components/SubscriptionStats.tsx` | KPIs, category/branch donuts, forecast vs budget, upcoming panels |
| `src/components/ui/segmented-toggle.tsx` | Generic pill segmented control |
| `src/features/dashboard/SubscriptionsCard.tsx` | Dashboard "Due this week" card |
| `src/pages/__tests__/Subscriptions.test.tsx` | Page render tests |
| `src/pages/__tests__/Calendar-toggle.test.tsx` | Calendar source-toggle tests |
| `src/components/__tests__/segmented-toggle.test.tsx` | Toggle component tests |
| `WORKFLOW-LOG.md` | This log |

### Files modified
| File | Change |
|---|---|
| `db/schema.ts` | 3 enums, `subscriptions`, `subscription_payments`, `subscription_paid` + `subscription_due_digest` enum values |
| `db/migrations/meta/_journal.json` | Registered `0031_subscription_management` |
| `api/test/setup.ts` | Bootstrap applies `0031_subscription_management.sql` |
| `api/middleware.ts` | `SUBSCRIPTIONS_VIEW/MANAGE/PAY` + role defaults + gated procedures |
| `api/router.ts` | Mounted `subscriptions` router |
| `api/boot.ts` | Sweep job + digest wiring (setInterval pattern), `subscriptionWriteLimiter` branch |
| `api/lib/rate-limit.ts` | `subscriptionWriteLimiter` (120/min) |
| `api/lib/notification-lifecycle.ts` | `ClearedReason` + `subscription_paid` |
| `api/lib/notification-clearance.ts` | `clearNotificationsForSubscription` (all-user clearance) |
| `api/lib/api-scopes.ts` | `subscriptions:read` / `subscriptions:write` scopes |
| `api/lib/integration-service.ts` | `listSubscriptions` / `listSubscriptionPayments` |
| `api/routes/v1/index.ts` | Mounted `/subscriptions` v1 routes |
| `docs/api-reference/openapi.yaml` | Subscriptions paths + scopes |
| `src/App.tsx` | `/subscriptions` route (lazy, ProtectedRoute, ErrorBoundary) |
| `src/components/Layout.tsx` | Nav entry (`Repeat` icon) |
| `src/components/MobileNavigation.tsx` | Mobile nav entry |
| `src/pages/Calendar.tsx` | Source toggle (Subscriptions/Bills/Both), merged events, legend, monthly strip, `?section=subscriptions`, futureDate fix |
| `src/pages/Dashboard.tsx` | `SubscriptionsCard` assembly |
| `src/features/dashboard/index.ts` | Barrel export |
| `src/lib/permissions.ts` | Permission keys + role defaults + landing order |
| `src/pages/Users.tsx` | "Subscriptions" permission group + labels |
| `src/pages/Subscriptions.tsx` | Stats view + CSV exports (batch 2 additions) |
| `CHANGELOG.md` | Batch entry at top of `[Unreleased]` |
| `.trae/specs/subscription-management/spec.md` | Audit fixes, permission decision, §12 bank-feed design note |
| `.trae/specs/subscription-management/tasks.md` | Task targets corrected to match implementation |
| `.trae/specs/subscription-management/checklist.md` | Gates corrected + added (fan-out, posting location, rolePermissions merge) |

### Verification
- `npx vitest run` on all subscription suites: **105 tests green** (60 math, 20 router, 7 sweep, 2 digest, 5 v1, 16 migration) + 9 UI tests (5 page, 4 toggle, 4 segmented-toggle component) — verified idempotent across repeated runs.
- Full suite `npm test`: **105 files / 829 tests green** (2026-10-16 final run).
- `npm run check`: only the 6 pre-existing repo errors remain (none in touched files).
- `npm run lint`: clean for all touched files (repo-wide pre-existing errors in unrelated files unchanged).
- `npm run build`: succeeds (vite + esbuild boot bundle).
- Migration verified applied on the live test DB (tables, enums incl. `subscription_paid`, 10 indexes).

---

## 2026-10-16 — Subscription Management: dev-server + browser verification round

### What was done
Started the dev server (`npm run dev:app`, vite + Hono on :3200), seeded the demo account via `localAuth.seedDefaults` (account `DEMO` / `finaflow2024`), and walked the feature in the built-in browser with real data created through the live API. Fixes below came out of that pass.

### Environment findings (not code defects, but worth knowing)
- **The dev database had not applied migration 0031.** `api/boot.ts` has the runtime migration runner commented out (`// import { ensureDatabaseReady }`), so migrations are never auto-applied — not in dev, not in prod. Ran `npm run db:migrate:run` (the repo's `drizzle_schema` ledger runner) to apply it: `[APPLY] 0031_subscription_management.sql … 22 statement(s)`.
- The pre-existing BILLS/sales calendar content is unbounded by the date range select (legacy behaviour, unchanged).

### Fixes made from the browser pass
| File | Fix |
|---|---|
| `src/pages/Calendar.tsx` | Subscription events now render in their own currency (`formatEventMoney`) — USD subs showed "KES 144.00" |
| `api/subscriptions-router.ts` | New `monthStats` (per-month `dueCount` / base-currency `total` / payment-netted `amountDue` / `budget`) + new `overdue` list; `pausedCancelledCount` now counts one-time subs; `monthAfter()` replaces the invalid `-31` date bound (Postgres `22008`) |
| `src/pages/Calendar.tsx` | Added the Wallos-parity **Statistics** panel (3 cards + over-budget warning); month strip now uses `monthStats` for both count and total (mixed-currency + count/total consistency) |
| `src/features/dashboard/SubscriptionsCard.tsx`, `src/pages/Dashboard.tsx` | Dashboard card now surfaces overdue subscriptions ("1 overdue · Due this week: 0") instead of reporting zero while an overdue exists |
| `api/__tests__/subscriptions-router.test.ts` | New test: calendar month statistics incl. payment-netted amount due |

### Browser verification performed
- Login (DEMO account) → dashboard loads; Subscriptions nav entry present.
- `/subscriptions`: summary strip (KES 10,760/mo, yearly 129,120, due this month 2, overdue 1 — math verified against the data), filter bar, status pills, Cards / Table / Split / Stats views, CSV export buttons (no console errors).
- Calendar: source toggle Subscriptions / Bills / Both (legend in Both, view+range controls return in Bills), `?section=subscriptions` locked preset, new Statistics panel (1 · KES 8,000.00 · KES 6,800.00 for October 2026), monthly strips with converted totals.
- Real API actions: created 4 subscriptions, recorded a payment (`paymentId=1, expenseId=75` — expense posting appeared in the dashboard KPIs and as a calendar expense event, and advanced the schedule 20 Oct → 20 Nov), soft-deleted a duplicate, cancelled one with a reason.
- `/subscriptions?highlight=1` deep link: verified the target card is scrolled into view mid-pulse.
- Form validation: submitting "Whole business" + "Create expense" without a posting branch was blocked (native required-field error on **Post to branch**) — the rule holds in the UI.

### Notes / not done
- Native `<select>` elements cannot be driven by the built-in browser tool ("not a text field"), so form submission was completed through the API rather than by clicking through the modal; the modal itself was verified visually.
- Over-budget warning path was not visually exercised (no active budget plan in the dev DB).

---

## 2026-10-17 — Subscription Management: paid-state + double-payment + category duplication round

### What was done
Follow-up fixes from user feedback after the first browser pass.

### Fixes
| File | Fix |
|---|---|
| `api/lib/subscription-service.ts` | `recordPayment` rejects a cycle further ahead than the pay-ahead window (7 days or the sub's notify window) unless `allowEarly`; renewals pass `allowEarly: true` |
| `api/subscriptions-router.ts` | `recordPayment` accepts `allowEarly` + window from settings; `lastPaidDate` added to list/get rows (one grouped query per page) |
| `api/routes/v1/subscriptions.ts` | `allowEarly` input on `POST /subscriptions/{id}/payments` |
| `src/pages/Subscriptions.tsx` | Mark-paid dialog states the cycle and requires "Pay early"; green/red Mark-paid button on cards **and** the detail popup; "Last paid"/"Not paid yet" line |
| `db/seed-accounting.ts` | Category seeding is idempotent (explicit existence check; `onConflictDoNothing` never fired without a unique constraint) |
| `scripts/dedupe-expense-categories.ts` | New: dry-run by default, discovers FK columns to `expense_categories`, repoints then soft-deletes duplicates (`--apply`) |
| `api/expenses-router.ts` | `categories` no longer returns colliding legacy global (businessId NULL) rows |
| `src/pages/Calendar.tsx` | Compact calendar rows (smaller padding/icons) |
| `api/__tests__/subscriptions-router.test.ts` | Pay-early guard test; existing future-cycle payment tests pass `allowEarly` |
| `src/pages/__tests__/Subscriptions.test.tsx` | Paid/unpaid button colour + last-paid assertions |

### Data cleanup performed (dev DB, business 1)
- 60 duplicate expense categories soft-deleted (6 copies of each of 12 names); 0 references repointed because all existing references pointed at the surviving rows (1 expense, 4 subscriptions).
- Diagnosed the user-reported double payment: Figma Organization was marked paid twice on 2026-10-17 (10:13 and 10:14) — exactly the reported scenario; the schedule had jumped 2026 → 2029.


