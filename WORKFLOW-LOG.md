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
