# FinaFlow Billing Module Specification

> **Implementation Location**: Inside `d:\DevCenter\abuilds\fina\finaflow\` — NOT a separate application
> **Architecture**: Context-switching single app where the sidebar completely changes between "Expenses" and "Billing" modes
> **Shared Foundation**: One Chart of Accounts, one RBAC system, one business/settings engine, one multi-currency wallet system

---

## Why

FinaFlow already provides powerful cashflow tracking, expense management, multi-currency accounting, and financial reporting. What's missing is the **receivables side** — the ability to send professional invoices, manage customer accounts, set up recurring billing, track payments received, and surface income-focused reports.

Rather than building a separate application (which would duplicate the entire Chart of Accounts, user system, settings, wallet system, and business context), this module extends FinaFlow with a **full context-switching experience**:

- One app, one login, one database
- Sidebar toggles between **Expenses** mode and **Billing** mode
- All shared infrastructure (COA, auth, settings, currencies, locations) lives once
- Revenue data flows naturally into the existing financial reports (P&L, Balance Sheet)

---

## What Changes

### Architecture

```
finaflow/
├── api/
│   ├── customers-router.ts         ← NEW
│   ├── invoices-router.ts          ← NEW
│   ├── invoice-payments-router.ts  ← NEW
│   ├── recurring-invoices-router.ts ← NEW
│   ├── billing-reports-router.ts   ← NEW
│   └── ...existing routers...
├── src/
│   ├── pages/
│   │   ├── billing/                ← NEW — all billing pages
│   │   │   ├── Invoices.tsx
│   │   │   ├── InvoiceDetail.tsx
│   │   │   ├── InvoiceBuilder.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── CustomerDetail.tsx
│   │   │   ├── RecurringInvoices.tsx
│   │   │   ├── BillingReports.tsx
│   │   │   └── BillingDashboard.tsx
│   │   ├── ...existing pages...
│   ├── components/
│   │   ├── Layout.tsx              ← MODIFIED — context switcher in sidebar
│   │   └── ...existing...
│   ├── features/
│   │   └── billing/                ← NEW — billing components
│   │       ├── InvoiceForm.tsx
│   │       ├── InvoiceList.tsx
│   │       ├── CustomerSelect.tsx
│   │       ├── InvoicePDF.tsx
│   │       └── PaymentForm.tsx
│   └── hooks/
│       ├── useBillingContext.ts    ← NEW — context switching hook
│       └── ...existing...
├── db/
│   ├── schema.ts                   ← MODIFIED — new tables added
│   └── ...existing...
└── packages/
    └── shared/                     ← NEW (optional, if needed for shared utilities)
```

### Context Switching: How It Works

The sidebar gains a **mode toggle** at the top. When the user switches modes, the entire navigation changes:

```
┌─────────────────────┐
│ [  Expenses ✓  ]   │  ← Mode toggle dropdown
│ [  Billing     ]   │
├─────────────────────┤
│ (mode-specific nav) │
│                     │
│ ...                 │
└─────────────────────┘
```

#### Expenses Mode Sidebar
```
Dashboard
Daily Sales
Expenses
Suppliers
Bills
  └─ All Bills
  └─ Recurring Bills
Accounts
Payroll
Wallet
Calendar
Reports
Settings
```

#### Billing Mode Sidebar
```
Billing Dashboard      ← Income-focused KPIs
Invoices
  └─ All Invoices
  └─ Create Invoice
  └─ Recurring Invoices
Customers
  └─ All Customers
  └─ Add Customer
Payments Received
Reports
  └─ Revenue by Period
  └─ Customer Aging
  └─ Invoice Status
  └─ Customer Statements
Settings               ← Same settings, billing-focused sections
```

**Shared items** (accessible from both modes):
- Settings (business profile, users, currencies — same pages)
- Accounts/COA (same Chart of Accounts — filtered by context)
- Calendar (same calendar — shows invoice due dates in billing mode)
- User profile/logout

### Business Onboarding: Primary Mode Selection

When a **new business is created**, the user selects their primary focus:

```
┌─────────────────────────────────────┐
│  What do you want to do first?      │
│                                     │
│  [📊 Track Expenses & Cashflow]     │
│     Manage bills, expenses, payroll │
│                                     │
│  [📋 Send Invoices & Get Paid]     │
│     Create invoices, manage clients │
│                                     │
│  [🔄 I'll do both]                  │
│     Full access to everything       │
└─────────────────────────────────────┘
```

This selection stores a `primaryMode` field on the `businesses` table:
- `"expense"` — Default to Expenses mode on login
- `"billing"` — Default to Billing mode on login
- `"both"` — Default to Expenses mode (but both are equally accessible)

The user can always switch modes freely. The primary mode just determines the default landing view.

### New Database Tables

All new tables follow existing FinaFlow conventions (same `businessId` scoping, same timestamp patterns, same soft-delete via `deletedAt`).

#### `customers`

```sql
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  businessId      INT NOT NULL REFERENCES businesses(id),
  customerNumber  VARCHAR(20) UNIQUE,        -- Auto-generated CUST-XXXX
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  billingAddress  TEXT,
  paymentTerms    VARCHAR(50),                -- net15, net30, net60, due_on_receipt
  creditLimit     DECIMAL(15,2) DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'KES',   -- Customer's preferred currency
  notes           TEXT,
  isActive        BOOLEAN DEFAULT true,
  createdAt       TIMESTAMPTZ DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ DEFAULT NOW(),
  deletedAt       TIMESTAMPTZ
);
CREATE INDEX idx_customers_business ON customers(businessId);
CREATE INDEX idx_customers_email ON customers(email);
```

#### `invoices`

```sql
CREATE TABLE invoices (
  id                  SERIAL PRIMARY KEY,
  businessId          INT NOT NULL REFERENCES businesses(id),
  locationId          INT REFERENCES locations(id),
  customerId          INT NOT NULL REFERENCES customers(id),
  invoiceNumber       VARCHAR(20) UNIQUE,       -- INV-XXXX per business
  status              VARCHAR(20) NOT NULL DEFAULT 'draft',
                      -- draft, sent, partial, paid, overdue, void, credit_note
  issueDate           DATE NOT NULL,
  dueDate             DATE NOT NULL,
  currency            VARCHAR(3) DEFAULT 'KES',
  subtotal            DECIMAL(15,2) NOT NULL,
  discountType        VARCHAR(10),               -- percentage, fixed
  discountValue       DECIMAL(15,2) DEFAULT 0,
  discountAmount      DECIMAL(15,2) DEFAULT 0,
  taxTotal            DECIMAL(15,2) DEFAULT 0,
  grandTotal          DECIMAL(15,2) NOT NULL,
  amountPaid          DECIMAL(15,2) DEFAULT 0,
  balanceDue          DECIMAL(15,2) GENERATED ALWAYS AS (grandTotal - amountPaid) STORED,
  notes               TEXT,
  terms               TEXT,
  isRecurring         BOOLEAN DEFAULT false,
  recurringTemplateId INT REFERENCES recurring_invoice_templates(id),
  sourceType          VARCHAR(50),               -- manual, recurring, credit_note
  sourceId            INT,
  voidReason          TEXT,
  voidedAt            TIMESTAMPTZ,
  createdBy           INT REFERENCES users(id),
  createdAt           TIMESTAMPTZ DEFAULT NOW(),
  updatedAt           TIMESTAMPTZ DEFAULT NOW(),
  deletedAt           TIMESTAMPTZ
);
CREATE INDEX idx_invoices_business ON invoices(businessId);
CREATE INDEX idx_invoices_customer ON invoices(customerId);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issueDate);
CREATE INDEX idx_invoices_due_date ON invoices(dueDate);
```

#### `invoice_items`

```sql
CREATE TABLE invoice_items (
  id                  SERIAL PRIMARY KEY,
  invoiceId           INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lineNumber          INT NOT NULL,
  description         TEXT NOT NULL,
  quantity            DECIMAL(15,2) DEFAULT 1,
  unitPrice           DECIMAL(15,2) NOT NULL,
  taxRate             DECIMAL(5,2) DEFAULT 0,
  taxAmount           DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unitPrice * taxRate / 100) STORED,
  discountRate        DECIMAL(5,2) DEFAULT 0,
  discountAmount      DECIMAL(15,2) DEFAULT 0,
  lineTotal           DECIMAL(15,2) NOT NULL,
  revenueCategoryId   INT REFERENCES revenue_categories(id),
  createdAt           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoiceId);
```

#### `invoice_payments`

```sql
CREATE TABLE invoice_payments (
  id              SERIAL PRIMARY KEY,
  businessId      INT NOT NULL REFERENCES businesses(id),
  invoiceId       INT NOT NULL REFERENCES invoices(id),
  paymentMethod   VARCHAR(20) NOT NULL,        -- cash, mpesa, bank_transfer, card, other
  amount          DECIMAL(15,2) NOT NULL,
  reference       VARCHAR(255),
  paymentDate     DATE NOT NULL,
  currency        VARCHAR(3) DEFAULT 'KES',
  exchangeRate    DECIMAL(10,4) DEFAULT 1,     -- For multi-currency payments
  notes           TEXT,
  accountId       INT REFERENCES accounts(id), -- The cash/bank/wallet account deposited to
  isReconciled    BOOLEAN DEFAULT false,
  reconciledAt    TIMESTAMPTZ,
  createdBy       INT REFERENCES users(id),
  createdAt       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_invpayments_invoice ON invoice_payments(invoiceId);
CREATE INDEX idx_invpayments_date ON invoice_payments(paymentDate);
CREATE INDEX idx_invpayments_method ON invoice_payments(paymentMethod);
```

#### `recurring_invoice_templates`

```sql
CREATE TABLE recurring_invoice_templates (
  id                SERIAL PRIMARY KEY,
  businessId        INT NOT NULL REFERENCES businesses(id),
  customerId        INT NOT NULL REFERENCES customers(id),
  name              VARCHAR(200),
  description       TEXT,
  frequency         VARCHAR(20) NOT NULL,       -- weekly, monthly, quarterly, annually
  interval          INT DEFAULT 1,              -- Every N periods
  nextDueDate       DATE NOT NULL,
  endDate           DATE,
  isActive          BOOLEAN DEFAULT true,
  notes             TEXT,
  terms             TEXT,
  lastGeneratedDate DATE,
  totalGenerated    INT DEFAULT 0,
  createdAt         TIMESTAMPTZ DEFAULT NOW(),
  updatedAt         TIMESTAMPTZ DEFAULT NOW(),
  deletedAt         TIMESTAMPTZ
);
CREATE INDEX idx_recurring_templates_active ON recurring_invoice_templates(businessId, isActive);
CREATE INDEX idx_recurring_templates_due ON recurring_invoice_templates(nextDueDate);
```

#### `recurring_template_items`

```sql
CREATE TABLE recurring_template_items (
  id                SERIAL PRIMARY KEY,
  templateId        INT NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          DECIMAL(15,2) DEFAULT 1,
  unitPrice         DECIMAL(15,2) NOT NULL,
  taxRate           DECIMAL(5,2) DEFAULT 0,
  revenueCategoryId INT REFERENCES revenue_categories(id),
  createdAt         TIMESTAMPTZ DEFAULT NOW()
);
```

#### `recurring_invoice_generations`

```sql
CREATE TABLE recurring_invoice_generations (
  id              SERIAL PRIMARY KEY,
  templateId      INT NOT NULL REFERENCES recurring_invoice_templates(id),
  invoiceId       INT REFERENCES invoices(id),
  generatedDate   DATE NOT NULL,
  status          VARCHAR(20) NOT NULL,         -- success, skipped, failed
  skipReason      TEXT,
  errorMessage    TEXT,
  createdAt       TIMESTAMPTZ DEFAULT NOW()
);
```

#### `payment_reminders`

```sql
CREATE TABLE payment_reminders (
  id              SERIAL PRIMARY KEY,
  businessId      INT NOT NULL REFERENCES businesses(id),
  invoiceId       INT NOT NULL REFERENCES invoices(id),
  reminderType    VARCHAR(20) NOT NULL,         -- first_reminder, second_reminder, final_reminder
  scheduledDate   DATE,
  sentDate        DATE,
  status          VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  deliveryLog     JSONB,
  createdAt       TIMESTAMPTZ DEFAULT NOW()
);
```

#### `invoice_email_logs`

```sql
CREATE TABLE invoice_email_logs (
  id              SERIAL PRIMARY KEY,
  invoiceId       INT NOT NULL REFERENCES invoices(id),
  recipient       VARCHAR(255) NOT NULL,
  emailType       VARCHAR(30) NOT NULL,         -- invoice_sent, payment_reminder, payment_receipt
  status          VARCHAR(20) NOT NULL,         -- sent, delivered, opened, bounced, failed
  sentAt          TIMESTAMPTZ,
  deliveredAt     TIMESTAMPTZ,
  openedAt        TIMESTAMPTZ,
  errorMessage    TEXT,
  createdAt       TIMESTAMPTZ DEFAULT NOW()
);
```

#### `business_profiles` (invoice branding)

```sql
CREATE TABLE business_profiles (
  id                  SERIAL PRIMARY KEY,
  businessId          INT NOT NULL UNIQUE REFERENCES businesses(id),
  logoUrl             TEXT,                    -- Uploaded logo
  businessName        VARCHAR(200),
  address             TEXT,
  phone               VARCHAR(50),
  email               VARCHAR(255),
  website             VARCHAR(255),
  taxRegistrationNo   VARCHAR(100),            -- KRA PIN, VAT no.
  defaultTaxRate      DECIMAL(5,2) DEFAULT 0,
  invoicePrefix       VARCHAR(10) DEFAULT 'INV',
  invoiceNumberStart  INT DEFAULT 1,
  paymentTerms        TEXT,                    -- Default terms text
  footerText          TEXT,
  accentColor         VARCHAR(7) DEFAULT '#C73E1D',
  createdAt           TIMESTAMPTZ DEFAULT NOW(),
  updatedAt           TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Existing Tables

#### `businesses` — Add `primaryMode` column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| primaryMode | VARCHAR(20) | 'both' | 'expense', 'billing', or 'both' |

---

## API Endpoints (NEW)

### `customers-router.ts` (`/api/customers`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `customers.list` | Query | Paginated list with search (name, email, phone, customerNumber) |
| `customers.getById` | Query | Single customer with stats (total invoiced, total paid, balance) |
| `customers.create` | Mutation | Create customer with auto-generated customerNumber |
| `customers.update` | Mutation | Update customer details |
| `customers.delete` | Mutation | Soft delete (check no outstanding invoices) |
| `customers.getStatement` | Query | Customer statement with invoice list and balances |

### `invoices-router.ts` (`/api/invoices`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `invoices.list` | Query | Paginated list with status/date/customer/currency filters |
| `invoices.getById` | Query | Full invoice with line items and payments |
| `invoices.create` | Mutation | Create invoice with line items (auto-calculate totals) |
| `invoices.update` | Mutation | Update draft invoice only |
| `invoices.send` | Mutation | Change status to 'sent', trigger email dispatch |
| `invoices.void` | Mutation | Void invoice with reason, reverse payments if any |
| `invoices.downloadPdf` | Query | Generate and return PDF |
| `invoices.getNextNumber` | Query | Return next available invoice number for preview |

### `invoice-payments-router.ts` (`/api/invoice-payments`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `invoicePayments.list` | Query | Payments list with date/payment method/invoice filters |
| `invoicePayments.record` | Mutation | Record payment, update invoice balance/status |
| `invoicePayments.getByInvoice` | Query | All payments for a specific invoice |
| `invoicePayments.delete` | Mutation | Reverse a payment (within cancelation period) |

### `recurring-invoices-router.ts` (`/api/recurring-invoices`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `recurringInvoices.list` | Query | List recurring templates |
| `recurringInvoices.create` | Mutation | Create template with items |
| `recurringInvoices.update` | Mutation | Update template |
| `recurringInvoices.delete` | Mutation | Deactivate template |
| `recurringInvoices.triggerNow` | Mutation | Manually trigger generation |
| `recurringInvoices.skipNext` | Mutation | Skip next occurrence |
| `recurringInvoices.getGenerationLog` | Query | History of auto-generations |

### `billing-reports-router.ts` (`/api/billing-reports`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `billingReports.revenueByPeriod` | Query | Grouped revenue by month/quarter/year |
| `billingReports.customerAging` | Query | Outstanding balances by aging bucket |
| `billingReports.invoiceStatusDistribution` | Query | Count/amount by status |
| `billingReports.revenueByCategory` | Query | Revenue breakdown by revenue category |

### `billing-business-profile-router.ts` (`/api/billing/business-profile`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `billingProfile.get` | Query | Get business branding profile |
| `billingProfile.update` | Mutation | Update branding (logo, prefix, terms, colors) |

### `billing-dashboard-router.ts` (`/api/billing/dashboard`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `billingDashboard.summary` | Query | Revenue KPIs (invoiced, collected, outstanding) |
| `billingDashboard.recentInvoices` | Query | Last N invoices |
| `billingDashboard.upcomingRecurring` | Query | Next N recurring invoices |

---

## UI Pages (NEW — `src/pages/billing/`)

### Billing Dashboard (`/billing`)
- Revenue summary cards: Invoiced This Month, Collected This Month, Outstanding
- Recent invoices list (last 10)
- Upcoming recurring invoices (next 5)
- Aging summary (buckets with amounts)
- Monthly revenue trend chart (recharts)

### Customers (`/billing/customers`)
- List page with search (name, email, phone, customerNumber)
- Status indicator (active/inactive)
- Quick actions: Create Invoice, View Statement
- Customer detail page with:
  - Info cards (contact, payment terms, credit limit)
  - Invoice history table with status badges
  - Statement summary (balance, aging)
  - Quick action buttons

### Invoices (`/billing/invoices`)
- List with status tabs: All, Draft, Sent, Paid, Overdue, Void
- FinaFlow-style button tabs (border-b-2 active indicator)
- Status badges with color coding (same pattern as bills)
- Quick actions: View, Send, Download PDF, Record Payment, Void

### Invoice Builder (`/billing/invoices/create`, `/billing/invoices/:id/edit`)
- Customer selector (searchable dropdown with contact info)
- Invoice date, due date (auto-computed from payment terms)
- Line items table (add/remove rows, inline edit qty/price/tax)
- Revenue category selector per line item (from revenue_categories table)
- Currency selector (defaults to customer's preferred currency)
- Real-time totals (subtotal, discount, tax, grand total)
- Notes and payment terms text areas
- Save as Draft / Save and Send buttons

### Invoice Detail (`/billing/invoices/:id`)
- Professional invoice display (print-friendly)
- Status badge with color coding
- Payment history table
- Email log entries
- Actions: Send, Download PDF, Record Payment, Void

### Recurring Invoices (`/billing/recurring`)
- Template list with status indicator (active/inactive)
- Create/edit template form (customer, name, frequency, items, next date)
- Template detail with generation history log
- Manual trigger / Skip next action buttons

### Payments Received (`/billing/payments`)
- Payments list with date range, payment method filters
- Payment method breakdown summary card
- Each payment shows linked invoice and customer

### Billing Reports (`/billing/reports`)
- Revenue by period chart and table (recharts bar chart)
- Customer aging summary card with bucket breakdown
- Invoice status distribution (pie chart)
- Date range picker
- CSV export

---

## Invoice Status Lifecycle

```
[Draft] ──→ [Sent] ──→ [Partial] ──→ [Paid]
   │            │           │
   ├──→ [Void]  └──→ [Overdue]    └──→ [Credit Note]
                  (past due + balance > 0)
```

- **Draft**: Editable, not yet sent to customer
- **Sent**: Dispatched to customer via email, no longer editable
- **Partial**: Some payments received, balance still due
- **Paid**: Fully paid
- **Overdue**: Past due date with balance > 0
- **Void**: Cancelled with reason (only if not fully paid)
- **Credit Note**: Full reversal (applies when voiding a paid invoice)

---

## Integration with Chart of Accounts

The existing **Chart of Accounts** already has:
- `accountType = "revenue"` — Income statement revenue accounts
- `revenue_categories` table — Categorizes revenue (product_sales, service_revenue, subscription, etc.)
- Each `revenueCategory` links to a `incomeAccountId` (a `revenue` type account in the COA)
- Multi-currency support on the `accounts` table

### How Invoices Feed Into Financial Reports

When an invoice is **sent** (status changes from draft → sent):
- No journal entry yet — revenue is not recognized until payment

When an **invoice payment is recorded**:
- Creates a journal entry automatically:
  - **Debit**: Cash/Bank/Wallet account (determined by payment method)
  - **Credit**: Revenue account (from the line item's revenueCategory → incomeAccountId)
- This feeds directly into:
  - **Profit & Loss** — Revenue is recognized
  - **Balance Sheet** — Cash/Bank balance increases
  - **Cash Flow** — Operating cash inflow recorded

When an invoice is **voided** with payments made:
- Creates a reversing journal entry
- Or creates a credit note entry

### Shared Account System

The `accounts` table (`cash`, `mpesa`, `bank_account` types) is used by **both**:
- **Expenses side**: Bills payments draw from these accounts
- **Billing side**: Invoice payments deposit into these accounts
- The `accountId` field on `invoice_payments` links directly to `accounts.id`

This means every payment, whether outgoing (bill) or incoming (invoice), connects to the same wallet/account tracking. The existing ledger and financial reports automatically reflect both sides.

---

## Payment to Account Mapping

| Payment Method | Account Type | COA Sub-Type |
|---------------|--------------|--------------|
| cash | cash | asset:cash |
| mpesa | mpesa | asset:cash |
| bank_transfer | bank_account | asset:bank |
| card | bank_account | asset:bank |

This mirrors the existing [accounting-maps.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/accounting-maps.ts) pattern used for bill payments, ensuring consistency.

---

## Recurring Invoice Engine (Cron Job)

A scheduled task runs daily:
1. Queries all active `recurring_invoice_templates` where `nextDueDate <= today`
2. For each template, creates a new invoice from template items
3. Updates `nextDueDate` by the frequency interval
4. Creates a `recurring_invoice_generations` log entry
5. Optionally sends the generated invoice via email (configurable)

Frequency computation:
- **Weekly**: `nextDueDate + 7 days`
- **Monthly**: `nextDueDate + 1 month` (using date-fns or similar)
- **Quarterly**: `nextDueDate + 3 months`
- **Annually**: `nextDueDate + 1 year`

---

## Payment Reminders (Cron Job)

A scheduled task runs daily:
1. Finds all invoices where `status = 'sent' OR status = 'partial'` AND `dueDate < today` AND `balanceDue > 0`
2. Groups by days overdue:
   - 7 days overdue → First reminder
   - 14 days overdue → Second reminder
   - 30+ days overdue → Final reminder
3. Creates `payment_reminders` entries with `status = 'pending'`
4. Email subsystem sends reminders and updates status

---

## PDF Invoice Generation

Using a lightweight PDF library (pdfkit or similar):
- Business logo (from `business_profiles.logoUrl`)
- Business info (name, address, phone, email, tax reg no)
- Customer info block
- Invoice header (number, date, due date, status)
- Line items table (description, qty, unit price, tax, total)
- Totals section (subtotal, discount, tax, grand total)
- Amount in words (for Kenyan businesses)
- Payment terms and notes
- Business accent color (from `business_profiles.accentColor`)

---

## UI Design Patterns

All billing pages follow existing FinaFlow conventions exactly:

| Pattern | Existing Reference | How Billing Follows |
|---------|-------------------|-------------------|
| **Sidebar** | Layout.tsx — collapsible, icon+label | Same component, context-switched nav items |
| **Mobile nav** | MobileBottomNavigation — bottom tab bar | Context-switched bottom items |
| **Page tabs** | Reports.tsx — button-style `border-b-2` | Same pattern for invoice status tabs |
| **Cards** | All pages — `rounded-2xl border border-[#E8E0D8] bg-white shadow-sm` | Same |
| **Tables** | Bills.tsx — `border-b` divides, hover rows | Same |
| **Buttons** | Primary `bg-[#C73E1D]`, success `bg-[#2E7D32]` | Same |
| **Inputs** | `rounded-lg border px-3 py-2 text-sm` | Same |
| **Dialogs** | shadcn `<Dialog>` | Same |
| **Color palette** | `#2D2A26` text, `#E8E0D8` borders, `#C73E1D` accent, `#F5EDE6` bg, `#8D8A87` muted | Same |
| **Fonts** | Serif titles, monospace currency amounts | Same |
| **Status badges** | Bills.tsx — colored inline badges | Same pattern, different status values |
| **Date pickers** | Native `<input type="date">` | Same |

---

## Mobile Experience

- **Bottom navigation** context-switches just like the sidebar:
  - Expenses mode: Dashboard, Sales, Expenses, Bills, Reports
  - Billing mode: Dashboard, Invoices, Customers, Payments, Reports
- **Invoice list** adapts to card-based layout on small screens
- **Invoice builder** is scrollable with touch-friendly line item controls
- **Dialogs** are full-screen on mobile
- **Touch targets** at least 44px

---

## Indexes for Performance

```
idx_customers_business       ON customers(businessId)
idx_customers_email          ON customers(email)
idx_invoices_business        ON invoices(businessId)
idx_invoices_customer        ON invoices(customerId)
idx_invoices_status          ON invoices(status)
idx_invoices_issue_date      ON invoices(issueDate)
idx_invoices_due_date        ON invoices(dueDate)
idx_invoice_items_invoice    ON invoice_items(invoiceId)
idx_invpayments_invoice      ON invoice_payments(invoiceId)
idx_invpayments_date         ON invoice_payments(paymentDate)
idx_invpayments_method       ON invoice_payments(paymentMethod)
idx_recurring_templates_active ON recurring_invoice_templates(businessId, isActive)
idx_recurring_templates_due  ON recurring_invoice_templates(nextDueDate)
uq_invoice_number            ON invoices(invoiceNumber) — unique per business
uq_customer_number           ON customers(customerNumber) — unique per business
```

---

## Permission Model

Leveraging the existing RBAC system, new permissions are added:

| Permission Constant | What It Controls |
|--------------------|-----------------|
| `INVOICES_VIEW` | View invoice list and details |
| `INVOICES_CREATE` | Create and edit invoices |
| `INVOICES_SEND` | Send invoices to customers |
| `INVOICES_VOID` | Void invoices |
| `INVOICES_PAY` | Record payments against invoices |
| `CUSTOMERS_VIEW` | View customer list and details |
| `CUSTOMERS_MANAGE` | Create, edit, delete customers |
| `RECURRING_MANAGE` | Create, edit, manage recurring templates |
| `BILLING_REPORTS_VIEW` | View billing reports |
| `BILLING_SETTINGS_MANAGE` | Manage billing settings and branding |

These follow the same pattern as existing permissions (`BILLS_VIEW`, `EXPENSES_VIEW`, etc.) and are checked via `hasAnyPermission()`.

---

## Invoice Numbering

- Format: `{prefix}-{number}` where prefix defaults to `"INV"`
- Prefix configurable in business profile settings
- Numbering is per-business (not global)
- First invoice: `INV-0001`, second: `INV-0002`, etc.
- Uses a counter stored in `business_profiles.invoiceNumberStart`
- Atomic increment to prevent duplicates

---

## Data Migration

### Existing Data
- **No data migration needed** — this is a new module. No existing tables are renamed or restructured.
- The `businesses` table gets a `primaryMode` column with default `'both'` for existing businesses.

### Seed Data
- No seed data needed for billing-specific tables.
- Existing `revenue_categories` seed data already exists in `db/seed.ts`.

---

## Phase Plan

### Phase 1: Foundation
1. Add `primaryMode` column to `businesses` table
2. Create all new database tables (Drizzle schema + migration)
3. Add context-switching infrastructure (Layout.tsx changes, useBillingContext hook)
4. Add new permissions to the RBAC system
5. Add new permission seed data

### Phase 2: Core Features
1. Customers CRUD (API + UI)
2. Invoices CRUD (API + UI + line items)
3. Invoice Builder UI
4. Invoice status lifecycle management
5. Invoice PDF generation

### Phase 3: Billing Operations
1. Payment recording (API + UI)
2. Recurring invoice engine + cron job
3. Email delivery (SendGrid or SMTP integration)
4. Payment reminders (cron job)
5. Business branding/profile settings

### Phase 4: Reports & Dashboard
1. Billing dashboard with revenue KPIs
2. Revenue by period report
3. Customer aging report
4. Invoice status distribution
5. Billing reports integrated into main Reports page

### Phase 5: Polish
1. Mobile optimization for all billing pages
2. Permission enforcement in UI
3. Business onboarding flow
4. Integration with existing financial reports (P&L, Balance Sheet)
5. Testing

---

## Key Design Decisions

1. **No separate app** — Everything lives inside `finaflow/`. Avoids duplication of COA, auth, settings, wallets.

2. **Full context switching** — The sidebar completely changes between modes. This keeps each mode lean and mobile-friendly.

3. **Business onboarding** — `primaryMode` on the businesses table determines the default landing view. Users can always switch freely.

4. **Revenue flows through existing COA** — Invoice payments create journal entries to revenue accounts. This means existing P&L and Balance Sheet reports automatically reflect billing data.

5. **Shared payment accounts** — `invoice_payments.accountId` links to the same `accounts` table as bill payments. One unified view of all cash/bank/wallet balances.

6. **Permissions reuse** — Follows the same `PERMISSIONS` constant pattern as the rest of the app. No new auth system needed.

7. **Revenue categories already exist** — The `revenue_categories` table is already in the schema with `incomeAccountId` linking to the COA. No new table needed for this.
