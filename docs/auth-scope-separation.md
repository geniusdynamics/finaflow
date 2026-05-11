# Auth: Account vs Business Scope Separation

## Overview

The authentication system supports two scopes:

- **Account scope** (`customer_accounts` table): Top-level tenant. Represents an organization/individual who owns one or more businesses. Has its own subscription plan, limits, and features.
- **Business scope** (`businesses` table): Sub-tenant under an account. A business belongs to exactly one account via `businesses.accountRefId` -> `customer_accounts.id`.

## Key Relationships

```
customer_accounts (accountId, plan, maxUsers, ...)
  |
  +-- businesses (accountRefId -> customer_accounts.id, accountId)
  |     +-- users (via userBusinesses junction table)
  |
  +-- users (accountRefId -> customer_accounts.id, accountId)
```

## Dual-Key Lookup Pattern

Users can be linked to an account via **either**:
1. `users.accountId` (legacy string field, set during registration)
2. `users.accountRefId` (FK to `customer_accounts.id`, set during registration/backfill)

Both `login` and `register` procedures use `or()` queries to match against both fields:

```typescript
or(
  eq(users.accountId, accountId),
  eq(users.accountRefId, account?.id ?? -1),
)
```

This ensures that legacy users (backfilled with only `accountRefId`) and new users (who get both) can all authenticate.

## Auth Procedures

### `register(input)`
1. Normalizes `accountName` -> `accountId` (uppercase, strip non-alphanumeric)
2. Checks availability: queries `customer_accounts` by `accountId`
3. Within a DB transaction:
   - Creates `customer_accounts` row (if new)
   - Creates `user` with `accountId` + `accountRefId`
   - Creates `business` with `accountRefId`
   - Creates default location + 3 default accounts (cash, mpesa, bank)
   - Issues JWT + CSRF cookies
4. **Retry detection**: On duplicate, checks exact match (same username + email + password + account) and returns existing session instead of error

### `login(input)`
1. Looks up `customer_accounts` by `accountId`
2. Finds primary business for that account
3. Queries `users` by `username` matching **either** `accountId` OR `accountRefId`
4. Verifies password hash
5. Updates `lastSignInAt`, `currentBusinessId`
6. Issues JWT + CSRF cookies

### `checkAccountAvailability(input)`
Queries `customer_accounts` to determine if an account name is taken. Public endpoint (no auth required).

### `lookupAccount(input)`
Queries `customer_accounts` + joins to `businesses` to return business info and user list. Public endpoint.

### `seedDefaults()`
Creates the DEMO account ecosystem:
1. Creates/finds `customer_accounts` row for "DEMO"
2. Creates/finds `business` with `accountRefId` pointing to the DEMO account
3. Creates 5 demo users, each with `accountId: "DEMO"` and `accountRefId`

## Migration Path

The `0001_account_level_subscriptions.sql` migration:
1. Created `customer_accounts` table with `id`, `accountId`, `plan`, subscription fields
2. Added `accountRefId` FK columns to `users`, `businesses`, `payment_methods`
3. Backfilled `customer_accounts` from existing `businesses` subscription data
4. Set `accountRefId` on all existing `users` and `businesses`

## Key Files

| File | Purpose |
|------|---------|
| `api/local-auth-router.ts` | All auth procedures (login, register, lookup, availability, seedDefaults) |
| `db/schema.ts` | `customer_accounts`, `users`, `businesses` schema definitions |
| `db/migrations/0001_account_level_subscriptions.sql` | Migration creating `customer_accounts` and backfill |
| `api/lib/account-subscriptions.ts` | Subscription resolution with fallback chain |
| `api/lib/subscription-enforcement.ts` | Plan-based feature gating |
| `api/__tests__/local-auth-scope.test.ts` | 12 integration tests for scope separation |
| `api/__tests__/local-auth-registration.test.ts` | 5 integration tests for registration flow |
| `src/pages/Login.tsx` | Login/Registration frontend |

## Error Handling

- Availability check failures on the frontend show "Could not verify - will check when you register" instead of silently failing
- Login failures return generic "Invalid account ID or credentials" (no information leakage)
- Registration transactions fully roll back on any downstream failure
