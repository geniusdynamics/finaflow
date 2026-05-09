# Audit Remediation Execution Spec

## Why
The Finaflow platform has been comprehensively audited across 20 dimensions yielding 31 findings (8 CRITICAL, 10 HIGH, 8 MEDIUM, 5 LOW). The application is functionally complete but unsafe for production — suffering from critical security vulnerabilities (SHA-256 password hashing, localStorage JWT, no rate limiting), systemic financial calculation bugs (PAYE not deducted, no decimal library, no transactions), zero test coverage, and severe architectural debt. This spec drives end-to-end remediation.

## What Changes
- Replace SHA-256 password hashing with bcrypt (per-user salts)
- Wrap all multi-step financial operations in database transactions
- Replace parseFloat with decimal.js across all financial routers
- Fix PAYE deduction in processPayroll (call computePaye)
- Add unit/integration/e2e test suites with Vitest, minimum 80% coverage
- Migrate JWT storage from localStorage to httpOnly cookies with CSRF
- Add rate limiting to all API endpoints (login brute-force, general DoS)
- Add location/business filter to daily-sales.list endpoint
- Fix PAYE +1 systematic tax overcharge bug
- Add React error boundaries to all route sections
- Fix N+1 query patterns (batch-load with IN clauses)
- Add database indexes to all 48 tables
- Add security headers (CSP, HSTS, CORS, XFO, XCTO)
- Fix OAuth state to use cryptographic CSRF tokens
- Add frontend route guards (auth check, redirect)
- Fix env.ts to throw on missing vars in all environments
- Standardize NHIF calculation across payroll routers
- Add refresh token mechanism for local auth sessions
- Add graceful shutdown handler to Hono server
- Add pagination to all list endpoints
- Add connection pooling configuration
- Add loading skeletons to all frontend pages
- Remove/extract hardcoded JWT fallback secret
- Fix Dockerfile (HEALTHCHECK, non-root user)
- Add audit logging for sensitive operations
- Extract shared utilities (hashPassword, financial helpers)
- Add SEO meta tags to landing page
- Add health endpoint to server
- Add lazy loading / code splitting to React routes
- Fix polymorphic FK orphan handling
- Add CI/CD pipeline (GitHub Actions)

## Impact
- Affected specs: Security, Authentication, Financial Calculations, Database Schema, API Design, Frontend Architecture, Testing, Deployment, DevOps
- Affected code: All 28 tRPC routers, db/schema.ts, all frontend pages, Dockerfile, vite/vitest configs, CI/CD pipeline
- **BREAKING**: JWT storage migration (localStorage → httpOnly cookies) requires all active sessions to re-authenticate
- **BREAKING**: decimal.js migration may cause minor rounding differences vs parseFloat — all financial records should be reconciled post-deployment
- **BREAKING**: bcrypt password re-hashing — all existing passwords invalidated, users must reset via "forgot password" flow
- **BREAKING**: Pagination added to all list endpoints — API consumers must update to pass offset/limit

## ADDED Requirements

### Requirement: Password Hashing with bcrypt
The system SHALL hash passwords using bcrypt with a per-user randomly generated salt and configurable cost factor (minimum 10 rounds).

#### Scenario: User registration hashes password
- **WHEN** a user registers with a password
- **THEN** the password is hashed using bcrypt with a unique per-user salt

#### Scenario: Login verifies bcrypt hash
- **WHEN** a user attempts login
- **THEN** the system retrieves the stored bcrypt hash and verifies the candidate password

### Requirement: Database Transaction Wrapping
All multi-step financial operations SHALL be wrapped in Drizzle `db.transaction()` calls.

#### Scenario: Account transfer atomicity
- **WHEN** funds are transferred between accounts
- **THEN** the debit and credit operations occur within a single database transaction

#### Scenario: Payroll processing atomicity
- **WHEN** payroll is processed for multiple employees
- **THEN** all payroll entries are created within a single transaction

### Requirement: Fixed-Precision Decimal Arithmetic
All financial calculations SHALL use `decimal.js` with precision 15 and rounding mode ROUND_HALF_UP.

#### Scenario: Sales total calculation
- **WHEN** calculating sale totals with multiple line items
- **THEN** decimal.js arithmetic is used instead of parseFloat

### Requirement: PAYE Withholding in Payroll
The processPayroll function SHALL call computePaye() and deduct the computed tax from employee net pay.

#### Scenario: Payroll run withholds PAYE
- **WHEN** payroll is processed
- **THEN** PAYE is computed and deducted for each employee

### Requirement: Test Coverage ≥ 80%
The codebase SHALL have unit, integration, and end-to-end tests with minimum 80% line coverage.

#### Scenario: Financial calculation tests
- **WHEN** PAYE, NSSF, NHIF calculations are tested
- **THEN** they produce correct results for all tax bands

### Requirement: httpOnly Cookie JWT Storage
JWT tokens SHALL be stored in httpOnly, Secure, SameSite=Strict cookies with CSRF token protection.

#### Scenario: Login sets httpOnly cookie
- **WHEN** a user logs in successfully
- **THEN** the JWT is set as an httpOnly cookie

### Requirement: Rate Limiting
All API endpoints SHALL have rate limiting: 10 requests/minute for login, 100 requests/minute for general endpoints.

#### Scenario: Login brute force blocked
- **WHEN** more than 10 login attempts occur in one minute
- **THEN** the endpoint returns 429 Too Many Requests

### Requirement: Tenant Data Isolation
All list endpoints SHALL filter by current business/location context using getCurrentBusinessLocationIds().

#### Scenario: Daily sales list filtered
- **WHEN** a user lists daily sales
- **THEN** only sales belonging to their current location are returned

### Requirement: React Error Boundaries
Every route section SHALL be wrapped in an ErrorBoundary component with a fallback UI.

#### Scenario: Component crash shows fallback
- **WHEN** a React component throws an error
- **THEN** the error boundary catches it and displays a fallback UI

### Requirement: Database Indexes
All tables SHALL have indexes on locationId, businessId, userId, deletedAt, status, and foreign key columns.

#### Scenario: Location query uses index
- **WHEN** querying daily_sales by locationId
- **THEN** the query uses the locationId index

### Requirement: Security Headers
The Hono server SHALL set Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security headers.

#### Scenario: Response includes security headers
- **WHEN** any response is sent
- **THEN** it includes all configured security headers

### Requirement: Cryptographic OAuth State
The OAuth state parameter SHALL be a cryptographic random token stored in an httpOnly cookie, verified on callback.

#### Scenario: OAuth callback verifies state
- **WHEN** OAuth callback is received
- **THEN** the state parameter is verified against the stored cookie

### Requirement: Frontend Route Guards
Protected routes SHALL redirect to login if unauthenticated, and check permissions for admin routes.

#### Scenario: Unauthenticated user redirected
- **WHEN** an unauthenticated user accesses a protected route
- **THEN** they are redirected to the login page

### Requirement: Env Var Validation
The env.ts module SHALL throw on any missing required environment variable regardless of NODE_ENV.

#### Scenario: Missing env var throws
- **WHEN** a required environment variable is missing
- **THEN** the application throws at startup

### Requirement: Unified NHIF Calculation
NHIF/SHIF calculation SHALL use the official 2.75% rate consistently across all payroll routers.

#### Scenario: Payroll uses correct NHIF rate
- **WHEN** payroll is processed
- **THEN** NHIF is calculated at 2.75% of gross pay

## MODIFIED Requirements
All existing requirements related to authentication, payroll, financial calculations, API queries, and frontend routing are modified to incorporate the changes listed above.

## REMOVED Requirements
### Requirement: SHA-256 Password Hashing
**Reason**: Replaced by bcrypt for security compliance.
**Migration**: All existing password hashes invalidated. Users must use password reset flow.

### Requirement: parseFloat Financial Arithmetic
**Reason**: Replaced by decimal.js for precision.
**Migration**: All amounts stored as DECIMAL(15,2) — value conversion uses decimal.js now.

### Requirement: localStorage JWT Storage
**Reason**: Replaced by httpOnly cookies for XSS protection.
**Migration**: All active localStorage tokens invalidated. Users must re-authenticate.
