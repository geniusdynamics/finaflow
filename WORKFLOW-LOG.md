# Workflow Log

Chronological log of agent work batches. Each entry records what was done and the exact files created or modified, for traceability.

---

## 2026-10-30 — Billing recovery browser QA

Completed a narrow in-app browser pass at approximately 430 × 550 using only disposable fixtures in `finaflow_test`. The held owner was redirected to `/billing`; dismissing the popup kept recovery visible, and attempting Dashboard reopened the popup without mounting the blocked route. The owner submitted a test-only payment reference and note, which appeared as pending in the admin renewal queue and account detail. Admin verification with a reason approved the request and cleared the billing hold. A fresh owner sign-in returned to Dashboard. No payment was collected and no email was sent. Browser console error/warning capture was empty while the server was live; observed tRPC reads and support/recovery mutations returned 200. An initial sign-in attempt against the previously selected wrong fixture account returned 500; selecting the matching account succeeded.

Removed the exact disposable fixture accounts, users, businesses, memberships, renewal row, sessions (via user cascade), and seven fixture audit rows inside a guarded transaction. Verified `finaflow_test` contains zero rows for the fixture account IDs/usernames/business slugs, renewal reference, and actor IDs. Closed the temporary browser tab and stopped the server.

Files rechecked in this browser QA batch: `src/components/admin/AdminWorkspace.tsx`, `WORKFLOW-LOG.md`, and `CHANGELOG.md`. The plan selector now follows the selected account's loaded plan; browser state showed `starter` for the starter fixture. After this adjustment, `npm run check`, focused ESLint for `AdminWorkspace.tsx`, and `git diff --check` passed.

Verification limits: browser coverage remains at the narrow viewport; desktop layout, SMTP failed-save preservation, keyboard-only navigation, and the full test suite remain unverified. The full test run previously cycled for about six minutes without reporting a completed test file and was stopped; focused suites passed 41/41 tests. `npm run lint` passed with 341 warnings and 0 errors; `npm run build` passed with stale Browserslist data and oversized-chunk warnings.

## 2026-10-30 — Browser QA for super-admin workspace

Ran the current source on `127.0.0.1:3201` with `DATABASE_URL` pinned to the dedicated `finaflow_test` database and a disposable super-admin fixture. At the in-app browser's narrow viewport (about 430 × 550), checked Accounts, Users, Overview, Usage & Plans, Communications (Email logs, Broadcasts, SMTP), and Audit. Account selection and return preserved the search filter; refresh restored the search from the URL; browser Back restored the prior section. Admin tRPC reads returned 200 in the server log. The responsive directory rendered as stacked cards with horizontal section navigation.

Browser finding fixed: the Users section reused the “Search customers” placeholder. `src/components/admin/AdminWorkspace.tsx` now displays “Search users” there; verified it in the browser after HMR.

During the broadcast confirmation check, browser automation accepted the confirmation and created one test broadcast. The test database had no SMTP configuration; the server logged eight skipped email attempts and no deliveries. Removed the uniquely titled broadcast, its eight skipped email-log rows, and the disposable account/business/user/session/login-audit rows in one guarded transaction; verified the exact test IDs and broadcast title now have zero rows. No email was delivered externally.

Files modified in this QA batch: `src/components/admin/AdminWorkspace.tsx`, `WORKFLOW-LOG.md`, and `CHANGELOG.md`.

Verification limits: only the narrow in-app browser viewport was available; desktop layout, billing recovery/popup flow, and SMTP save failure remain unverified. Browser console inspection after shutdown showed repeated `Failed to fetch` retries because the temporary tab remained open after the dev server stopped; closing the tab ended those retries. No console capture was collected while the server was live. `git diff --check`, focused ESLint, `npm run check`, `npm run build`, and `npm run lint` passed. Build warnings: stale Browserslist data and oversized chunks. Lint reported 341 warnings and 0 errors. Targeted reruns passed the three previously failing files (12/12) and the five admin/access suites (29/29). Full `npm test` did not complete: after roughly six minutes it had not reported any test file while workers continued to cycle, so it was stopped to release the test database. The earlier failures were not reproduced in the targeted rerun; the full suite remains unverified.

## 2026-10-29 — Super-admin operations and recovery implementation

Implemented the approved admin directories, account actions, manual renewal review and restricted recovery screen. Added canonical billing-hold enforcement across shared procedures, authentication and integration entrypoints. Fixed completed-session reporting, numeric aggregates and broadcast linkage. Verification is in progress; this entry does not claim release readiness.

Files added: `api/admin-support-router.ts`, `api/lib/account-access.ts`, `db/migrations/0035_admin_support.sql`, `src/components/admin/AdminWorkspace.tsx`, `src/pages/Billing.tsx`, and focused tests under `api/__tests__/` and `src/pages/__tests__/AdminWorkspace.test.tsx`.

Files modified: `api/admin-router.ts`, `api/router.ts`, `api/middleware.ts`, `api/local-auth-router.ts`, `api/lib/api-key-auth.ts`, `api/lib/integrations/connect-service.ts`, `api/lib/mobile-wallet/webhook-handler.ts`, `api/lib/webhook-dispatcher.ts`, `api/routes/v1/webhooks.ts`, `api/test/setup.ts`, `db/schema.ts`, `db/migrations/meta/_journal.json`, `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/hooks/useAuth.ts`, `src/pages/Admin.tsx`, `src/providers/trpc.tsx`, `CHANGELOG.md`, and `WORKFLOW-LOG.md`.

Verified so far: existing admin suite 15/15; directory rendering tests 4/4; access policy tests 3/3 and procedure enforcement tests 3/3; support lifecycle tests passed before an additional rollback case was added. Next: finish final checks, review, browser QA, and commit the verified change.

## 2026-10-29 — Admin workspace implementation started

### What was done
Updated `src/pages/Admin.tsx` to retain the SMTP configuration draft after a failed save and clear it after success. Added the corresponding changelog entry in `CHANGELOG.md` and this record in `WORKFLOW-LOG.md`.

### Next steps
Complete the approved super-admin workspace, billing hold and recovery flows, and their regression tests. Verify the SMTP form in a browser and run the planned project checks.

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

---

## 2026-10-17 (later) — Bill-mode accrual, posting-mode visibility, ledger correctness

### What was done
Implemented the requested accounting model: subscriptions default to **bill** posting, the AP obligation accrues **on the due date**, and "Mark paid" settles it. Also fixed three accounting bugs found while verifying it.

### Files
| File | Change |
|---|---|
| `api/lib/subscription-posting.ts` | `materializeSubscriptionBill` (pending bill + expense/AP accrual, idempotent external key), `settleSubscriptionBill` (AP/cash settlement on the accrual's AP account), natural-balance ledger signs, funding-source guard, `findSubscriptionBill` |
| `api/lib/subscription-service.ts` | Settles pending (materialized) cycles via `settlePendingPaymentInTx`; shared by `recordPayment` and `confirmPayment`; pay-early guard only for non-pending cycles |
| `api/lib/subscription-sweep.ts` | `handleBillMaterialization` (bounded catch-up, pending payment + notification, schedule advance); bill mode replaces auto-advance |
| `api/subscriptions-router.ts` | Default `postingMode = 'bill'`; `lastPaidDate` and `pendingCycleDueDate` on rows; `confirmPayment` settles |
| `api/lib/bill-payment.ts`, `api/expenses-router.ts` | Fixed `accounts.type` auto-detect (`bank` → `bank_account`, wallet → `mpesa`/`wallet`) |
| `db/migrations/0032_subscription_posting_default_bill.sql` | `postingMode` default → `bill` (registered in setup.ts + journal) |
| `db/__tests__/0032_subscription_posting_default.test.ts` | New migration test |
| `scripts/run-subscription-sweep.ts` | Ops script to run one sweep (notifications, pendings, bill materialization) |
| `src/pages/Subscriptions.tsx` | Posting-mode tile + explanation, "Unpaid bill for …" state, "Settling the bill for cycle …" dialog, pending-cycle targeting, paid/unpaid button colours |
| `src/components/SubscriptionFormDialog.tsx` | Default posting mode = Create bill |
| `src/pages/Calendar.tsx` | Excludes subscription-generated bills from bill events |
| `api/__tests__/subscriptions-{router,sweep}.test.ts`, `src/pages/__tests__/{Subscriptions,Calendar-toggle}.test.tsx` | Coverage for default/accrual/materialization/settlement/exclusion |

### Data notes (dev DB)
- Repair script reversed the unbalanced postings created before the fix, removed the bad bill, then the fixed sweep re-materialized it.
- Verified final state: bill 26 paid (2,500); ledger = expense debit 2,500 (Operating Expenses) · AP credit 2,500 + AP debit 2,500 (same AP account, net 0) · cash credit 2,500 (Cash Drawer, Malindi).

### Browser verification
- Card: "Unpaid bill for 17 Oct 2026" + red Mark paid → after settlement "Last paid 17 Oct 2026" + green Mark paid.
- Popup: "Posting mode / Create bill / A bill is created on the due date and settled when you mark it paid", payment history pending → confirmed.

---

## 2026-10-18 — Returning-user login, email account lookup, Profile Account ID

### What was done
1. **Returning-user login** — the login page now remembers up to three accounts used in the browser and opens directly on the username/password step for the most recent one. The account chip on that step is a **Change** button; the account-ID step lists recent accounts as quick picks.
2. **Email-based account lookup** — `localAuth.lookupAccount` accepts either an Account ID or the email the user registered with, resolving case-insensitively before showing the credentials step.
3. **Profile Account ID** — the Profile page's Account Details card now shows the sign-in Account ID (own profile and admin-viewed profiles) with a copy button.

### Files created
| File | Purpose |
|---|---|
| `src/lib/recent-accounts.ts` | Defensive localStorage list (`finaflow_recent_accounts`, max 3): read, normalise, promote, ignore malformed/quota failures |
| `src/lib/__tests__/recent-accounts.test.ts` | 6 unit tests with an in-memory Storage double |
| `src/pages/__tests__/Login.remembered-account.test.tsx` | 3 render tests: auto-advance, change action, no-history fallback |
| `src/pages/__tests__/Profile.account-id.test.tsx` | 3 render tests: own profile, viewed profile, missing ID |

### Files modified
| File | Change |
|---|---|
| `src/pages/Login.tsx` | Recent-account state + auto-advance, quick picks, **Change** button, Account ID/email field with format-aware hint, save on lookup and login success |
| `api/local-auth-router.ts` | `findAccountIdByEmail` (users.email → customer_accounts → first active business, case-insensitive, most recent sign-in first); `lookupAccount` accepts emails (max 320) |
| `api/__tests__/local-auth-scope.test.ts` | Email lookup (mixed case) and unknown-email tests |
| `src/pages/Profile.tsx` | Account ID row in Account Details with clipboard copy + "Copied" feedback |
| `CHANGELOG.md` | Two new sections under Unreleased |

### Verification
- `src/lib/__tests__/recent-accounts.test.ts` (6) + `src/pages/__tests__/Login.test.tsx` (9) + `src/pages/__tests__/Login.remembered-account.test.tsx` (3) — **18 pass**.
- `api/__tests__/local-auth-scope.test.ts` — **14/14 pass** against the test DB, including email resolution.
- `src/pages/__tests__/Profile.account-id.test.tsx` — **3/3 pass**.
- `npx tsc -b` and focused `npx eslint` on every touched file — clean.
- Not browser-verified: no dev server was running, and the OpenChamber browser carries a live session (so `/login` redirects to the dashboard there).

### Findings / proposed next steps
- Email lookup makes the unauthenticated `lookupAccount` an email→business/account oracle. The 120/min limiter was left unchanged to avoid breaking shared-office IPs; consider 30/min or resolving the email inside the login submit.
- Pre-existing: `lookupAccount` returns every active username in the business; `users.email` has no index (email lookup is a sequential scan).
- Pre-existing: `lookupLoading` state in `Login.tsx` is never set to `true` (the spinner uses `lookupMutation.isPending`).




