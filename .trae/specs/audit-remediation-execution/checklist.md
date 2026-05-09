# Checklist — Audit Remediation Execution

## Phase 1: Security & Financial Integrity

- [ ] T1: Dependencies installed (bcryptjs, decimal.js, @hono-rate-limiter, hono-rate-limiter, @paralleldrive/cuid2, test utilities)
- [ ] T2: SHA-256 replaced with bcrypt — password.ts utility created, local-auth-router.ts and users-router.ts updated, seed files updated
- [ ] T3: PAYE deducted in processPayroll — computePaye called, paye_deducted column added via migration
- [ ] T4: PAYE +1 tax overcharge fixed — band size formula corrected, tests verify correct values
- [ ] T5: NHIF standardized to 2.75% — single computeNhif function, bracket table removed from both routers
- [ ] T6: parseFloat replaced with decimal.js — decimal.ts utility created, all 8 financial routers updated
- [ ] T7: Financial operations wrapped in db.transaction() — accounts, sales, expenses, payroll, bills, dashboard all use transactions
- [ ] T8: Rate limiting implemented — loginLimiter (10/min) and apiLimiter (100/min) applied, 429 responses with Retry-After
- [ ] T9: JWT migrated from localStorage to httpOnly cookies — context.ts reads cookie, trpc.tsx/Login.tsx updated, CSRF token on login
- [ ] T10: OAuth state fixed — cryptographic random state used, stored in httpOnly cookie, verified on callback
- [ ] T11: CSRF protection middleware created and applied — double-submit cookie pattern, excluded for GET/HEAD/OPTIONS
- [ ] T12: daily-sales.list data leakage fixed — location filter applied, other list endpoints audited
- [ ] T13: env.ts throws on missing vars in all environments — NODE_ENV condition removed
- [ ] T14: Security headers added — CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy; CORS configured properly

## Phase 2: Testing & Quality

- [ ] T15: Database indexes added — all 48 tables have locationId, businessId, userId, deletedAt, status, composite indexes
- [ ] T16: N+1 query patterns fixed — batch-loading implemented, routers audited
- [ ] T17: Test infrastructure set up — vitest.config.ts updated, api/test/setup.ts, api/test/db.ts created, npm test scripts added
- [ ] T18: Unit tests for financial calculations — tax.test.ts and decimal.test.ts with ≥ 80% coverage
- [ ] T19: Integration tests for auth flows — signup, login, password, rate limit, CSRF tests
- [ ] T20: Integration tests for financial operations — account transfer atomicity, payroll, rollback tests
- [ ] T21: End-to-end tests — sales cycle, payroll cycle, bills cycle journeys
- [ ] T22: React error boundaries created and wired into App.tsx
- [ ] T23: Frontend route guards created (ProtectedRoute) — AuthLayout wired, redirect on unauthenticated
- [ ] T24: Pagination added to all list endpoints — pagination.ts utility, paginated responses
- [ ] T25: Connection pooling configured — mysql2/promise pool, connectionLimit 10, keepAlive enabled

## Phase 3: Architecture & Polish

- [ ] T26: Shared utilities extracted — password.ts, tax.ts, decimal.ts, pagination.ts all clean and deduplicated
- [ ] T27: Refresh token / session management — refresh_tokens table, /auth/refresh, /auth/logout, /auth/logout-all endpoints
- [ ] T28: Graceful shutdown handler added to boot.ts — SIGTERM/SIGINT handlers, DB pool close, 10s timeout
- [ ] T29: Health endpoint added — GET /health returns status + DB health check
- [ ] T30: Loading skeletons added to frontend pages — Skeleton component, page-specific skeletons
- [ ] T31: Lazy loading / code splitting implemented — React.lazy() + Suspense for all 23 routes
- [ ] T32: Hardcoded JWT fallback secret removed — both local-auth-router.ts and kimi/session.ts cleaned
- [ ] T33: Dockerfile fixed — multi-stage build, non-root user, HEALTHCHECK
- [ ] T34: Audit logging added — logAudit utility, calls in password changes, user creation, role changes, financial ops
- [ ] T35: SEO meta tags added to Home.tsx — react-helmet-async, title, meta, OG tags, structured data
- [ ] T36: Polymorphic FK orphan handling fixed — cleanup logic, composite indexes on (recordType, recordId)
- [ ] T37: CI/CD pipeline set up — .github/workflows/ci.yml with lint, test (MySQL service), deploy jobs
- [ ] T38: Post-deployment verification completed — smoke tests, financial reconciliation, security scan, verification report

## Cross-cutting Verification

- [ ] All code changes pass lint (`npm run lint`)
- [ ] All tests pass with ≥ 80% coverage (`npm run test:coverage`)
- [ ] No console errors or TypeScript compilation errors
- [ ] Frontend renders without errors on all 23 routes
- [ ] Security headers verified via curl/Postman
- [ ] Rate limiting verified (10 rapid login requests → 429)
- [ ] CSRF protection verified (mutation without token → 403)
- [ ] Tenant isolation verified (user A cannot see user B's data)
- [ ] Financial reconciliation verified (account balances match ledger entry sums)
- [ ] Docker image builds successfully and passes HEALTHCHECK
- [ ] CI pipeline passes on GitHub Actions
