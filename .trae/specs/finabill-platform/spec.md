# FinaBill Platform Specification

> **Project Location**: `d:\DevCenter\abuilds\fina\finabill\` — sibling directory to FinaFlow (`d:\DevCenter\abuilds\fina\finaflow\`)
> **Spec documents**: Initially created at `finaflow/.trae/specs/finabill-platform/`. Once the monorepo foundation is built, these spec documents SHALL be copied to `finabill/.trae/specs/` for implementation tracking within the FinaBill project.

## Why

FinaFlow provides powerful cashflow tracking, expense management, and accounting capabilities for small businesses, but lacks a dedicated invoicing and billing platform. Businesses need to send professional invoices, manage customer accounts, set up recurring billing, track payments received, and integrate collections data back into their financial reporting. FinaBill fills this gap as a standalone billing platform that seamlessly integrates with FinaFlow's accounting engine, creating a complete financial operations suite.

---

## What Changes

### Platform Architecture
- **Create standalone FinaBill application** in a new repository at `/finabill/` sibling to `/finaflow/`
- **Shared libraries package** `@finabill/shared` for types, utilities, and validation schemas consumed by both FinaBill and FinaFlow
- **API integration layer** between FinaBill and FinaFlow for bi-directional data sync (payments, invoices, customers)
- **Unified database** strategy using shared PostgreSQL with separate schema (`finabill.*`) or same-schema with `businessId` scoping
- **Authentication re-use** via shared JWT + session model so users log in once across both platforms
- **Monorepo structure** with `packages/` directory holding shared code

### Database Schema (NEW — FinaBill-specific tables)
- `customers` — Customer profiles with contact info, billing addresses, payment terms, credit limits
- `invoices` — Invoice header with line items, totals, status, due dates
- `invoice_items` — Individual line items on invoices (description, quantity, unit price, tax, total)
- `invoice_payments` — Payment records applied to invoices (partial/full)
- `recurring_invoice_templates` — Recurring invoice schedules (frequency, next date, active status)
- `recurring_invoice_generations` — History of auto-generated invoices from recurring templates
- `payment_reminders` — Reminder schedules and delivery logs
- `invoice_email_logs` — Email delivery tracking (sent, opened, bounced)
- `revenue_categories` — **(already exists in FinaFlow schema)** Revenue classification for invoice line items
- `business_profiles` — Business branding settings (logo, payment terms, footer text) for invoice customization

### Shared Library (`@finabill/shared`)
- **Shared TypeScript types**: Customer, Invoice, InvoiceItem, Payment, RecurringTemplate, RevenueCategory
- **Validation schemas** via Zod: createCustomerSchema, createInvoiceSchema, recordPaymentSchema, etc.
- **Financial utilities**: currency formatting, tax calculation, invoice totals, due date computation
- **Date utilities**: next invoice date calculation, overdue detection, period filtering
- **tRPC procedure helpers**: shared middleware patterns, pagination schemas, date-range filters
- **Decimal.js wrapper**: consistent financial math across both platforms
- **Permission types**: shared RBAC definitions for billing operations

### API Endpoints (NEW — FinaBill routers)
- `customers.router.ts` — CRUD + search + statement generation
- `invoices.router.ts` — CRUD + send + void + download PDF
- `invoice-items.router.ts` — Line item management within invoices
- `payments.router.ts` — Payment recording + reconciliation
- `recurring.router.ts` — Recurring template CRUD + manual trigger + schedule management
- `reports.router.ts` — Revenue reports, aging reports, customer statements
- `email.router.ts` — Send invoices, payment reminders
- `business-profile.router.ts` — Business branding configuration
- `integration.router.ts` — FinaFlow sync endpoints (push payments, pull accounts)

### API Integration Layer (FinaFlow ↔ FinaBill)
- **FinaFlow sync router** (`finabill-integration.ts`): Exposes endpoints for FinaBill to push/pull data
- **Payment sync**: When FinaBill records a payment, it creates a corresponding journal entry in FinaFlow via integration API
- **Customer sync**: Customers created in FinaBill are visible as entities in FinaFlow
- **Revenue mapping**: Invoice line items map to revenue categories → Chart of Accounts revenue accounts
- **Shared business context**: Both platforms use the same `businessId` and location model
- **Webhook system**: FinaBill can notify FinaFlow of invoice events (paid, overdue, created)
- **Batch sync**: Scheduled reconciliation between invoice payment totals and FinaFlow bank transaction totals

### UI Features (FinaBill standalone app)
- **Dashboard** — Revenue overview, outstanding invoices, upcoming recurring, aging summary
- **Customers page** — List + search + detail view with invoice history and statement
- **Invoices page** — List with status filters (draft, sent, paid, overdue, void) + create/send
- **Invoice Builder** — Professional invoice form with line items, tax, discounts, notes, terms
- **Recurring Invoices page** — Template list, schedule management, generation log
- **Payments page** — Payment records, reconciliation with bank deposits
- **Reports section** — Revenue by period, customer aging, invoice status distribution
- **Settings** — Business profile (logo, branding), payment terms, invoice numbering, email templates
- **Mobile-friendly** — Responsive design matching FinaFlow's Tailwind/shadcn/ui patterns

### UI Personas
- **Admin/Owner** — Full access to all billing features, settings, reports
- **Accountant** — Can view invoices, record payments, run reports — cannot create/edit customers
- **Operator** — Can create invoices, send invoices, manage customers — cannot modify settings or void invoices

---

## Impact

- **Affected FinaFlow specs**: This extends the existing accounting enhancements spec with a complete billing platform
- **New repository**: `/finabill/` standalone application
- **Shared package**: `@finabill/shared` NPM package
- **FinaFlow modifications**: New integration router, shared package consumption, optional API endpoints
- **Database**: New tables (customers, invoices, invoice_items, payments, recurring, reminders, business_profiles, email_logs)
- **Migration**: Existing FinaFlow bills/payables remain separate from FinaBill invoices/receivables

---

## ADDED Requirements

### Requirement: Shared Library Package

The system SHALL provide a shared NPM package `@finabill/shared` with common types, validation schemas, and utilities consumed by both FinaBill and FinaFlow.

#### Scenario: Consuming shared types
- **GIVEN** both FinaBill and FinaFlow import from `@finabill/shared`
- **WHEN** either application uses a type (e.g., `Invoice`, `Customer`)
- **THEN** the type definition is identical in both applications

#### Scenario: Validation re-use
- **GIVEN** an API endpoint that accepts invoice creation input
- **WHEN** validation runs
- **THEN** it uses Zod schemas from `@finabill/shared/createInvoiceSchema`

### Requirement: Customer Management

FinaBill SHALL provide full customer lifecycle management.

#### Scenario: Create customer
- **GIVEN** an authorized user with billing:create permission
- **WHEN** they fill the customer form with name, email, phone, billing address, payment terms
- **THEN** the customer is saved and visible in the customer list
- **AND** a customer number is auto-generated (CUST-0001 format)

#### Scenario: View customer detail
- **GIVEN** a customer exists with invoices and payments
- **WHEN** user clicks on the customer
- **THEN** a detail page shows customer info, statement (invoice list with balances), payment history

#### Scenario: Search customers
- **GIVEN** many customers exist
- **WHEN** user types in the search field
- **THEN** results filter by name, email, phone, or customer number in real-time

### Requirement: Invoice Management

FinaBill SHALL support professional invoice creation, sending, and lifecycle management.

#### Scenario: Create invoice
- **GIVEN** a customer exists
- **WHEN** user creates a new invoice with customer, line items (description, qty, unit price, tax rate), discount, notes
- **THEN** the invoice is saved as "draft" with auto-calculated subtotal, tax total, discount total, grand total
- **AND** an invoice number is auto-generated (INV-0001 format)

#### Scenario: Invoice line items
- **GIVEN** an invoice is being created or edited
- **WHEN** user adds/removes line items
- **THEN** totals are recalculated in real-time
- **AND** each line item has: description, quantity, unit_price, tax_rate, tax_amount, line_total

#### Scenario: Send invoice
- **GIVEN** an invoice in "draft" status
- **WHEN** user clicks "Send"
- **THEN** status changes to "sent"
- **AND** an email is dispatched to the customer with the invoice PDF attached
- **AND** an email delivery log is created

#### Scenario: Record partial payment
- **GIVEN** an invoice in "sent" or "overdue" status with balance > 0
- **WHEN** user records a payment for an amount less than the balance
- **THEN** status changes to "partial"
- **AND** the paid amount and balance are updated

#### Scenario: Record full payment
- **GIVEN** an invoice in "sent" or "overdue" status with balance > 0
- **WHEN** user records a payment for the full balance amount
- **THEN** status changes to "paid"
- **AND** a payment record is created

#### Scenario: Void invoice
- **GIVEN** an invoice that has not been fully paid
- **WHEN** user voids the invoice with a reason
- **THEN** status changes to "void"
- **AND** any payments made are reversed as credit notes

### Requirement: Recurring Invoices

FinaBill SHALL support recurring invoice templates with automatic generation on schedule.

#### Scenario: Create recurring template
- **GIVEN** a customer exists
- **WHEN** user creates a recurring invoice template with customer, line items, frequency (weekly/monthly/quarterly/annually), next_due_date, end_date
- **THEN** the template is saved and scheduled for auto-generation

#### Scenario: Auto-generate recurring invoice
- **GIVEN** an active recurring template with next_due_date <= today
- **WHEN** scheduled task runs (daily cron)
- **THEN** a new invoice is created from the template
- **AND** next_due_date is advanced by the frequency period
- **AND** a generation log entry is created

#### Scenario: Skip recurring generation
- **GIVEN** a recurring template with next_due_date today
- **WHEN** user manually skips this occurrence
- **THEN** next_due_date is advanced without generating an invoice
- **AND** a skip log entry is created

### Requirement: Payment Collection

FinaBill SHALL track payments with support for partial payments, multiple payment methods, and reconciliation.

#### Scenario: Record payment
- **GIVEN** an invoice with outstanding balance
- **WHEN** user records a payment with amount, payment_method (cash/mpesa/bank/card), reference, payment_date
- **THEN** the payment is applied to the invoice
- **AND** invoice balance and status are updated

#### Scenario: Payment reconciliation
- **GIVEN** payments recorded against invoices
- **WHEN** user views the payments page
- **THEN** they can filter by date, payment method, status
- **AND** see totals by payment method for reconciliation with bank/M-PESA statements

### Requirement: Revenue Reporting

FinaBill SHALL provide revenue and aging reports for business insights.

#### Scenario: Revenue by period
- **GIVEN** invoices with payments exist
- **WHEN** user selects a date range and grouping (monthly/quarterly/yearly)
- **THEN** a revenue report shows: invoiced amount, collected amount, outstanding balance by period

#### Scenario: Customer aging
- **GIVEN** invoices with different due dates
- **WHEN** user views the aging report
- **THEN** outstanding balances are grouped into buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days

### Requirement: FinaFlow Integration

FinaBill SHALL integrate with FinaFlow for unified accounting and cashflow tracking.

#### Scenario: Sync payment to FinaFlow journal
- **GIVEN** a payment is recorded in FinaBill
- **WHEN** the payment is saved
- **THEN** a background sync creates a journal entry in FinaFlow:
  - Debit: Cash/Bank account (by payment method)
  - Credit: Revenue account (by invoice revenue category)

#### Scenario: Sync customer list
- **GIVEN** customers exist in FinaBill
- **WHEN** FinaFlow requests customer data
- **THEN** customers are available for selection in FinaFlow's account/entity picker

#### Scenario: Batch reconciliation
- **GIVEN** FinaBill has recorded payments
- **WHEN** daily batch sync runs
- **THEN** FinaBill payment totals are reconciled against FinaFlow bank transaction totals

### Requirement: PDF Invoice Generation

FinaBill SHALL generate professional PDF invoices with business branding.

#### Scenario: Generate invoice PDF
- **GIVEN** an invoice exists with customer info and line items
- **WHEN** user clicks "Download PDF" or sends invoice via email
- **THEN** a PDF is generated with: business logo, business info, customer info, invoice number, invoice date, due date, line items table, subtotal, tax, discounts, grand total, payment terms, notes
- **AND** the PDF is styled professionally with the business branding colors

### Requirement: Email Delivery

FinaBill SHALL send invoices and payment reminders via email.

#### Scenario: Send invoice email
- **GIVEN** an invoice in "draft" status
- **WHEN** user clicks "Send"
- **THEN** an email is sent to the customer's email address
- **AND** the PDF invoice is attached
- **AND** a delivery log is created with status (sent/failed/bounced)

#### Scenario: Payment reminder
- **GIVEN** an invoice is overdue (past due date with balance > 0)
- **WHEN** automated reminder schedule triggers
- **THEN** a reminder email is sent to the customer
- **AND** a reminder log is created

### Requirement: Business Branding

FinaBill SHALL support per-business branding configuration for invoices.

#### Scenario: Configure business profile
- **GIVEN** a business exists
- **WHEN** user configures the business profile in settings
- **THEN** they can set: business logo (upload), business name, address, phone, email, payment terms text, invoice footer text, default tax rate, invoice numbering prefix
- **AND** all generated invoices use this branding

### Requirement: Mobile-Friendly UI

FinaBill SHALL provide a mobile-responsive interface matching FinaFlow's design patterns.

#### Scenario: Mobile invoice list
- **GIVEN** a user on a mobile device
- **WHEN** they view the invoices list
- **THEN** the table adapts to card-based layout for small screens
- **AND** actions (view, send, download) are accessible via touch-friendly buttons

#### Scenario: Mobile invoice creation
- **GIVEN** a user on a mobile device
- **WHEN** they create an invoice
- **THEN** the form is scrollable with stacked layout
- **AND** line items can be added/removed with touch-friendly controls

---

## ADDED Infrastructure Requirements

### Requirement: Monorepo Structure

The system SHALL be organized as a monorepo with shared packages.

```
/finabill/
  ├── apps/
  │   └── web/          # FinaBill React frontend (Vite)
  ├── packages/
  │   └── shared/       # @finabill/shared types, schemas, utilities
  ├── api/              # Hono.js + tRPC backend
  ├── db/               # Drizzle schema + migrations for FinaBill tables
  ├── package.json
  └── tsconfig.json
```

### Requirement: Database Schema

#### Table: `customers`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| customerNumber | varchar(20) UNIQUE | Auto-generated CUST-XXXX |
| name | varchar(200) NOT NULL | |
| email | varchar(255) | |
| phone | varchar(50) | |
| billingAddress | text | Street, city, postal code, country |
| paymentTerms | varchar(50) | net15, net30, net60, due_on_receipt |
| creditLimit | decimal(12,2) DEFAULT 0 | |
| notes | text | |
| isActive | boolean DEFAULT true | |
| externalId | varchar(255) | For FinaFlow integration mapping |
| externalSystem | varchar(50) | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | Soft delete |

#### Table: `invoices`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| customerId | int FK → customers.id | |
| invoiceNumber | varchar(20) UNIQUE | Auto-generated INV-XXXX |
| status | enum | draft, sent, partial, paid, overdue, void, credit_note |
| issueDate | date NOT NULL | |
| dueDate | date NOT NULL | Computed from payment_terms |
| subtotal | decimal(12,2) | Sum of line item totals before tax/discount |
| discountType | enum | percentage, fixed |
| discountValue | decimal(12,2) | |
| discountAmount | decimal(12,2) | Computed |
| taxTotal | decimal(12,2) | Sum of line item taxes |
| grandTotal | decimal(12,2) | subtotal - discount + tax |
| amountPaid | decimal(12,2) DEFAULT 0 | |
| balanceDue | decimal(12,2) | grand_total - amount_paid |
| notes | text | |
| terms | text | Payment terms text |
| isRecurring | boolean DEFAULT false | |
| recurringTemplateId | int FK → recurring_invoice_templates | |
| sourceType | varchar(50) | manual, recurring, credit_note |
| sourceId | int | ID of source (recurring gen log, etc.) |
| voidReason | text | |
| voidedAt | timestamptz | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

#### Table: `invoice_items`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| invoiceId | int FK → invoices.id | |
| lineNumber | int | Order within invoice |
| description | text NOT NULL | |
| quantity | decimal(12,2) DEFAULT 1 | |
| unitPrice | decimal(12,2) NOT NULL | |
| taxRate | decimal(5,2) DEFAULT 0 | Percentage (e.g., 16.00 for VAT) |
| taxAmount | decimal(12,2) | Computed: quantity × unit_price × tax_rate / 100 |
| discountRate | decimal(5,2) DEFAULT 0 | Percentage |
| discountAmount | decimal(12,2) | Computed |
| lineTotal | decimal(12,2) | Computed: (qty × unit_price) - discount + tax |
| revenueCategoryId | int FK → revenue_categories | For accounting mapping |
| createdAt | timestamptz | |

#### Table: `invoice_payments`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| invoiceId | int FK → invoices.id | |
| paymentMethod | enum | cash, mpesa, bank_transfer, card, other |
| amount | decimal(12,2) NOT NULL | |
| reference | varchar(255) | Transaction reference (M-PESA code, cheque no.) |
| paymentDate | date NOT NULL | |
| notes | text | |
| isReconciled | boolean DEFAULT false | Synced to FinaFlow |
| reconciledAt | timestamptz | |
| createdBy | int FK → users.id | |
| createdAt | timestamptz | |

#### Table: `recurring_invoice_templates`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| customerId | int FK → customers.id | |
| name | varchar(200) | Template name for display |
| description | text | |
| frequency | enum | weekly, monthly, quarterly, annually |
| interval | int DEFAULT 1 | Every N periods |
| nextDueDate | date NOT NULL | Next invoice generation date |
| endDate | date | Optional end date |
| isActive | boolean DEFAULT true | |
| notes | text | Default invoice notes |
| terms | text | Default invoice terms |
| lastGeneratedDate | date | |
| totalGenerated | int DEFAULT 0 | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

#### Table: `recurring_template_items`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| templateId | int FK → recurring_invoice_templates.id | |
| description | text NOT NULL | |
| quantity | decimal(12,2) DEFAULT 1 | |
| unitPrice | decimal(12,2) NOT NULL | |
| taxRate | decimal(5,2) DEFAULT 0 | |
| revenueCategoryId | int FK → revenue_categories | |
| createdAt | timestamptz | |

#### Table: `recurring_invoice_generations`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| templateId | int FK → recurring_invoice_templates.id | |
| invoiceId | int FK → invoices.id | The generated invoice |
| generatedDate | date NOT NULL | |
| status | enum | success, skipped, failed |
| skipReason | text | |
| createdAt | timestamptz | |

#### Table: `payment_reminders`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| invoiceId | int FK → invoices.id | |
| reminderType | enum | first_reminder, second_reminder, final_reminder |
| scheduledDate | date | |
| sentDate | date | |
| status | enum | pending, sent, failed |
| deliveryLog | jsonb | |
| createdAt | timestamptz | |

#### Table: `invoice_email_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| invoiceId | int FK → invoices.id | |
| recipient | varchar(255) | Email address |
| emailType | enum | invoice_sent, payment_reminder, payment_receipt |
| status | enum | sent, delivered, opened, bounced, failed |
| sentAt | timestamptz | |
| deliveredAt | timestamptz | |
| openedAt | timestamptz | |
| errorMessage | text | |
| createdAt | timestamptz | |

#### Table: `business_profiles`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id UNIQUE | |
| logoUrl | text | Uploaded logo path |
| businessName | varchar(200) | Display name on invoices |
| address | text | |
| phone | varchar(50) | |
| email | varchar(255) | |
| website | varchar(255) | |
| taxRegistrationNo | varchar(100) | KRA PIN, VAT no., etc. |
| defaultTaxRate | decimal(5,2) DEFAULT 0 | |
| invoicePrefix | varchar(10) DEFAULT "INV" | |
| invoiceNumberStart | int DEFAULT 1 | |
| paymentTerms | text | Default terms text |
| footerText | text | Invoice footer |
| accentColor | varchar(7) | Hex color for invoice branding |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

### Requirement: FinaFlow Integration API

#### Integration Endpoints (in FinaFlow's `api/integration`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/integration/finabill/sync-payment` | Mutation | Receive a payment from FinaBill, create journal entry |
| `POST /api/integration/finabill/sync-invoice` | Mutation | Create/update invoice as receivable in FinaFlow |
| `GET /api/integration/finabill/accounts` | Query | Get Chart of Accounts for revenue category mapping |
| `GET /api/integration/finabill/verify-business` | Query | Verify API key and return business context |
| `POST /api/integration/finabill/reconcile` | Mutation | Trigger batch reconciliation |

#### Authentication between platforms
- FinaBill uses an API key (generated per business in FinaFlow settings)
- API key is passed in `X-FinaBill-Api-Key` header
- FinaFlow validates the key and scopes all operations to the matching business

### Requirement: Chron Job for Recurring Invoices

- Daily cron job runs at 00:00
- Finds all active recurring templates where nextDueDate <= today
- For each, creates a new invoice from template items
- Updates nextDueDate (add frequency interval)
- Logs generation in `recurring_invoice_generations`
- Sends generated invoices automatically (configurable)

### Requirement: Invoice Status Lifecycle

```
[Draft] ──→ [Sent] ──→ [Partial] ──→ [Paid]
   │            │           │
   ├──→ [Void]  └──→ [Overdue]     └──→ [Credit Note]
                    (past due date + balance > 0)
```

### Requirement: Invoice Numbering

- Format: `{prefix}-{number}` where prefix defaults to "INV" and number auto-increments
- Prefix configurable in business profile settings
- Numbering is per-business (not global)
- Format: `INV-0001`, `INV-0002`, etc.

### Requirement: Shared NPM Package Structure

```typescript
// @finabill/shared package
@finabill/shared/
  ├── src/
  │   ├── index.ts
  │   ├── types/
  │   │   ├── customer.ts       // Customer, CreateCustomerInput, UpdateCustomerInput
  │   │   ├── invoice.ts        // Invoice, InvoiceItem, InvoiceStatus, CreateInvoiceInput
  │   │   ├── payment.ts        // Payment, RecordPaymentInput, PaymentMethod
  │   │   ├── recurring.ts      // RecurringTemplate, RecurringTemplateItem
  │   │   ├── revenue.ts        // RevenueCategory, RevenueReport
  │   │   ├── business.ts       // BusinessProfile, BusinessProfileUpdate
  │   │   ├── common.ts         // Pagination, DateRange, ApiResponse, BusinessContext
  │   │   └── integration.ts    // SyncPayload, SyncResult
  │   ├── schemas/
  │   │   ├── customer.ts       // Zod schemas
  │   │   ├── invoice.ts
  │   │   ├── payment.ts
  │   │   └── recurring.ts
  │   ├── utils/
  │   │   ├── currency.ts       // formatCurrency, parseCurrency
  │   │   ├── invoice.ts        // calculateTotals, computeDueDate, generateInvoiceNumber
  │   │   ├── date.ts           // nextDateByFrequency, isOverdue, formatDate
  │   │   ├── validation.ts     // shared validation helpers
  │   │   └── pagination.ts     // paginate, buildPaginationMeta
  │   └── constants.ts          // InvoiceStatus, PaymentMethod enums, defaultTaxRates
  ├── package.json
  ├── tsconfig.json
  └── README.md
```

---

## MODIFIED FinaFlow Requirements

### FinaFlow: Integration Router (NEW)

FinaFlow SHALL expose integration endpoints for FinaBill to sync billing data into the accounting system.

#### Scenario: Receive payment sync
- **GIVEN** FinaBill records a payment
- **WHEN** FinaBill calls the sync endpoint
- **THEN** FinaFlow creates a journal entry:
  - Debit: Cash/Bank account (determined by payment method)
  - Credit: Revenue account (determined by invoice revenue category)
- **AND** returns success with the journal entry ID

#### Scenario: API key verification
- **GIVEN** a request with X-FinaBill-Api-Key header
- **WHEN** FinaFlow receives the request
- **THEN** it validates the key against the `finabill_api_keys` table
- **AND** returns the associated business context

### FinaFlow: New `finabill_api_keys` Table

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK → businesses.id | |
| apiKey | varchar(64) UNIQUE | Generated key |
| isActive | boolean DEFAULT true | |
| createdAt | timestamptz | |
| expiresAt | timestamptz | |

---

## UI Design Patterns

- **Color scheme**: Follow FinaFlow's warm neutral palette (#2D2A26 text, #E8E0D8 borders, #C73E1D accent, #F5EDE6 backgrounds)
- **Sidebar navigation**: Same `Layout` component pattern with collapsible sidebar, icon + label links
- **Tabs style**: Underline-tab pattern (border-b-2 on active, same as FinaFlow's Accounts/Suppliers pages)
- **Cards**: Rounded-2xl, border [#E8E0D8], white background, shadow-sm
- **Fonts**: Serif for page titles (font-serif), monospace for currency amounts (font-mono)
- **Mobile**: Same responsive patterns (grid → stacked at sm, tables → card lists)
- **Tables**: Same styled table pattern (border-b divides, hover:bg[#F5EDE6]/50 rows)
- **Forms**: Same input styling (rounded border px-3 py-2 text-sm)
- **Buttons**: Same variant classes (bg-[#C73E1D] primary, bg-[#2E7D32] success actions)
- **Date pickers**: Native `<input type="date">` with max/min constraints

---

## Indexes for Performance

- `idx_customers_business_id` on `customers(businessId)`
- `idx_customers_email` on `customers(email)`
- `idx_invoices_business_id` on `invoices(businessId)`
- `idx_invoices_customer_id` on `invoices(customerId)`
- `idx_invoices_status` on `invoices(status)`
- `idx_invoices_issue_date` on `invoices(issueDate)`
- `idx_invoice_items_invoice_id` on `invoice_items(invoiceId)`
- `idx_invoice_payments_invoice_id` on `invoice_payments(invoiceId)`
- `idx_invoice_payments_payment_date` on `invoice_payments(paymentDate)`
- `idx_recurring_templates_active` on `recurring_invoice_templates(businessId, isActive)`
- `idx_recurring_templates_next_due` on `recurring_invoice_templates(nextDueDate)`
- `idx_email_logs_invoice_id` on `invoice_email_logs(invoiceId)`
- Unique indexes on `invoiceNumber`, `customerNumber`

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
- Set up monorepo structure
- Create `@finabill/shared` package with types and schemas
- Create database schema + Drizzle migration scripts
- Set up FinaBill API scaffold (Hono + tRPC)

### Phase 2: Core Features (Week 3-4)
- Customer CRUD API + UI
- Invoice CRUD API + UI with line items
- Invoice status lifecycle management
- PDF generation

### Phase 3: Billing Operations (Week 5-6)
- Payment recording
- Recurring invoice engine + cron job
- Email delivery (invoices + reminders)
- Revenue reporting

### Phase 4: Integration (Week 7-8)
- FinaFlow integration router
- Payment sync (FinaBill → FinaFlow journal entries)
- Shared library consumption in FinaFlow
- Batch reconciliation

### Phase 5: Polish (Week 9-10)
- Business branding on invoices
- Mobile optimization
- Permission system
- Testing (unit + integration)
- Documentation
