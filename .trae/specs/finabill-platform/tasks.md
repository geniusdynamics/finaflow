# FinaBill Platform - Implementation Tasks

> **All file paths referenced below are relative to**: `d:\DevCenter\abuilds\fina\finabill\`

---

## Phase 1: Foundation

### Task 1.1: Monorepo Setup

- [ ] **1.1.1**: Create `/finabill/` project root with `package.json`, `tsconfig.json`, `.gitignore`, `AGENTS.md`
- [ ] **1.1.2**: Create `/finabill/apps/web/` with Vite + React + TypeScript scaffold (follow FinaFlow pattern)
- [ ] **1.1.3**: Create `/finabill/api/` with Hono.js + tRPC scaffold (follow FinaFlow pattern)
- [ ] **1.1.4**: Create `/finabill/packages/shared/` for `@finabill/shared`
- [ ] **1.1.5**: Create `/finabill/db/` with Drizzle ORM schema + migrations config
- [ ] **1.1.6**: Setup path aliases (`@/` → `apps/web/`, `@api/` → `api/`, `@db/` → `db/`, `@shared/` → `packages/shared/src/`)
- [ ] **1.1.7**: Setup ESLint + Prettier configs matching FinaFlow
- [ ] **1.1.8**: Setup Tailwind CSS with same palette as FinaFlow (#2D2A26, #C73E1D, #F5EDE6, #E8E0D8, #8D8A87)

### Task 1.2: Shared Library (`@finabill/shared`)

- [ ] **1.2.1**: Create package structure with `package.json`, `tsconfig.json`
- [ ] **1.2.2**: Define shared type definitions:
  - [ ] `customer.ts` — Customer, CreateCustomerInput, UpdateCustomerInput, CustomerListFilter
  - [ ] `invoice.ts` — Invoice, InvoiceItem, InvoiceStatus enum, CreateInvoiceInput, InvoiceTotals
  - [ ] `payment.ts` — Payment, RecordPaymentInput, PaymentMethod enum
  - [ ] `recurring.ts` — RecurringTemplate, RecurringTemplateItem, RecurringFrequency enum
  - [ ] `revenue.ts` — RevenueCategory, RevenueReport, AgingReport
  - [ ] `business.ts` — BusinessProfile, BusinessProfileUpdate
  - [ ] `common.ts` — Pagination, DateRange, ApiResponse, BusinessContext
  - [ ] `integration.ts` — SyncPayload, SyncResult, ApiKeyVerify
- [ ] **1.2.3**: Define Zod validation schemas:
  - [ ] `createCustomerSchema`, `updateCustomerSchema`
  - [ ] `createInvoiceSchema`, `updateInvoiceSchema`
  - [ ] `recordPaymentSchema`
  - [ ] `createRecurringTemplateSchema`, `updateRecurringTemplateSchema`
  - [ ] `businessProfileSchema`
- [ ] **1.2.4**: Implement utility functions:
  - [ ] `currency.ts` — formatCurrency, parseCurrency, formatKES reuse from FinaFlow
  - [ ] `invoice.ts` — calculateSubtotal, calculateTax, calculateDiscount, calculateGrandTotal, computeDueDate, generateInvoiceNumber
  - [ ] `date.ts` — nextDateByFrequency, isOverdue, formatInvoiceDate, getAgingBucket
  - [ ] `validation.ts` — positiveDecimal, validEmail, validPhone, futureOrTodayDate
  - [ ] `pagination.ts` — buildPaginationMeta, paginateQuery
- [ ] **1.2.5**: Define constants (InvoiceStatus enum values, PaymentMethod enum, defaultTaxRates, DateFormat constants)
- [ ] **1.2.6**: Export all from `src/index.ts`
- [ ] **1.2.7**: Build and publish to workspace (npm link or workspace protocol)

### Task 1.3: Database Schema

- [ ] **1.3.1**: Create `db/schema.ts` with all FinaBill tables:
  - [ ] `customers` table (14 columns + timestamps)
  - [ ] `invoices` table (28 columns + timestamps + status enum)
  - [ ] `invoice_items` table (12 columns + timestamps)
  - [ ] `invoice_payments` table (11 columns + timestamps + payment method enum)
  - [ ] `recurring_invoice_templates` table (15 columns + timestamps + frequency enum)
  - [ ] `recurring_template_items` table (8 columns + timestamps)
  - [ ] `recurring_invoice_generations` table (7 columns + status enum)
  - [ ] `payment_reminders` table (8 columns + status enum + reminder type enum)
  - [ ] `invoice_email_logs` table (10 columns + status enum + email type enum)
  - [ ] `business_profiles` table (17 columns + timestamps)
- [ ] **1.3.2**: Add all index definitions in schema
- [ ] **1.3.3**: Add all enum type definitions (invoiceStatus, paymentMethod, frequency, reminderType, emailStatus, emailType)
- [ ] **1.3.4**: Generate Drizzle migration: `npm run db:generate`
- [ ] **1.3.5**: Create seed script with default revenue categories
- [ ] **1.3.6**: Create `db/connection.ts` (postgres connection pool matching FinaFlow pattern)

---

## Phase 2: Core Features

### Task 2.1: Customer Management

- [ ] **2.1.1**: Create `api/routers/customers-router.ts`:
  - [ ] `list` — Paginated list with search (name, email, phone, customerNumber)
  - [ ] `getById` — Single customer with stats (total invoiced, total paid, balance)
  - [ ] `create` — Create customer with auto-generated customerNumber
  - [ ] `update` — Update customer details
  - [ ] `delete` — Soft delete (check no outstanding invoices)
  - [ ] `getStatement` — Customer statement with invoice list and balances
- [ ] **2.1.2**: Create `apps/web/src/pages/Customers.tsx`:
  - [ ] Customers list page with search bar and table
  - [ ] Customer detail page with info cards + invoice history table + statement summary
  - [ ] Create/Edit customer dialog (name, email, phone, billing address, payment terms, credit limit)
  - [ ] Mobile-responsive layout matching FinaFlow patterns
- [ ] **2.1.3**: Add customer routes to App.tsx (`/customers`, `/customers/:id`)

### Task 2.2: Invoice Management

- [ ] **2.2.1**: Create `api/routers/invoices-router.ts`:
  - [ ] `list` — Paginated list with status/date/customer filters
  - [ ] `getById` — Full invoice with line items and payments
  - [ ] `create` — Create invoice with line items (auto-calculate totals)
  - [ ] `update` — Update draft invoice only
  - [ ] `send` — Change status to "sent", trigger email dispatch
  - [ ] `void` — Void invoice with reason, reverse payments if any
  - [ ] `downloadPdf` — Generate and return PDF
  - [ ] `getNextNumber` — Return next available invoice number for preview
- [ ] **2.2.2**: Create `api/routers/invoice-items-router.ts`:
  - [ ] `addItem` — Add line item to invoice
  - [ ] `removeItem` — Remove line item from draft invoice
  - [ ] `updateItem` — Update line item (description, qty, unit price, tax rate)
- [ ] **2.2.3**: Create `apps/web/src/pages/Invoices.tsx`:
  - [ ] Invoices list page with status tabs (All, Draft, Sent, Paid, Overdue, Void) using FinaFlow tab pattern
  - [ ] Invoice builder form with:
    - Customer selector (searchable dropdown)
    - Invoice date, due date (auto-computed from payment terms)
    - Line items table (add/remove rows, inline edit qty/price/tax)
    - Real-time totals (subtotal, discount, tax, grand total)
    - Notes and payment terms text areas
    - Save as Draft / Save and Send buttons
  - [ ] Invoice detail view with:
    - Professional invoice display (print-friendly)
    - Status badge with color coding
    - Payment history table
    - Actions: Send, Download PDF, Record Payment, Void
    - Email log entries
  - [ ] Mobile-responsive layout

### Task 2.3: Invoice PDF Generation

- [ ] **2.3.1**: Create `api/lib/pdf-generator.ts`:
  - [ ] Use `pdfkit` or equivalent for Node.js PDF generation
  - [ ] Render business logo and branding info
  - [ ] Render customer info block
  - [ ] Render invoice header (number, date, due date, status)
  - [ ] Render line items table with headers
  - [ ] Render totals section (subtotal, discount, tax, grand total)
  - [ ] Render payment terms and notes
  - [ ] Support business accent color
  - [ ] Return PDF as buffer/stream
- [ ] **2.3.2**: Implement `generateInvoicePdf(invoiceId)` function
- [ ] **2.3.3**: Wire into `invoices.downloadPdf` endpoint

---

## Phase 3: Billing Operations

### Task 3.1: Payment Recording

- [ ] **3.1.1**: Create `api/routers/payments-router.ts`:
  - [ ] `list` — Payments list with date/payment method/invoice filters
  - [ ] `record` — Record payment against invoice, update invoice balance and status
  - [ ] `getByInvoice` — All payments for a specific invoice
  - [ ] `delete` — Reverse a payment (only if within cancelation period)
- [ ] **3.1.2**: Create `apps/web/src/pages/Payments.tsx`:
  - [ ] Payments list with filter by date range, payment method
  - [ ] Record payment dialog (from invoice detail or standalone)
  - [ ] Payment method breakdown summary card
  - [ ] Mobile-friendly layout

### Task 3.2: Recurring Invoice Engine

- [ ] **3.2.1**: Create `api/routers/recurring-router.ts`:
  - [ ] `list` — List recurring templates
  - [ ] `create` — Create template with items
  - [ ] `update` — Update template
  - [ ] `delete` — Deactivate template
  - [ ] `triggerNow` — Manually trigger generation
  - [ ] `skipNext` — Skip next occurrence
  - [ ] `getGenerationLog` — History of auto-generations
- [ ] **3.2.2**: Create `api/cron/recurring-invoices.ts`:
  - [ ] Scheduled job that runs daily
  - [ ] Queries active templates where nextDueDate <= today
  - [ ] Creates invoices from template items
  - [ ] Updates nextDueDate
  - [ ] Creates generation log entries
  - [ ] Optionally sends generated invoices automatically
- [ ] **3.2.3**: Create `apps/web/src/pages/RecurringInvoices.tsx`:
  - [ ] Template list with status indicator (active/inactive)
  - [ ] Create/edit template form (customer, name, frequency, items, next date)
  - [ ] Template detail with generation history log
  - [ ] Manual trigger / Skip next action buttons
  - [ ] Mobile-friendly layout

### Task 3.3: Email Delivery

- [ ] **3.3.1**: Create `api/lib/email.ts`:
  - [ ] Send invoice email with PDF attachment
  - [ ] Send payment reminder email
  - [ ] Send payment receipt email
  - [ ] Track delivery status (sent, delivered, bounced, opened)
- [ ] **3.3.2**: Create `api/routers/email-router.ts`:
  - [ ] `sendInvoice` — Send invoice to customer email
  - [ ] `resendInvoice` — Resend to same or different email
  - [ ] `getEmailLogs` — Delivery logs for an invoice
  - [ ] `sendReminder` — Send manual reminder
- [ ] **3.3.3**: Create `api/cron/payment-reminders.ts`:
  - [ ] Daily cron for overdue invoices
  - [ ] Sends first/second/final reminders based on days overdue
  - [ ] Uses configurable grace periods (7 days for first, 14 for second, 30 for final)

### Task 3.4: Revenue Reporting

- [ ] **3.4.1**: Create `api/routers/reports-router.ts`:
  - [ ] `revenueByPeriod` — Grouped revenue by month/quarter/year
  - [ ] `customerAging` — Outstanding balances by aging bucket
  - [ ] `invoiceStatusDistribution` — Count/amount by status
  - [ ] `revenueByCategory` — Revenue breakdown by revenue category
  - [ ] `customerStatement` — Full statement for a customer
- [ ] **3.4.2**: Create `apps/web/src/pages/Reports.tsx`:
  - [ ] Revenue by period chart and table (recharts bar chart)
  - [ ] Customer aging summary card with bucket breakdown
  - [ ] Invoice status distribution (pie chart)
  - [ ] Date range picker for reports
  - [ ] CSV export for report data
  - [ ] Mobile-friendly layout

---

## Phase 4: Integration with FinaFlow

### Task 4.1: FinaFlow Integration Router

- [ ] **4.1.1**: In FinaFlow, create `api/integration/finabill-router.ts`:
  - [ ] `syncPayment` — Receive payment data from FinaBill, create journal entry (Dr Cash, Cr Revenue)
  - [ ] `syncInvoice` — Receive invoice data (as receivable reference)
  - [ ] `getAccounts` — Return Chart of Accounts for revenue category mapping
  - [ ] `verifyBusiness` — Validate API key, return business context
  - [ ] `reconcile` — Trigger batch reconciliation endpoint
- [ ] **4.1.2**: Create `finabill_api_keys` table in FinaFlow schema
- [ ] **4.1.3**: Add API key management UI in FinaFlow Settings page (new "FinaBill" tab)
- [ ] **4.1.4**: Add `@finabill/shared` as dependency in FinaFlow's package.json

### Task 4.2: FinaBill Integration Client

- [ ] **4.2.1**: Create `api/lib/integration-client.ts`:
  - [ ] Configure FinaFlow API endpoint URL
  - [ ] Send API key with each request
  - [ ] `syncPaymentToFinaFlow(payment)` — Push payment to FinaFlow
  - [ ] `syncInvoiceToFinaFlow(invoice)` — Push invoice as receivable
  - [ ] `fetchAccounts()` — Get Chart of Accounts from FinaFlow
  - [ ] `validateConnection()` — Test API connectivity
- [ ] **4.2.2**: Add integration settings UI in FinaBill Settings (FinaFlow URL, API key)
- [ ] **4.2.3**: Wire payment recording → auto-sync to FinaFlow
- [ ] **4.2.4**: Wire invoice creation → sync receivable reference to FinaFlow

### Task 4.3: Shared Library Consumption in FinaFlow

- [ ] **4.3.1**: Add `@finabill/shared` as dependency in FinaFlow
- [ ] **4.3.2**: Replace FinaFlow-specific invoice/revenue types with shared types where applicable
- [ ] **4.3.3**: Reuse shared Zod validation schemas for FinaFlow's billing-related endpoints
- [ ] **4.3.4**: Reuse shared currency/decimal utilities across both platforms

---

## Phase 5: Polish & UI

### Task 5.1: Business Branding

- [ ] **5.1.1**: Create `api/routers/business-profile-router.ts`:
  - [ ] `get` — Get business profile
  - [ ] `update` — Update business profile (logo upload, branding settings)
- [ ] **5.1.2**: Create `apps/web/src/pages/Settings.tsx` with tabs:
  - [ ] Business Profile tab (logo upload, business info, branding)
  - [ ] Invoice Settings tab (numbering prefix, default terms, default tax rate)
  - [ ] Email Settings tab (sender name, sender email, reminder intervals)
  - [ ] Integration tab (FinaFlow URL, API key, connection test)

### Task 5.2: Dashboard

- [ ] **5.2.1**: Create `apps/web/src/pages/Dashboard.tsx`:
  - [ ] Revenue summary cards (Invoiced this month, Collected this month, Outstanding)
  - [ ] Recent invoices list (last 10)
  - [ ] Upcoming recurring invoices (next 5)
  - [ ] Aging summary (buckets with amounts)
  - [ ] Monthly revenue trend chart (recharts bar chart)
- [ ] **5.2.2**: Create `api/routers/dashboard-router.ts`:
  - [ ] `summary` — Aggregated KPIs
  - [ ] `recentInvoices` — Last N invoices
  - [ ] `upcomingRecurring` — Next N recurring invoices

### Task 5.3: Layout & Navigation

- [ ] **5.3.1**: Create `apps/web/src/components/Layout.tsx` matching FinaFlow's sidebar navigation:
  - [ ] Collapsible sidebar with icon + label links
  - [ ] Active link highlighting (border-b-2 + #C73E1D accent)
  - [ ] User avatar/logout in footer
  - [ ] Mobile hamburger menu
  - [ ] Business selector dropdown
- [ ] **5.3.2**: Create navigation items:
  - Dashboard, Customers, Invoices, Recurring, Payments, Reports, Settings
- [ ] **5.3.3**: Create `apps/web/src/components/ui/` with shadcn/ui primitives (Button, Card, Dialog, Input, Select, Table, Tabs, etc.)

### Task 5.4: Testing

- [ ] **5.4.1**: Unit tests for shared library utilities (currency formatting, invoice calculation, date helpers)
- [ ] **5.4.2**: Integration tests for invoice CRUD (create draft → add items → send → record payment)
- [ ] **5.4.3**: Integration tests for recurring invoice engine
- [ ] **5.4.4**: Integration tests for FinaFlow sync
- [ ] **5.4.5**: E2E tests for critical user flows (create customer → create invoice → send → record payment)

---

## Task Dependencies

- **Phase 2** depends on **Phase 1** (monorepo setup, DB schema, shared library)
- **Task 2.2 (Invoices)** depends on **Task 2.1 (Customers)** — invoices need customers
- **Task 2.3 (PDF)** depends on **Task 2.2 (Invoices)** — needs invoice data
- **Phase 3** depends on **Phase 2** (needs invoices and customers in place)
- **Task 3.1 (Payments)** depends on **Task 2.2 (Invoices)**
- **Task 3.2 (Recurring)** depends on **Task 2.2 (Invoices)** and **Task 2.1 (Customers)**
- **Task 3.3 (Email)** depends on **Task 2.2 (Invoices)**
- **Task 3.4 (Reports)** depends on **Task 2.2 (Invoices)** and **Task 3.1 (Payments)**
- **Phase 4** depends on **Phase 3** (needs payment data flowing)
- **Task 4.1 (FinaFlow Integration Router)** depends on **Phase 3** — needs invoice + payment data to sync
- **Phase 5** has no strict dependencies on Phase 4 — can run in parallel
