# FinaBill Platform — Specification

> **Project Location**: `d:\DevCenter\abuilds\fina\finabill\` — sibling directory to FinaFlow
> **Integration**: FinaBill pushes revenue journal entries → FinaFlow COA; FinaFlow pulls invoice data for cashflow
> **Not a Duplicate**: FinaBill does NOT re-implement Chart of Accounts, multi-currency, wallet, or budgeting — those live in FinaFlow
> **Spec Grounding**: Every decision below is based on audit of the actual FinaFlow codebase (76 tables, 31 enums, 30+ routers)

---

## 1. The Reality Check — What Exists vs What Needs Building

### Already Built in FinaFlow (FinaBill integrates, does NOT duplicate)

| FinaFlow Feature | Integration Point | What FinaBill Does |
|---|---|---|
| **Chart of Accounts** (5 types, 26+ sub-types, journal entries, trial balance, P&L, balance sheet) | FinaBill's items select `incomeAccountId` from FinaFlow's COA. Payments push `Dr Cash, Cr Revenue` journal entries to FinaFlow via API. | Pulls COA list via integration API. Never stores its own COA. |
| **Multi-currency** (`supported_currencies`, `exchange_rates`, `business_currencies`) | FinaBill uses FinaFlow's currency list + exchange rates via API. | Does not store its own currency/rate tables. |
| **Multi-wallet** (`mobile_wallet_providers`, `mobile_wallet_transactions`, `provider_configs`) | FinaBill's payments reference FinaFlow wallet accounts via `depositToAccountId`. | Does not manage wallets — references them. |
| **Payment → Account Mapping** (`accounting-maps.ts`) | FinaBill reuses the same mapping: cash→cash account, mpesa→mpesa account, bank→bank account. | Same mapping file, or imports from `@finabill/shared`. |
| **Items** (exists in FinaFlow with `incomeAccountId`, `expenseAccountId`, SKU, stock tracking) | FinaBill's sellable items optionally sync to FinaFlow items for COA income tracking. | FinaBill has its own items (sales catalogue) but references FinaFlow's items for accounting. |
| **Revenue Categories** (exists with `incomeAccountId` FK) | FinaBill reuses this. | Same DB table or synced via integration. |
| **Business Scoping** (businessId on every table, multi-business via `userBusinesses`) | FinaBill uses its own `businessId` scoping — same pattern as FinaFlow. | Same pattern, separate DB. |
| **Auth & RBAC** (JWT httpOnly, 40 permissions, 5 roles) | FinaBill has its own auth (same JWT pattern). Shared user identity by email. | Separate auth, same approach. |
| **External Sync** (`external_sync_config` table) | Used for FinaBill ↔ FinaFlow integration config. | Both apps have this table. |
| **Audit Log** (`audit_log` table, `events` table planned) | FinaBill logs its own events. | Separate events table. |

### Must Be Built in FinaBill (Doesn't Exist Anywhere)

| Module | Why FinaFlow Doesn't Have It |
|---|---|
| **Customers** | FinaFlow has `suppliers` (payables). FinaBill needs customers (receivables). Different entity. |
| **Quotes** (QOT-XXXX) | FinaFlow has no quoting system. |
| **Invoices** (INV-XXXX) | FinaFlow has `bills` (payables — money owed TO suppliers). FinaBill needs invoices (receivables — money owed BY customers). Different lifecycle (draft→sent→partial→paid→overdue→void). |
| **Sales Receipts** (SR-XXXX) | Point-of-sale/instant payment receipts. Doesn't exist. |
| **Credit Notes** (CN-XXXX) | Refund/credit against invoices. Doesn't exist. |
| **Products** | Subscription product definitions for plans. Doesn't exist. |
| **Plans, Addons, Coupons** | Subscription management infrastructure. Doesn't exist. |
| **Subscriptions** (w/ Stripe) | Recurring billing with dunning, proration, hosted pages. Doesn't exist. |
| **Payments Received** (incoming) | FinaFlow has `bill_payments` for OUTGOING payments. FinaBill needs incoming payment recording. |
| **Payment Links** | Shareable payment URLs. Doesn't exist. |
| **Projects & Timesheets** | Time tracking for billable hours. Doesn't exist. |
| **Events/Activity Log** | FinaFlow has `audit_log` for DB mutations. FinaBill needs a business activity log. |
| **74 Reports** | FinaFlow has 11 reports. FinaBill needs subscription-specific reports (MRR, ARR, churn, LTV, etc.). |
| **Customer Portal** | Self-service portal for customers. Doesn't exist. |

---

## 2. Platform Architecture

### Repository Structure

```
d:\DevCenter\abuilds\fina\finabill\
├── apps/web/                    # Vite + React 19 + TypeScript
├── api/                         # Hono.js + tRPC
│   ├── routers/
│   ├── middleware/
│   ├── lib/
│   └── cron/
├── db/
├── packages/shared/             # @finabill/shared
│   └── src/                    # types, schemas, utils for both apps
├── package.json (monorepo)
└── tsconfig.json
```

### Technology Stack

| Layer | Same as FinaFlow? |
|-------|------------------|
| React 19 + TypeScript + Vite | ✅ Same |
| Hono.js + tRPC | ✅ Same |
| PostgreSQL + Drizzle ORM | ✅ Same |
| JWT httpOnly cookies | ✅ Same pattern |
| Tailwind CSS + shadcn/ui | ✅ Same ecosystem, **different palette** |
| Stripe | ❌ New to FinaBill |
| Resend / SendGrid | ❌ New (FinaFlow doesn't email) |
| pdfkit | ❌ New |
| Recharts | ✅ Same |

### Authentication

FinaBill has its own auth system following FinaFlow's exact pattern:
- JWT stored in httpOnly cookie
- Same `roleEnum` (owner, admin, manager, employee, viewer)
- Same `userBusinesses` pattern for multi-business
- Same `currentBusinessId` scoping on every request
- **Shared identity**: A user can have the same email in both apps. Integration layer links by email.

---

## 3. Integration Architecture

### The Integration Contract

```
┌─────────────────────┐                        ┌─────────────────────┐
│      FinaFlow       │                        │      FinaBill       │
│                     │                        │                     │
│  COA (accounts) ◄───┼──── API Pull ──────────┤ Items pick income   │
│                     │                        │ account from COA    │
│  Ledger Entries ◄───┼──── API Push ──────────┤ Payment recorded →  │
│  Journal Entry      │                        │ Dr Cash/Bank        │
│                     │                        │ Cr Revenue          │
│  Cashflow Forecast ◄┼──── API Pull ──────────┤ Invoice payment     │
│                     │                        │ totals              │
│  Supplier Match ◄───┼──── Email Match ───────┤ Customer with same  │
│                     │                        │ email → Connect     │
│  Expense Sync ◄─────┼──── API Push ──────────┤ Expenses recorded   │
│                     │                        │ (simplified)        │
└─────────────────────┘                        └─────────────────────┘
```

### Smart Integration Page (Both Apps)

Each app has an **Integrations** page with:

1. **Connection Status**: Connected / Disconnected
2. **API Key**: Generate / Revoke (stored in `external_sync_config`)
3. **Entity Matching**: Scans by email → shows matches → "Connect" button
4. **Sync Triggers**: Manual or automatic

| Action | Direction | What Happens |
|--------|-----------|-------------|
| Payment recorded in FinaBill | → FinaFlow | Creates journal entry: Dr Cash/Bank account, Cr Revenue account via `ledger_entries` or `journal_entries` + `journal_lines` |
| Customer created in FinaBill | ↔ FinaFlow | Optionally syncs. If same email exists as supplier in FinaFlow → links. |
| COA needed in FinaBill | ← FinaFlow | Pulls `accounts` table filtered by `accountType = 'revenue'` for item income account selection |
| Expense recorded in FinaBill | → FinaFlow | Creates expense entry in FinaFlow if linked |
| Cashflow needs invoice data | ← FinaBill | FinaFlow pulls invoice payment totals for cashflow projection |

### API Endpoints

**FinaFlow side (for FinaBill to consume):**
```
POST /api/integration/finabill/sync-payment   — Accept Dr/Cr journal entry from FinaBill
POST /api/integration/finabill/sync-customer   — Receive customer sync
GET  /api/integration/finabill/accounts        — Return COA accounts (filtered by type)
GET  /api/integration/finabill/currencies      — Return supported currencies + rates
GET  /api/integration/finabill/verify          — Verify API key
POST /api/integration/finabill/reconcile       — Batch reconciliation
```

**FinaBill side (for FinaFlow to consume):**
```
POST /api/integration/finaflow/sync-expense    — Receive expense data
GET  /api/integration/finaflow/customers       — Return customer list for matching
GET  /api/integration/finaflow/invoices        — Return invoice payment totals
GET  /api/integration/finaflow/verify          — Verify API key
```

### Customer Matching Flow

```
User opens FinaBill Integrations
  → Enter FinaFlow URL + API Key
  → FinaBill calls FinaFlow's GET /customers to get all customers/suppliers
  → FinaBill cross-references by email
  → If matches found:
      Show table: [FinaBill Customer] ↔ [FinaFlow Entity]  [Connect]
  → If no matches:
      Show: "No matching customers found. Try FinaFlow →"
```

---

## 4. Database Schema

FinaBill has its **own database** (separate schema or separate DB). It does NOT share tables with FinaFlow.

### Core Business Tables

#### `businesses` — Same pattern as FinaFlow
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar(255) | |
| slug | varchar(100) UNIQUE | |
| email | varchar(255) | |
| phone | varchar(20) | |
| address | text | |
| country | varchar(100) | |
| timezone | varchar(50) | |
| dateFormat | varchar(20) | |
| currency | varchar(3) DEFAULT 'KES' | Base currency |
| subscriptionTier | varchar(20) DEFAULT 'free' | free, standard, premium, finance_plus |
| subscriptionStatus | varchar(20) DEFAULT 'active' | |
| stripeCustomerId | varchar(255) | Stripe customer ref |
| stripeSubscriptionId | varchar(255) | Stripe subscription ref |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

#### `users` — Same pattern as FinaFlow
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| email | varchar(255) UNIQUE | Shared identity with FinaFlow |
| name | varchar(255) | |
| passwordHash | varchar(255) | |
| role | varchar(20) DEFAULT 'viewer' | owner, admin, manager, employee, viewer |
| currentBusinessId | bigint FK→businesses | |
| isActive | boolean DEFAULT true | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

### Customer Tables

#### `customers` — FinaBill's core CRM entity
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerNumber | varchar(20) UNIQUE | CUST-XXXX |
| customerType | varchar(20) | 'business', 'individual' |
| salutation | varchar(10) | Mr, Ms, Mrs, Dr |
| firstName | varchar(100) | |
| lastName | varchar(100) | |
| companyName | varchar(200) | |
| displayName | varchar(200) | |
| email | varchar(255) | **Match key for integration** |
| phone | varchar(50) | |
| workPhone | varchar(50) | |
| mobile | varchar(50) | |
| language | varchar(10) | |
| billingAddress | jsonb | attention, country, street1/2, city, state, zip, phone, fax |
| shippingAddress | jsonb | same structure |
| paymentTerms | varchar(20) | due_on_receipt, net15, net30, net60 |
| creditLimit | decimal(15,2) | |
| currency | varchar(3) DEFAULT 'KES' | |
| taxRate | decimal(5,2) | |
| taxExempt | boolean DEFAULT false | |
| companyId | varchar(50) | |
| remarks | text | |
| enablePortal | boolean DEFAULT false | |
| isActive | boolean DEFAULT true | |
| linkedFinaflowId | int | FinaFlow entity ID (if connected) |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

Indexes: `businessId`, `email`, `customerNumber` (unique)

#### `customer_contact_persons`
| Column | Type |
|--------|------|
| id | serial PK |
| customerId | int FK→customers CASCADE |
| salutation | varchar(10) |
| firstName | varchar(100) |
| lastName | varchar(100) |
| email | varchar(255) |
| workPhone | varchar(50) |
| mobile | varchar(50) |

### Product Catalogue Tables

#### `items` — Sellable products/services (NOT FinaFlow's `items` table)
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| itemCode | varchar(50) | SKU |
| name | varchar(200) NOT NULL | |
| description | text | |
| unitType | varchar(20) | hours, pieces, kg, box, service |
| type | varchar(10) | 'goods', 'service' |
| unitPrice | decimal(15,2) | |
| currency | varchar(3) | |
| incomeAccountId | int | **FK to FinaFlow's accounts.id** (via integration) |
| taxRate | decimal(5,2) | |
| isTrackable | boolean DEFAULT false | For inventory future |
| imageUrl | text | |
| isActive | boolean DEFAULT true | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

#### `price_lists`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(200) |
| currency | varchar(3) |
| isDefault | boolean DEFAULT false |

#### `price_list_items`
| Column | Type |
|--------|------|
| id | serial PK |
| priceListId | int FK→price_lists |
| itemId | int FK→items |
| unitPrice | decimal(15,2) |

### Sales Document Tables

#### `quotes`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerId | int FK→customers | |
| quoteNumber | varchar(20) UNIQUE | QOT-XXXXXX |
| status | varchar(20) | draft, sent, accepted, declined, expired, converted |
| issueDate | date | |
| expiryDate | date | Default +30 days |
| salespersonId | int FK→users | |
| subject | text | |
| currency | varchar(3) | |
| subtotal | decimal(15,2) | |
| discountType | varchar(10) | percentage, fixed |
| discountValue | decimal(15,2) | |
| discountAmount | decimal(15,2) | |
| shippingCharges | decimal(15,2) DEFAULT 0 | |
| adjustment | decimal(15,2) DEFAULT 0 | |
| total | decimal(15,2) | |
| customerNotes | text | |
| termsConditions | text | |
| convertedToInvoiceId | int FK→invoices | |
| createdBy | int FK→users | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

#### `quote_items`
| Column | Type |
|--------|------|
| id | serial PK |
| quoteId | int FK→quotes CASCADE |
| lineNumber | int |
| itemId | int FK→items (nullable) |
| description | text NOT NULL |
| quantity | decimal(15,2) DEFAULT 1 |
| rate | decimal(15,2) |
| taxRate | decimal(5,2) |
| taxAmount | decimal(15,2) |
| amount | decimal(15,2) |
| sortOrder | int |

#### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerId | int FK→customers | |
| invoiceNumber | varchar(20) UNIQUE | INV-XXXXXX |
| orderNumber | varchar(50) | |
| status | varchar(20) | draft, sent, partial, paid, overdue, void, credit_note |
| issueDate | date | |
| dueDate | date | |
| terms | varchar(20) | |
| salespersonId | int FK→users | |
| subject | text | |
| currency | varchar(3) | |
| subtotal | decimal(15,2) | |
| discountType | varchar(10) | |
| discountValue | decimal(15,2) | |
| discountAmount | decimal(15,2) | |
| shippingCharges | decimal(15,2) DEFAULT 0 | |
| adjustment | decimal(15,2) DEFAULT 0 | |
| total | decimal(15,2) | |
| amountPaid | decimal(15,2) DEFAULT 0 | |
| balanceDue | decimal(15,2) GENERATED | total - amountPaid |
| customerNotes | text | |
| termsConditions | text | |
| isRecurring | boolean DEFAULT false | |
| subscriptionId | int FK→subscriptions | |
| sourceType | varchar(20) | manual, recurring, credit_note, quote |
| sourceId | int | |
| voidReason | text | |
| voidedAt | timestamptz | |
| syncedToFinaflow | boolean DEFAULT false | Integration flag |
| finaflowJournalEntryId | int | FinaFlow reference |
| createdBy | int FK→users | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

Indexes: `businessId`, `customerId`, `status`, `issueDate`, `dueDate`

#### `invoice_items` — Same as quote_items structure
#### `sales_receipts` — Same as invoice structure with `receiptNumber` (SR-XXXXXX) + `paymentMode` + `depositToAccountId`
#### `sales_receipt_items` — Same as invoice_items structure
#### `credit_notes` — Same as invoice structure with `creditNoteNumber` (CN-XXXXXX) + `referenceNumber` + `linkedInvoiceId` + `remainingCredit`
#### `credit_note_items` — Same as invoice_items but with `accountId` (full COA selection) instead of `itemId`

### Subscription Tables

#### `products`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(200) |
| description | text |
| emailNotificationRecipients | text |
| redirectUrl | text |
| autoGenerateSubscriptionNumbers | boolean DEFAULT true |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

#### `plans`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| productId | int FK→products |
| name | varchar(200) |
| code | varchar(50) UNIQUE |
| billingFrequency | int |
| billingPeriod | varchar(10) | day, week, month, year |
| billingCycles | int DEFAULT 0 | 0 = unlimited |
| description | text |
| pricingModel | varchar(20) | flat_fee, per_unit, tiered, volume |
| unitName | varchar(50) |
| price | decimal(15,2) |
| currency | varchar(3) |
| freeTrialDays | int DEFAULT 0 |
| setupFee | decimal(15,2) DEFAULT 0 |
| type | varchar(10) | goods, service |
| salesTaxId | int FK→taxes |
| imageUrl | text |
| isActive | boolean DEFAULT true |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

#### `addons`, `addon_plan_links`, `coupons`, `subscriptions`, `subscription_invoices`
— Same as previously specified in detail. See `specs/finabill-platform/spec.md` lines 821-868 for full column definitions.

### Payment Tables

#### `payments` — Incoming payments (distinct from FinaFlow's `bill_payments`)
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerId | int FK→customers | |
| paymentNumber | varchar(20) UNIQUE | PAY-XXXXX |
| amountReceived | decimal(15,2) | |
| bankCharges | decimal(15,2) DEFAULT 0 | |
| paymentDate | date | |
| paymentMode | varchar(20) | cash, mpesa, bank_transfer, card, stripe |
| depositToAccountId | int | **FinaFlow accounts.id** (cash/bank/mpesa account) |
| reference | varchar(255) | M-PESA code, cheque no. |
| taxDeducted | boolean DEFAULT false | |
| tdsAmount | decimal(15,2) | |
| amountUsed | decimal(15,2) DEFAULT 0 | Applied to invoices |
| amountRefunded | decimal(15,2) DEFAULT 0 | |
| amountInExcess | decimal(15,2) GENERATED | amountReceived - used - refunded |
| notes | text | Internal only |
| syncedToFinaflow | boolean DEFAULT false | |
| finaflowJournalEntryId | int | |
| stripePaymentIntentId | varchar(255) | |
| createdBy | int FK→users | |
| createdAt | timestamptz | |

#### `payment_applications`
| Column | Type |
|--------|------|
| id | serial PK |
| paymentId | int FK→payments |
| invoiceId | int FK→invoices |
| amount | decimal(15,2) |

#### `payment_links`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(200) |
| amount | decimal(15,2) |
| currency | varchar(3) |
| isActive | boolean |
| maxUses | int |
| currentUses | int DEFAULT 0 |
| expiresAt | timestamptz |
| stripeLinkId | varchar(255) |

### Expense Tables (Simplified — FinaBill's own, not FinaFlow's)

#### `expenses`
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| categoryId | int FK→expense_categories | |
| amount | decimal(15,2) | |
| currency | varchar(3) | |
| description | text | |
| date | date | |
| isRecurring | boolean DEFAULT false | |
| recurringFrequency | varchar(10) | |
| receiptUrl | text | |
| linkedFinaflowId | int | If synced to FinaFlow |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

#### `expense_categories` — Simple, not FinaFlow's full COA-linked version
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(100) |
| isActive | boolean DEFAULT true |

### Time Tracking Tables

#### `projects`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| customerId | int FK→customers |
| name | varchar(200) |
| code | varchar(50) |
| billingMethod | varchar(20) | flat_fee, hourly, non_billable |
| description | text |
| costBudget | decimal(15,2) |
| revenueBudget | decimal(15,2) |
| status | varchar(20) | active, completed, on_hold, canceled |
| watchlist | boolean DEFAULT false |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

#### `project_tasks`, `project_users`, `timesheet_entries`
— As previously specified.

### Events & Integration Tables

#### `events` — Business activity log (NOT FinaFlow's `audit_log`)
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| actionType | varchar(50) | customer.created, invoice.paid, etc. |
| entityType | varchar(20) | |
| entityId | int | |
| actorId | int FK→users |
| details | jsonb |
| createdAt | timestamptz |

#### `integration_connections`
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| targetSystem | varchar(20) | finaflow |
| apiKeyHash | varchar(255) |
| targetUrl | varchar(500) |
| isActive | boolean DEFAULT true |
| lastSyncAt | timestamptz |
| customerMatchCount | int DEFAULT 0 |
| syncConfig | jsonb |
| createdAt | timestamptz |
| updatedAt | timestamptz |

### Document & Email Tables

#### `documents`, `email_logs`
— As previously specified.

---

## 5. New Permissions for FinaBill

FinaBill uses its own RBAC, same pattern as FinaFlow's 40 permissions:

| Permission | What It Controls |
|-----------|------------------|
| `customers:view` | View customer list and details |
| `customers:manage` | Create, edit, delete customers |
| `items:view` | View product catalogue |
| `items:manage` | Create, edit items and price lists |
| `quotes:view` | View quotes |
| `quotes:create` | Create and send quotes |
| `quotes:manage` | Void/delete quotes |
| `invoices:view` | View invoices |
| `invoices:create` | Create and send invoices |
| `invoices:pay` | Record payments |
| `invoices:void` | Void invoices |
| `subscriptions:view` | View subscriptions |
| `subscriptions:manage` | Create, modify, cancel subscriptions |
| `plans:manage` | Manage plans, addons, coupons |
| `payments:view` | View payment history |
| `payments:refund` | Process refunds |
| `expenses:view` | View expenses |
| `expenses:manage` | Create, edit expenses |
| `projects:view` | View projects |
| `projects:manage` | Create, edit projects |
| `timesheets:view` | View timesheets |
| `timesheets:manage` | Log and approve timesheets |
| `reports:view` | View all reports |
| `settings:manage` | Manage business profile and branding |
| `integrations:manage` | Configure FinaFlow integration |

Role defaults: Same as FinaFlow — Owner/Admin get all, Manager gets create/manage, Employee/Viewer get view-only.

---

## 6. The 74 Reports (Organized by Category)

| Category | Reports | Priority |
|----------|---------|----------|
| **Sales** (7) | Sales by Customer, Sales by Item, Sales by Plan, Sales by Addon, Sales by Coupon, Sales by Sales Person, Sales Summary | Phase 6 |
| **Receivables** (7) | AR Aging Summary, AR Aging Details, Invoice Details, Bad Debts, Customer Balance Summary, Receivable Summary, Receivable Details | Phase 6 |
| **Acquisition Insights** (5) | Active Trials, Inactive Trials, Trial to Live Conversions, Avg Sales Cycle Length, Lost Opportunities | Phase 6+ |
| **Signups & Activations** (3) | Signups, Activations, Activations By Country | Phase 6+ |
| **Subscriptions** (7) | Active Subscriptions, Net Customers, Subscription Details, Upgrades, Downgrades, Summary, ARPU, LTV | Phase 6+ |
| **Revenue** (3) | Net Revenue, Revenue By Country, Revenue Retention Cohort | Phase 6+ |
| **Retention** (5) | Revenue Retention Cohort, Revenue Retention Rate, Renewal Summary, Renewal Failures, Subscription Retention Rate | Phase 6+ |
| **MRR & ARR** (3) | MRR, ARR, MRR Quick Ratio | Phase 6+ |
| **Churn** (6) | Under Risk, Non Renewing Profiles, Churned After Retries, Churned Subscriptions, Subscription Expiry, Net Cancellations | Phase 6+ |
| **Churn Insights** (5) | Net Cancellations, Churn Rate, Cancellations by Country, Cancellations by Product, Revenue Churn | Phase 6+ |
| **Payments Received** (6) | Payments Received, Time to Get Paid, Credit Note Details, Refund History, Payment Failures, Card Expiry | Phase 6+ |
| **Expenses** (5) | Expense Details, Expenses by Category, Expenses by Customer, Expenses by Project, Billable Expense Details | Phase 6+ |
| **Taxes** (1) | Tax Summary | Phase 6+ |
| **Projects** (4) | Timesheet Details, Project Summary, Project Details, Projects Revenue Summary | Phase 6+ |
| **Activity** (5) | System Mails, Activity Logs, Exception Report, Portal Activities, Customer Reviews, API Usage | Phase 6+ |

**Build order**: Start with Sales + Receivables. Add Subscriptions/MRR/Churn after Phase 4. Add remaining incrementally with placeholders.

---

## 7. Integration Sync Flow (Detailed)

### When a Payment Is Recorded in FinaBill

```
1. User records payment against invoice in FinaBill
2. FinaBill creates payment record + updates invoice.amountPaid
3. FinaBill calls FinaFlow API: POST /sync-payment
   Payload: {
     businessId, paymentMethod, amount,
     depositToAccountId, customerEmail, invoiceItems
   }
4. FinaFlow receives it → creates journal entry:
   Dr: account matching depositToAccountId (cash/bank/wallet)
   Cr: account matching invoice items' revenueCategory.incomeAccountId
5. FinaFlow returns journal entry ID
6. FinaBill stores finaflowJournalEntryId on the payment record
7. If sync fails → payment still recorded locally, marked unsynced
   Background job retries failed syncs
```

### When an Expense Is Recorded in FinaBill

```
1. User records expense in FinaBill
2. FinaBill optionally pushes to FinaFlow if integration is connected
3. FinaFlow receives it → creates expense entry
4. FinaFlow's cashflow forecast → updated
```

### When FinaFlow Needs Invoice Data

```
1. FinaFlow's cashFlowForecast endpoint fetches unpaid invoice totals
2. FinaFlow calls FinaBill API: GET /invoices?status=sent,partial,overdue
3. FinaBill returns: { totalOutstanding, overdueTotal, dueThisWeek, byCustomer }
4. FinaFlow incorporates into its cashflow projection
```

---

## 8. Implementation Phases (Grounded in Reality)

### Phase 1: Foundation (Monorepo + Auth + DB)
- Scaffold monorepo (same pattern as FinaFlow: Vite + Hono + tRPC + Drizzle)
- Auth system (JWT httpOnly, same role enum, business scoping)
- Core DB tables: businesses, users, customers, customer_contact_persons
- UI foundation: Tailwind palette (#2563EB accent), shadcn/ui, Layout with sidebar
- Shared library foundation: types, schemas, currency utils

### Phase 2: Core Sales (Customers + Items + Quotes + Invoices)
- Customers CRUD with inline forms, tabbed detail (address, contacts, custom fields, reporting tags)
- Items CRUD with COA income account selection (pulled from FinaFlow integration)
- Quotes: create → send → accept/decline → convert to invoice
- Invoices: create → send → record payment → void
- Sales Receipts: create with immediate payment
- Credit Notes: create linked to invoice
- PDF generation for all documents

### Phase 3: Payments & Expenses
- Payments Received: record, apply to invoices, TDS, excess tracking
- Payment Links: generate shareable URLs
- Expenses: simplified (NOT FinaFlow's deep COA-linked version)
- Recurring Expenses

### Phase 4: Subscriptions (Stripe)
- Products, Plans, Addons, Coupons
- Subscriptions engine with Stripe
- Dunning management
- Hosted payment pages
- Cron: recurring invoice generation, payment reminders

### Phase 5: Time Tracking
- Projects with budgets, tasks, users
- Timesheets with approval workflow
- Export to invoice

### Phase 6: Reports (Incremental)
- Report viewer framework (category sidebar → list → viewer)
- Sales + Receivables reports first
- Subscriptions/MRR/Churn/Retention after Phase 4
- Remaining categories incrementally with placeholders

### Phase 7: Integration & Polish
- FinaFlow integration (smart customer matching, payment sync, COA pull, expense sync)
- Events/activity log
- Documents & email
- Settings & branding
- Mobile optimization
- Customer portal

---

## 9. Key Design Decisions (Grounded in Codebase Reality)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Separate DB, not shared** | FinaBill's customers are NOT FinaFlow's suppliers. Different entities, different lifecycles. Integration at API layer, not DB layer. |
| 2 | **FinaBill does NOT have its own COA** | FinaFlow already has a full Chart of Accounts with 5 types, 26 sub-types, journal entries, trial balance, P&L, balance sheet. FinaBill references it via integration. |
| 3 | **FinaBill payments push journal entries to FinaFlow** | Every payment recorded in FinaBill creates `Dr Cash, Cr Revenue` in FinaFlow. This means FinaFlow's P&L and balance sheet automatically reflect billing revenue. |
| 4 | **FinaBill items select incomeAccount from FinaFlow COA** | When creating a sellable item, the user picks a revenue account from FinaFlow's COA. This maps sales to the correct income account. |
| 5 | **FinaBill's expenses are simplified** | FinaFlow has deep expense tracking with COA-linked categories, fixed assets, depreciation. FinaBill's expenses are simple — date, category, amount, receipt. Deeper expense tracking = use FinaFlow. |
| 6 | **Shared user identity by email** | Same user can have accounts in both apps. Integration page links them by email. No shared auth DB. |
| 7 | **Smart integration page** | If the same email exists as a supplier in FinaFlow and a customer in FinaBill → Connect button. If not → Try FinaFlow/Try FinaBill button. |
| 8 | **Inline forms, not modals** | FinaBill's UI is inline forms (create/edit happens on the page, not in dialogs). This is intentionally different from FinaFlow's modal-heavy UX. |
| 9 | **Stripe for payment processing** | FinaBill uses Stripe for subscription billing, payment processing, and hosted pages. FinaFlow handles its own payment tracking. |
| 10 | **FinaGen is the North Star** | Both apps are designed for eventual merger. Clean APIs, compatible data models, clear migration path. |
