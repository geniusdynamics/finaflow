# FinaBill Platform — Implementation Tasks

> **All file paths are relative to**: `d:\DevCenter\abuilds\fina\finabill\`
> **Architecture**: Standalone application — NOT embedded in FinaFlow
> **Integration**: Bi-directional API sync with FinaFlow via integration page
> **Phases**: 8 phases, listed in dependency order

---

## Phase 1: Foundation — Monorepo & Auth

### Task 1.1: Project Scaffold
- [ ] **1.1.1**: Create `/finabill/` project root with `package.json`, `tsconfig.json`, `.gitignore`, `AGENTS.md`
- [ ] **1.1.2**: Create `apps/web/` with Vite + React 19 + TypeScript scaffold
- [ ] **1.1.3**: Create `api/` with Hono.js + tRPC scaffold
- [ ] **1.1.4**: Create `packages/shared/` for `@finabill/shared`
- [ ] **1.1.5**: Create `db/` with Drizzle ORM + migrations config
- [ ] **1.1.6**: Setup path aliases (`@/` → `apps/web/`, `@api/` → `api/`, `@db/` → `db/`, `@shared/` → `packages/shared/src/`)
- [ ] **1.1.7**: Setup ESLint + Prettier configs
- [ ] **1.1.8**: Setup HMR dev server (Vite on 5173, API on 3001)

### Task 1.2: Authentication
- [ ] **1.2.1**: Create `api/routers/auth-router.ts`:
  - [ ] `auth.register` — Business + owner user registration
  - [ ] `auth.login` — Email/password login, return JWT in httpOnly cookie
  - [ ] `auth.logout` — Clear cookie
  - [ ] `auth.me` — Return current user + business context
- [ ] **1.2.2**: Create `api/middleware/auth.ts`:
  - [ ] JWT verification middleware (same pattern as FinaFlow)
  - [ ] Business context extraction
  - [ ] Role/permission extraction
- [ ] **1.2.3**: Create `apps/web/src/providers/auth.tsx`:
  - [ ] AuthProvider context with login/logout/me
  - [ ] ProtectedRoute component
  - [ ] useAuth hook

### Task 1.3: Database Foundation
- [ ] **1.3.1**: Create `db/schema.ts` with core tables:
  - [ ] `businesses` — Subscription tier, currency, branding fields
  - [ ] `users` — Email, name, role, businessId FK
  - [ ] `customers` — Full: type (business/individual), salutation, names, company, displayName, contacts, billing/shipping address (jsonb), language, taxRate, taxExempt, companyId, enablePortal, remarks
  - [ ] `customers_contact_persons` — salutation, name, email, workPhone, mobile per customer
  - [ ] `items` — With incomeAccountId (COA FK), type (goods/service), unitType, isTrackable
  - [ ] `products` — Plan products with email notification, redirect URL, auto-gen numbers
  - [ ] `subscription_tiers` enum (free, standard, premium, finance_plus)
- [ ] **1.3.2**: Create `db/connection.ts` — PostgreSQL connection pool
- [ ] **1.3.3**: Generate initial Drizzle migration
- [ ] **1.3.4**: Create `db/seed.ts` — Default admin user seeding

### Task 1.4: UI Foundation
- [ ] **1.4.1**: Setup Tailwind CSS with FinaBill color palette:
  - Background `#F8F9FA`, Surface `#FFFFFF`
  - Text Primary `#1A1A2E`, Text Secondary `#6B7280`
  - Accent `#2563EB`, Success `#059669`, Warning `#D97706`, Danger `#DC2626`
  - Border `#E5E7EB`, Muted `#9CA3AF`
- [ ] **1.4.2**: Add shadcn/ui primitives (Button, Input, Select, Card, Table, Dialog, Badge, Tabs)
- [ ] **1.4.3**: Create base Layout component with sidebar navigation
- [ ] **1.4.4**: Create global search command palette (⌘K)
- [ ] **1.4.5**: Create inline form wrapper component (for inline create/edit UX)
- [ ] **1.4.6**: Create responsive mobile navigation

### Task 1.5: Shared Library
- [ ] **1.5.1**: Setup `packages/shared/` package with TypeScript + build config
- [ ] **1.5.2**: Define shared type definitions:
  - [ ] `customer.ts` — Customer, CustomerCreate, CustomerUpdate
  - [ ] `item.ts` — Item, ItemCreate
  - [ ] `invoice.ts` — Invoice, InvoiceItem, InvoiceStatus enum
  - [ ] `quote.ts` — Quote, QuoteItem, QuoteStatus enum
  - [ ] `subscription.ts` — Subscription, Plan, Addon, Coupon
  - [ ] `payment.ts` — Payment, PaymentMethod enum
  - [ ] `common.ts` — Pagination, DateRange, ApiResponse, BusinessContext
  - [ ] `integration.ts` — SyncPayload, SyncResult, ConnectionStatus
- [ ] **1.5.3**: Define Zod validation schemas
- [ ] **1.5.4**: Implement utility functions (currency, dates, invoice calc, pagination)
- [ ] **1.5.5**: Export all from `src/index.ts`

### Task 1.6: Rate Limiting & Security
- [ ] **1.6.1**: Create `api/middleware/rate-limit.ts` (login: 10/min, API: 100/min)
- [ ] **1.6.2**: Create `api/middleware/audit.ts` — Audit logging for mutations
- [ ] **1.6.3**: Implement CSRF protection on mutation endpoints
- [ ] **1.6.4**: Implement input validation on all endpoints

---

## Phase 2: Core CRM & Sales

### Task 2.1: Customer Management
- [ ] **2.1.1**: Create `db/schema.ts` additions:
  - [ ] `customers_contact_persons` table (salutation, first name, last name, email, work phone, mobile)
- [ ] **2.1.2**: Create `api/routers/customers-router.ts`:
  - [ ] `customers.list` — Paginated list with search + filters
  - [ ] `customers.getById` — Single customer with stats + contact persons + addresses
  - [ ] `customers.create` — Create with type (Business/Individual), contact info, address tabs (billing + shipping)
  - [ ] `customers.update` — Update inline
  - [ ] `customers.delete` — Soft delete
  - [ ] `customers.getStatement` — Invoice history + aging
  - [ ] `customers.contactPersons.list/create/delete` — Contact person CRUD
- [ ] **2.1.3**: Create `apps/web/src/pages/Customers.tsx`:
  - [ ] List page with search + inline create form
  - [ ] Customer detail page with tabbed sections: Address, Contact Persons, Custom Fields, Reporting Tags
  - [ ] Inline editing on detail page
  - [ ] Statement view with invoice history table
- [ ] **2.1.4**: Wire routes: `/customers`, `/customers/:id`

### Task 2.2: Product Catalogue (Items)
- [ ] **2.2.1**: Create `api/routers/items-router.ts`:
  - [ ] `items.list` — Paginated with search
  - [ ] `items.getById` — Single item
  - [ ] `items.create` — Create with SKU, type (Goods/Service), unit, COA income account selection
  - [ ] `items.update` — Update inline
  - [ ] `items.delete` — Soft delete
- [ ] **2.2.2**: Create `api/routers/price-lists-router.ts`:
  - [ ] `priceLists.list` — List price lists
  - [ ] `priceLists.create` — Create with items + overrides
  - [ ] `priceLists.update` — Update
  - [ ] `priceLists.delete` — Delete
- [ ] **2.2.3**: Create `apps/web/src/pages/Items.tsx`:
  - [ ] List with inline create
  - [ ] Item detail with inline edit
  - [ ] Price list management UI
- [ ] **2.2.4**: Wire routes: `/catalogue/items`, `/catalogue/price-lists`

### Task 2.3: Quotes
- [ ] **2.3.1**: Create `api/routers/quotes-router.ts`:
  - [ ] `quotes.list` — Paginated with status/date/customer filters
  - [ ] `quotes.getById` — Full quote with items
  - [ ] `quotes.create` — Create with line items, auto quoteNumber (QOT-XXXX)
  - [ ] `quotes.update` — Update draft only
  - [ ] `quotes.send` — Change to 'sent', trigger email
  - [ ] `quotes.accept` — Change to 'accepted'
  - [ ] `quotes.decline` — Change to 'declined' with reason
  - [ ] `quotes.convertToInvoice` — Create invoice from quote
  - [ ] `quotes.downloadPdf` — Generate PDF
- [ ] **2.3.2**: Create `apps/web/src/pages/Quotes.tsx`:
  - [ ] List with status tabs (All, Draft, Sent, Accepted, Declined, Expired, Converted)
  - [ ] Inline quote builder with line items
  - [ ] Quote detail + actions (Send, Accept, Decline, Convert, Download PDF)
- [ ] **2.3.3**: Wire routes: `/sales/quotes`, `/sales/quotes/:id`, `/sales/quotes/create`

### Task 2.4: Invoices
- [ ] **2.4.1**: Create `api/routers/invoices-router.ts`:
  - [ ] `invoices.list` — Paginated with status/date/customer/currency filters
  - [ ] `invoices.getById` — Full invoice with items + payments
  - [ ] `invoices.create` — Create with line items, auto invoiceNumber (INV-XXXX)
  - [ ] `invoices.update` — Update draft only
  - [ ] `invoices.send` — Change to 'sent', trigger email with PDF
  - [ ] `invoices.void` — Void with reason
  - [ ] `invoices.downloadPdf` — Generate PDF
  - [ ] `invoices.getNextNumber` — Preview next number
- [ ] **2.4.2**: Create `apps/web/src/pages/Invoices.tsx`:
  - [ ] List with status tabs (All, Draft, Sent, Paid, Overdue, Void)
  - [ ] Inline invoice builder with line items from catalogue
  - [ ] Invoice detail with payment history
- [ ] **2.4.3**: Wire routes: `/sales/invoices`, `/sales/invoices/:id`, `/sales/invoices/create`

### Task 2.5: Sales Receipts
- [ ] **2.5.1**: Create `api/routers/sales-receipts-router.ts`:
  - [ ] `salesReceipts.list` — List with filters
  - [ ] `salesReceipts.getById` — Full receipt
  - [ ] `salesReceipts.create` — Create with immediate payment
  - [ ] `salesReceipts.downloadPdf` — Generate PDF
- [ ] **2.5.2**: Create `apps/web/src/pages/SalesReceipts.tsx`:
  - [ ] List page
  - [ ] Inline receipt creation form (simpler than invoice)
- [ ] **2.5.3**: Wire routes: `/sales/receipts`, `/sales/receipts/create`

### Task 2.6: Credit Notes
- [ ] **2.6.1**: Create `api/routers/credit-notes-router.ts`:
  - [ ] `creditNotes.list` — List with filters
  - [ ] `creditNotes.getById` — Full credit note
  - [ ] `creditNotes.create` — Create linked to invoice
  - [ ] `creditNotes.apply` — Apply credit to invoice
- [ ] **2.6.2**: Create `apps/web/src/pages/CreditNotes.tsx`
- [ ] **2.6.3**: Wire routes: `/sales/credit-notes`

### Task 2.7: PDF Generation
- [ ] **2.7.1**: Create `api/lib/pdf-generator.ts`:
  - [ ] `generateQuotePdf(quoteId)` — Quote PDF with branding
  - [ ] `generateInvoicePdf(invoiceId)` — Invoice PDF with branding
  - [ ] `generateReceiptPdf(receiptId)` — Receipt PDF
  - [ ] `generateCreditNotePdf(creditNoteId)` — Credit note PDF
- [ ] **2.7.2**: Wire PDF generation into all download endpoints

---

## Phase 3: Payments & Expenses

### Task 3.1: Payments Received
- [ ] **3.1.1**: Create `api/routers/payments-router.ts`:
  - [ ] `payments.list` — List with date/method/customer filters
  - [ ] `payments.record` — Record payment against invoice/receipt
  - [ ] `payments.getByInvoice` — All payments for an invoice
  - [ ] `payments.refund` — Refund a payment
- [ ] **3.1.2**: Create `apps/web/src/pages/Payments.tsx`:
  - [ ] List with filters + payment method breakdown card
  - [ ] Inline record payment form
- [ ] **3.1.3**: Wire route: `/payments`

### Task 3.2: Payment Links
- [ ] **3.2.1**: Create `api/routers/payment-links-router.ts`:
  - [ ] `paymentLinks.list` — List
  - [ ] `paymentLinks.create` — Create shareable link
  - [ ] `paymentLinks.update` — Update
  - [ ] `paymentLinks.delete` — Delete
- [ ] **3.2.2**: Create payment link UI in Payments page
- [ ] **3.2.3**: Wire route: `/payments/links`

### Task 3.3: Expenses
- [ ] **3.3.1**: Create `api/routers/expenses-router.ts`:
  - [ ] `expenses.list` — List with category/date filters
  - [ ] `expenses.create` — Create with receipt upload
  - [ ] `expenses.update` — Update
  - [ ] `expenses.delete` — Delete
- [ ] **3.3.2**: Create `api/routers/expense-categories-router.ts`:
  - [ ] `expenseCategories.list` — List
  - [ ] `expenseCategories.create` — Create
  - [ ] `expenseCategories.update` — Update
  - [ ] `expenseCategories.delete` — Delete
- [ ] **3.3.3**: Create `apps/web/src/pages/Expenses.tsx`:
  - [ ] List with inline create form
  - [ ] Receipt upload (photo capture)
  - [ ] Recurring expenses list + create
- [ ] **3.3.4**: Wire routes: `/expenses`, `/expenses/recurring`

---

## Phase 4: Subscriptions & Recurring

### Task 4.1: Products, Plans & Addons
- [ ] **4.1.0**: Create `api/routers/products-router.ts`:
  - [ ] `products.list` — List products
  - [ ] `products.create` — Create product (name, description, email recipients, redirect URL, auto-generate numbers)
  - [ ] `products.update` — Update
  - [ ] `products.delete` — Delete
- [ ] **4.1.1**: Create `api/routers/plans-router.ts`:
  - [ ] `plans.list` — List subscription plans
  - [ ] `plans.create` — Create with items
  - [ ] `plans.update` — Update
  - [ ] `plans.delete` — Deactivate
- [ ] **4.1.2**: Create `api/routers/addons-router.ts`:
  - [ ] `addons.list` — List addons
  - [ ] `addons.create` — Create
  - [ ] `addons.update` — Update
  - [ ] `addons.delete` — Deactivate
- [ ] **4.1.3**: Create `apps/web/src/pages/Plans.tsx`:
  - [ ] Plan list with inline create/edit
  - [ ] Plan detail with items table
  - [ ] Addon management UI
- [ ] **4.1.4**: Wire routes: `/subscriptions/plans`, `/subscriptions/addons`

### Task 4.2: Coupons & Pricing
- [ ] **4.2.1**: Create `api/routers/coupons-router.ts`:
  - [ ] `coupons.list` — List coupons
  - [ ] `coupons.create` — Create with validation rules
  - [ ] `coupons.update` — Update
  - [ ] `coupons.delete` — Deactivate
  - [ ] `coupons.validate` — Validate coupon code at checkout
- [ ] **4.2.2**: Create `api/routers/pricing-widgets-router.ts`:
  - [ ] `pricingWidgets.list` — List widgets
  - [ ] `pricingWidgets.create` — Create tiered/volume/usage config
  - [ ] `pricingWidgets.update` — Update
  - [ ] `pricingWidgets.delete` — Delete
- [ ] **4.2.3**: Create coupon + pricing widget UI
- [ ] **4.2.4**: Wire routes: `/subscriptions/coupons`, `/subscriptions/pricing`

### Task 4.3: Subscriptions Engine
- [ ] **4.3.1**: Install + configure Stripe SDK
- [ ] **4.3.2**: Create `api/lib/stripe.ts`:
  - [ ] Stripe customer creation
  - [ ] Payment method management
  - [ ] Subscription creation on Stripe side
  - [ ] Webhook handling (payment_intent.succeeded, invoice.paid, etc.)
- [ ] **4.3.3**: Create `api/routers/subscriptions-router.ts`:
  - [ ] `subscriptions.list` — List with status filters
  - [ ] `subscriptions.create` — Create with plan + addons + coupon
  - [ ] `subscriptions.getById` — Full subscription detail
  - [ ] `subscriptions.pause` — Pause billing
  - [ ] `subscriptions.resume` — Resume billing
  - [ ] `subscriptions.cancel` — Cancel with reason
  - [ ] `subscriptions.updatePlan` — Change plan with proration
  - [ ] `subscriptions.addAddon` — Attach addon
  - [ ] `subscriptions.removeAddon` — Detach addon
- [ ] **4.3.4**: Create `apps/web/src/pages/Subscriptions.tsx`:
  - [ ] List with status badges
  - [ ] Subscription detail with plan, addons, coupon
  - [ ] Actions: Pause, Resume, Cancel, Change Plan
  - [ ] Invoice history for subscription
- [ ] **4.3.5**: Wire routes: `/subscriptions`, `/subscriptions/:id`, `/subscriptions/create`

### Task 4.4: Cron — Recurring Invoice Generation
- [ ] **4.4.1**: Create `api/cron/recurring-invoices.ts`:
  - [ ] Daily check for subscription billing cycles
  - [ ] Generate invoices for due subscriptions
  - [ ] Handle proration
  - [ ] Create payment intents via Stripe
  - [ ] Log generation results

### Task 4.5: Dunning Management
- [ ] **4.5.1**: Create `api/cron/dunning.ts`:
  - [ ] Failed payment retry logic (3 attempts at 3-day intervals)
  - [ ] Escalation: email notification → suspend subscription
  - [ ] Update subscription status to 'past_due' during retry window
  - [ ] Update to 'canceled' after all retries fail

### Task 4.6: Hosted Payment Pages
- [ ] **4.6.1**: Implement Stripe Checkout integration for one-time payments
- [ ] **4.6.2**: Implement Stripe Customer Portal for subscription management
- [ ] **4.6.3**: Create custom hosted payment page (optional — if not using Stripe's)

---

## Phase 5: Time Tracking & Projects

### Task 5.1: Projects
- [ ] **5.1.1**: Create `api/routers/projects-router.ts`:
  - [ ] `projects.list` — List with customer/status filters
  - [ ] `projects.create` — Create with budget
  - [ ] `projects.update` — Update
  - [ ] `projects.delete` — Soft delete
  - [ ] `projects.getProfitability` — Revenue vs tracked hours
- [ ] **5.1.2**: Create `apps/web/src/pages/Projects.tsx`:
  - [ ] List with status badges
  - [ ] Project detail with budget tracking
  - [ ] Project profitability view
- [ ] **5.1.3**: Wire routes: `/time/projects`, `/time/projects/:id`

### Task 5.2: Timesheets
- [ ] **5.2.1**: Create `api/routers/timesheets-router.ts`:
  - [ ] `timesheets.list` — List with date/project/user filters
  - [ ] `timesheets.create` — Log time entry
  - [ ] `timesheets.update` — Update entry
  - [ ] `timesheets.delete` — Delete entry
  - [ ] `timesheets.submit` — Submit for approval
  - [ ] `timesheets.approve` — Approve/reject
  - [ ] `timesheets.exportToInvoice` — Create invoice from approved entries
- [ ] **5.2.2**: Create `apps/web/src/pages/Timesheets.tsx`:
  - [ ] Weekly timesheet view (grid: days × projects)
  - [ ] Inline time entry form
  - [ ] Approval workflow UI
- [ ] **5.2.3**: Wire routes: `/time/timesheets`

---

## Phase 6: Reports & Intelligence

### Task 6.1: Report Viewer Framework
- [ ] **6.1.1**: Create report viewer infrastructure:
  - [ ] Report viewer layout: category selector (left sidebar), report list (middle), report view (right)
  - [ ] Date range picker (From/To)
  - [ ] Filter bar (Entities, More Filters)
  - [ ] Compare With dropdown (None, Previous Period, Previous Year)
  - [ ] Customize Report Columns interface
  - [ ] Empty state: "There were no [data] during the selected date range."
  - [ ] Placeholder system for unimplemented reports
- [ ] **6.1.2**: Create `api/lib/reports/` directory with one module per category:
  - [ ] `sales.ts` — 7 sales reports
  - [ ] `receivables.ts` — 7 receivable reports
  - [ ] `acquisition.ts` — 5 acquisition insight reports
  - [ ] `signups.ts` — 3 signup/activation reports
  - [ ] `subscriptions.ts` — 8 subscription reports
  - [ ] `revenue.ts` — 3 revenue reports
  - [ ] `retention.ts` — 5 retention reports
  - [ ] `mrr-arr.ts` — 3 MRR/ARR reports
  - [ ] `churn.ts` — 6 churn reports
  - [ ] `churn-insights.ts` — 5 churn insight reports
  - [ ] `payments.ts` — 6 payment reports
  - [ ] `expenses.ts` — 5 expense reports
  - [ ] `taxes.ts` — 1 tax report
  - [ ] `projects.ts` — 4 project/timesheet reports
  - [ ] `activity.ts` — 5 activity reports
- [ ] **6.1.3**: Build reports incrementally, starting with Sales + Receivables
- [ ] **6.1.4**: All reports support CSV export

### Task 6.2: Dashboard
- [ ] **6.2.1**: Create `api/routers/dashboard-router.ts`:
  - [ ] `dashboard.summary` — KPIs (revenue, outstanding, overdue, MRR)
  - [ ] `dashboard.recentInvoices` — Last 10 invoices
  - [ ] `dashboard.upcomingSubscriptions` — Next renewals
  - [ ] `dashboard.agingSummary` — Aging buckets
  - [ ] `dashboard.monthlyTrend` — 12-month revenue trend
- [ ] **6.2.2**: Create `apps/web/src/pages/Dashboard.tsx`:
  - [ ] Bento-grid layout
  - [ ] KPI cards with trend indicators
  - [ ] Revenue trend chart
  - [ ] Recent activity list
  - [ ] Aging summary cards
- [ ] **6.2.3**: Wire route: `/`

---

## Phase 7: Integration & Polish

### Task 7.1: FinaFlow Integration (FinaBill Side)
- [ ] **7.1.1**: Create `api/routers/integration-router.ts`:
  - [ ] `integration.connect` — Connect to FinaFlow with API key
  - [ ] `integration.disconnect` — Disconnect
  - [ ] `integration.status` — Connection status + last sync
  - [ ] `integration.matchCustomers` — Scan for email matches
  - [ ] `integration.syncCustomers` — Push matched customers
  - [ ] `integration.syncPayments` — Push payments to FinaFlow journal
- [ ] **7.1.2**: Create `api/lib/integrations/finaflow-client.ts`:
  - [ ] HTTP client with API key auth
  - [ ] `syncPaymentToFinaFlow(payment)` — Push payment journal entry
  - [ ] `syncCustomerToFinaFlow(customer)` — Push customer profile
  - [ ] `fetchAccounts()` — Pull COA from FinaFlow
  - [ ] `fetchExpenses()` — Pull expenses from FinaFlow
  - [ ] `verifyConnection()` — Test API connectivity
- [ ] **7.1.3**: Create `api/lib/integrations/customer-matcher.ts`:
  - [ ] `findMatchingCustomers(finaflowApiKey, businessId)` — Email matching
  - [ ] `linkCustomer(customerId, finaflowEntityId)` — Create link
- [ ] **7.1.4**: Create `apps/web/src/pages/Integrations.tsx`:
  - [ ] Integration page with Connect/Disconnect buttons
  - [ ] Smart customer matching UI (list of matches with Connect buttons)
  - [ ] Sync status indicators
  - [ ] "Try FinaFlow" button when not connected + no matches
- [ ] **7.1.5**: Wire route: `/integrations`

### Task 7.2: FinaFlow Integration (FinaFlow Side)
- [ ] **7.2.1**: In FinaFlow, create integration endpoints for FinaBill:
  - [ ] `POST /api/integration/finabill/sync-payment` — Receive payment journal entry
  - [ ] `POST /api/integration/finabill/sync-customer` — Receive customer sync
  - [ ] `GET /api/integration/finabill/accounts` — Return COA
  - [ ] `GET /api/integration/finabill/verify` — Verify API key
  - [ ] `POST /api/integration/finabill/reconcile` — Batch reconciliation
- [ ] **7.2.2**: In FinaFlow, create `apps/web/src/pages/Integrations.tsx`:
  - [ ] "Connect to FinaBill" button
  - [ ] Smart customer/supplier matching (email-based)
  - [ ] "Try FinaBill" button when no match

### Task 7.3: Documents & Email
- [ ] **7.3.1**: Create `api/routers/documents-router.ts`:
  - [ ] `documents.upload` — Upload file
  - [ ] `documents.list` — List by entity
  - [ ] `documents.download` — Download file
  - [ ] `documents.delete` — Delete file
- [ ] **7.3.2**: Create `api/lib/email.ts`:
  - [ ] Configure email transport (Resend/SendGrid)
  - [ ] `sendInvoiceEmail(invoiceId)` — Invoice + PDF
  - [ ] `sendQuoteEmail(quoteId)` — Quote + PDF
  - [ ] `sendPaymentReceipt(paymentId)` — Receipt
  - [ ] `sendSubscriptionInvoice(invoiceId)` — Subscription invoice
  - [ ] `sendPaymentReminder(invoiceId, type)` — Overdue reminder
  - [ ] `sendDunningEmail(subscriptionId, attempt)` — Failed payment
- [ ] **7.3.3**: Create `api/cron/payment-reminders.ts`:
  - [ ] Daily check for overdue invoices
  - [ ] First reminder at 7 days, second at 14, final at 30+
  - [ ] Prevent duplicate reminders
- [ ] **7.3.4**: Create documents UI + email log UI

### Task 7.4: Settings & Branding
- [ ] **7.4.1**: Create `api/routers/settings-router.ts`:
  - [ ] `settings.getBusinessProfile` — Get branding config
  - [ ] `settings.updateBusinessProfile` — Update logo, colors, defaults
  - [ ] `settings.getInvoiceDefaults` — Prefix, terms, tax rate
  - [ ] `settings.updateInvoiceDefaults` — Update defaults
  - [ ] `settings.getEmailSettings` — Sender, signature
  - [ ] `settings.updateEmailSettings` — Update email config
- [ ] **7.4.2**: Create `apps/web/src/pages/Settings.tsx`:
  - [ ] Business Profile tab (logo, name, address, tax reg)
  - [ ] Invoice Settings tab (prefix, default terms, tax rate, numbering)
  - [ ] Email Settings tab (sender name, email, signature)
  - [ ] Users & Roles tab (team management)
- [ ] **7.4.3**: Wire route: `/settings`

### Task 7.5: Events & Activity Log
- [ ] **7.5.1**: Create `events` table in `db/schema.ts` (actionType, entityType, entityId, actorId, details jsonb)
- [ ] **7.5.2**: Create `api/routers/events-router.ts`:
  - [ ] `events.list` — Paginated with date/actionType/entityType/actor filters
  - [ ] `events.log` — Internal: log an event from any mutation
- [ ] **7.5.3**: Wire events logging into all mutation endpoints (auto-log on create/update/delete)
- [ ] **7.5.4**: Create `apps/web/src/pages/Events.tsx`:
  - [ ] Activity log list view with timestamp, action type, actor, details
  - [ ] Filter by date range, action type, entity type
- [ ] **7.5.5**: Wire route: `/events`

### Task 7.6: Calendar
- [ ] **7.6.1**: Create calendar view showing invoice due dates, subscription renewals, project milestones
- [ ] **7.6.2**: Wire route: `/calendar`

### Task 7.7: Mobile Optimization
- [ ] **7.7.1**: Audit all pages for mobile layout:
  - [ ] Tables → card lists at sm breakpoint
  - [ ] Inline forms → stacked at sm
  - [ ] Charts → stacked at sm
  - [ ] Dialogs → full-screen at sm
- [ ] **7.7.2**: Touch targets ≥ 44px
- [ ] **7.7.3**: Bottom navigation bar for mobile

---

## Phase 8: FinaGen Vision

### Task 8.1: Architecture Planning
- [ ] **8.1.1**: Design unified database schema
- [ ] **8.1.2**: Plan module merger strategy (FinaFlow + FinaBill + Inventory)
- [ ] **8.1.3**: Design unified dashboard

### Task 8.2: Inventory & Warehouses
- [ ] **8.2.1**: Inventory management module
- [ ] **8.2.2**: Warehouse management
- [ ] **8.2.3**: Stock tracking, adjustments, transfers
- [ ] **8.2.4**: Low-stock alerts

### Task 8.3: Order Management
- [ ] **8.3.1**: Sales orders
- [ ] **8.3.2**: Purchase orders
- [ ] **8.3.3**: Order fulfillment workflow

### Task 8.4: Unified Platform
- [ ] **8.4.1**: Merge FinaFlow + FinaBill codebases
- [ ] **8.4.2**: Unified dashboard
- [ ] **8.4.3**: Unified reporting
- [ ] **8.4.4**: Data migration from separate apps
- [ ] **8.4.5**: Single sign-on across all modules

---

## Task Dependencies

| Phase | Depends On | Description |
|-------|-----------|-------------|
| **Phase 1** | — | Foundation — no dependencies |
| **Phase 2** | Phase 1 | Core CRM requires DB, auth, UI scaffold |
| **Phase 3** | Phase 2 | Payments require invoices; expenses are standalone |
| **Phase 4** | Phase 2 | Subscriptions require customers + items |
| **Phase 5** | Phase 2 | Projects require customers; timesheets require projects |
| **Phase 6** | Phases 2, 3, 4, 5 | Reports need data from all modules |
| **Phase 7** | Phases 2, 3 | Integration needs customers, invoices, payments |
| **Phase 8** | All | FinaGen is the final unification |
