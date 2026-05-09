# Restaurant Cashflow MVP — Comprehensive Software Product Specification

**Version:** 1.0.0  
**Status:** Draft  
**Date:** 2026-04-29  
**Audience:** Engineering, QA, Product, Deployment Teams  

---

## Table of Contents

1. [System Overview & Purpose](#1-system-overview--purpose)
2. [Detailed Database Schema](#2-detailed-database-schema)
3. [API Endpoint Catalog](#3-api-endpoint-catalog)
4. [Business Logic Details](#4-business-logic-details)
5. [Frontend Architecture & Component Spec](#5-frontend-architecture--component-spec)
6. [Security & Access Control](#6-security--access-control)
7. [Quality Assurance Strategy](#7-quality-assurance-strategy)
8. [Deployment & Operations](#8-deployment--operations)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)

---

## 1. System Overview & Purpose

### 1.1 Business Context

Restaurant owners and managers across Kenya operate in a high-volume, thin-margin environment where cashflow visibility is the difference between survival and growth. Most Kenyan restaurants use POS systems (e.g., Khaos, Positouch, or generic ETR devices) that generate Z-reports — end-of-day sales summaries printed on thermal paper. These reports are manually transcribed into spreadsheets for record-keeping. The process is error-prone, non-auditable, and provides zero real-time visibility into cash position across multiple locations.

The **Restaurant Cashflow MVP** eliminates this manual overhead by providing a mobile-first digital system where:

- **Daily Sales** are entered directly (not from POS Z-reports, though the system can cross-reference against them) with breakdowns by cash, card, M-Pesa, and delivery partner collections.
- **Expenses** are logged categorically at the time of occurrence, with receipt photo attachments.
- **Suppliers & Payables** are tracked with invoice lifecycles and aging schedules.
- **Recurring Bills** (rent, electricity, internet, security) are scheduled and auto-escalated.
- **Payroll** handles salaries, advances, deductions, and generates payslips.
- **Unified Calendar** aggregates all obligations (bill due dates, payroll dates, supplier payment promises) into a single timeline view.
- **General Ledger** provides double-entry confidence with single-entry simplicity: every financial transaction auto-creates corresponding ledger entries.

### 1.2 Target Users

| Persona | Role | Permissions | Devices | Pain Points |
|---|---|---|---|---|
| **Owner** | Business owner or director-level stakeholder | Full access across all locations | Phone + Tablet + Desktop | Needs consolidated view, doesn't visit locations daily |
| **Admin** | Operations manager or accountant | Full access including user management | Phone + Tablet + Desktop | Needs to drill into location data, reconcile accounts |
| **Location Manager** | On-site restaurant manager | Access limited to assigned location only, no permanent delete | Phone (primarily) | Enters daily sales and expenses on the go |
| **Employee** | Staff (cashiers, waiters) | Read-only or limited entry access | Phone | Views payslips, requests advances |

### 1.3 Success Metrics

| KPI | Target | Measurement |
|---|---|---|
| Daily sales entry time | < 30 seconds per entry | In-app session timing |
| Expense logging rate | 90% of expenses logged within 24h | Audit log vs. bank statement |
| Supplier payment compliance | 95% on-time payments | Bill aging report |
| Payroll processing time | < 5 minutes per pay period | Feature usage analytics |
| User adoption | 100% of target users active within first month | Login frequency per user |
| Data integrity | Zero orphaned transactions after 1 month | Data quality checks |

### 1.4 Geographic & Currency Scope

- **Region:** Kenya (Nairobi-based operations initially, expandable to other counties)
- **Currency:** Kenyan Shillings (KES) only — all monetary values stored in KES, no multi-currency support in MVP
- **Locations:** Starting with 2 restaurant locations, scalable to N locations
- **Regulatory:** Compliant with Kenya Data Protection Act 2019, KRA tax record-keeping requirements

---

## 2. Detailed Database Schema

### 2.1 Schema Design Principles

- **Soft-delete everywhere:** Every primary table has `deleted_at TIMESTAMP NULL` and `is_deleted BOOLEAN DEFAULT FALSE`
- **Audit trail:** Core tables have `created_at`, `updated_at` timestamps; mutations logged in a dedicated `audit_log` table
- **Immutable transactions:** Once a ledger entry is created, it is never modified — corrections are done via reversal entries
- **Indexing strategy:** All foreign keys + date-range query columns are indexed; composite indexes on frequent join patterns
- **Timestamps:** All dates stored in UTC; timezone conversion handled at display layer

### 2.2 Table Catalog (DDL-Level Detail)

#### 2.2.1 locations

Stores restaurant outlets/branches.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | Auto-increment |
| name | VARCHAR(255) | NOT NULL | | e.g., "Mama's Kitchen - Westlands" |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | | URL-friendly identifier |
| address | TEXT | | NULL | Physical location |
| phone | VARCHAR(20) | | NULL | Contact number |
| email | VARCHAR(255) | | NULL | |
| is_active | BOOLEAN | NOT NULL | TRUE | Allow deactivation without deletion |
| opening_balance | DECIMAL(15,2) | NOT NULL | 0.00 | Starting cash balance when location was added |
| deleted_at | TIMESTAMP | | NULL | Soft-delete marker |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | Auto-updated via trigger |

**Indexes:** `idx_locations_slug` (UNIQUE), `idx_locations_active` (WHERE is_active = TRUE)

#### 2.2.2 users

System users with role-based access.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | | Login credential |
| password_hash | VARCHAR(255) | NOT NULL | | bcrypt hashed |
| full_name | VARCHAR(255) | NOT NULL | | |
| role | ENUM('owner','admin','manager','employee') | NOT NULL | 'manager' | RBAC role |
| location_id | BIGINT | FK → locations.id | NULL | NULL for owner/admin; required for manager/employee |
| phone | VARCHAR(20) | | NULL | |
| is_active | BOOLEAN | NOT NULL | TRUE | |
| last_login_at | TIMESTAMP | | NULL | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:** `idx_users_email` (UNIQUE), `idx_users_role`, `idx_users_location`, `idx_users_active`

**Foreign Key:** `location_id REFERENCES locations(id) ON DELETE SET NULL`

#### 2.2.3 accounts

Financial accounts (cash, M-Pesa, bank accounts) per location.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations.id, NOT NULL | | Account belongs to one location |
| name | VARCHAR(100) | NOT NULL | | e.g., "Main Cash Drawer", "M-Pesa Business" |
| type | ENUM('cash','mpesa','bank_account') | NOT NULL | | Account classification |
| account_number | VARCHAR(100) | | NULL | For bank/M-Pesa accounts |
| opening_balance | DECIMAL(15,2) | NOT NULL | 0.00 | Balance when account was added |
| current_balance | DECIMAL(15,2) | NOT NULL | 0.00 | Computed via ledger materialized or cached |
| currency | CHAR(3) | NOT NULL | 'KES' | Hardcoded to KES in MVP |
| is_active | BOOLEAN | NOT NULL | TRUE | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:** `idx_accounts_location`, `idx_accounts_type`, `idx_accounts_location_type` (composite)

**Foreign Key:** `location_id REFERENCES locations(id) ON DELETE RESTRICT`

#### 2.2.4 ledger_entries

The heart of the financial system. Every monetary transaction creates one or more entries here.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| account_id | BIGINT | FK → accounts(id), NOT NULL | | Debit/credit applies to this account |
| transaction_type | ENUM('sale','expense','bill_payment','supplier_payment','payroll','advance','transfer','opening_balance') | NOT NULL | | Source module |
| transaction_id | BIGINT | NOT NULL | | FK to the source transaction row (polymorphic via type) |
| entry_type | ENUM('debit','credit') | NOT NULL | | Double-entry convention |
| amount | DECIMAL(15,2) | NOT NULL | | Always positive; sign determined by entry_type |
| balance_after | DECIMAL(15,2) | NOT NULL | | Running balance on this account after this entry |
| description | TEXT | | NULL | Human-readable note |
| entry_date | DATE | NOT NULL | | The business date, not system date |
| created_by | BIGINT | FK → users(id) | NULL | Who created the transaction |
| deleted_at | TIMESTAMP | | NULL | Soft-delete flag (do not use — entries should be immutable) |
| created_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:**
- `idx_ledger_account_date` ON (account_id, entry_date DESC) — primary query pattern
- `idx_ledger_transaction` ON (transaction_type, transaction_id) — reverse lookup
- `idx_ledger_date_range` ON (entry_date) — date-range queries
- `idx_ledger_account_balance` ON (account_id, created_at DESC) — balance computation

**Foreign Key:** `account_id REFERENCES accounts(id) ON DELETE RESTRICT`

> **NOTE:** Ledger entries are **immutable by design**. No UPDATE or DELETE should be performed. Corrections are made via reversal entries that debit/credit the opposite direction. The `deleted_at` column exists for extreme scenarios but should never be used in normal operation.

#### 2.2.5 daily_sales

Single entry per location per date capturing summary of the day's sales.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | |
| sale_date | DATE | NOT NULL | | Business date |
| cash_total | DECIMAL(15,2) | NOT NULL | 0.00 | Cash collected |
| card_total | DECIMAL(15,2) | NOT NULL | 0.00 | Card payments |
| mpesa_total | DECIMAL(15,2) | NOT NULL | 0.00 | M-Pesa payments |
| delivery_partner_total | DECIMAL(15,2) | NOT NULL | 0.00 | UberEats/Glovo/etc |
| net_sales | DECIMAL(15,2) | NOT NULL | 0.00 | Computed: sum of all totals minus discounts |
| discount_amount | DECIMAL(15,2) | NOT NULL | 0.00 | Total discounts given |
| void_amount | DECIMAL(15,2) | NOT NULL | 0.00 | Voided order value |
| notes | TEXT | | NULL | Any remarks |
| entered_by | BIGINT | FK → users(id) | NOT NULL | User who entered the data |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Constraints:**
- `UNIQUE(location_id, sale_date)` — only one sales entry per location per day
- `CHECK (sale_date <= CURRENT_DATE)` — cannot enter future sales
- `CHECK (net_sales >= 0)` — sales cannot be negative

**Indexes:** `idx_sales_location_date` (UNIQUE composite), `idx_sales_date_range` ON (sale_date)

#### 2.2.6 expense_categories

Taxonomy of expense types.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| name | VARCHAR(100) | NOT NULL | | e.g., "Food Supplies", "Utilities" |
| description | TEXT | | NULL | |
| is_location_specific | BOOLEAN | NOT NULL | TRUE | If FALSE, category is global/centralized |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Seed Data:** Food Supplies, Beverages, Utilities, Rent, Salaries, Marketing, Maintenance, Transport, Licenses, Miscellaneous

#### 2.2.7 expenses

Individual expense records.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | |
| category_id | BIGINT | FK → expense_categories(id), NOT NULL | | |
| amount | DECIMAL(15,2) | NOT NULL | | |
| description | TEXT | NOT NULL | | What was purchased |
| expense_date | DATE | NOT NULL | | |
| payment_method | ENUM('cash','mpesa','bank_transfer','card') | NOT NULL | | |
| receipt_image_url | TEXT | | NULL | Path to uploaded receipt photo |
| is_reimbursable | BOOLEAN | | FALSE | For staff-paid expenses |
| reimbursed_to | BIGINT | FK → users(id) | NULL | Employee reimbursed |
| entered_by | BIGINT | FK → users(id) | NOT NULL | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:** `idx_expenses_location`, `idx_expenses_category`, `idx_expenses_date`, `idx_expenses_location_date` (composite)

#### 2.2.8 suppliers

Vendor/producer profiles.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| name | VARCHAR(255) | NOT NULL | | |
| phone | VARCHAR(20) | | NULL | |
| email | VARCHAR(255) | | NULL | |
| contact_person | VARCHAR(255) | | NULL | |
| krapin | VARCHAR(20) | | NULL | KRA PIN for tax reporting |
| payment_terms_days | INTEGER | NOT NULL | 30 | Net days |
| credit_limit | DECIMAL(15,2) | | NULL | Maximum outstanding payable |
| notes | TEXT | | NULL | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

#### 2.2.9 bills

Accounts payable records (invoices from suppliers).

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | |
| supplier_id | BIGINT | FK → suppliers(id) | NULL | NULL for one-off bills |
| bill_number | VARCHAR(100) | | NULL | Supplier's invoice number |
| description | TEXT | NOT NULL | | |
| amount | DECIMAL(15,2) | NOT NULL | | Total bill amount |
| amount_paid | DECIMAL(15,2) | NOT NULL | 0.00 | Running total of payments |
| balance_due | DECIMAL(15,2) | NOT NULL | amount - amount_paid | Computed on every payment |
| issue_date | DATE | NOT NULL | | Invoice date |
| due_date | DATE | NOT NULL | | Payment deadline |
| status | ENUM('pending','partial','paid','overdue','cancelled') | NOT NULL | 'pending' | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:** `idx_bills_location`, `idx_bills_status`, `idx_bills_due_date`, `idx_bills_supplier`, `idx_bills_location_status_due` (composite for dashboard queries)

#### 2.2.10 recurring_bill_templates

Schedule definitions for recurring expenses.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | |
| supplier_id | BIGINT | FK → suppliers(id) | NULL | |
| description | TEXT | NOT NULL | | e.g., "Monthly Rent - Westlands" |
| amount | DECIMAL(15,2) | NOT NULL | | |
| frequency | ENUM('weekly','monthly','quarterly','annually') | NOT NULL | | |
| day_of_week | SMALLINT | | NULL | 0=Sun, 6=Sat; used for weekly |
| day_of_month | SMALLINT | | NULL | 1-31; used for monthly/quarterly/annually |
| month_of_year | SMALLINT | | NULL | 1-12; used for annually |
| next_due_date | DATE | NOT NULL | | Next instance when bill will be created |
| is_active | BOOLEAN | NOT NULL | TRUE | Can pause without deleting |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

#### 2.2.11 bill_payments

Individual payments against bills.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| bill_id | BIGINT | FK → bills(id), NOT NULL | | |
| payment_method | ENUM('cash','mpesa','bank_transfer','card') | NOT NULL | | |
| amount | DECIMAL(15,2) | NOT NULL | | Payment amount |
| payment_date | DATE | NOT NULL | | |
| reference | VARCHAR(100) | | NULL | M-Pesa transaction code, cheque no, etc. |
| notes | TEXT | | NULL | |
| entered_by | BIGINT | FK → users(id) | NOT NULL | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

#### 2.2.12 employees

Staff payroll profiles.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | Employee belongs to one location |
| user_id | BIGINT | FK → users(id) | NULL | Link to system login (optional for MVP) |
| full_name | VARCHAR(255) | NOT NULL | | |
| phone | VARCHAR(20) | NOT NULL | | |
| id_number | VARCHAR(20) | | NULL | National ID |
| krapin | VARCHAR(20) | | NULL | KRA PIN for tax deductions |
| nssf_number | VARCHAR(20) | | NULL | NSSF deduction |
| nhif_number | VARCHAR(20) | | NULL | NHIF deduction |
| salary_type | ENUM('monthly','weekly','daily','hourly') | NOT NULL | | |
| basic_salary | DECIMAL(15,2) | NOT NULL | | Monthly rate or equivalent |
| bank_name | VARCHAR(100) | | NULL | |
| bank_account | VARCHAR(50) | | NULL | |
| bank_code | VARCHAR(10) | | NULL | |
| employment_date | DATE | NOT NULL | | |
| termination_date | DATE | | NULL | |
| is_active | BOOLEAN | NOT NULL | TRUE | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

#### 2.2.13 payroll_periods

Pay periods for processing salaries.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| location_id | BIGINT | FK → locations(id), NOT NULL | | |
| period_name | VARCHAR(50) | NOT NULL | | e.g., "April 2026 - First Half" |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |
| payment_date | DATE | NOT NULL | | When salaries are paid |
| status | ENUM('open','processing','paid','cancelled') | NOT NULL | 'open' | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Constraints:** `UNIQUE(location_id, start_date, end_date)`, `CHECK (end_date >= start_date)`

#### 2.2.14 payroll_entries

Individual employee salary records per period.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| period_id | BIGINT | FK → payroll_periods(id), NOT NULL | | |
| employee_id | BIGINT | FK → employees(id), NOT NULL | | |
| basic_pay | DECIMAL(15,2) | NOT NULL | | Salary for this period |
| advances_deducted | DECIMAL(15,2) | NOT NULL | 0.00 | Sum of outstanding advances to deduct |
| deductions | DECIMAL(15,2) | NOT NULL | 0.00 | NSSF, NHIF, other deductions |
| bonuses | DECIMAL(15,2) | NOT NULL | 0.00 | Any additional payments |
| overtime_pay | DECIMAL(15,2) | NOT NULL | 0.00 | Overtime computed |
| net_pay | DECIMAL(15,2) | NOT NULL | basic_pay + bonuses + overtime - advances_deducted - deductions | Computed |
| payment_method | ENUM('cash','mpesa','bank_transfer') | | 'mpesa' | |
| paid_at | TIMESTAMP | | NULL | When payment was processed |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Constraints:** `UNIQUE(period_id, employee_id)`, `CHECK (net_pay >= 0)`

#### 2.2.15 payroll_advances

Salary advances taken by employees.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| employee_id | BIGINT | FK → employees(id), NOT NULL | | |
| amount | DECIMAL(15,2) | NOT NULL | | Advance amount |
| balance_remaining | DECIMAL(15,2) | NOT NULL | amount | How much still owed |
| request_date | DATE | NOT NULL | | |
| repayment_periods | INTEGER | | 1 | Number of pay periods to deduct across |
| status | ENUM('pending','approved','partially_repaid','repaid','cancelled') | NOT NULL | 'pending' | |
| approved_by | BIGINT | FK → users(id) | NULL | Admin approval |
| notes | TEXT | | NULL | |
| deleted_at | TIMESTAMP | | NULL | |
| created_at | TIMESTAMP | NOT NULL | NOW() | |
| updated_at | TIMESTAMP | NOT NULL | NOW() | |

**Constraint:** `CHECK (balance_remaining >= 0)`

#### 2.2.16 audit_log

Immutable record of all important mutations.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| id | BIGSERIAL | PK | | |
| table_name | VARCHAR(100) | NOT NULL | | Entity name |
| record_id | BIGINT | NOT NULL | | PK of the affected record |
| action | ENUM('CREATE','UPDATE','DELETE','RESTORE','LOGIN','LOGOUT') | NOT NULL | | |
| old_values | JSONB | | NULL | Snapshot before change |
| new_values | JSONB | | NULL | Snapshot after change |
| changed_by | BIGINT | FK → users(id) | NULL | Who performed the action |
| ip_address | VARCHAR(45) | | NULL | Client IP for security audit |
| user_agent | TEXT | | NULL | Browser/device info |
| created_at | TIMESTAMP | NOT NULL | NOW() | |

**Indexes:** `idx_audit_table_record`, `idx_audit_changed_by`, `idx_audit_created_at` DESC, `idx_audit_action`

> **IMPORTANT:** The `audit_log` table is WRITE-ONLY. No DELETEs, no UPDATEs. Only the system should insert via database triggers or application-level hooks.

### 2.3 Soft-Delete Pattern

All primary entity tables follow this pattern:

```sql
ALTER TABLE {table_name}
  ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

-- ALL queries SELECT ... FROM {table} WHERE deleted_at IS NULL
-- ALL queries (except admin export/sudo mode)
```

**Application-level enforcement:**
- `DELETE` operations set `deleted_at = NOW()` and `is_deleted = TRUE` (where column exists)
- Managers **cannot** delete — only admin can
- All DELETE actions are logged in `audit_log`
- Cascade deletes are **never** automatic; cascade is application-level soft-delete

### 2.4 Sample Migration Pseudocode

```python
# /backend/migrations/001_initial_schema.py
from sqlalchemy import create_engine, MetaData

def upgrade():
    # Create locations
    locations = Table('locations', metadata,
        Column('id', BigInteger, primary_key=True),
        Column('name', String(255), nullable=False),
        Column('created_at', DateTime, server_default=func.now()),
        # ... all columns above
    )

    # Create audit_log BEFORE any other table's triggers reference it
    audit_log = Table('audit_log', metadata, ...)

    # Create remaining tables
    # ...

    # Create audit trigger function
    # CREATE FUNCTION audit_trigger() RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;

    # Apply trigger to all tracked tables
    # CREATE TRIGGER trg_{table}_audit AFTER INSERT OR UPDATE OR DELETE ON {table}
    #   FOR EACH ROW EXECUTE FUNCTION audit_trigger();

def downgrade():
    # Drop all triggers first
    # Drop all tables in reverse dependency order
    pass
```

---

## 3. API Endpoint Catalog

### 3.1 API Design Conventions

| Aspect | Standard |
|---|---|
| Base URL | `/api/v1` |
| Response envelope | `{ "success": bool, "data": {}, "meta": {}, "error": {} }` |
| Pagination | `?page=1&per_page=50` (max 100), response includes `{ total, page, per_page, total_pages }` |
| Filtering | `?field=value`, `?date_from=2026-01-01&date_to=2026-04-29` |
| Sorting | `?sort=-created_at` (descending with minus prefix) |
| Auth | `Authorization: Bearer <jwt_token>` |
| Error format | `{ "code": "VALIDATION_ERROR", "message": "...", "details": {} }` |

### 3.2 Authentication & User Management

| Method | Path | Description | Auth | Manager Access |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Email + password → JWT pair | None | N/A |
| POST | `/api/v1/auth/refresh` | Refresh token → new JWT | Bearer | N/A |
| POST | `/api/v1/auth/logout` | Invalidate current token | Bearer | All |
| GET | `/api/v1/auth/me` | Current user profile | Bearer | All |
| POST | `/api/v1/auth/change-password` | Current + new password | Bearer | All |

**Login Request:**
```json
{
  "email": "manager@westlands.example.com",
  "password": "securepassword123"
}
```

**Login Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "...", "full_name": "...", "role": "manager", "location_id": 1 },
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `401` — Invalid credentials
- `403` — Account deactivated
- `429` — Too many login attempts (rate limit: 5 attempts per minute per IP)

### 3.3 Locations (Admin Only)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/locations` | List all active locations | Admin |
| GET | `/api/v1/locations/{id}` | Location detail with summary stats | Admin |
| POST | `/api/v1/locations` | Create new location | Admin |
| PUT | `/api/v1/locations/{id}` | Update location | Admin |
| DELETE | `/api/v1/locations/{id}` | Soft-delete location (only if no active data) | Admin |

### 3.4 Users (Admin Only)

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/users` | List all users (supports ?role=, ?location_id=) | Admin |
| GET | `/api/v1/users/{id}` | User detail | Admin |
| POST | `/api/v1/users` | Create user (invite email sent) | Admin |
| PUT | `/api/v1/users/{id}` | Update user | Admin |
| DELETE | `/api/v1/users/{id}` | Soft-delete user | Admin |

### 3.5 Daily Sales

| Method | Path | Description | Auth | Note |
|---|---|---|---|---|
| GET | `/api/v1/sales` | List daily sales | Bearer | Filters by user's location (manager) or all (admin) |
| GET | `/api/v1/sales/{id}` | Single sale detail | Bearer | Location-scoped |
| POST | `/api/v1/sales` | Create daily sale | Bearer | Enforces date uniqueness per location |
| PUT | `/api/v1/sales/{id}` | Update sale | Bearer | Only if same date (recalc ledger) |
| DELETE | `/api/v1/sales/{id}` | Soft-delete sale + auto-void ledger entries | Admin only | |

**Create Daily Sale Request:**
```json
{
  "location_id": 1,
  "sale_date": "2026-04-29",
  "cash_total": 45200.00,
  "card_total": 12800.00,
  "mpesa_total": 31500.00,
  "delivery_partner_total": 8750.00,
  "discount_amount": 1200.00,
  "void_amount": 0.00,
  "notes": "Busy lunch service"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 147,
    "location_id": 1,
    "sale_date": "2026-04-29",
    "gross_sales": 98250.00,
    "net_sales": 97050.00,
    "ledger_entries": [
      { "account_id": 1, "entry_type": "credit", "amount": 45200.00 },
      { "account_id": 2, "entry_type": "credit", "amount": 12800.00 },
      { "account_id": 3, "entry_type": "credit", "amount": 31500.00 },
      { "account_id": 4, "entry_type": "credit", "amount": 8750.00 }
    ]
  }
}
```

**Error Responses:**
- `409` — Sale already exists for this location/date combination (`CONFLICT_DUPLICATE_SALE`)
- `422` — Future date not allowed (`FUTURE_DATE_NOT_ALLOWED`)
- `422` — Negative net sales (`NEGATIVE_SALES_NOT_ALLOWED`)

### 3.6 Expenses

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/expenses` | List expenses with filtering (?category_id=, ?date_from=, ?date_to=) | Bearer |
| GET | `/api/v1/expenses/{id}` | Single expense | Bearer |
| POST | `/api/v1/expenses` | Create expense (attaches receipt image via multipart) | Bearer |
| PUT | `/api/v1/expenses/{id}` | Update expense | Bearer |
| DELETE | `/api/v1/expenses/{id}` | Soft-delete + auto-reverse ledger | Admin only |
| GET | `/api/v1/expense-categories` | List all categories | Bearer |
| POST | `/api/v1/expense-categories` | Create category | Admin |
| PUT | `/api/v1/expense-categories/{id}` | Update category | Admin |

### 3.7 Suppliers

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/suppliers` | List all suppliers (with ?search= for name) | Bearer |
| GET | `/api/v1/suppliers/{id}` | Supplier detail with bill summary | Bearer |
| POST | `/api/v1/suppliers` | Create supplier | Bearer |
| PUT | `/api/v1/suppliers/{id}` | Update supplier | Bearer |
| DELETE | `/api/v1/suppliers/{id}` | Soft-delete (only if no outstanding bills) | Admin |

### 3.8 Bills & Payments

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/bills` | List bills (?status=overdue, ?supplier_id=, ?date_from=, ?date_to=) | Bearer |
| GET | `/api/v1/bills/{id}` | Bill detail with payment history | Bearer |
| POST | `/api/v1/bills` | Create bill | Bearer |
| PUT | `/api/v1/bills/{id}` | Update bill | Bearer |
| DELETE | `/api/v1/bills/{id}` | Soft-delete (only if status=pending) | Admin |
| POST | `/api/v1/bills/{id}/pay` | Record payment against bill | Bearer | |
| GET | `/api/v1/bills/{id}/payments` | Payment history for bill | Bearer |
| GET | `/api/v1/recurring-bills` | List recurring templates | Bearer |
| POST | `/api/v1/recurring-bills` | Create recurring bill template | Bearer |
| PUT | `/api/v1/recurring-bills/{id}` | Update template | Bearer |
| DELETE | `/api/v1/recurring-bills/{id}` | Soft-delete template | Admin |

**Record Payment Request:**
```json
{
  "bill_id": 89,
  "payment_method": "mpesa",
  "amount": 50000.00,
  "payment_date": "2026-04-29",
  "reference": "QWE1R2T3Y4",
  "notes": "Partial payment for April supply"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "bill_id": 89,
    "previous_balance_due": 120000.00,
    "payment_amount": 50000.00,
    "new_balance_due": 70000.00,
    "new_status": "partial",
    "ledger_entry": { "account_id": 1, "entry_type": "debit", "amount": 50000.00 }
  }
}
```

### 3.9 Payroll

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/employees` | List employees (?active=true, ?location_id=) | Bearer |
| GET | `/api/v1/employees/{id}` | Employee detail with advance history | Bearer |
| POST | `/api/v1/employees` | Create employee | Admin |
| PUT | `/api/v1/employees/{id}` | Update employee | Admin |
| DELETE | `/api/v1/employees/{id}` | Soft-delete (terminated employees retained for history) | Admin |
| GET | `/api/v1/payroll-periods` | List pay periods (?status=, ?location_id=) | Bearer |
| POST | `/api/v1/payroll-periods` | Create pay period | Admin |
| PUT | `/api/v1/payroll-periods/{id}/close` | Close period, compute entries | Admin |
| PUT | `/api/v1/payroll-periods/{id}/pay` | Mark period as paid, create ledger entries | Admin |
| GET | `/api/v1/payroll-entries` | List entries (?period_id=, ?employee_id=) | Bearer |
| PUT | `/api/v1/payroll-entries/{id}` | Edit entry (bonuses, deductions) before payment | Admin |
| GET | `/api/v1/advances` | List advances (?employee_id=, ?status=) | Bearer |
| POST | `/api/v1/advances` | Request advance | Manager |
| PUT | `/api/v1/advances/{id}/approve` | Approve advance | Admin |
| PUT | `/api/v1/advances/{id}/cancel` | Cancel advance | Admin |

### 3.10 Accounts & Ledger

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/accounts` | List accounts (?location_id=, ?type=) | Bearer |
| GET | `/api/v1/accounts/{id}` | Account detail with current balance | Bearer |
| POST | `/api/v1/accounts` | Create account | Admin |
| PUT | `/api/v1/accounts/{id}` | Update account | Admin |
| DELETE | `/api/v1/accounts/{id}` | Soft-delete (only if zero balance) | Admin |
| GET | `/api/v1/ledger` | Query ledger entries (?account_id=, ?date_from=, ?date_to=, ?transaction_type=) | Bearer |
| GET | `/api/v1/ledger/balance` | Get current balance for account(s) | Bearer |
| POST | `/api/v1/ledger/reconcile` | Reconcile account — set manual balance checkpoint | Admin |

### 3.11 Calendar

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/calendar` | Aggregated view of all obligations | Bearer |

**Calendar Query Parameters:**
- `date_from` (required) — Start of range
- `date_to` (required) — End of range
- `type` — Filter: `bill`, `payroll`, `advance_repayment`, `all` (default)
- `location_id` — Filter by location
- `status` — Filter by status

**Calendar Response (200):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "bill-89",
        "type": "bill",
        "title": "Rent - Westlands",
        "amount": 120000.00,
        "status": "overdue",
        "date": "2026-04-25",
        "location_id": 1,
        "location_name": "Mama's Kitchen - Westlands"
      },
      {
        "id": "payroll-12",
        "type": "payroll",
        "title": "April 2026 - Second Half Salary",
        "amount": 485000.00,
        "status": "open",
        "date": "2026-04-30",
        "location_id": 1,
        "location_name": "Mama's Kitchen - Westlands"
      }
    ],
    "date_range": { "from": "2026-04-01", "to": "2026-05-31" },
    "totals": {
      "bills_due": 320000.00,
      "payroll_due": 970000.00,
      "advance_repayments": 15000.00,
      "total_obligations": 1305000.00
    }
  }
}
```

### 3.12 Dashboard

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/dashboard/summary` | Aggregated KPIs for date range | Bearer |
| GET | `/api/v1/dashboard/cashflow` | Cashflow chart data (daily net cashflow) | Bearer |
| GET | `/api/v1/dashboard/alerts` | Urgent items (overdue bills, low balance) | Bearer |

### 3.13 Audit Log

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/audit` | Query audit log (?table_name=, ?action=, ?changed_by=, ?date_range) | Admin only |

---

## 4. Business Logic Details

### 4.1 Daily Sales

#### 4.1.1 Uniqueness Enforcement

- **Rule:** One `daily_sales` record per `(location_id, sale_date)` pair
- **Implementation:** Unique composite constraint at database level + application-level check before insert
- **Conflict resolution:** If a record exists, return `409 CONFLICT` with existing record ID. User can choose to update existing record or navigate
- **Edge case:** Midnight cutoff — `sale_date` is business date, not entry timestamp. A sale from 2:00 AM on April 30 would normally be recorded on April 29's sales if it was from the previous service. The system uses the date selected by the user, not the system clock.

#### 4.1.2 Net Sales Calculation

```
net_sales = cash_total + card_total + mpesa_total + delivery_partner_total - discount_amount - void_amount
```

- All monetary fields use `DECIMAL(15,2)` for KES precision
- `discount_amount` and `void_amount` are subtractive, reducing net sales
- Validation: `net_sales >= 0` enforced via CHECK constraint

#### 4.1.3 Ledger Integration

Each sale auto-creates **one ledger entry per payment method account**:

| Field | Entry 1 (Cash) | Entry 2 (Card) | Entry 3 (M-Pesa) | Entry 4 (Delivery) |
|---|---|---|---|---|
| account_id | Location's Cash Account | Location's Card Account | Location's M-Pesa Account | Location's Delivery Account |
| entry_type | credit | credit | credit | credit |
| amount | cash_total | card_total | mpesa_total | delivery_partner_total |
| transaction_type | 'sale' | 'sale' | 'sale' | 'sale' |
| transaction_id | daily_sales.id | daily_sales.id | daily_sales.id | daily_sales.id |
| entry_date | sale_date | sale_date | sale_date | sale_date |

> **Design Decision:** Sales are always **credits** to accounts (money coming in). Expenses and payments are **debits** (money going out). This follows the accounting convention: revenue accounts increase on credit.

### 4.2 Ledger & Balance Calculations

#### 4.2.1 Architecture: Enhanced Single-Entry

The system uses **enhanced single-entry accounting** — not full double-entry. Rationale:

- Target users are restaurant managers, not accountants
- Full double-entry (debits/credits on separate accounts balancing to zero) is complex and error-prone for non-accountants
- Enhanced single-entry: every transaction records an entry against a specific account with a running balance, plus a `transaction_type` and `transaction_id` for full traceability
- The `ledger_entries` table provides auditability without requiring users to understand double-entry

#### 4.2.2 Balance Calculation Strategy

**Option A (Preferred for MVP): Cached Running Balance**

- Each `ledger_entry` stores `balance_after` — the account's balance immediately after this entry
- On insert, compute: `balance_after = (SELECT balance_after FROM ledger_entries WHERE account_id = ? ORDER BY created_at DESC LIMIT 1) +/- amount`
- `current_balance` on the `accounts` table is synced periodically or via trigger
- This provides O(1) read performance for balance queries

**Option B (Fallback): On-the-Fly Summation**

- `SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END), 0) + opening_balance FROM ledger_entries WHERE account_id = ? AND deleted_at IS NULL`
- Safe but slow for large datasets; requires covering index on `(account_id, entry_type, amount)`

**MVP Recommendation:** Use **Option A** for the running balance column, with a background reconciliation job that occasionally validates using Option B's method to catch any drift.

#### 4.2.3 Transaction Type Summary

| Module | Transaction Type | Entry Direction | Account(s) Affected |
|---|---|---|---|
| Daily Sales | `sale` | Credit | Cash, Card, M-Pesa, Delivery |
| Expenses | `expense` | Debit | The account used for payment |
| Bill Payment | `bill_payment` | Debit | The payment source account |
| Supplier Payment | `supplier_payment` | Debit | The payment source account |
| Payroll | `payroll` | Debit | Cash/Bank account (salary payments) |
| Salary Advance | `advance` | Debit | Cash/Bank account |
| Transfer | `transfer` | Debit (source) + Credit (destination) | Both accounts |
| Opening Balance | `opening_balance` | Credit | Opening balance account |

### 4.3 Accounts

#### 4.3.1 Account Types

| Type | Description | Example |
|---|---|---|
| `cash` | Physical cash in the drawer | "Main Cash Drawer - Westlands" |
| `mpesa` | M-Pesa business paybill/till number | "M-Pesa Till 123456" |
| `bank_account` | Bank current/savings account | "Equity Bank - Westlands Op Account" |

#### 4.3.2 Opening Balance

- Set when an account is created
- Creates an opening ledger entry with `transaction_type = 'opening_balance'` and `entry_type = 'credit'`
- This ensures `current_balance` starts correctly without requiring manual reconciliation
- Opening balance can be zero for new accounts

#### 4.3.3 Reconciliation

- Admins can perform periodic reconciliation: compare system balance vs actual physical cash/bank statement
- Reconciliations create a checkpoint: `reconciled_balance` and `reconciliation_date`
- Discrepancies can be noted and adjusted via a `transfer` entry

### 4.4 Expenses

#### 4.4.1 Category Taxonomy

Expense categories are seeded globally but can be marked as location-specific:

| Category | Global? | Typical Use |
|---|---|---|
| Food Supplies | No (location-specific) | Raw ingredients per restaurant |
| Beverages | No | Drink stock |
| Utilities | Yes (global) | Electricity, water — paid centrally |
| Rent | Yes | Per location lease |
| Salaries & Wages | No | Staff costs per location |
| Marketing | Yes | Brand advertising |
| Maintenance & Repairs | No | Equipment fixes |
| Transport & Delivery | No | Logistics costs |
| Licenses & Permits | Yes | County health permits |
| Miscellaneous | Yes | Uncategorized |

#### 4.4.2 Receipt Attachment Handling

- Receipt images uploaded via multipart/form-data
- Stored on local filesystem or S3-compatible object storage in MVP
- Supported formats: JPG, PNG, PDF (first page as thumbnail)
- Max file size: 5 MB per receipt
- Image path stored in `receipt_image_url` column
- Display option: click to view expanded image in a lightbox modal

#### 4.4.3 Ledger Integration

Each expense creates a single **debit** entry against the selected payment method's account:

```sql
INSERT INTO ledger_entries (account_id, transaction_type, transaction_id, entry_type, amount, balance_after, entry_date, created_by)
VALUES (@payment_account_id, 'expense', @expense_id, 'debit', @amount, @new_balance, @expense_date, @user_id);
```

### 4.5 Suppliers & Bills

#### 4.5.1 Supplier Profile Fields

Each supplier record tracks:
- Basic identification (name, phone, email)
- KRA PIN for compliance (linked to ETR/invoice requirements)
- Payment terms (net days) — defaults to 30
- Credit limit — nullable; when set, the system warns before creating bills that would exceed this limit
- Total outstanding balance (computed: `SUM(bills.balance_due) WHERE status IN ('pending','partial','overdue')`)

#### 4.5.2 Bill Lifecycle

```
status flow:
  pending --> partial --> paid
     |          |
     +--> overdue --> partial --> paid
     |          |
     +--> cancelled (admin only)
```

- **pending:** Created, no payments yet, due_date not reached
- **partial:** At least one payment recorded, balance_due > 0
- **paid:** balance_due = 0
- **overdue:** balance_due > 0 AND CURRENT_DATE > due_date
- **cancelled:** Admin-marked as void

**Status transitions are computed, not stored.** The `status` column in the database is computed on read by evaluating `amount_paid`, `amount`, and `due_date` relative to today. This avoids stale status values.

#### 4.5.3 Credit Limit Tracking

When creating a new bill:

```python
def check_credit_limit(supplier_id, new_bill_amount):
    supplier = get_supplier(supplier_id)
    if not supplier.credit_limit:
        return  # No limit configured

    current_outstanding = db.query(func.sum(Bills.balance_due))\
        .filter(Bills.supplier_id == supplier_id,
                Bills.status.in_(['pending', 'partial', 'overdue']),)
        .scalar() or 0

    if current_outstanding + new_bill_amount > supplier.credit_limit:
        raise Warning(f"This bill would exceed {supplier.name}'s credit limit of KES {supplier.credit_limit:,.2f}")
    # Bill is still created — warning, not blocking
```

### 4.6 Recurring Bills

#### 4.6.1 Schedule Configuration

| Frequency | day_of_week | day_of_month | month_of_year | Example |
|---|---|---|---|---|
| weekly | 0-6 | NULL | NULL | Every Monday (1) |
| monthly | NULL | 1-31 | NULL | 1st of every month |
| quarterly | NULL | 1-31 | NULL | 1st of Jan, Apr, Jul, Oct |
| annually | NULL | 1-31 | 1-12 | 1st April every year |

**Day clamping:** If day_of_month is 31 but month has only 28/30 days, the system uses the last day of that month (e.g., February 31 → February 28).

#### 4.6.2 Auto-Creation Strategy

A cron job (or Bull queue) runs daily:

1. Find all active recurring templates where `next_due_date <= CURRENT_DATE`
2. For each template, create a new `bills` record with:
   - `description` from template
   - `amount` from template (note: future versions may support variable amounts)
   - `issue_date = CURRENT_DATE`
   - `due_date = next_due_date` (or computed based on frequency if `next_due_date` was a trigger)
   - `status = 'pending'`
3. Update template's `next_due_date` to the next occurrence based on frequency
4. Log the creation in `audit_log`

#### 4.6.3 Escalation Logic

For overdue bills:
- **3 days overdue:** Status updates to `overdue` (computed)
- **7 days overdue:** Push notification to location manager + entry added to dashboard alerts
- **14 days overdue:** SMS alert to location manager and admin (requires Twilio integration)
- **30 days overdue:** Notification to business owner

### 4.7 Payroll

#### 4.7.1 Pay Period Definition

Pay periods are defined by the admin. Common patterns:

- **Monthly:** First half (1st–15th) and second half (16th–end of month)
- **Monthly single payment:** 1st–end of month, paid on 25th or last day
- **Weekly:** Every Monday–Sunday

Each period has `start_date`, `end_date`, and `payment_date`.

#### 4.7.2 Employee Profile Fields

Required for KRA-compliant payroll:
- `krapin` — KRA Personal Identification Number
- `nssf_number` — National Social Security Fund
- `nhif_number` — National Hospital Insurance Fund
- `salary_type` — Determines how `basic_pay` is prorated
- `bank_details` — For direct payments

#### 4.7.3 Salary & Advance Logic

**Salary Calculation:**

```python
def compute_payroll_entry(employee, period):
    # Compute basic pay for the period based on salary_type
    if employee.salary_type == 'monthly':
        basic_pay = employee.basic_salary * (period_days / 30)
    elif employee.salary_type == 'weekly':
        basic_pay = employee.basic_salary * (period_weeks or 1)
    # ...

    # Deduct outstanding advances
    outstanding_advances = sum of advances where status in ('approved','partially_repaid')
    per_period_deduction = outstanding_advances / repayment_periods (min 1)

    # Fixed deductions (NSSF, NHIF)
    nssf = min(basic_pay * 0.06, 2160)  # KRA rates as of 2026
    nhif = tiered_rate(employee.nhif_number, basic_pay)

    net_pay = basic_pay + bonuses + overtime_pay - per_period_deduction - nssf - nhif
    return { basic_pay, advances_deducted: per_period_deduction, nssf, nhif, net_pay }
```

**Advance Logic:**
- Employee requests advance (amount, reason)
- Manager approves → creates `payroll_advances` record with `status = 'approved'`
- Balance is deducted from next payroll (or spread across N periods if `repayment_periods > 1`)
- Each payroll entry deducts `balance_remaining / remaining_periods`
- Advance is fully repaid when `balance_remaining = 0` and status → `'repaid'`

#### 4.7.4 Payslip Generation

When payroll is processed, each employee sees:

```
PAYSLIP: April 2026 - First Half
----------------------------------------
Employee: Jane Wanjiku
Period: 01-Apr-2026 to 15-Apr-2026

Earnings:
  Basic Pay:              KES 30,000.00
  Overtime:               KES  2,500.00
  Bonus:                  KES  1,000.00

Deductions:
  Advance Repayment:     -KES  5,000.00
  NSSF:                  -KES  1,080.00
  NHIF:                  -KES    750.00
  PAYE (Withholding):    -KES  2,310.00
----------------------------------------
  NET PAY:               KES 24,360.00
```

Payslips are served via a dedicated read-only API endpoint or downloadable PDF.

### 4.8 Unified Calendar

#### 4.8.1 Aggregation Query Strategy

The calendar endpoint performs a **UNION** query across three sources:

```sql
SELECT 'bill' AS type, id, description, amount, due_date AS event_date, status, location_id
FROM bills
WHERE deleted_at IS NULL
  AND due_date BETWEEN :date_from AND :date_to

UNION ALL

SELECT 'payroll' AS type, pp.id, pp.period_name AS description,
       SUM(pe.net_pay) AS amount,
       pp.payment_date AS event_date,
       pp.status, pp.location_id
FROM payroll_periods pp
JOIN payroll_entries pe ON pe.period_id = pp.id
WHERE pp.deleted_at IS NULL
  AND pp.payment_date BETWEEN :date_from AND :date_to
GROUP BY pp.id

UNION ALL

SELECT 'advance_repayment' AS type, pa.id,
       CONCAT('Advance Repayment - ', e.full_name) AS description,
       pa.amount / pa.repayment_periods AS amount,
       pp.payment_date AS event_date,
       pa.status, pp.location_id
FROM payroll_advances pa
JOIN employees e ON e.id = pa.employee_id
JOIN payroll_periods pp ON pp.location_id = e.location_id
WHERE pa.deleted_at IS NULL
  AND pa.status IN ('approved','partially_repaid')
  AND pp.payment_date BETWEEN :date_from AND :date_to
```

#### 4.8.2 Filtering & Display

- **Type filter:** `?type=bill|payroll|advance_repayment|all`
- **Location filter:** `?location_id=1`
- **Status filter:** `?status=overdue|pending|paid|open`
- **Date range:** `?date_from=2026-04-01&date_to=2026-05-31`
- Events are sorted chronologically by `event_date`
- Financial totals are aggregated by month for the cashflow forecast

---

## 5. Frontend Architecture & Component Spec

### 5.1 Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Framework | React 18+ with Vite | Fast HMR, excellent mobile performance, tree-shaking |
| Routing | React Router v6 | Declarative routing with nested layouts for location-based scoping |
| State Management | Zustand + React Query | Zustand for UI state (sidebar open, filters); React Query for server state (caching, pagination, optimistic updates) |
| HTTP Client | Axios | Interceptors for JWT refresh, request/response transformation |
| Styling | Tailwind CSS v3 + Hand-written CSS | Tailwind for utility-first responsive design; custom CSS for distinctive editorial typography and magazine-style layouts |
| Icons | Lucide React | Simple, consistent icon set for restaurant POS-like UI |
| Date Handling | date-fns | Lightweight; Kenyan timezone (`Africa/Nairobi`) support |
| Forms | React Hook Form + Zod | Performant forms with schema-based validation |
| Charts | Recharts | Simple React-native charting for cashflow visualizations |

### 5.2 Component Tree & Navigation

```
App
├── AuthProvider (context + JWT management)
├── AppLayout
│   ├── MobileBottomNav (bottom tab bar on phones)
│   │   ├── Dashboard
│   │   ├── Sales
│   │   ├── Expenses
│   │   ├── Calendar
│   │   └── More (Menu)
│   ├── SidebarNavigation (desktop only, collapsible)
│   │   ├── Dashboard
│   │   ├── Daily Sales
│   │   ├── Expenses
│   │   ├── Suppliers
│   │   ├── Bills & Payments
│   │   ├── Payroll
│   │   ├── Accounts & Ledger
│   │   ├── Calendar
│   │   ├── Reports
│   │   └── Admin (users, locations, audit)
│   └── ContentArea
│       ├── DashboardPage
│       │   ├── KpiCard[] (Today's Sales, Expenses, Cash Balance, Upcoming Bills)
│       │   ├── CashflowChart
│       │   ├── RecentTransactionsList
│       │   └── AlertsWidget
│       ├── DailySalesPage
│       │   ├── SalesEntryForm
│       │   └── SalesHistoryTable (with inline editing)
│       ├── ExpensePage
│       │   ├── ExpenseForm
│       │   ├── ReceiptViewer (lightbox modal)
│       │   └── ExpenseList (with category filter)
│       ├── SuppliersPage
│       │   ├── SupplierList
│       │   ├── SupplierDetail
│       │   │   ├── SupplierInfoCard
│       │   │   └── BillListPerSupplier
│       │   └── SupplierForm
│       ├── BillsPage
│       │   ├── BillList (with status tabs: Pending/Overdue/Paid)
│       │   ├── BillDetail
│       │   │   ├── BillInfoCard
│       │   │   └── PaymentHistory
│       │   ├── BillForm
│       │   └── PaymentForm
│       ├── PayrollPage
│       │   ├── EmployeeList
│       │   ├── EmployeeDetail
│       │   │   ├── EmployeeInfoCard
│       │   │   └── AdvanceHistory
│       │   ├── PayPeriodList
│       │   ├── PayPeriodDetail
│       │   │   └── EmployeePayEntriesTable
│       │   ├── AdvanceForm
│       │   └── PayslipView (modal)
│       ├── AccountsPage
│       │   ├── AccountList
│       │   ├── AccountDetail
│       │   │   ├── BalanceCard
│       │   │   └── LedgerEntryTable (paginated)
│       │   └── AccountForm
│       ├── CalendarPage
│       │   ├── MonthViewGrid
│       │   ├── DayDetailList (events for selected day)
│       │   └── CashflowForecastSummary
│       ├── ReportsPage
│       │   ├── ProfitLossReport
│       │   ├── SupplierAgingReport
│       │   └── ExportOptions
│       └── AdminPage
│           ├── UserManager
│           ├── LocationManager
│           └── AuditLogViewer
```

### 5.3 Design System

#### 5.3.1 Typography

Distinctive, editorial feel — avoiding generic system fonts:

| Element | Font | Fallback | Usage |
|---|---|---|---|
| Headings (h1-h4) | **Playfair Display** | Georgia, serif | Page titles, card headers, dashboard KPI values |
| Body text | **Inter** | -apple-system, sans-serif | All reading content, table cells |
| Data/numbers | **JetBrains Mono** | Courier New, monospace | Monetary values, dates, IDs |
| Accent/quotations | **Crimson Pro** | Georgia, serif | Pull quotes, callout cards, special notes |

**Scale:** `text-xs` (12px) → `text-sm` (14px) → `text-base` (16px) → `text-lg` (18px) → `text-xl` (24px) → `text-2xl` (30px) → `text-3xl` (36px) → `text-4xl` (48px)

#### 5.3.2 Color Palette

Inspired by warm, professional restaurant aesthetics:

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| Brand Primary | `#C73E1D` | `--clr-primary` | Key CTAs, active nav items, sale amounts |
| Brand Secondary | `#2D2A26` | `--clr-secondary` | Headings, body text |
| Surface Light | `#FFF9F5` | `--clr-surface` | Page backgrounds, card surfaces |
| Surface Dark | `#F5EDE6` | `--clr-surface-alt` | Alternating rows, secondary cards |
| Accent Gold | `#D4A854` | `--clr-accent` | Highlight badges, revenue indicators |
| Success Green | `#2E7D32` | `--clr-success` | Paid status, positive cashflow |
| Warning Amber | `#ED6C02` | `--clr-warning` | Partial status, approaching deadlines |
| Danger Red | `#D32F2F` | `--clr-danger` | Overdue status, negative values, error states |
| Muted Grey | `#8D8A87` | `--clr-muted` | Secondary text, disabled states |
| Border Light | `#E8E0D8` | `--clr-border` | Card borders, dividers |

#### 5.3.3 Spacing System

Based on a 4px grid:
| Token | px | rem |
|---|---|---|
| `space-1` | 4 | 0.25 |
| `space-2` | 8 | 0.5 |
| `space-3` | 12 | 0.75 |
| `space-4` | 16 | 1 |
| `space-6` | 24 | 1.5 |
| `space-8` | 32 | 2 |
| `space-12` | 48 | 3 |
| `space-16` | 64 | 4 |
| `space-20` | 80 | 5 |

#### 5.3.4 Component Library

Custom components built on Tailwind (no third-party component library to avoid generic feel):

| Component | Description |
|---|---|
| `KpiCard` | Elevated card with icon, label, value (KES formatted), and mini trend indicator |
| `DataTable` | Striped rows, sticky header, sortable columns, responsive (card view on mobile) |
| `FormField` | Label, input, error message with micro-animated shake on validation error |
| `SubmitButton` | Button with loading spinner, disabled state, success transition |
| `StatusBadge` | Colored pill for paid/overdue/pending statuses |
| `AmountDisplay` | KES-formatted amount with negative values in red, positive in green |
| `CalendarGrid` | Month grid with event dots, clickable days expand to list |
| `AlertBanner` | Contextual notification bar (success, warning, error, info) |
| `FilterBar` | Horizontal scrollable filter chips for list views |
| `ConfirmModal` | Dialog for destructive actions with soft-delete confirmation |

### 5.4 Key Screens Descriptions

#### 5.4.1 Dashboard Screen

- **Layout:** 2-column grid on desktop, single-column on mobile
- **Top KPI row:** 4 `KpiCard`s: Today's Net Sales, Today's Expenses, Cash on Hand, Upcoming Bills (total within 7 days)
- **Chart section:** Line chart of daily net cashflow for last 30 days (if data exists); empty state shows "Start by entering your first day's sales"
- **Alert widget:** Red badges for overdue bills, yellow for bills due within 3 days
- **Header:** Location selector dropdown (if user has access to multiple), date display, profile menu

#### 5.4.2 Daily Sales Entry Form

- **Location selector:** Pre-filled for managers, dropdown for admins
- **Date picker:** Defaults to today, can go back up to 7 days (configurable)
- **Payment method inputs:** Four number inputs with KES prefix: Cash, Card, M-Pesa, Delivery
- **Discount & Void:** Optional numeric inputs below main totals
- **Auto-calculation:** Gross and net totals update in real-time as user types
- **Notes:** Optional text area
- **Submit button:** Large, primary color, full-width on mobile — "Record Sales"
- **Success state:** Brief toast notification, form resets for next day

#### 5.4.3 Expense Form

- **Category selector:** Searchable dropdown with category icons
- **Amount:** Numeric input with KES prefix
- **Description:** Text area with placeholder prompts ("e.g., 10kg tomatoes from Wakulima Market")
- **Payment method:** Radio buttons for cash/M-Pesa/bank transfer/card
- **Receipt upload:** Drag-and-drop zone → file picker → thumbnail preview
- **Date:** Defaults to today, calendar picker
- **Reimbursable toggle:** If checked, "Paid by" employee selector appears

#### 5.4.4 Supplier Detail Screen

- **Header card:** Supplier name, phone, email with contact person
- **KPI row:** Total outstanding, credit limit bar (visual indicator of how close to limit), on-time payment %
- **Bill tabs:** All (default) / Pending / Overdue / Paid
- **Each bill row:** Date, description, amount, balance due, days overdue (for overdue), status badge
- **Quick actions:** "Add Bill" button, "Record Payment" button

#### 5.4.5 Calendar View

- **Header:** Month/Year title, left/right arrows, "Today" button
- **Grid:** 7-column grid with day numbers; event indicators (colored dots: red=overdue, blue=bill, green=payroll, amber=advance)
- **Day detail:** Clicking a day shows a list of events in a slide-up panel (mobile) or right panel (desktop)
- **Summary bar:** Sticky bottom bar showing total obligations for visible month

### 5.5 State Management Approach

| Category | Solution | Rationale |
|---|---|---|
| Server data (API responses) | React Query (TanStack Query) | Caching, automatic refetch, pagination, optimistic updates for form submissions |
| UI state (modals, filters, sidebar) | Zustand | Simple, no boilerplate, persists to localStorage for session preferences |
| Auth state (user, token) | Zustand + httpOnly cookie | JWT stored in secure cookie; Zustand for UI state (logged-in, user profile) |
| Form state | React Hook Form | Uncontrolled inputs for performance; Zod schema for validation |

### 5.6 Form Validation Rules

| Form | Field | Rules |
|---|---|---|
| Daily Sales | `sale_date` | Required, <= today, no future dates |
| | `cash_total`, `card_total`, `mpesa_total`, `delivery_partner_total` | Required, >= 0, max 10 digits |
| | `discount_amount`, `void_amount` | Optional, >= 0, <= sum of totals |
| Expense | `category_id` | Required, must exist |
| | `amount` | Required, > 0, max 12 digits |
| | `description` | Required, max 500 chars |
| | `payment_method` | Required |
| | `receipt_image` | Optional, max 5MB, JPG/PNG/PDF |
| Bill | `amount` | Required, > 0 |
| | `due_date` | Required, >= issue_date |
| Supplier | `name` | Required, max 255 chars |
| | `payment_terms_days` | Required, integer >= 0 |
| Employee | `full_name` | Required, max 255 chars |
| | `basic_salary` | Required, > 0 |
| | `salary_type` | Required |
| Payment | `amount` | Required, > 0, <= bill.balance_due |
| | `payment_method` | Required |

### 5.7 Mobile-First Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Phone | < 640px | Single column, bottom tab nav, full-width forms, card-stack tables |
| Phone (landscape) | 640px–768px | Single column, wider inputs, side-by-side on some forms |
| Tablet | 768px–1024px | 2-column dashboard, sidebar as hamburger, table with more columns |
| Desktop | 1024px–1440px | Full sidebar, 2-3 column dashboard, data tables with filters |
| Wide | > 1440px | Max-width container centered, 3-4 column KPI displays |

---

## 6. Security & Access Control

### 6.1 Role Definitions & Permissions Matrix

| Permission | owner | admin | manager (location) | employee |
|---|---|---|---|---|
| View own profile | ✓ | ✓ | ✓ | ✓ |
| Change own password | ✓ | ✓ | ✓ | ✓ |
| View all locations' data | ✓ | ✓ | — | — |
| View assigned location data | ✓ | ✓ | ✓ | Read-only |
| CRUD daily sales (own location) | ✓ | ✓ | ✓ | — |
| CRUD expenses (own location) | ✓ | ✓ | ✓ | — |
| CRUD suppliers | ✓ | ✓ | ✓ | — |
| CRUD bills (own location) | ✓ | ✓ | ✓ | — |
| Record bill payment | ✓ | ✓ | ✓ | — |
| View payroll data | ✓ | ✓ | Own | Own |
| Approve payroll advances | ✓ | ✓ | — | — |
| Process payroll run | ✓ | ✓ | — | — |
| Create/Edit users | ✓ | ✓ | — | — |
| View audit log | ✓ | ✓ | — | — |
| Delete records (soft-delete) | ✓ | ✓ | VIEW ONLY | — |
| Permanent delete (hard-delete) | ✓ | — | — | — |
| Reconcile accounts | ✓ | ✓ | — | — |
| Configure recurring bills | ✓ | ✓ | ✓ | — |
| Export financial reports | ✓ | ✓ | Own location | — |

> **Note:** Manager-level delete is **strictly view-only** on delete actions. Managers can see the "Delete" button as disabled with a tooltip "Contact admin to delete."

### 6.2 Authentication Strategy

- **Password hashing:** bcrypt with cost factor 12
- **Token format:** JWT with RS256 or HS256
  - Access token: 1 hour expiry, stored in memory (Zustand)
  - Refresh token: 7 days expiry, stored in httpOnly secure cookie
- **Login rate limiting:** 5 attempts per minute per IP, 20 per hour per account
- **Session invalidation:** Refresh token rotation — old refresh tokens are invalidated on use
- **Password policy:** Minimum 8 characters, at least 1 number and 1 special character

### 6.3 API Key Management

Not required for MVP. API keys may be introduced in v2 for:
- Mobile app programmatic access
- Third-party integration (e.g., accounting software export)

### 6.4 Data Isolation Between Locations

- **Row-Level Security (RLS):** All queries for `manager` role implicitly filter by `location_id = user.location_id`
- **Application-level enforcement:** Every repository/DAO method accepts `location_id` as a parameter
- **Cross-location access:** Only `owner` and `admin` roles bypass the location filter
- **Leak prevention:** API responses never include data from other locations in aggregate endpoints

### 6.5 Audit Trail Coverage

Every mutation on the following tables generates an `audit_log` entry:

- `users` — CREATE, UPDATE, DELETE, LOGIN, LOGOUT
- `locations` — CREATE, UPDATE, DELETE
- `daily_sales` — CREATE, UPDATE, DELETE
- `expenses` — CREATE, UPDATE, DELETE
- `suppliers` — CREATE, UPDATE, DELETE
- `bills` — CREATE, UPDATE, DELETE
- `bill_payments` — CREATE, DELETE
- `payroll_periods` — CREATE, UPDATE
- `payroll_entries` — CREATE, UPDATE
- `payroll_advances` — CREATE, UPDATE
- `accounts` — CREATE, UPDATE, DELETE
- `recurring_bill_templates` — CREATE, UPDATE, DELETE

**Audit log entries include:**
- Full JSON snapshot of old and new values (for UPDATE operations)
- IP address and user agent of the requestor
- Exact timestamp (UTC)

### 6.6 Data Protection Considerations (East Africa)

- **Kenya Data Protection Act 2019 compliance:**
  - User consent obtained at registration (checkbox "I agree to the Privacy Policy")
  - Data stored only within Kenyan or East African servers (or compliant cloud regions)
  - Users can request data export (Right to Access) and account deletion (Right to Erasure)
  - Data retention: Financial records retained for 7 years per KRA requirements; user data retained until account deletion
- **Employee financial data:** Salary, bank account, and KRA PIN stored encrypted at rest using AES-256
- **No PII in URLs:** All sensitive IDs are opaque (not sequential) where practical; use UUIDs for externally-visible identifiers

---

## 7. Quality Assurance Strategy

### 7.1 Unit Testing Framework

| Layer | Framework | Coverage Target |
|---|---|---|
| Backend (Node) | Jest + Supertest | 85% line coverage |
| Backend (Python) | pytest | 85% line coverage |
| Frontend | Vitest + Testing Library | 70% line coverage (utility + hook heavy) |

**Critical test areas:**
- Ledger balance calculation (test all transaction types)
- Payroll net pay computation (test all salary types, deductions, advance deductions)
- Date uniqueness enforcement for daily sales
- Bill status transitions (computed, not stored)
- RBAC middleware (every endpoint tested for each role)

### 7.2 Integration Tests (Key Workflows)

#### Workflow 1: Sales → Ledger

```
Test: Create daily sale → verify ledger entries created
  - POST /api/v1/sales with full payment breakdown
  - Assert: 4 ledger entries created (one per payment method)
  - Assert: Each entry has correct entry_type='credit'
  - Assert: Account balance sums to net_sales
  - DELETE sale → assert ledger entries soft-deleted
```

#### Workflow 2: Bill Payment → Payable → Ledger

```
Test: Create bill → record payment → verify ledger + balance
  - POST /api/v1/bills → assert status='pending'
  - POST /api/v1/bills/{id}/pay with partial payment
  - Assert: bill_payment created
  - Assert: bill.amount_paid updated, balance_due decreased, status='partial'
  - Assert: Ledger entry created with entry_type='debit' against payment account
  - Assert: Payment account balance decreased by amount
```

#### Workflow 3: Payroll → Ledger

```
Test: Run payroll → verify payroll entries + ledger
  - Create pay period with 5 employees
  - Process payroll → compute net pays
  - Assert: payroll_entries created for each employee
  - Assert: net_pay = basic_pay + bonuses - deductions - advance_deductions
  - Mark period as paid → assert ledger entries created
  - Assert: Cash account debited by total payroll amount
```

### 7.3 E2E Scenarios

#### Happy Path
1. Admin logs in, sees empty dashboard
2. Admin creates a location "North Road Restaurant"
3. Admin creates a Manager account tied to North Road
4. Manager logs in, sees only North Road data
5. Manager records daily sales for today (KES 125,000 total)
6. Dashboard updates: today's sales KPI = 125,000
7. Manager records an expense (KES 5,000 for vegetables)
8. Manager creates a supplier (GreenGrocer Ltd)
9. Manager adds a bill from GreenGrocer (KES 30,000, due in 14 days)
10. Calendar shows the bill due date
11. Manager records partial payment (KES 15,000) — bill status → 'partial'
12. Admin views audit log, sees all 4 CREATE actions

#### Edge Case Scenarios
1. **Duplicate sales entry:** Manager tries to enter sales for same location/date → 409 error with existing record details
2. **Future date entry:** API rejects with 422
3. **Overdue bill:** Bill passes due_date without payment → status computes as 'overdue', dashboard alert appears
4. **Advance exceeds salary:** Employee with KES 10,000 basic salary requests KES 15,000 advance → System warns but allows (manager can override)
5. **Negative balance:** Account reaches KES 0.00, expense of KES 5,000 attempted → 422 with `INSUFFICIENT_BALANCE` error
6. **Concurrent access:** Two managers try to enter sales for same location/date simultaneously → 409 on second request (unique constraint)
7. **Terminated employee:** Employee terminated mid-period → payroll entry does not include them
8. **Partial payment with reference:** Payment recorded with M-Pesa reference code → code stored for reconciliation

### 7.4 Performance Benchmarks

| Metric | Target | Test Method |
|---|---|---|
| API response time (p95) | < 500ms | k6/artillery with 50 concurrent users |
| Ledger balance query | < 200ms | Index-only scan verified with EXPLAIN ANALYZE |
| Dashboard load time | < 1.5s | Lighthouse mobile simulation |
| Calendar query (3-month range) | < 1s | Database query with 10k+ bills, 200 employees |
| File upload (receipt, 2MB) | < 3s | Network-throttled test (3G) |
| Concurrent users | 50 concurrent with < 10% degradation | Load test with k6 |
| Daily transaction volume | 500 entries/day per location | Simulated 1 year of data |

---

## 8. Deployment & Operations

### 8.1 Environment Requirements

| Component | Requirement | Notes |
|---|---|---|
| Node.js | v18 LTS or v20 LTS | Native fetch, modern ES module support |
| Python (if FastAPI) | 3.11+ | Async support, type hints |
| PostgreSQL | 14+ | JSONB support, CTEs for recursive queries |
| Redis | 6+ (optional) | For job queues (Bull) and rate limiting |
| Disk | 20GB minimum | For database, receipts, logs |
| RAM | 2GB minimum, 4GB recommended | For application + database simultaneous |
| CPU | 2 vCPU minimum | |
| OS | Ubuntu 22.04 LTS or Debian 12 | Docker container base |

### 8.2 Docker Configuration Structure

```
project-root/
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── nginx/
│   ├── nginx.conf
│   └── ssl/ (certificates for HTTPS)
├── postgres/
│   ├── init.sql
│   └── backup.sh
├── backend/
│   ├── Dockerfile
│   └── ...
└── frontend/
    ├── Dockerfile
    └── ...
```

**docker-compose.yml structure:**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      - POSTGRES_DB=restaurant_cashflow
      - POSTGRES_USER=cashflow_app
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build: ./backend
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://cashflow_app:${DB_PASSWORD}@postgres:5432/restaurant_cashflow
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
```

### 8.3 CI/CD Pipeline Outline

```yaml
# .github/workflows/deploy.yml
name: Deploy Restaurant Cashflow MVP

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: Run unit tests
        run: npm run test -- --coverage
      - name: Run integration tests
        run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker images
        run: docker compose build
      - name: Push to registry
        run: |
          docker tag restaurant-cashflow_backend:latest ghcr.io/${{ github.repository }}/backend:latest
          docker push ghcr.io/${{ github.repository }}/backend:latest

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh deploy@${{ secrets.DEPLOY_HOST }} '
            cd /opt/restaurant-cashflow &&
            docker compose pull &&
            docker compose up -d &&
            docker compose exec backend npm run migrate
          '
```

### 8.4 Backup Strategy

| Backup Type | Frequency | Retention | Method |
|---|---|---|---|
| Database (full) | Daily at 02:00 EAT | 30 days | pg_dump → encrypted S3 bucket |
| Database (WAL) | Continuous | 7 days | WAL archiving to S3 |
| Receipt images | Real-time | 90 days | S3 versioning enabled |
| Application config | On change | Git history | `.env` templates with secrets in vault |
| Audit log export | Weekly | 1 year | COPY to CSV, compressed, encrypted |

**Backup verification:** Monthly restore test to staging environment — verify data integrity and query accuracy.

### 8.5 Monitoring & Alerting

| Metric | Tool | Alert Threshold |
|---|---|---|
| API response time (p95) | Prometheus + Grafana | > 1s for 5 minutes |
| Error rate (5xx) | Sentry + Prometheus | > 1% for 5 minutes |
| PostgreSQL connections | Prometheus exporter | > 80% of max_connections |
| Disk usage | Node exporter | > 85% |
| Uptime | UptimeRobot | 99.5% monthly SLA |
| Failed login attempts | Application logs | > 10 per user per hour |
| Database replication lag | Prometheus | > 10 seconds |

**Alert channels:** Email (PagerDuty for critical), Slack webhook (all alerts), SMS (critical: outage, security breach)

---

## 9. Error Handling & Edge Cases

### 9.1 HTTP Status Code Catalog

| Status Code | Usage | Example |
|---|---|---|
| 200 | Successful GET, PUT, PATCH | Bill detail returned |
| 201 | Successful POST (creation) | Expense created |
| 204 | Successful DELETE | Record soft-deleted (no content) |
| 400 | Bad request — malformed payload | Invalid JSON body |
| 401 | Unauthenticated | Missing/invalid JWT |
| 403 | Forbidden — insufficient role | Manager tries to delete user |
| 404 | Resource not found (or soft-deleted) | Bill ID does not exist |
| 409 | Conflict — duplicate or constraint violation | Duplicate sales date |
| 422 | Unprocessable entity — validation failure | Negative net sales |
| 429 | Too many requests — rate limit exceeded | Login rate limit hit |
| 500 | Internal server error | Unhandled exception (should be rare) |
| 503 | Service unavailable | Database connection failure |

### 9.2 Race Condition Handling

#### Concurrent Daily Sales Entry

**Problem:** Two managers at the same location attempt to enter sales for the same date simultaneously.

**Solution:**
1. Database-level unique constraint on `(location_id, sale_date)` is the first line of defense
2. Application-level advisory lock before insert: `SELECT pg_try_advisory_xact_lock(hashtext(:location_id || '-' || :sale_date))`
3. If lock fails (another transaction is committing), retry after random 50–200ms delay (up to 3 retries)
4. If unique constraint violation still occurs, return 409 with existing record details

#### Concurrent Bill Payment

**Problem:** Two users simultaneously pay the same bill, causing `balance_due` to go negative.

**Solution:**
1. `SELECT ... FOR UPDATE` on the bill row before inserting payment
2. PostgreSQL row-level lock ensures second transaction waits for first to complete
3. After first payment updates `balance_due` to 0, second payment sees `balance_due = 0` and can validate `amount <= balance_due`

### 9.3 Negative Balance Handling

**Detection:** Before creating any debit entry (expense, payment, payroll), check:
```sql
SELECT current_balance FROM accounts WHERE id = :account_id FOR UPDATE;
IF current_balance - :debit_amount < 0 THEN
  RAISE exception using errcode = 'INSUFFICIENT_BALANCE';
```

**Behavior:**
- API returns `422` with `{"code": "INSUFFICIENT_BALANCE", "message": "Account 'Main Cash' has insufficient funds. Available: KES 12,000.00, Required: KES 15,000.00"}`
- User can either fund the account (record a transfer or sale) or reduce the expense amount
- **Override:** Admin can force a negative balance with a flag (useful for bank overdrafts where negative is acceptable)

### 9.4 Data Migration on Location Add/Remove

#### Adding a New Location

1. Create location record via `POST /api/v1/locations`
2. Create default accounts for the location (Cash, M-Pesa, Bank, Delivery) automatically
3. Copy global expense categories to location-specific table entries
4. Create default account with `opening_balance = 0`
5. No existing data is affected

#### Removing (Soft-Deleting) a Location

**Prerequisites:**
- All accounts must have zero balance (or be reconciled to zero)
- No pending/overdue bills
- All payroll periods must be closed
- Final audit log export must be completed

**Process:**
1. Admin initiates location deactivation (not deletion)
2. Location marked `is_active = FALSE` — no new entries can be made
3. Final data export is generated (admin confirmation required)
4. After 30-day grace period (configurable), soft-delete all data for that location
5. Soft-deletes cascade through application logic (not DB CASCADE)

### 9.5 Timezone Handling

- **All dates and timestamps stored in UTC** in the database
- **Application backend operates in UTC** for all calculations
- **Frontend converts to `Africa/Nairobi` (UTC+3) on display**
- **Daily sales cutoff:** The `sale_date` is selected by the user, not inferred from timezone
  - Example: If today is April 29 in Nairobi, a sale at 1:00 AM on April 30 UTC (which is 4:00 AM Nairobi time) can be entered as April 29 if the user selects that date
- **Cron jobs** (auto-bill creation) run on server time (UTC) but adjust for relevant Nairobi business day
- **Date picker** on frontend uses `Intl.DateTimeFormat` with `timeZone: 'Africa/Nairobi'`

### 9.6 Partial Payments & Credit Notes

#### Partial Payments

- A bill can have multiple payments over time
- Each payment creates a `bill_payments` record and a corresponding ledger debit entry
- `bill.amount_paid` is updated incrementally: `amount_paid = COALESCE(SUM(bill_payments.amount), 0)`
- `bill.balance_due` = `bill.amount - bill.amount_paid`
- Status computed on read:
  - `balance_due == 0` → 'paid'
  - `balance_due > 0 AND due_date < CURRENT_DATE` → 'overdue'
  - `balance_due > 0 AND amount_paid > 0` → 'partial'
  - `balance_due == amount` → 'pending'

#### Credit Notes (v2 feature, noted for architecture)

- **Not in MVP**, but the schema design accommodates: a negative payment amount or a `credit_note` flag on `bill_payments` reverses a prior payment
- Ledger entries for credit notes reverse the original debit (credit the account back)

### 9.7 Employee Termination Payroll Adjustment

**Scenario:** Employee is terminated on April 20. The pay period runs April 1–30. How is payroll handled?

**Process:**

1. Admin sets `employee.termination_date = '2026-04-20'` and `employee.is_active = FALSE`
2. When creating the April payroll period, the system computes prorated salary:
   - `days_worked = 20` (April 1–20 inclusive)
   - `total_period_days = 30`
   - `prorated_pay = basic_salary * (20 / 30)`
3. All outstanding advances must be deducted in full from the final pay:
   - Remaining advance balance is deducted from the prorated salary
   - If advance balance > prorated salary, advance is marked for recovery via other means (manual repayment)
4. Final payslip auto-generates with the note "FINAL PAY — Employee Terminated"
5. After payment, employee record remains in system for historical reporting but is excluded from future payroll runs

### 9.8 Data Integrity Guarantees Summary

| Guarantee | Mechanism |
|---|---|
| No orphaned ledger entries | All ledger entries reference a valid `transaction_id` via FK; application deletes ledger in same transaction as source record |
| No duplicate sales | Unique constraint on (location_id, sale_date) at DB + app level |
| No negative account balances | CHECK constraint + application validation (admin override available) |
| No lost audit entries | `audit_log` is write-only; no UPDATE or DELETE operations allowed |
| No cascade data loss | Soft-deletes are application-level, not DB CASCADE |
| Immutable financial records | Ledger entries are never modified; corrections use reversal entries |
| Consistent payroll calculations | All entries for a period are computed in a single transaction |

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| KES | Kenyan Shillings — the system's sole currency |
| M-Pesa | Mobile money transfer service by Safaricom, widely used in Kenya |
| ETR | Electronic Tax Register — KRA-mandated device for recording sales |
| Z-Report | End-of-day POS sales summary report |
| KRA PIN | Kenya Revenue Authority Personal Identification Number |
| NSSF | National Social Security Fund (Kenya) |
| NHIF | National Hospital Insurance Fund (Kenya) |
| Soft-Delete | Marking a record as deleted (setting `deleted_at`) instead of physically removing it |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token — stateless authentication |
| CRUD | Create, Read, Update, Delete |

## Appendix B: Reference Documents

- [Kenya Data Protection Act 2019](https://www.odpc.go.ke/dpa-2019/) — Compliance baseline
- [KRA Tax Procedures Act 2015](https://www.kra.go.ke/en/helping-taxpayers/tax-laws/act) — Record-keeping requirements (7-year retention)
- [ESRI: Restaurant Cashflow Management Best Practices](https://www.esri.com/) — Industry reference (via web research)

---

*End of Specification Document*
