# Account-Level Subscription Refactor Design

## Summary

This design refactors subscription ownership from `businesses` to a real `accounts` table while preserving the existing human-facing `accountId` login slug. After the change, a single account owns one subscription, and that subscription applies consistently across all businesses linked to the account.

The rollout uses a dual-read, single-write transition:

- reads prefer the new account-level subscription model
- reads can temporarily fall back to legacy business-level subscription fields during migration
- all new subscription writes go only to the account model

## Goals

- bind subscriptions to accounts instead of businesses
- keep `accountId` as the stable human-facing account identifier
- enforce business creation limits at the account level
- enforce location limits per business using the account's subscription plan
- make subscription UI consistent across business switching
- provide a safe migration path that preserves historical continuity
- add automated coverage for enforcement, migration, and cross-business consistency

## Non-Goals

- redesigning the full billing provider integration
- replacing the existing user-to-business permission model
- removing all legacy subscription columns in the first release
- changing transaction quota behavior beyond current plan definitions

## Approved Decisions

- create a real `accounts` table as the subscription source of truth
- keep `accountId` as the human-facing slug/login identifier
- resolve migration conflicts with "most recent paid/trial state wins"
- enforce limits as:
  - `maxBusinesses`: account-wide
  - `maxBranches`: per business
  - `maxUsers`: account-wide
- use dual-read, single-write rollout

## Current Problem

Today, subscription state is stored on `businesses`, which creates the wrong ownership model:

- changing the current business changes the derived subscription context
- the system cannot cleanly support one account with multiple businesses under one subscription
- business creation and location creation limits are not enforced from a single canonical account entitlement source
- migration to a true multi-business account model is blocked by the current subscription shape

## Target Architecture

### Ownership Model

- `accounts` is the parent entity for subscription ownership
- one `account` can own many `businesses`
- one `account` can have many `users`
- users authenticate against the account slug `accountId`
- account subscription state is independent of the currently selected business

### Data Model

Add a new `accounts` table with fields such as:

- `id`
- `accountId` as the unique slug/login identifier
- `name`
- `plan`
- `subscriptionStatus`
- `subscriptionExpiry`
- `maxUsers`
- `maxBusinesses`
- `features`
- `trialExtendedAt`
- `trialReminderSentAt`
- `trialDowngradedAt`
- audit timestamps

Update related tables:

- `businesses`
  - add `accountRefId` foreign key to `accounts.id`
  - keep business metadata and business-local operational fields
  - retain legacy subscription fields temporarily for rollout fallback and audit history
- `users`
  - add `accountRefId` foreign key to `accounts.id`
  - preserve the existing `accountId` string during transition, then converge reads on the joined account row
- `payment_methods`
  - treat payment methods as account-scoped for subscription lifecycle decisions
  - if payment methods are currently business-scoped, bridge them through the owning account during rollout

### Source of Truth

- account-level fields are canonical for:
  - plan
  - subscription status
  - trial state
  - account-wide business limits
  - account-wide user limits
- business-level fields remain canonical for:
  - business name and identity
  - per-business location count
  - business-local operational data

## API and Business Logic Changes

### Subscription Reads

Create an account-scoped read path such as `accounts.mySubscription` that:

- resolves the authenticated user's account
- returns account-level subscription data
- returns account-wide usage counts
- returns plan-derived entitlements used by the UI

Existing subscription reads in `businesses.myTier` should be refactored to:

- prefer account-level subscription state
- fall back to legacy business-level subscription state only if the account record is not yet fully migrated
- stop deriving subscription display from `currentBusiness`

### Business Creation Validation

Before any business is created:

1. resolve the caller's account
2. load the account subscription and current number of active businesses
3. compare usage against `maxBusinesses`
4. block the insert if the limit is exceeded

The server must return a structured error payload that includes:

- current plan
- business limit
- current business usage
- the next upgrade plan or plans that would allow the action
- a clear human-facing explanation

Example response shape:

```ts
{
  code: "SUBSCRIPTION_LIMIT_EXCEEDED",
  entity: "business",
  message: "Your current plan allows 1 business. Upgrade to Growth or Pro to add another business.",
  currentPlan: "starter",
  currentUsage: 1,
  currentLimit: 1,
  upgradeOptions: ["growth", "pro"]
}
```

### Location Creation Validation

Before a location is created:

1. resolve the parent business
2. resolve the owning account
3. load the account subscription
4. count active locations for the target business
5. compare usage against the plan's per-business `maxBranches`
6. block the insert if the limit is exceeded

The returned error payload should reuse the same structured shape as business creation, with `entity: "location"`.

### User Limits

Account-wide user creation should eventually validate against `maxUsers` on the account plan, even if that is not the first mutation updated in this refactor. The helper layer should be built to support the same pattern.

### Shared Enforcement Helpers

Centralize validation in shared subscription enforcement helpers so all entry points use the same logic:

- signup-created account and first business
- manual business creation
- location creation from any page or modal
- future user-creation or invite flows

These helpers should:

- resolve the account
- resolve the effective subscription state
- compute usage
- return structured upgrade metadata for UX

## UI Changes

### Subscription Page Consistency

The subscription/settings page must show the same subscription details regardless of selected business context. To achieve that:

- use an account-scoped subscription query instead of reading from the active business
- keep account-level plan details stable across business switching
- display business-specific usage only as supplementary context

### Upgrade Prompt UX

Business and location creation flows should:

- intercept structured subscription limit errors
- display a clear explanation of why creation was blocked
- show upgrade options that satisfy the requested action
- avoid generic "something went wrong" errors for subscription violations

## Migration Strategy

### Schema Migration

1. create the `accounts` table
2. add `accountRefId` foreign keys to `users` and `businesses`
3. backfill account rows from existing logical account identities
4. link users and businesses to their corresponding account row
5. preserve legacy business subscription fields during the transition

### Subscription Backfill

For each logical account:

1. gather all businesses belonging to the same existing `accountId`
2. inspect their business-level subscription states
3. choose the winning subscription using "most recent paid/trial state wins"
4. write the winning state onto the new account row
5. mark the account as migrated if needed for observability

### Historical Continuity

- do not delete legacy business subscription fields in the initial rollout
- keep them available for audit comparison and fallback reads
- all new plan, trial, downgrade, and reminder writes go to the account row only

### Rollout Mode

Dual-read, single-write:

- read account subscription first
- if account migration is incomplete, temporarily fall back to legacy business subscription fields
- write all new subscription changes only to `accounts`

This minimizes deployment risk while making the new model authoritative for future state changes.

## Subscription Lifecycle Updates

The existing trial lifecycle logic must be updated so that:

- new signups create an account-level Pro trial
- trial reminder state is tracked on the account
- downgrade-on-expiry without payment method happens at the account level
- paid activation after trial expiry happens at the account level
- payment method checks resolve account ownership, not business ownership

## Testing Plan

### Backend Tests

Add or update tests for:

- business creation allowed under plan capacity
- business creation blocked when `maxBusinesses` is reached
- location creation allowed while below per-business branch limit
- location creation blocked when branch limit is reached
- shared subscription state across multiple businesses in one account
- first-business signup flow under the new account model
- migration reconciliation where businesses under one account disagree on plan or trial state
- lifecycle reads preferring account-level state over legacy business state

### Frontend and API Contract Tests

Add or update tests for:

- subscription page showing identical subscription details after switching businesses
- upgrade prompt rendering specific actionable plan guidance
- structured limit errors remaining stable across business and location flows

### Migration Validation

Add deterministic migration fixtures covering:

- single-business free account
- multi-business paid account
- conflicting historical business subscriptions under one logical account
- accounts with active trials and payment methods

## Implementation Plan

### Phase 1: Data Model and Read Path

- add `accounts` table and relations
- backfill account rows and foreign keys
- add account-scoped subscription read helpers
- implement dual-read fallback logic

### Phase 2: Enforcement

- enforce account-level business limits
- enforce per-business location limits from account plan
- standardize structured upgrade errors

### Phase 3: UI Consistency

- move settings/subscription UI to account-scoped data
- update business and location creation flows to show structured upgrade prompts

### Phase 4: Migration Hardening

- validate backfill against fixtures
- add observability and rollout checks
- stop depending on legacy business subscription fields for normal reads once migration confidence is high

## Risks and Mitigations

- risk: inconsistent account linking during migration
  - mitigation: deterministic backfill keyed by `accountId`, plus migration validation tests
- risk: subscription UI shows mixed old/new data during rollout
  - mitigation: route all subscription page reads through one account-scoped query with explicit fallback behavior
- risk: hidden creation entry points bypass limits
  - mitigation: centralize all enforcement in shared server helpers instead of per-page UI checks
- risk: payment method scope mismatch
  - mitigation: explicitly bridge payment method ownership to the account during rollout and test both migrated and fallback cases

## Acceptance Criteria

- one account owns one canonical subscription regardless of business context
- business creation is blocked when the account exceeds its business limit
- location creation is blocked when a business exceeds the branch limit from the account plan
- users see the same subscription details while switching businesses
- migration preserves service continuity and historical comparison
- automated coverage exists for enforcement, multi-business behavior, and migration conflict handling
