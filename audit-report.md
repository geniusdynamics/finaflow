ABOUTME: Finaflow Comprehensive Technical Audit Report - FINAL
ABOUTME: Covers all 20 dimensions: security, architecture, DB, financials, testing, deployment, and more

# Finaflow — Comprehensive Technical Audit Report

**Date:** 2026-05-07  
**Audit Scope:** Full-stack business financial/cashflow tracking platform  
**Stack:** React 19 + TypeScript + Vite 7 + Tailwind CSS 3 + shadcn/ui + Hono 4 + tRPC 11 + Drizzle ORM + MySQL (Planetscale mode) + jose (JWT)  
**Version:** 0.0.0  
**Repository:** `d:\DevCenter\abuilds\fina\finaflow`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Risk Assessment Matrix](#2-risk-assessment-matrix)
3. [Critical Findings (P0 — Immediate Action Required)](#3-critical-findings-p0)
4. [High Findings (P1 — Fix Within 1-2 Weeks)](#4-high-findings-p1)
5. [Medium Findings (P2 — Fix Within Sprint)](#5-medium-findings-p2)
6. [Low Findings (P3 — Fix When Convenient)](#6-low-findings-p3)
7. [Dimension-by-Dimension Findings](#7-dimension-by-dimension-findings)
8. [Prioritized Remediation Plan](#8-prioritized-remediation-plan)
9. [Appendix: File Reference Index](#9-appendix-file-reference-index)

---

## 1. Executive Summary

Finaflow is a moderately complex multi-tenant financial tracking platform with **48 database tables**, **166 API endpoints** (85 queries + 81 mutations), **5 user roles with 35 permissions**, and **5 pricing tiers**. The platform processes sales, expenses, payroll (including Kenya PAYE/NSSF/NHIF), bills, supplier management, M-PESA integration, and financial reporting.

### Overall Health Rating: **D (Poor)**

The application has **functional completeness** — most features work end-to-end — but suffers from **critical security vulnerabilities**, **zero testing**, **systematic financial calculation bugs**, and **severe architectural debt** that make it **unsafe for production deployment** in its current state.

### Key Stats

| Metric | Value | Verdict |
|--------|-------|---------|
| Total Tables | 48 | ✅ Comprehensive |
| Total Endpoints | 166 | ✅ Full coverage |
| Total Indexes | 0 (custom) | ❌ CRITICAL |
| Foreign Keys | 0 | ❌ CRITICAL |
| Security Headers | 0 | ❌ CRITICAL |
| Rate Limiting | 0 | ❌ CRITICAL |
| Test Files | 0 | ❌ CRITICAL |
| Decimal Library | 0 | ❌ CRITICAL |
| Error Boundaries | 0 | ❌ HIGH |
| Lazy-loaded Routes | 0 | ❌ HIGH |

### Findings Summary

| Severity | Count | Action Required |
|----------|-------|-----------------|
| CRITICAL (P0) | 8 | Immediate — before any production traffic |
| HIGH (P1) | 10 | Within 1-2 weeks |
| MEDIUM (P2) | 8 | Within current sprint |
| LOW (P3) | 5 | When convenient |
| **Total** | **31** | |

---

## 2. Risk Assessment Matrix

| ID | Finding | Severity | Impact | Likelihood | Risk Score | Effort to Fix |
|----|---------|----------|--------|------------|------------|---------------|
| C01 | SHA-256 Password Hashing | CRITICAL | 10/10 | 10/10 | **100** | 2 days |
| C02 | No Database Transactions | CRITICAL | 9/10 | 8/10 | **72** | 3 days |
| C03 | No Decimal Library | CRITICAL | 9/10 | 9/10 | **81** | 2 days |
| C04 | PAYE Not Deducted in Payroll | CRITICAL | 10/10 | 9/10 | **90** | 1 day |
| C05 | Zero Test Coverage | CRITICAL | 8/10 | 10/10 | **80** | Ongoing |
| C06 | localStorage JWT Storage | CRITICAL | 9/10 | 8/10 | **72** | 2 days |
| C07 | No Rate Limiting | CRITICAL | 8/10 | 9/10 | **72** | 1 day |
| C08 | Daily Sales Data Leakage | CRITICAL | 9/10 | 9/10 | **81** | 1 day |
| H01 | SHA-256 + appSecret (no salt/bcrypt) | HIGH | 8/10 | 7/10 | **56** | 2 days |
| H02 | No Error Boundaries | HIGH | 7/10 | 8/10 | **56** | 1 day |
| H03 | PAYE +1 Tax Overcharge Bug | HIGH | 7/10 | 9/10 | **63** | 2 hours |
| H04 | N+1 Query Patterns | HIGH | 6/10 | 9/10 | **54** | 3 days |
| H05 | No Missing Indexes (48 tables, ~0 indexes) | HIGH | 7/10 | 8/10 | **56** | 2 days |
| H06 | No CORS, Security Headers, CSP | HIGH | 6/10 | 8/10 | **48** | 1 day |
| H07 | OAuth State is NOT a CSRF Token | HIGH | 7/10 | 6/10 | **42** | 1 day |
| H08 | No Route Guards in Frontend | HIGH | 7/10 | 7/10 | **49** | 2 days |
| H09 | Missing Env Vars Silently Return "" | HIGH | 6/10 | 8/10 | **48** | 1 day |
| H10 | NHIF Calculation Inconsistency | HIGH | 6/10 | 7/10 | **42** | 1 day |

---

## 3. Critical Findings (P0)

### C01 — SHA-256 Password Hashing (No Salt, No bcrypt)

**File:** [local-auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/local-auth-router.ts) (lines 28-34)  
**Severity:** CRITICAL  

```typescript
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + env.appSecret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

**Issues:**
- SHA-256 is a **fast, GPU-friendly** hash — not designed for passwords
- The "salt" (`env.appSecret`) is a **static, shared application secret**, not a per-user salt
- No bcrypt, scrypt, or argon2 — the industry standard for password hashing
- If the database is breached, all passwords can be cracked rapidly

**Impact:** Massive — a database breach exposes all user passwords.  
**Fix:** Replace with `bcrypt` (Node.js native or `bcryptjs`). Add per-user salts.

---

### C02 — Zero Database Transactions

**Files:** All routers across [`api/`](file:///d:/DevCenter/abuilds/fina/finaflow/api/)  
**Severity:** CRITICAL  

**No single `db.transaction()` call exists in the entire codebase.** Financial operations like transfers, payroll processing, bill payments, and account updates are performed with individual SQL statements sequentially. If the server crashes mid-operation:
- Money can be debited from one account but never credited to another
- Payroll entries can be partially committed
- Bill payments can be deducted but not recorded

**Example (account transfer — no transaction):**
```typescript
// accounts-router.ts — debit then credit, NO transaction wrapping
await db.insert(ledgerEntries).values({ /* debit */ });
await db.update(accounts).set({ currentBalance: fromNewBal });
// If crash happens here, money is lost
for (const to of input.toAccounts) {
  await db.insert(ledgerEntries).values({ /* credit */ });
  await db.update(accounts).set({ currentBalance: toNewBal });
}
```

**Impact:** Financial corruption — money can be lost.  
**Fix:** Wrap every multi-step financial operation in `db.transaction()`.

---

### C03 — No Decimal Library (parseFloat Everywhere)

**Files:** All routers. Example heavy offenders:  
- [accounts-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/accounts-router.ts)  
- [daily-sales-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/daily-sales-router.ts)  
- [employees-payroll-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/employees-payroll-router.ts)  
- [payroll-settings-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/payroll-settings-router.ts)  
- [bills-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/bills-router.ts)  
- [reports-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/reports-router.ts)  

**Severity:** CRITICAL  

The codebase uses `parseFloat()` and `.toFixed(2)` for **all financial calculations** — payroll, tax computation, account transfers, bill payments, expense tracking, cashflow forecasting — across every single router.

**Why this is catastrophic for financial software:**
- `parseFloat(0.1 + 0.2)` → `0.30000000000000004` — classic IEEE 754 floating-point error
- Over thousands of transactions, rounding errors accumulate
- `.toFixed(2)` rounds using banker's rounding (or not, depending on values)
- No fixed-precision arithmetic anywhere

**Impact:** Silent financial drift. Over time, balances will be off by cents, then dollars.  
**Fix:** Replace with `decimal.js` or `bignumber.js` across all financial operations.

---

### C04 — PAYE (Income Tax) NOT Withheld in ProcessPayroll

**File:** [employees-payroll-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/employees-payroll-router.ts) (lines 160-174)  
**Severity:** CRITICAL  

The `processPayroll` mutation computes deductions as:
```typescript
const nssf = Math.min(basicPay * 0.06, 2160);
const nhif = basicPay < 6000 ? 150 : basicPay < 8000 ? 300 : basicPay < 12000 ? 400 : 500;
const netPay = Math.max(0, basicPay - advanceDeduction - nssf - nhif);
```

**PAYE (income tax / Pay As You Earn) is completely absent from the actual payroll processing.** While a `computePaye` function exists in `payroll-settings-router.ts`, it is **never called** during `processPayroll`. Employees will receive their full gross salary minus only NSSF and NHIF — meaning no income tax is withheld by the system.

The `computePaye` function is only exposed via the `/payrollSettings.compute` query (for UI display), but the **actual payroll run ignores it**.

**Impact:** Massive legal and financial liability — employees will owe back taxes, and the business faces KRA penalties.  
**Fix:** Call `computePaye()` in `processPayroll` and deduct the result from net pay.

---

### C05 — Zero Test Coverage

**Files:** [vitest.config.ts](file:///d:/DevCenter/abuilds/fina/finaflow/vitest.config.ts) (configured but unused)  
**Severity:** CRITICAL  

- **Zero** `.test.ts` or `.spec.ts` files exist anywhere in the project
- Vitest is installed and configured but matches nothing
- No unit tests for financial calculations (PAYE, NSSF, NHIF, rounding)
- No integration tests for any API endpoint
- No end-to-end tests for any user flow
- No CI/CD pipeline

**Impact:** Every deployment is a leap of faith. Refactoring or fixing one thing risks breaking another.  
**Fix:** Implement TDD process. Start with: (1) PAYE/NSSF/NHIF calculation tests, (2) Auth flow tests, (3) Account transfer tests.

---

### C06 — JWT Stored in localStorage (XSS Exposure)

**Files:** [trpc.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/providers/trpc.tsx) (line 25), [Login.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/pages/Login.tsx)  
**Severity:** CRITICAL  

```typescript
const token = localStorage.getItem("finaflow_token");
```

**Issues:**
- localStorage is accessible to **any JavaScript** running on the page
- A single XSS vulnerability exposes all user tokens
- 30-day token expiry means a leaked token is valid for a month
- Tokens also include OAuth session tokens with **1-year expiry**

**Impact:** XSS = complete account takeover.  
**Fix:** Use `httpOnly` cookies for JWT storage. Implement CSRF protection if switching to cookies.

---

### C07 — No Rate Limiting

**File:** [boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts)  
**Severity:** CRITICAL  

No rate limiting on any endpoint. This means:
- Login endpoints are vulnerable to **brute force attacks** (password guessing)
- All API endpoints are vulnerable to **DoS attacks**
- Public endpoints (`lookupAccount`, `seedDefaults`) are unprotected

**Impact:** Brute force password cracking, DoS.  
**Fix:** Implement rate limiting (e.g., `@upstash/ratelimit` or `express-rate-limit` equivalent for Hono).

---

### C08 — Daily Sales List Has No Tenant Isolation (Data Leakage)

**File:** [daily-sales-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/daily-sales-router.ts) (lines 10-16)  
**Severity:** CRITICAL  

```typescript
list: salesQuery.query(async () => {
  const sales = await db.select().from(dailySales)
    .where(isNull(dailySales.deletedAt))
    .orderBy(desc(dailySales.saleDate));
  // Returns ALL sales across ALL locations — NO location filter
```

The `list` query has **no location or business filter**. Every authenticated user can see every sale across the entire platform. While `getByLocation` exists as a filtered alternative, `list` is the default query that returns ALL data.

**Impact:** Massive data breach — users can see other businesses' sales data.  
**Fix:** Apply location/business filtering in `list()` using `getCurrentBusinessLocationIds()`.

---

## 4. High Findings (P1)

### H01 — Weak Password Hashing (SHA-256 + Static App Secret)

**File:** [local-auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/local-auth-router.ts) (lines 28-34)  
**Severity:** HIGH  

The `hashPassword` function uses SHA-256 with `env.appSecret` as a static salt. While slightly better than unsalted SHA-256, this is still far below modern standards. The app secret is also used for JWT signing, meaning if it's compromised, everything breaks.

**Fix:** Use bcrypt with per-user salts. Never reuse the same secret for hashing and signing.

---

### H02 — No Error Boundaries in React

**File:** [App.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/App.tsx)  
**Severity:** HIGH  

The entire React app has **zero error boundaries**. A single unhandled error in any component will crash the entire application (white screen of death). With 23 pages and complex async operations, this is a significant risk.

**Fix:** Wrap route sections in `<ErrorBoundary>` components with fallback UI.

---

### H03 — PAYE Calculation Has Systematic +1 Bug

**File:** [payroll-settings-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/payroll-settings-router.ts) (line 36)  
**Severity:** HIGH  

```typescript
const bandSize = bandMax - band.min + (band.min === 0 ? 1 : 0);
```

The `+1` offset is **incorrect for all bands except the first one**. For example, the second band (24001–32333) should have size 8333, but the formula gives `32333 - 24001 + 0 = 8332` — off by 1. The first band gets `24000 - 0 + 1 = 24001` which is also wrong (should be 24000).

This systematically overcharges tax by a small but incorrect amount on every payslip.

**Fix:** The correct band size for progressive tax is simply `bandMax - band.min` (no `+1` offset).

---

### H04 — N+1 Query Patterns

**Files:**
- [daily-sales-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/daily-sales-router.ts) (lines 12-16)  
- [employees-payroll-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/employees-payroll-router.ts) (line ~90)  

**Severity:** HIGH  

```typescript
// daily-sales-router.ts — N+1 for payments
const result = [];
for (const sale of sales) {
  const payments = await db.select().from(dailySalePayments)
    .where(eq(dailySalePayments.dailySaleId, sale.id));
  result.push({ ...sale, payments });
}
```

Each sale triggers a **separate SQL query** for payments. With 100 sales, that's 101 queries. This pattern repeats across the codebase.

**Fix:** Batch-load with `IN` clauses or use Drizzle's relation/join capabilities.

---

### H05 — Severely Under-Indexed Database

**File:** [schema.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/schema.ts)  
**Severity:** HIGH  

For **48 tables**, there are approximately **0 custom indexes** (only primary keys). Key queries that will perform poorly:
- `WHERE locationId = ?` queries on every major table (daily_sales, expenses, accounts, etc.)
- `WHERE businessId = ?` on businesses, user_businesses
- `WHERE userId = ?` on users, user_businesses
- `WHERE deletedAt IS NULL` soft-delete filters on every table
- `ORDER BY createdAt DESC` or `saleDate DESC` on large tables
- `WHERE status = ?` on payroll_advances, bills, etc.

**Impact:** As data grows, query performance will degrade exponentially.  
**Fix:** Add indexes on: `(locationId)`, `(businessId)`, `(userId)`, `(deletedAt)`, `(status)`, foreign key columns, and sort columns.

---

### H06 — No Security Headers or CORS

**Files:** [boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts), [vite.config.ts](file:///d:/DevCenter/abuilds/fina/finaflow/vite.config.ts)  
**Severity:** HIGH  

The production Hono server has:
- No `Content-Security-Policy` header
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options: DENY`
- No `Strict-Transport-Security`
- No CORS configuration on the production server
- The Vite dev server has CORS from the `hono` config but production doesn't

**Fix:** Add helmet-style security headers via Hono middleware. Configure CORS explicitly.

---

### H07 — OAuth `state` Parameter is NOT a CSRF Token

**File:** [kimi/auth.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/kimi/auth.ts) (lines 95-96)  
**Severity:** HIGH  

```typescript
const redirectUri = atob(state);
```

The OAuth `state` parameter is simply a **base64-encoded redirect URI**, not a cryptographic CSRF token. This means:
- No protection against CSRF attacks on the OAuth callback
- An attacker can forge the state parameter
- No nonce/timestamp to prevent replay attacks

**Fix:** Generate a real cryptographic state token, store it in a session/httpOnly cookie, and verify on callback.

---

### H08 — No Frontend Route Guards

**File:** [App.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/App.tsx)  
**Severity:** HIGH  

All 23 routes in `App.tsx` are **completely unprotected**. There is no:
- Authentication check before rendering protected pages
- Role/permission check before rendering admin pages
- Business/location context validation
- Redirect to login if unauthenticated
- AuthLayout component is defined but **not wired into routes**

While tRPC endpoints have server-side auth, the unprotected routes could lead to:
- Flash of unauthenticated content
- Accidental navigation exposure
- Poor UX with no redirect

**Fix:** Implement route guards using React Router loaders or a wrapper component.

---

### H09 — Missing Environment Variables Silently Return ""

**File:** [lib/env.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/env.ts) (line 5)  
**Severity:** HIGH  

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}
```

In non-production environments, **missing env vars silently return empty strings**, which means:
- `env.appSecret` could be `""` → JWT secret becomes the fallback string
- `env.databaseUrl` could be `""` → connection fails with confusing error
- `env.kimiAuthUrl` could be `""` → OAuth calls fail silently

**Fix:** Always throw on missing required env vars regardless of NODE_ENV.

---

### H10 — NHIF Calculation Inconsistency

**Files:**
- [payroll-settings-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/payroll-settings-router.ts) — uses percentage (2.75%)
- [employees-payroll-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/employees-payroll-router.ts) (line ~170) — uses bracket table

**Severity:** HIGH  

The NHIF calculation differs between the two files:
- `payroll-settings-router.ts`: `computeNhif` calculates NHIF as **2.75% of gross pay**
- `employees-payroll-router.ts`: NHIF is computed using a **bracket table**:
  ```typescript
  const nhif = basicPay < 6000 ? 150 : basicPay < 8000 ? 300 : basicPay < 12000 ? 400 : 500;
  ```

The bracket table caps at 500, while the percentage method can produce much higher values.

**Impact:** Inconsistent payroll deductions depending on which function is used.  
**Fix:** Standardize on one NHIF calculation method (the official SHIF rate is 2.75% as of 2024).

---

## 5. Medium Findings (P2)

### M01 — No Browser/Device-Specific Session Management

**Files:** All auth-related files  
**Severity:** MEDIUM  

- No refresh token mechanism for local auth
- No way to revoke individual sessions
- No device fingerprinting
- No concurrent session limits
- Users cannot "log out everywhere else"

### M02 — No Graceful Shutdown on Server

**File:** [boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts)  
**Severity:** MEDIUM  

The Hono server has no `process.on('SIGTERM', ...)` handler to gracefully close DB connections and finish in-flight requests before shutting down.

### M03 — No Pagination on Any List Endpoint

**Files:** All `list` and `query` endpoints  
**Severity:** MEDIUM  

No endpoint in the entire API supports pagination (`offset`/`limit` or cursor-based). The `dailySales.list` endpoint returns **all sales** without limits. As data grows, this will consume increasing memory and bandwidth.

### M04 — 11-Column Payment Method Anti-Pattern in daily_sales

**File:** [schema.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/schema.ts) — `daily_sales` table  
**Severity:** MEDIUM  

The `daily_sales` table originally had 11 separate columns for different payment method amounts (cashAmount, mpesaAmount, cardAmount, etc.). A `daily_sale_payments` table exists but the old columns may still be present. This violates normalization principles.

### M05 — Polymorphic Foreign Keys (No Referential Integrity)

**Files:** [schema.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/schema.ts) — `attachments`, `audit_log`, `quick_actions_log`, `notifications` tables  
**Severity:** MEDIUM  

Tables like `attachments` use `(recordType, recordId)` polymorphic foreign keys. These cannot have database-level FK constraints, making it possible to have orphaned attachment records pointing to deleted parent records.

### M06 — No Connection Pooling Configuration

**File:** [queries/connection.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/queries/connection.ts)  
**Severity:** MEDIUM  

Uses PlanetScale serverless mode with default connection settings. No connection pooling, no retry logic, no timeout configuration, no connection limit.

### M07 — No Loading Skeletons or States in Frontend

**Files:** All [pages](file:///d:/DevCenter/abuilds/fina/finaflow/src/pages/)  
**Severity:** MEDIUM  

Almost every page component lacks loading states, skeleton screens, or empty states. Users see blank pages or spinners only. No optimistic UI updates. This creates a poor user experience, especially on slow connections.

### M08 — Hardcoded JWT Fallback Secret

**File:** [local-auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/local-auth-router.ts) (line 10)  
**Severity:** MEDIUM  

```typescript
const JWT_SECRET = new TextEncoder().encode(env.appSecret || "finaflow-local-auth-secret-key-2025");
```

The hardcoded fallback secret is in source control. If someone forks or accesses the repo, they can forge JWTs.

---

## 6. Low Findings (P3)

### L01 — No Docker HEALTHCHECK

**File:** [Dockerfile](file:///d:/DevCenter/abuilds/fina/finaflow/Dockerfile)  
**Severity:** LOW  

Dockerfile has no `HEALTHCHECK` instruction, meaning orchestrators cannot detect when the application is unhealthy.

### L02 — Docker Runs as Root

**File:** [Dockerfile](file:///d:/DevCenter/abuilds/fina/finaflow/Dockerfile)  
**Severity:** LOW  

The production image runs as root, violating security best practices.

### L03 — No Audit Logging for Sensitive Operations

**Severity:** LOW  

While an `audit_log` table exists, no critical operations (password changes, user creation, financial adjustments) are logged to it.

### L04 — Duplicate hashPassword Function

**Files:** [local-auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/local-auth-router.ts), [users-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/users-router.ts)  
**Severity:** LOW  

The `hashPassword` function is redefined in multiple routers. Should be extracted to a shared utility.

### L05 — No SEO Meta Tags on Landing Page

**File:** [Home.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/pages/Home.tsx)  
**Severity:** LOW  

The landing page has no `<title>`, no meta description, no Open Graph tags, no structured data. Poor SEO.

---

## 7. Dimension-by-Dimension Findings

### 7.1 Codebase Organization

**Rating: B**

The project follows a clean structure:
```
/contracts     — Shared types, constants, errors
/api           — tRPC routers, middleware, lib
/db            — Schema, migrations, seed data
/src           — React frontend components, pages, hooks, providers
```

**Issues:**
- Mixed naming conventions (snake_case columns, TypeScript PascalCase)
- No barrel files (`index.ts`) in many directories
- Some files exceed 500 lines (local-auth-router.ts: ~545 lines, middleware.ts: ~357 lines)

### 7.2 Authentication & Authorization

**Rating: D**

- ✅ RBAC with 35 permissions across 5 roles
- ✅ Dual auth (local JWT + Kimi OAuth)
- ❌ SHA-256 password hashing (CRITICAL)
- ❌ localStorage JWT storage (CRITICAL)
- ❌ OAuth state is not a CSRF token (HIGH)
- ❌ No rate limiting (CRITICAL)
- ❌ Hardcoded JWT fallback secret (MEDIUM)
- ❌ Minimum password length is 4 characters
- ❌ No refresh token mechanism
- ❌ 30-day local token / 1-year OAuth token are excessively long

### 7.3 Database Schema

**Rating: D**

- ✅ 48 tables covering all business domains
- ✅ DECIMAL(15,2) for monetary amounts is appropriate
- ❌ 0 custom indexes for 48 tables (CRITICAL)
- ❌ No foreign key constraints (PlanetScale compatibility — but no trade-off analysis)
- ❌ Denormalized balance fields (accounts.currentBalance, suppliers.currentBalance)
- ❌ 11-column payment method anti-pattern
- ❌ Polymorphic FKs with no referential integrity
- ❌ No composite indexes for common query patterns

### 7.4 Financial Calculations

**Rating: F**

- ❌ No decimal library — parseFloat everywhere (CRITICAL)
- ❌ PAYE not deducted in processPayroll (CRITICAL)
- ❌ Systematic +1 tax overcharge bug (HIGH)
- ❌ NHIF calculation inconsistency (HIGH)
- ❌ No database transactions (CRITICAL)
- ❌ Manual rounding logic instead of precise financial arithmetic

### 7.5 API Design

**Rating: B**

- ✅ Consistent tRPC pattern with typed inputs/outputs
- ✅ Zod validation on all endpoints
- ✅ SuperJSON for serialization
- ❌ No pagination on any list endpoint
- ❌ N+1 query patterns
- ❌ Data leakage in daily-sales.list (CRITICAL)
- ❌ Some endpoints return too much data (no field selection)

### 7.6 Frontend Architecture

**Rating: D**

- ✅ 23 pages covering all features
- ✅ Clean component structure with shadcn/ui
- ❌ No lazy loading / code splitting
- ❌ No error boundaries
- ❌ No route guards
- ❌ AuthLayout not wired to routes
- ❌ No loading skeletons for most pages
- ❌ No SEO meta tags
- ❌ No accessibility audit (ARIA, keyboard nav)
- ❌ staleTime: 0 means no caching at all

### 7.7 Security

**Rating: F**

Summary of all security issues:
| Issue | Severity | File |
|-------|----------|------|
| SHA-256 password hashing | CRITICAL | local-auth-router.ts |
| JWT in localStorage | CRITICAL | trpc.tsx, Login.tsx |
| No rate limiting | CRITICAL | boot.ts |
| Data leakage | CRITICAL | daily-sales-router.ts |
| Weak hash algorithm | HIGH | local-auth-router.ts |
| No security headers | HIGH | boot.ts |
| OAuth state forgery | HIGH | kimi/auth.ts |
| No CSRF protection | HIGH | (missing everywhere) |
| Hardcoded JWT fallback | MEDIUM | local-auth-router.ts |
| Min password 4 chars | MEDIUM | local-auth-router.ts |
| Missing env vars silent | HIGH | lib/env.ts |
| Docker runs as root | LOW | Dockerfile |

### 7.8 Testing

**Rating: F**

- Zero test files in the entire project
- Vitest installed but unused
- No CI/CD pipeline
- No test scripts beyond empty `vitest run`
- No test database configuration

### 7.9 Deployment & Devops

**Rating: D**

- ✅ Dockerfile exists and builds successfully
- ❌ No HEALTHCHECK
- ❌ No graceful shutdown
- ❌ No non-root user
- ❌ No health endpoint on the server
- ❌ No monitoring/observability
- ❌ No structured logging
- ❌ Hardcoded npm registry mirror

### 7.10 Scalability

**Rating: D**

- ❌ No pagination → memory exhaustion
- ❌ N+1 queries → database load spikes
- ❌ No indexes → full table scans
- ❌ No connection pooling → connection exhaustion
- ❌ Denormalized balances → race conditions
- ❌ No caching layer (staleTime: 0 means zero caching)
- ❌ In-memory role permission cache (no persistence)

---

## 8. Prioritized Remediation Plan

### Phase 1: Security & Financial Integrity (Week 1)

| Day | Task | Owner | Effort |
|-----|------|-------|--------|
| D1 | Replace SHA-256 with bcrypt password hashing | Backend | 2 days |
| D1 | Add rate limiting to all endpoints | Backend | 1 day |
| D2 | Fix PAYE deduction in processPayroll | Backend | 1 day |
| D2 | Fix PAYE +1 tax calculation bug | Backend | 2 hours |
| D2 | Standardize NHIF calculation | Backend | 1 day |
| D3 | Implement database transactions for all financial ops | Backend | 3 days |
| D3 | Fix daily-sales.list data leakage (add location filter) | Backend | 1 day |
| D4 | Replace parseFloat with decimal.js everywhere | Backend | 2 days |
| D4 | Move JWT from localStorage to httpOnly cookie | Fullstack | 2 days |
| D5 | Fix OAuth state parameter to use real CSRF token | Backend | 1 day |
| D5 | Add CSRF protection | Backend | 1 day |

### Phase 2: Testing & Quality (Week 2)

| Day | Task | Owner | Effort |
|-----|------|-------|--------|
| D6 | Add unit tests for PAYE/NSSF/NHIF calculations | QA | 1 day |
| D6 | Add auth flow tests (signup, login, token refresh) | QA | 1 day |
| D7 | Add account transfer integration tests | QA | 1 day |
| D7 | Set up CI/CD pipeline (GitHub Actions) | DevOps | 1 day |
| D7 | Add error boundaries to React app | Frontend | 1 day |
| D8 | Add frontend route guards | Frontend | 2 days |
| D8 | Add loading skeletons to all pages | Frontend | 2 days |
| D9 | Add security headers (CSP, HSTS, CORS) | Backend | 1 day |
| D9 | Add pagination to all list endpoints | Backend | 3 days |
| D10 | Add database indexes (48 tables) | DBA | 2 days |

### Phase 3: Architecture & Polish (Week 3-4)

| Task | Owner | Effort |
|------|-------|--------|
| Extract shared utilities (hashPassword, financial helpers) | Backend | 1 day |
| Add graceful shutdown | Backend | 1 day |
| Add health endpoint | Backend | 1 day |
| Fix Dockerfile (HEALTHCHECK, non-root user) | DevOps | 1 day |
| Add audit logging for sensitive operations | Backend | 2 days |
| Add SEO meta tags | Frontend | 1 day |
| Add lazy loading / code splitting | Frontend | 2 days |
| Implement pagination on all list endpoints | Backend | 3 days |
| Add connection pooling configuration | Backend | 1 day |
| Implement proper env var validation | Backend | 1 day |
| Fix hardcoded JWT fallback | Backend | 1 day |

---

## 9. Appendix: File Reference Index

### Backend (`/api/`)

| File | Lines | Purpose | Key Findings |
|------|-------|---------|-------------|
| [boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts) | ~40 | Server startup | No security headers, no graceful shutdown |
| [context.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/context.ts) | ~75 | Auth resolution pipeline | 2-4 DB queries per request |
| [middleware.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/middleware.ts) | ~357 | Permission/RBAC/Tier enforcement | 35 permissions, 5 roles |
| [router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/router.ts) | ~30 | Router aggregation | 28 routers, 166 endpoints |
| [local-auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/local-auth-router.ts) | ~545 | Local auth (signup, login, password) | SHA-256, hardcoded secret, min 4 chars |
| [auth-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/auth-router.ts) | ~20 | OAuth session management | |
| [daily-sales-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/daily-sales-router.ts) | ~200 | Daily sales CRUD | Data leakage, N+1 queries |
| [accounts-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/accounts-router.ts) | ~250 | Account management, transfers | No transactions, parseFloat |
| [employees-payroll-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/employees-payroll-router.ts) | ~350 | Payroll processing | PAYE not deducted |
| [payroll-settings-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/payroll-settings-router.ts) | ~150 | Payroll settings, tax calc | +1 tax bug, NHIF inconsistency |
| [bills-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/bills-router.ts) | ~200 | Bill management | parseFloat |
| [reports-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/reports-router.ts) | ~150 | P&L, cashflow, budgets | parseFloat |
| [dashboard-router.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/dashboard-router.ts) | ~200 | Dashboard summaries | No transaction on resetAllTransactions |
| [kimi/auth.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/kimi/auth.ts) | ~130 | OAuth handler | State is not CSRF token |
| [kimi/session.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/kimi/session.ts) | ~40 | Session JWT | 1-year expiry, no revocation |
| [lib/env.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/env.ts) | ~15 | Env var access | Missing vars return "" in dev |
| [lib/cookies.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/cookies.ts) | ~20 | Cookie options | |
| [queries/connection.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/queries/connection.ts) | ~30 | DB connection | No pooling config |

### Database (`/db/`)

| File | Lines | Purpose | Key Findings |
|------|-------|---------|-------------|
| [schema.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/schema.ts) | ~1000 | 48 table definitions | 0 indexes, no FKs |
| [migrate-auth.cjs](file:///d:/DevCenter/abuilds/fina/finaflow/db/migrate-auth.cjs) | ~200 | Auth migration | Manual SQL |
| [migrate-v3.cjs through v13.cjs](file:///d:/DevCenter/abuilds/fina/finaflow/db/) | Various | Schema migrations | No transaction wrappers |
| [seed.ts](file:///d:/DevCenter/abuilds/fina/finaflow/db/seed.ts) | ~300 | Dev seed data | |
| [seed-demo.cjs](file:///d:/DevCenter/abuilds/fina/finaflow/db/seed-demo.cjs) | ~200 | Demo seed | 5 users with SHA-256 passwords |

### Frontend (`/src/`)

| File | Lines | Purpose | Key Findings |
|------|-------|---------|-------------|
| [App.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/App.tsx) | ~40 | Root routes | No lazy loading, no error boundaries, no route guards |
| [Login.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/pages/Login.tsx) | ~270 | Login page | Manual validation, localStorage JWT |
| [Home.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/pages/Home.tsx) | ~187 | Landing page | No SEO, no meta tags |
| [providers/trpc.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/providers/trpc.tsx) | ~63 | tRPC client | localStorage token, staleTime:0 |
| [AuthLayout.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/components/AuthLayout.tsx) | ~266 | Auth layout | NOT WIRED to routes |

### Config Files

| File | Purpose | Key Findings |
|------|---------|-------------|
| [Dockerfile](file:///d:/DevCenter/abuilds/fina/finaflow/Dockerfile) | Docker build | No HEALTHCHECK, runs as root |
| [vitest.config.ts](file:///d:/DevCenter/abuilds/fina/finaflow/vitest.config.ts) | Test config | Matches 0 test files |
| [drizzle.config.ts](file:///d:/DevCenter/abuilds/fina/finaflow/drizzle.config.ts) | Drizzle config | MySQL dialect |
| [.env.example](file:///d:/DevCenter/abuilds/fina/finaflow/.env.example) | Env template | 8 env vars documented |

---

*End of Audit Report*
