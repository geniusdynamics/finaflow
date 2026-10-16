# Subscription Management — Verification Checklist

Run after each phase. Commands per repo conventions.

## Static gates

- [ ] `npm run check` (typecheck) — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — succeeds
- [ ] Migration applies on a fresh DB and on an existing dev DB (idempotent)
- [ ] `scripts/verify-migrations.ts`-style check passes for the new migration

## Automated tests

- [ ] `npx vitest run api/__tests__/subscriptions-math.test.ts` — green
- [ ] `npx vitest run api/__tests__/subscriptions-router.test.ts` — green
- [ ] `npx vitest run api/__tests__/subscriptions-sweep.test.ts` — green (P2+)
- [ ] `npm test` — full suite, no new failures
- [ ] `db/__tests__/00XX_subscription_migration.test.ts` — green

## Isolation & security

- [ ] Business A cannot list/get/update/delete Business B's subscriptions (list, get, update, delete, payments)
- [ ] Branch A user (assigned only to branch A) cannot see or mutate branch B rows
- [ ] Business-wide (`locationId=null`) rows visible to authorized users across branches, editable only with `subscriptions:manage`
- [ ] Employee without `subscriptions:manage` gets permission error on create/update/delete (server-side, verified via direct tRPC call, not UI)
- [ ] CSRF rejection verified on `subscriptions.create` without token
- [ ] Rate limiter returns 429 past burst threshold
- [ ] Audit rows written for create/update/delete/renew/payment with correct actor + business

## Money correctness

- [ ] `monthlyNormalized` matches Wallos formulas for all 4 units incl. count>1
- [ ] Month-end clamping verified (Jan 31 → Feb → Mar behaviour documented in test)
- [ ] Payment posting is atomic: forced failure mid-posting leaves no `subscriptionPayments` and no `expenses` row
- [ ] Double payment for same cycle rejected by unique guard
- [ ] Mixed-currency totals convert via `getRate` and match hand-computed values (mocked rate)
- [ ] `postingMode='none'` creates no expense/bill

## Calendar toggle (headline)

- [ ] Toggle = **Subscriptions**: only subscription chips render; bills/sales/payroll hidden
- [ ] Toggle = **Bills**: legacy behaviour byte-for-byte (existing bills view regression)
- [ ] Toggle = **Both**: both chip types render with legend; month strip totals = subscriptions + bills
- [ ] Overdue subscription chip: red border + `OVERDUE`; due today: solid fill
- [ ] `?section=subscriptions` deep link opens subscription-locked calendar
- [ ] Notification link `/subscriptions?highlight=<id>` scrolls to and pulses the card

## Notifications (P2+)

- [ ] Due-soon notification fires exactly once per subscription per cycle (run sweep twice)
- [ ] Due-today re-highlights the same row (no duplicate)
- [ ] Overdue escalates info→warning→critical correctly at thresholds
- [ ] Payment clears/archives pending notifications for that subscription
- [ ] Unread badge counts include subscription notifications; banners respect existing rules

## UX / visual parity

- [ ] KPI cards, donuts, and forecast chart match the Wallos reference screenshots in structure (values differ by data)
- [ ] Cards/Table/Split views all render with 0, 1, and 50+ subscriptions (empty states included)
- [ ] Forms validate and surface `toast` errors; "Whole business" persists `locationId=null`
- [ ] Mobile: toggle row scrollable, 44px+ touch targets, tables degrade gracefully

## Docs

- [ ] `CHANGELOG.md` updated per phase (append-only, top of `[Unreleased]`)
- [ ] Open questions in spec §11 resolved and spec updated
