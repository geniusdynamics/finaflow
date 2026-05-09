# Tasks — Audit Remediation Execution

## Task Dependencies

```
Phase 1 (Security + Financial Integrity)
├── T1: Install dependencies (bcrypt, decimal.js, rate-limit, helmet)
├── T2: Replace SHA-256 with bcrypt password hashing
│   └── T3 depends on T2 (password hashing must be in place)
├── T3: Fix PAYE deduction in processPayroll
│   └── T4 depends on T3 (tax calc must be correct first)
├── T4: Fix PAYE +1 systematic tax overcharge
├── T5: Standardize NHIF calculation to 2.75%
├── T6: Replace parseFloat with decimal.js everywhere
│   └── T7 depends on T6 (decimal types needed for transactions)
├── T7: Wrap all financial operations in db.transaction()
├── T8: Add rate limiting to all endpoints
├── T9: Migrate JWT from localStorage to httpOnly cookies
│   ├── T10 depends on T9 (new cookie-based auth needed)
│   └── T11 depends on T9 (CSRF needed for cookie auth)
├── T10: Fix OAuth state with cryptographic CSRF tokens
├── T11: Add CSRF protection middleware
├── T12: Fix daily-sales.list data leakage (tenant isolation)
├── T13: Fix env.ts to throw on missing vars
└── T14: Add security headers (CSP, HSTS, CORS, XFO)

Phase 2 (Testing + Quality)
├── T15: Add database indexes to all 48 tables
├── T16: Fix N+1 query patterns
├── T17: Set up test infrastructure (Vitest config, test DB, CI)
├── T18: Write unit tests for financial calculations
├── T19: Write integration tests for auth flows
├── T20: Write integration tests for account/financial operations
├── T21: Write end-to-end tests for critical user journeys
├── T22: Add React error boundaries
├── T23: Add frontend route guards
├── T24: Add pagination to all list endpoints
├── T25: Add connection pooling configuration

Phase 3 (Architecture + Polish)
├── T26: Extract shared utilities (hashPassword, decimal helpers)
├── T27: Add refresh token / session management
├── T28: Add graceful shutdown handler
├── T29: Add health endpoint
├── T30: Add loading skeletons to frontend pages
├── T31: Add lazy loading / code splitting
├── T32: Remove/extract hardcoded JWT fallback secret
├── T33: Fix Dockerfile (HEALTHCHECK, non-root user)
├── T34: Add audit logging for sensitive operations
├── T35: Add SEO meta tags to landing page
├── T36: Fix polymorphic FK orphan handling
├── T37: Set up CI/CD pipeline (GitHub Actions)
└── T38: Post-deployment verification & financial reconciliation
```

---

## T1: Install Required Dependencies

**Technical Specification:**
Add the following npm packages:
- `bcryptjs` (pure JS, no native compilation) — password hashing
- `decimal.js` — fixed-precision financial arithmetic
- `@hono/rate-limit` or `hono-rate-limiter` — API rate limiting
- `helmet` or Hono-equivalent security headers middleware
- `cookie-parser` equivalent for Hono cookie handling
- `@paralleldrive/cuid2` — CSRF token generation
- `@testing-library/react`, `@testing-library/jest-dom`, `msw` — test utilities

**Commands:**
```bash
npm install bcryptjs decimal.js @paralleldrive/cuid2
npm install -D @types/bcryptjs @testing-library/react @testing-library/jest-dom msw
```

**Deliverables:**
- Updated package.json and package-lock.json

---

## T2: Replace SHA-256 with bcrypt Password Hashing

**Technical Specification:**
- Create `/api/lib/password.ts` with `hashPassword(password: string): Promise<string>` and `verifyPassword(password: string, hash: string): Promise<boolean>` using bcryptjs with cost factor 12
- Update `local-auth-router.ts` to import and use the new functions
- Update `users-router.ts` to import and use the new functions
- Remove the old duplicate `hashPassword` function from both routers
- Add a `POST /auth/migrate-password` endpoint that accepts old SHA-256 hash + new password, re-hashes with bcrypt (for smooth migration)

**Maintainability Checklist:**
- [ ] Single source of truth: only one `password.ts` utility
- [ ] Configurable cost factor via env var `BCRYPT_ROUNDS` (default 12)
- [ ] All existing password hashing code removed

**LTS Plan:**
- bcryptjs v2.x maintains backward compat for existing hashes
- If moving to native bcrypt later, verify hash format compatibility
- Rollback: keep SHA-256 verify fallback for 30-day migration window

**Infrastructure Impact:**
- bcrypt is CPU-intensive at cost 12 — expect ~250ms per hash on modern hardware
- Registration and login endpoints will be ~200ms slower
- No additional server resources required

**Implementation Steps:**
1. Create `/api/lib/password.ts`
2. Update `local-auth-router.ts` — replace hashPassword, signup, login, changePassword
3. Update `users-router.ts` — replace hashPassword in create/update user
4. Verify `npm test` passes
5. Update seed files to use bcrypt hashes

**Deliverables:**
- `/api/lib/password.ts` — bcrypt hash + verify utilities
- Updated `local-auth-router.ts`
- Updated `users-router.ts`
- Updated `db/seed.ts` and `db/seed-demo.cjs`

---

## T3: Fix PAYE Deduction in processPayroll

**Technical Specification:**
- Import `computePaye` from `payroll-settings-router.ts` (or extract to shared utility)
- In `employees-payroll-router.ts`, modify the payroll loop to:
  1. Compute PAYE using `computePaye(basicPay)`
  2. Deduct PAYE from netPay: `netPay = Math.max(0, basicPay - advanceDeduction - nssf - nhif - paye)`
  3. Store the PAYE amount in a new `payeDeducted` column in payroll_entries (add via migration)
- Add a migration to add `paye_deducted` DECIMAL(15,2) DEFAULT 0 column to payroll_entries

**Maintainability Checklist:**
- [ ] computePaye extracted to shared location (not just imported from another router)
- [ ] Payroll entry tracks paye_deducted for records
- [ ] Existing payroll_entries get paye_deducted = 0 (backward compat)

**LTS Plan:**
- KRA tax bands change annually — make bands configurable via a payroll_settings table field
- Add deprecation warning for hardcoded bands after next KRA update

**Infrastructure Impact:**
- Minor: adds one column to payroll_entries table
- Negligible performance impact

**Implementation Steps:**
1. Extract `computePaye` to `/api/lib/tax.ts`
2. Add migration for `paye_deducted` column
3. Modify `processPayroll` mutation
4. Verify with test

**Deliverables:**
- `/api/lib/tax.ts` — shared tax calculation utilities
- Database migration for new column
- Updated `employees-payroll-router.ts`

---

## T4: Fix PAYE +1 Systematic Tax Overcharge

**Technical Specification:**
In `/api/lib/tax.ts` (extracted from payroll-settings-router.ts):
- Change band size calculation from `bandMax - band.min + (band.min === 0 ? 1 : 0)` to `bandMax - band.min`
- Verify the correct tax for each band:
  - Band 1 (0 — 24,000): tax = 0 (correct, already exempt)
  - Band 2 (24,001 — 32,333): band size = 8,333, tax = 8,333 × 0.10
  - Band 3 (32,334 — 420,000): band size = 387,667, tax = 387,667 × 0.25
  - etc.
- Add a unit test that verifies known salary amounts produce correct tax

**Maintainability Checklist:**
- [ ] Tax bands defined as a typed constant, not inline
- [ ] Test cases for every band boundary

**LTS Plan:**
- Tax bands configurable via admin settings (future)
- Add Rollback: previous computePaye function renamed to `computePayeLegacy` for 30-day comparison

**Infrastructure Impact:**
- None — pure calculation change

**Implementation Steps:**
1. Fix band size formula
2. Add unit tests
3. Verify payroll calculations

**Deliverables:**
- Updated `/api/lib/tax.ts`

---

## T5: Standardize NHIF Calculation to 2.75%

**Technical Specification:**
- In `/api/lib/tax.ts`, add a `computeNhif(grossPay: number): number` function using 2.75%
- Update `employees-payroll-router.ts` to use the shared `computeNhif` instead of the bracket table
- Update `payroll-settings-router.ts` to use the shared `computeNhif`
- Remove the bracket-table implementation

**Maintainability Checklist:**
- [ ] Single NHIF/SHIF computation function
- [ ] Rate configurable via env var `NHIF_RATE` (default 2.75)

**LTS Plan:**
- SHIF rate changed from NHIF in 2024 — keep rate configurable
- Monitor for official rate changes

**Implementation Steps:**
1. Add computeNhif to `/api/lib/tax.ts`
2. Update both payroll routers
3. Add tests

**Deliverables:**
- Updated `/api/lib/tax.ts`
- Updated `employees-payroll-router.ts`
- Updated `payroll-settings-router.ts`

---

## T6: Replace parseFloat with decimal.js

**Technical Specification:**
- Create `/api/lib/decimal.ts` with:
  ```typescript
  import Decimal from 'decimal.js';
  Decimal.set({ precision: 15, rounding: Decimal.ROUND_HALF_UP });
  export const d = (value: number | string | Decimal) => new Decimal(value);
  export { Decimal };
  ```
- Replace all `parseFloat(x)` with `d(x).toNumber()` — but more importantly, chain decimal operations:
  ```typescript
  // BEFORE
  const total = parseFloat(a) + parseFloat(b);
  // AFTER
  const total = d(a).plus(b).toNumber();
  ```
- Update these routers (in order):
  1. accounts-router.ts (transfers, balance calculations)
  2. daily-sales-router.ts (totals, payments)
  3. expenses-router.ts (totals)
  4. employees-payroll-router.ts (gross, deductions, net)
  5. payroll-settings-router.ts (tax computation)
  6. bills-router.ts (amounts, payments)
  7. reports-router.ts (P&L, cashflow)
  8. dashboard-router.ts (summaries)

**Maintainability Checklist:**
- [ ] No `parseFloat` remains in any financial calculation
- [ ] All decimal operations chain using Decimal methods, not operators

**LTS Plan:**
- decimal.js v10+ has different API — pin to v10.x and plan upgrade
- Rollback: git revert on router files, keep decimal.ts utility for future use
- No backward compatibility impact — all amounts remain DECIMAL(15,2) in DB

**Infrastructure Impact:**
- Decimal arithmetic is ~3-5x slower than native float — negligible at this scale
- No additional memory or storage

**Implementation Steps:**
1. Create `/api/lib/decimal.ts`
2. Update each router one at a time
3. Run tests after each

**Deliverables:**
- `/api/lib/decimal.ts`
- Updated financial routers

---

## T7: Wrap Financial Operations in db.transaction()

**Technical Specification:**
Use Drizzle's transaction API:
```typescript
import { db } from '../queries/connection';

await db.transaction(async (tx) => {
  await tx.insert(ledgerEntries).values({...});
  await tx.update(accounts).set({...});
});
```
- Update these operations (at minimum):
  1. accounts-router.ts: transfer, create (with initial balance)
  2. daily-sales-router.ts: create (with ledger entries), delete (with reversal)
  3. expenses-router.ts: create, delete
  4. payroll-router.ts: processPayroll
  5. bills-router.ts: pay, create
  6. dashboard-router.ts: resetAllTransactions

**Maintainability Checklist:**
- [ ] Every multi-table write uses `db.transaction()`
- [ ] Read operations remain outside transactions
- [ ] Transactions use `tx` parameter, not top-level `db`

**LTS Plan:**
- Drizzle transaction API is stable and signed for future versions
- If migrating to Prisma, transaction API differs — account in migration plan

**Infrastructure Impact:**
- Transactions hold DB row locks longer — monitor for deadlocks under high concurrency
- No server resource changes needed

**Deliverables:**
- Updated financial routers with transaction-wrapped operations

---

## T8: Add Rate Limiting

**Technical Specification:**
- Install `@hono-rate-limiter` and `hono-rate-limiter`
- Create `/api/lib/rate-limit.ts`:
  ```typescript
  import { rateLimiter } from 'hono-rate-limiter';
  
  export const loginLimiter = rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,              // 10 attempts
    standardHeaders: true,
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
  });
  
  export const apiLimiter = rateLimiter({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
  });
  ```
- Apply `loginLimiter` to `/auth/login` and `/auth/signup` routes
- Apply `apiLimiter` to all other routes
- Return 429 with `Retry-After` header

**Maintainability Checklist:**
- [ ] Rate limit configurable via env vars (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_LOGIN, RATE_LIMIT_MAX_API)
- [ ] 429 responses include informative error messages
- [ ] IP-based key generation handles proxy headers

**LTS Plan:**
- For multi-instance deployment, migrate to Redis-backed rate limiting
- Current in-memory works for single instance

**Infrastructure Impact:**
- Negligible memory: in-memory store uses ~1KB per active IP
- No additional infrastructure needed

**Deliverables:**
- `/api/lib/rate-limit.ts`
- Updated `local-auth-router.ts` (applied rate limiter)
- Updated `boot.ts` (applied global rate limiter)

---

## T9: Migrate JWT from localStorage to httpOnly Cookies

**Technical Specification:**
- On login/signup, set JWT as a cookie instead of returning in response body:
  ```typescript
  c.res.headers.append('Set-Cookie', serialize('finaflow_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }));
  ```
- Update `/api/context.ts` to read JWT from cookie instead of Authorization header
- Update `/src/providers/trpc.tsx` to remove localStorage read
- Update `/src/pages/Login.tsx` to remove localStorage write
- Add CSRF token generation and validation:
  - On login, generate a CSRF token, store in separate cookie (non-httpOnly), return in response body
  - All mutation requests include `x-csrf-token` header

**Maintainability Checklist:**
- [ ] No localStorage reads for auth tokens
- [ ] Cookie options properly configured per environment
- [ ] CSRF token rotation on each request (or at minimum on login)

**LTS Plan:**
- Cookie size limited to 4KB — token must stay small
- JWT already small, no issue
- Rollback: keep localStorage write for 30 days, checked as fallback

**Infrastructure Impact:**
- No server changes needed
- CSRF adds minimal overhead

**Deliverables:**
- Updated `/api/context.ts`
- Updated `/api/local-auth-router.ts`
- Updated `/src/providers/trpc.tsx`
- Updated `/src/pages/Login.tsx`
- CSRF middleware in `/api/lib/csrf.ts`

---

## T10: Fix OAuth State — Cryptographic CSRF Tokens

**Technical Specification:**
- In `/api/kimi/auth.ts`:
  1. Generate state using `crypto.randomUUID()` or `@paralleldrive/cuid2`
  2. Store state in an httpOnly cookie: `serialize('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })`
  3. On callback, read cookie, compare to state param, delete cookie
  4. If mismatch, return 401
- Remove the `atob(state)` redirect URI decode (redirect URI stored separately or passed via session)

**Maintainability Checklist:**
- [ ] OAuth state is a cryptographic random value
- [ ] State cookie is short-lived (10 minutes)
- [ ] State is single-use (deleted after verification)

**LTS Plan:**
- If adding more OAuth providers, implement state in a reusable middleware
- PKCE flow for public clients (future)

**Infrastructure Impact:**
- None

**Deliverables:**
- Updated `/api/kimi/auth.ts`

---

## T11: Add CSRF Protection Middleware

**Technical Specification:**
- Create `/api/lib/csrf.ts`:
  ```typescript
  export const csrfProtection = async (c: Context, next: Next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }
    const csrfCookie = c.req.header('cookie')?.match(/csrf_token=([^;]+)/)?.[1];
    const csrfHeader = c.req.header('x-csrf-token');
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return c.json({ error: 'CSRF token mismatch' }, 403);
    }
    return next();
  };
  ```
- Apply as global middleware in boot.ts (after CORS, before routes)
- On login, set CSRF token cookie (non-httpOnly) and return in response body
- Frontend reads CSRF token from response body and sends as `x-csrf-token` header

**Maintainability Checklist:**
- [ ] CSRF uses double-submit cookie pattern
- [ ] Excluded for GET/HEAD/OPTIONS
- [ ] Token rotated on login

**LTS Plan:**
- If using SameSite=Strict everywhere, CSRF may be redundant — but defense-in-depth
- No upgrade concerns

**Deliverables:**
- `/api/lib/csrf.ts`
- Updated `local-auth-router.ts` (set CSRF token on login)
- Updated `boot.ts` (apply middleware)
- Updated frontend tRPC client (send CSRF header)

---

## T12: Fix daily-sales.list Data Leakage (Tenant Isolation)

**Technical Specification:**
- Update `daily-sales-router.ts` `list` procedure to filter by location:
  ```typescript
  list: salesQuery
    .input(z.object({
      locationId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const locationIds = input?.locationId 
        ? [input.locationId] 
        : await getCurrentBusinessLocationIds(ctx);
      const conditions = [
        inArray(dailySales.locationId, locationIds),
        isNull(dailySales.deletedAt),
      ];
      // ... date filters if provided
    });
  ```
- Apply similar tenant isolation to all other `list` endpoints

**Maintainability Checklist:**
- [ ] Every list endpoint enforces location/business scope
- [ ] Default (no input) uses current user's locations

**LTS Plan:**
- If RBAC is extended to cross-location access, add explicit permission check
- No backward compat break — API now requires fewer permissions

**Deliverables:**
- Updated `daily-sales-router.ts`
- Audit of all other list endpoints

---

## T13: Fix env.ts to Throw on Missing Vars

**Technical Specification:**
- Update `/api/lib/env.ts`:
  ```typescript
  function required(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }
  ```
- Remove the `NODE_ENV === "production"` condition

**Maintainability Checklist:**
- [ ] All env vars fail fast at startup
- [ ] Error message includes the var name

**LTS Plan:**
- If adding .env file loading, validate after load

**Deliverables:**
- Updated `/api/lib/env.ts`

---

## T14: Add Security Headers

**Technical Specification:**
- Create `/api/lib/security-headers.ts`:
  ```typescript
  export const securityHeaders = async (c: Context, next: Next) => {
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('X-Frame-Options', 'DENY');
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    await next();
  };
  ```
- Apply as global middleware in boot.ts
- Configure CORS properly (not open):
  ```typescript
  app.use('*', cors({
    origin: env.appUrl || 'http://localhost:5173',
    credentials: true,
  }));
  ```

**Maintainability Checklist:**
- [ ] CSP policy reviewed for all app resources
- [ ] CORS origin list configurable via env var

**LTS Plan:**
- CSP may need updates as new resources (CDN, fonts, analytics) are added
- Monitor CSP reports if report-uri is configured

**Deliverables:**
- `/api/lib/security-headers.ts`
- Updated `boot.ts`

---

## T15: Add Database Indexes

**Technical Specification:**
- Add Drizzle indexes in `db/schema.ts` for all 48 tables:
  - `locationId` index on: daily_sales, expenses, accounts, employees, payroll_periods, etc.
  - `businessId` index on: businesses, user_businesses, locations
  - `userId` index on: users, user_businesses, audit_log, notifications
  - `deletedAt` index on: all soft-delete tables
  - `status` index on: bills, payroll_advances, purchase_orders
  - Composite indexes: `(locationId, saleDate)`, `(locationId, deletedAt)`, `(businessId, userId)`
- Create migration for indexes

**Maintainability Checklist:**
- [ ] Every foreign key column has an index
- [ ] Every WHERE clause column has appropriate index
- [ ] Composite indexes match common query patterns

**LTS Plan:**
- Monitor slow query log post-deployment; add missing indexes as needed
- Index maintenance: periodic REBUILD for heavily written tables

**Infrastructure Impact:**
- Indexes increase insert/update time by ~10-20%
- Storage increase: ~50-100MB per 1M rows per index
- Query performance improvement: 10x-1000x for filtered queries

**Deliverables:**
- Updated `db/schema.ts` with index definitions
- Drizzle migration file

---

## T16: Fix N+1 Query Patterns

**Technical Specification:**
- In `daily-sales-router.ts`:
  ```typescript
  // BEFORE (N+1)
  const result = [];
  for (const sale of sales) {
    const payments = await db.select().from(dailySalePayments)
      .where(eq(dailySalePayments.dailySaleId, sale.id));
    result.push({ ...sale, payments });
  }
  
  // AFTER (batch-load)
  const saleIds = sales.map(s => s.id);
  const allPayments = await db.select().from(dailySalePayments)
    .where(inArray(dailySalePayments.dailySaleId, saleIds));
  const paymentsBySaleId = new Map(
    allPayments.map(p => [p.dailySaleId, p])
  );
  const result = sales.map(sale => ({
    ...sale,
    payments: paymentsBySaleId.get(sale.id) || [],
  }));
  ```
- Audit all routers for similar patterns (employees, bills, expenses)

**Maintainability Checklist:**
- [ ] No sequential DB queries inside loops
- [ ] Batch loading used for all 1:N relations

**LTS Plan:**
- If using Drizzle relations, consider `.with()` or `.leftJoin()` for single-query loading

**Deliverables:**
- Updated `daily-sales-router.ts`
- Updated other routers as found

---

## T17: Set up Test Infrastructure

**Technical Specification:**
- Update `vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['api/**/*.test.ts', 'api/**/*.test.tsx'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['api/**/*.ts'],
        exclude: ['api/**/*.test.ts', 'api/**/*.test.tsx'],
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      setupFiles: ['api/test/setup.ts'],
    },
  });
  ```
- Create `api/test/setup.ts` with test helpers, mock DB
- Create `api/test/db.ts` with test database configuration (SQLite or isolated MySQL)
- Add npm scripts: `test`, `test:coverage`, `test:watch`
- Set up GitHub Actions workflow `.github/workflows/test.yml`

**Maintainability Checklist:**
- [ ] Test database isolated from production
- [ ] Coverage thresholds enforced in CI
- [ ] Setup/teardown properly handles test isolation

**Infrastructure Impact:**
- CI runner needs MySQL service or Docker container for test DB
- ~2-5 minutes added to CI pipeline

**Deliverables:**
- Updated `vitest.config.ts`
- `api/test/setup.ts`
- `api/test/db.ts`
- `.github/workflows/test.yml`

---

## T18: Unit Tests — Financial Calculations

**Technical Specification:**
Write tests for `/api/lib/tax.ts`:
```typescript
describe('PAYE Calculation', () => {
  it('should return 0 for income below 24,000', () => {
    expect(computePaye(20000)).toBe(0);
  });
  it('should calculate PAYE for 50,000 correctly', () => {
    // Band 2: 24001-32333 = 8333 * 0.10 = 833.3
    // Band 3: 32334-50000 = 17666 * 0.25 = 4416.5
    // Total: 833.3 + 4416.5 = 5249.8
    expect(computePaye(50000)).toBeCloseTo(5249.8, 1);
  });
  // More test cases for all bands
});

describe('NHIF Calculation', () => {
  it('should calculate 2.75% of gross pay', () => {
    expect(computeNhif(50000)).toBeCloseTo(1375, 1);
  });
});
```

Write tests for `/api/lib/decimal.ts` utilities.

**Deliverables:**
- `api/lib/__tests__/tax.test.ts`
- `api/lib/__tests__/decimal.test.ts`

---

## T19: Integration Tests — Auth Flows

**Technical Specification:**
Write tests for auth endpoints:
```typescript
describe('Auth Flow', () => {
  it('should signup a new user', async () => { /* ... */ });
  it('should login with correct credentials', async () => { /* ... */ });
  it('should reject login with wrong password', async () => { /* ... */ });
  it('should reject duplicate email signup', async () => { /* ... */ });
  it('should reject weak passwords (< 8 chars)', async () => { /* ... */ });
  it('should return rate limit error after 10 login attempts', async () => { /* ... */ });
  it('should verify JWT cookie is httpOnly', async () => { /* ... */ });
  it('should reject requests with invalid CSRF token', async () => { /* ... */ });
});
```

**Deliverables:**
- `api/__tests__/auth.test.ts`

---

## T20: Integration Tests — Financial Operations

**Technical Specification:**
Write tests for account transfers:
```typescript
describe('Account Transfer', () => {
  it('should complete transfer atomically', async () => { /* ... */ });
  it('should rollback on failure', async () => { /* ... */ });
  it('should reject insufficient funds', async () => { /* ... */ });
  it('should reject transfer to same account', async () => { /* ... */ });
  it('should process payroll with all deductions', async () => { /* ... */ });
});
```

**Deliverables:**
- `api/__tests__/accounts.test.ts`
- `api/__tests__/payroll.test.ts`

---

## T21: End-to-End Tests — Critical Journeys

**Technical Specification:**
Install Playwright or use Vitest with MSW:
```typescript
describe('User Journey', () => {
  it('should complete full sales cycle: login → record sale → view report', async () => { /* ... */ });
  it('should complete payroll cycle: add employee → process payroll → verify deductions', async () => { /* ... */ });
  it('should complete bill management: create bill → pay bill → verify ledger', async () => { /* ... */ });
});
```

**Deliverables:**
- `e2e/__tests__/sales-cycle.test.ts`
- `e2e/__tests__/payroll-cycle.test.ts`
- `e2e/__tests__/bills-cycle.test.ts`

---

## T22: Add React Error Boundaries

**Technical Specification:**
- Create `/src/components/ErrorBoundary.tsx`:
  ```typescript
  class ErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback?: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
      console.error('ErrorBoundary caught:', error, info);
    }
    render() {
      if (this.state.hasError) {
        return this.props.fallback || <DefaultFallback error={this.state.error} />;
      }
      return this.props.children;
    }
  }
  ```
- Wrap route groups in App.tsx:
  ```typescript
  <ErrorBoundary>
    <Route path="/" element={<Home />} />
  </ErrorBoundary>
  <ErrorBoundary>
    <Route path="/dashboard/*" element={<DashboardLayout />} />
  </ErrorBoundary>
  ```

**Deliverables:**
- `/src/components/ErrorBoundary.tsx`
- Updated `src/App.tsx`

---

## T23: Add Frontend Route Guards

**Technical Specification:**
- Create `/src/components/ProtectedRoute.tsx`:
  ```typescript
  function ProtectedRoute({ children, requiredPermission }: Props) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      return <Navigate to="/unauthorized" replace />;
    }
    return children;
  }
  ```
- Wire AuthLayout into App.tsx routes
- Wrap protected routes:
  ```typescript
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <AuthLayout>
        <Outlet />
      </AuthLayout>
    </ProtectedRoute>
  }>
    <Route path="sales" element={<DailySales />} />
    <Route path="payroll" element={<Payroll />} />
  </Route>
  ```

**Deliverables:**
- `/src/components/ProtectedRoute.tsx`
- Updated `src/App.tsx`
- `src/hooks/useAuth.ts` (if not existing)

---

## T24: Add Pagination to All List Endpoints

**Technical Specification:**
- Create `/api/lib/pagination.ts`:
  ```typescript
  export const paginationInput = z.object({
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(20),
  });
  
  export async function paginatedQuery<T>(
    db: any,
    query: any,
    input: { offset: number; limit: number },
  ): Promise<{ data: T[]; total: number; offset: number; limit: number }> {
    const [data, countResult] = await Promise.all([
      query.limit(input.limit).offset(input.offset),
      db.select({ count: sql<number>`count(*)` }).from(query.from),
    ]);
    return { data, total: Number(countResult[0].count), offset: input.offset, limit: input.limit };
  }
  ```
- Update all list endpoints to accept pagination input and return paginated response

**Deliverables:**
- `/api/lib/pagination.ts`
- Updated list endpoints

---

## T25: Add Connection Pooling Configuration

**Technical Specification:**
- Update `/api/queries/connection.ts`:
  ```typescript
  import { drizzle } from 'drizzle-orm/mysql2';
  import mysql from 'mysql2/promise';
  
  const pool = mysql.createPool({
    uri: env.databaseUrl,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  
  export const db = drizzle(pool);
  ```

**Deliverables:**
- Updated `/api/queries/connection.ts`

---

## T26: Extract Shared Utilities

**Technical Specification:**
- Create `/api/lib/password.ts` (already done in T2)
- Create `/api/lib/tax.ts` (already done in T3/T4/T5)
- Create `/api/lib/decimal.ts` (already done in T6)
- Create `/api/lib/pagination.ts` (already done in T24)
- Remove duplicate `hashPassword` from all routers
- Remove inline PAYE/NHIF from routers

**Deliverables:**
- Clean, deduplicated utility files
- Updated routers

---

## T27: Add Refresh Token / Session Management

**Technical Specification:**
- Create `refresh_tokens` table: id, userId, tokenHash, expiresAt, deviceInfo, createdAt
- On login, generate JWT (short-lived: 15 min) + refresh token (long-lived: 7 days)
- JWT uses access + refresh pattern:
  - Access token: 15 min, signed with appSecret
  - Refresh token: 7 days, stored as hash in DB
- Add `/auth/refresh` endpoint:
  1. Validate refresh token (check hash)
  2. Issue new access token + refresh token (rotate)
  3. Invalidate old refresh token
- Add `/auth/logout` endpoint to invalidate refresh tokens
- Add `/auth/logout-all` to invalidate all user sessions

**Deliverables:**
- DB migration for refresh_tokens table
- Updated auth routers
- New auth endpoints

---

## T28: Add Graceful Shutdown

**Technical Specification:**
- Update `boot.ts`:
  ```typescript
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await pool.end(); // close DB pool
      console.log('Server shut down');
      process.exit(0);
    });
    // Force shutdown after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  ```

**Deliverables:**
- Updated `boot.ts`

---

## T29: Add Health Endpoint

**Technical Specification:**
- Add `GET /health` route in boot.ts:
  ```typescript
  app.get('/health', async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
    } catch (e) {
      return c.json({ status: 'unhealthy', error: String(e) }, 503);
    }
  });
  ```

**Deliverables:**
- Updated `boot.ts`

---

## T30: Add Loading Skeletons to Frontend Pages

**Technical Specification:**
- Create `/src/components/Skeleton.tsx` (shadcn/ui pattern):
  ```typescript
  function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
  }
  ```
- Create page-specific skeletons: `SalesTableSkeleton`, `DashboardSkeleton`, `PayrollSkeleton`
- Add to each page's loading state

**Deliverables:**
- `/src/components/Skeleton.tsx`
- Updated page components

---

## T31: Add Lazy Loading / Code Splitting

**Technical Specification:**
- Update `App.tsx`:
  ```typescript
  import { lazy, Suspense } from 'react';
  
  const Home = lazy(() => import('./pages/Home'));
  const DailySales = lazy(() => import('./pages/DailySales'));
  const Payroll = lazy(() => import('./pages/Payroll'));
  // ... etc
  
  function App() {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          ...
        </Routes>
      </Suspense>
    );
  }
  ```

**Deliverables:**
- Updated `src/App.tsx`

---

## T32: Remove/Extract Hardcoded JWT Fallback Secret

**Technical Specification:**
- In `local-auth-router.ts`, remove `env.appSecret || "finaflow-local-auth-secret-key-2025"`
- Change to: `const JWT_SECRET = new TextEncoder().encode(env.appSecret);`
- Update kimi/session.ts similarly
- Ensure env.ts throws if API_SECRET missing

**Deliverables:**
- Updated `local-auth-router.ts`
- Updated `kimi/session.ts`

---

## T33: Fix Dockerfile

**Technical Specification:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 finaflow
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./
USER finaflow

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

**Deliverables:**
- Updated `Dockerfile`

---

## T34: Add Audit Logging for Sensitive Operations

**Technical Specification:**
- Create `/api/lib/audit.ts`:
  ```typescript
  export async function logAudit(params: {
    userId: string;
    businessId: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ip?: string;
  }) {
    await db.insert(auditLog).values({
      id: generateId(),
      userId: params.userId,
      businessId: params.businessId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ip,
      createdAt: new Date(),
    });
  }
  ```
- Add audit calls to: password changes, user creation, role changes, financial adjustments, account transfers

**Deliverables:**
- `/api/lib/audit.ts`
- Updated routers with audit calls

---

## T35: Add SEO Meta Tags to Landing Page

**Technical Specification:**
- Update `src/pages/Home.tsx`:
  ```typescript
  import { Helmet } from 'react-helmet-async';
  
  function Home() {
    return (
      <>
        <Helmet>
          <title>Finaflow — Business Financial Tracking Platform</title>
          <meta name="description" content="Finaflow helps businesses track cashflow, manage payroll, process bills, and generate financial reports in real-time." />
          <meta property="og:title" content="Finaflow — Financial Tracking for Kenyan Businesses" />
          <meta property="og:description" content="Comprehensive business financial management platform with M-PESA integration, payroll, and reporting." />
          <meta property="og:type" content="website" />
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Finaflow",
              "applicationCategory": "BusinessApplication",
            })}
          </script>
        </Helmet>
        {/* existing content */}
      </>
    );
  }
  ```
- Install `react-helmet-async`

**Deliverables:**
- Updated `Home.tsx`
- `react-helmet-async` added to dependencies

---

## T36: Fix Polymorphic FK Orphan Handling

**Technical Specification:**
- For `attachments`, `audit_log`, `quick_actions_log`, `notifications` tables:
  1. Add ON DELETE CASCADE via Drizzle hooks or application-level cleanup
  2. Add cleanup jobs that run periodically to remove orphaned records
  3. Add composite indexes on `(recordType, recordId)` for each polymorphic table

**Deliverables:**
- Updated schema with cleanup logic
- DB migration for indexes

---

## T37: Set up CI/CD Pipeline (GitHub Actions)

**Technical Specification:**
- Create `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: npm ci
        - run: npm run lint
    test:
      runs-on: ubuntu-latest
      services:
        mysql:
          image: mysql:8
          env:
            MYSQL_ROOT_PASSWORD: test
            MYSQL_DATABASE: finaflow_test
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: npm ci
        - run: npm run test
    deploy:
      if: github.ref == 'refs/heads/main'
      needs: [lint, test]
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: npm ci && npm run build
        # deployment steps (docker push, etc.)
  ```

**Deliverables:**
- `.github/workflows/ci.yml`

---

## T38: Post-Deployment Verification & Financial Reconciliation

**Technical Specification:**
1. Run smoke test suite against production
2. Run financial reconciliation:
   - Compare all account balances against ledger entry sums
   - Verify PAYE deductions match computed values for last 3 payroll runs
   - Verify NHIF deductions match 2.75% for last 3 payroll runs
   - Spot-check decimal.js vs parseFloat differences (should be negligible)
3. Run security scan:
   - Verify no localStorage tokens exist
   - Verify security headers present
   - Verify rate limiting active
   - Verify CSRF protection active
4. Generate verification report

**Deliverables:**
- `post-deployment-verification.md` — verification report
