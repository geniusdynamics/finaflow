# FinaFlow Billing Module - Implementation Tasks

> **All file paths are relative to**: `d:\DevCenter\abuilds\fina\finaflow\`
> **Architecture**: Context-switching single app (not a separate application)

---

## Phase 1: Foundation

### Task 1.1: Database Schema Changes

- [ ] **1.1.1**: Add `primaryMode` column to `businesses` table in `db/schema.ts`:
  - `primaryMode: varchar("primaryMode", { length: 20 }).default("both").notNull()`
- [ ] **1.1.2**: Create `customers` table in `db/schema.ts`:
  - Columns: id, businessId, customerNumber, name, email, phone, billingAddress, paymentTerms, creditLimit, currency, notes, isActive, createdAt, updatedAt, deletedAt
  - Indexes: businessId, email
- [ ] **1.1.3**: Create `invoices` table in `db/schema.ts`:
  - Columns: id, businessId, locationId, customerId, invoiceNumber, status (draft/sent/partial/paid/overdue/void/credit_note), issueDate, dueDate, currency, subtotal, discountType, discountValue, discountAmount, taxTotal, grandTotal, amountPaid, balanceDue, notes, terms, isRecurring, recurringTemplateId, sourceType, sourceId, voidReason, voidedAt, createdBy, createdAt, updatedAt, deletedAt
  - Indexes: businessId, customerId, status, issueDate, dueDate
- [ ] **1.1.4**: Create `invoice_items` table in `db/schema.ts`:
  - Columns: id, invoiceId (cascade delete), lineNumber, description, quantity, unitPrice, taxRate, taxAmount, discountRate, discountAmount, lineTotal, revenueCategoryId, createdAt
  - Index: invoiceId
- [ ] **1.1.5**: Create `invoice_payments` table in `db/schema.ts`:
  - Columns: id, businessId, invoiceId, paymentMethod, amount, reference, paymentDate, currency, exchangeRate, notes, accountId, isReconciled, reconciledAt, createdBy, createdAt
  - Indexes: invoiceId, paymentDate, paymentMethod
- [ ] **1.1.6**: Create `recurring_invoice_templates` table in `db/schema.ts`:
  - Columns: id, businessId, customerId, name, description, frequency (weekly/monthly/quarterly/annually), interval, nextDueDate, endDate, isActive, notes, terms, lastGeneratedDate, totalGenerated, createdAt, updatedAt, deletedAt
  - Indexes: (businessId, isActive), nextDueDate
- [ ] **1.1.7**: Create `recurring_template_items` table in `db/schema.ts`:
  - Columns: id, templateId (cascade delete), description, quantity, unitPrice, taxRate, revenueCategoryId, createdAt
- [ ] **1.1.8**: Create `recurring_invoice_generations` table in `db/schema.ts`:
  - Columns: id, templateId, invoiceId, generatedDate, status (success/skipped/failed), skipReason, errorMessage, createdAt
- [ ] **1.1.9**: Create `payment_reminders` table in `db/schema.ts`:
  - Columns: id, businessId, invoiceId, reminderType (first_reminder/second_reminder/final_reminder), scheduledDate, sentDate, status (pending/sent/failed), deliveryLog (jsonb), createdAt
- [ ] **1.1.10**: Create `invoice_email_logs` table in `db/schema.ts`:
  - Columns: id, invoiceId, recipient, emailType (invoice_sent/payment_reminder/payment_receipt), status (sent/delivered/opened/bounced/failed), sentAt, deliveredAt, openedAt, errorMessage, createdAt
- [ ] **1.1.11**: Create `business_profiles` table in `db/schema.ts`:
  - Columns: id, businessId (unique), logoUrl, businessName, address, phone, email, website, taxRegistrationNo, defaultTaxRate, invoicePrefix, invoiceNumberStart, paymentTerms, footerText, accentColor, createdAt, updatedAt
- [ ] **1.1.12**: Generate Drizzle migration: `npm run db:generate`
- [ ] **1.1.13**: Add TypeScript types and insert types for all new tables (e.g. `Customer`, `Invoice`, `InvoicePayment`, etc.)

### Task 1.2: Context Switching Infrastructure

- [ ] **1.2.1**: Create `src/hooks/useBillingContext.ts`:
  - State: `activeMode` — 'expenses' | 'billing'
  - `setMode(mode)` function
  - Persisted to localStorage (`finaflow_ui_mode`)
  - `getDefaultMode` reads from user's current business `primaryMode`
  - Returns current mode, setMode, isExpenses, isBilling helpers
- [ ] **1.2.2**: Modify `src/components/Layout.tsx`:
  - Add mode toggle at top of sidebar (before nav items)
  - Mode toggle shows active mode name with dropdown to switch
  - Desktop: dropdown button in sidebar header
  - Mobile: mode toggle in mobile header
  - `navItems` filtered based on `activeMode`
  - Import `useBillingContext` hook
- [ ] **1.2.3**: Create expense mode nav items:
  - Dashboard, Daily Sales, Expenses, Suppliers, Bills (All Bills, Recurring Bills), Accounts, Payroll, Wallet, Calendar, Reports, Settings, Partner
- [ ] **1.2.4**: Create billing mode nav items:
  - Billing Dashboard, Invoices (All Invoices, Create Invoice, Recurring), Customers (All Customers, Add Customer), Payments Received, Reports (Revenue, Aging, Invoice Status), Settings
- [ ] **1.2.5**: Modify `src/components/MobileBottomNavigation.tsx`:
  - Context-switch bottom nav items based on active mode
  - Expenses mode: Dashboard, Sales, Expenses, Bills, Reports
  - Billing mode: Dashboard, Invoices, Customers, Payments, Reports
- [ ] **1.2.6**: Create route configuration for billing pages in `src/App.tsx`:
  - `/billing` → BillingDashboard (lazy loaded)
  - `/billing/invoices` → Invoices
  - `/billing/invoices/create` → InvoiceBuilder
  - `/billing/invoices/:id` → InvoiceDetail
  - `/billing/invoices/:id/edit` → InvoiceBuilder
  - `/billing/customers` → Customers
  - `/billing/customers/:id` → CustomerDetail
  - `/billing/recurring` → RecurringInvoices
  - `/billing/payments` → Payments
  - `/billing/reports` → BillingReports
- [ ] **1.2.7**: Add `ProtectedRoute` wrapping for all billing routes

### Task 1.3: Permissions

- [ ] **1.3.1**: Add new permission constants in `src/lib/permissions.ts`:
  - `INVOICES_VIEW`, `INVOICES_CREATE`, `INVOICES_SEND`, `INVOICES_VOID`, `INVOICES_PAY`
  - `CUSTOMERS_VIEW`, `CUSTOMERS_MANAGE`
  - `RECURRING_MANAGE`
  - `BILLING_REPORTS_VIEW`
  - `BILLING_SETTINGS_MANAGE`
- [ ] **1.3.2**: Add permissions to `db/schema.ts` if permissions are DB-backed
- [ ] **1.3.3**: Add permissions seed data in `db/seed.ts`:
  - Owner role gets all billing permissions
  - Admin gets all billing permissions
  - Manager gets: INVOICES_VIEW, INVOICES_CREATE, INVOICES_SEND, CUSTOMERS_VIEW, CUSTOMERS_MANAGE, BILLING_REPORTS_VIEW
  - Employee gets: INVOICES_VIEW, CUSTOMERS_VIEW
  - Viewer gets: INVOICES_VIEW, CUSTOMERS_VIEW, BILLING_REPORTS_VIEW

---

## Phase 2: Core Features

### Task 2.1: Customer Management

- [ ] **2.1.1**: Create `api/customers-router.ts`:
  - `customers.list` — Paginated list with search (name, email, phone, customerNumber), filter by businessId
  - `customers.getById` — Single customer with stats (totalInvoiced, totalPaid, balance) via aggregate queries
  - `customers.create` — Create customer with auto-generated customerNumber (CUST-XXXX), validate unique
  - `customers.update` — Update customer fields, validate email uniqueness
  - `customers.delete` — Soft delete, check no outstanding (non-void) invoices
  - `customers.getStatement` — Invoice list with balances, aging for a customer
  - All endpoints use existing auth middleware and businessId scoping
  - Rate limiting: 30/min
- [ ] **2.1.2**: Create `src/pages/billing/Customers.tsx`:
  - List page with search bar and paginated table
  - Columns: Customer Number, Name, Email, Phone, Total Invoiced, Balance, Status, Actions
  - Status indicator (active/inactive via isActive field)
  - Quick actions dropdown: Create Invoice, View Statement
  - Create/Edit customer dialog (name, email, phone, billing address, payment terms, credit limit, currency)
  - Mobile: card-based layout
  - FinaFlow pattern: search bar + table with same styling as Suppliers page
- [ ] **2.1.3**: Create `src/pages/billing/CustomerDetail.tsx`:
  - Info cards (contact info, payment terms, credit limit, currency)
  - Invoice history table with status badges, amounts, dates
  - Statement summary (total invoiced, total paid, current balance)
  - Aging breakdown: 0-30, 31-60, 61-90, 90+ days
  - Quick action buttons: Create Invoice, Record Payment
  - Mobile responsive layout
- [ ] **2.1.4**: Wire routes in App.tsx: `/billing/customers`, `/billing/customers/:id`

### Task 2.2: Invoice Management

- [ ] **2.2.1**: Create `api/invoices-router.ts`:
  - `invoices.list` — Paginated list with filters: status, dateRange (issueDate), customerId, currency. Sorted by issueDate desc
  - `invoices.getById` — Full invoice with line items (joined) and payments (joined). Include customer info
  - `invoices.create` — Create invoice with line items in a transaction:
    - Validate customer exists and is active
    - Validate line items (non-empty, positive qty/price)
    - Auto-calculate: subtotal, discountAmount, taxAmount per item, grandTotal
    - Auto-generate invoice number (from business_profiles)
    - Set status to 'draft'
    - Create invoice + all invoice_items in one transaction
  - `invoices.update` — Update draft invoice only (replace line items in transaction)
  - `invoices.send` — Change status to 'sent', set issueDate if not set, trigger email dispatch
  - `invoices.void` — Void invoice with reason:
    - Check not already paid (or reverse payments)
    - Set status to 'void', set voidReason, voidedAt
    - If payments exist, create credit note invoice or reversing journal entry
  - `invoices.downloadPdf` — Generate PDF on-demand, return as file response
  - `invoices.getNextNumber` — Return next available invoice number (from business_profiles + 1, without incrementing)
  - All endpoints use existing auth middleware and businessId scoping
  - Rate limiting: 20/min
- [ ] **2.2.2**: Create `src/pages/billing/Invoices.tsx`:
  - List with status tabs (All, Draft, Sent, Paid, Overdue, Void) using FinaFlow button-tab pattern
  - Table with columns: Invoice Number, Customer, Issue Date, Due Date, Grand Total, Balance Due, Status, Actions
  - Status badges with color coding:
    - Draft: gray (#8D8A87)
    - Sent: blue (#0288D1)
    - Partial: orange (#ED6C02)
    - Paid: green (#2E7D32)
    - Overdue: red (#D32F2F)
    - Void: muted gray
  - Search by invoice number or customer name
  - Date range filter
  - Quick actions dropdown: View, Send, Download PDF, Record Payment, Void
  - FinaFlow table styling: border-b divides, hover:bg[#F5EDE6]/50 rows
  - Mobile: card-based layout
- [ ] **2.2.3**: Create `src/pages/billing/InvoiceBuilder.tsx`:
  - Customer selector (searchable dropdown with name, email, phone display)
  - Invoice date input (default: today)
  - Due date auto-computed from payment terms (default: net30 from invoice date)
  - Currency selector (default: from customer or business)
  - Line items table:
    - Add/remove rows
    - Each row: description (text), quantity (number), unitPrice (decimal), taxRate (dropdown or input), revenueCategory (dropdown from revenue_categories), lineTotal (auto, read-only)
    - Row actions: delete, duplicate
    - Add line item button
  - Totals section (real-time):
    - Subtotal (sum of all qty × unitPrice)
    - Discount (dropdown: percentage/fixed, input for value)
    - Tax total (sum of all line item taxAmount)
    - Grand total
  - Notes text area
  - Payment terms text area
  - Action buttons: "Save as Draft" (bg-gray), "Save and Send" (bg-[#C73E1D])
  - Mobile: stacked form layout, touch-friendly line item controls
- [ ] **2.2.4**: Create `src/pages/billing/InvoiceDetail.tsx`:
  - Professional invoice display (print-friendly, uses @media print)
  - Business info header (from business_profiles)
  - Customer info block
  - Invoice header: number, status badge, issue date, due date
  - Line items table
  - Totals section
  - Payment history table (if any payments recorded)
  - Email log entries (if any)
  - Action buttons: Send, Download PDF, Record Payment, Void
  - Status change confirmation dialogs
- [ ] **2.2.5**: Wire routes in App.tsx: `/billing/invoices`, `/billing/invoices/create`, `/billing/invoices/:id`, `/billing/invoices/:id/edit`

### Task 2.3: Invoice PDF Generation

- [ ] **2.3.1**: Install PDF generation library (pdfkit)
- [ ] **2.3.2**: Create `api/lib/invoice-pdf.ts`:
  - `generateInvoicePdf(invoiceId)` function
  - Fetch full invoice with items, customer, business profile
  - Generate PDF with:
    - Business logo (base64 from business_profiles)
    - Business name, address, phone, email, tax reg no
    - Customer name, address
    - Invoice number, issue date, due date, status
    - Line items table with headers (Description, Qty, Unit Price, Tax, Total)
    - Totals section (subtotal, discount, tax, grand total)
    - Amount in words (utility function)
    - Payment terms and notes
    - Accent color from business_profiles.accentColor
  - Return PDF as Buffer
- [ ] **2.3.3**: Wire into `invoices.downloadPdf` endpoint — return as octet-stream with Content-Disposition

---

## Phase 3: Billing Operations

### Task 3.1: Payment Recording

- [ ] **3.1.1**: Create `api/invoice-payments-router.ts`:
  - `invoicePayments.list` — Payments list with filters: date range, payment method, invoiceId, customerId (via join)
  - `invoicePayments.record` — Record payment in transaction:
    - Validate invoice exists and has balanceDue > 0
    - Validate amount > 0 and <= balanceDue
    - Find appropriate accountId by payment method (use accounting-maps.ts patterns):
      - cash → find cash account
      - mpesa → find mpesa account
      - bank_transfer → find bank account
      - card → find bank account
    - Create invoice_payment record
    - Update invoice.amountPaid (accumulate) and balanceDue (computed)
    - Update invoice.status:
      - If amountPaid >= grandTotal → 'paid'
      - If amountPaid > 0 → 'partial'
    - Create journal entry in FinaFlow's journal system:
      - Debit: the cash/bank account (by payment method)
      - Credit: Revenue account (from invoice items' revenueCategory → incomeAccountId)
      - Or aggregate: if multiple revenue categories, credit proportionally
    - Rate limiting: 20/min
  - `invoicePayments.getByInvoice` — All payments for a specific invoice, ordered by paymentDate desc
  - `invoicePayments.delete` — Reverse a payment (within configurable cancelation period, default 24h):
    - Only if invoice is not fully reconciled
    - Reverse the amount from invoice.amountPaid
    - Reverse the journal entry
    - Update invoice status back
- [ ] **3.1.2**: Create `src/pages/billing/Payments.tsx`:
  - Payments list with filters: date range, payment method
  - Table: Date, Invoice #, Customer, Amount, Method, Reference, Status
  - Payment method breakdown summary card (cash total, mpesa total, bank total)
  - Record payment dialog (opened from invoice detail or standalone):
    - Invoice selector (searchable)
    - Amount (pre-filled if from invoice detail)
    - Payment method dropdown
    - Reference input
    - Payment date (default: today)
    - Notes text area
  - Mobile-friendly layout
- [ ] **3.1.3**: Wire routes: `/billing/payments`

### Task 3.2: Recurring Invoice Engine

- [ ] **3.2.1**: Create `api/recurring-invoices-router.ts`:
  - `recurringInvoices.list` — List templates with status, next due date, customer name
  - `recurringInvoices.create` — Create template with items in transaction:
    - Validate customer, frequency, nextDueDate
    - Create template + template items
  - `recurringInvoices.update` — Update template, replace items
  - `recurringInvoices.delete` — Soft delete (set isActive = false, deletedAt)
  - `recurringInvoices.triggerNow` — Manually generate invoice from template:
    - Creates invoice from template items
    - Updates nextDueDate
    - Creates generation log
  - `recurringInvoices.skipNext` — Skip next occurrence:
    - Advance nextDueDate without generating
    - Create generation log with status 'skipped' and skipReason
  - `recurringInvoices.getGenerationLog` — History of auto-generations for a template
- [ ] **3.2.2**: Create `api/cron/recurring-invoices.ts`:
  - Scheduled task that checks every hour (or daily at 00:00)
  - Queries active templates where nextDueDate <= today
  - For each template in transaction:
    - Create invoice from template items (same logic as invoices.create)
    - Compute new nextDueDate by frequency:
      - weekly: add 7 days
      - monthly: add 1 month
      - quarterly: add 3 months
      - annually: add 1 year
    - If endDate is set and new date > endDate, set isActive = false
    - Update lastGeneratedDate, totalGenerated
    - Create generation log entry
    - Optionally send invoice via email (sendInvoice mutation)
  - Uses db.transaction() for each template
  - Logging: success/failure per template
- [ ] **3.2.3**: Create `src/pages/billing/RecurringInvoices.tsx`:
  - Template list with status indicator (active/inactive badge)
  - Create/edit template dialog:
    - Customer selector
    - Template name
    - Description
    - Frequency selector (weekly/monthly/quarterly/annually)
    - Interval (every N periods)
    - Next due date picker
    - End date picker (optional)
    - Line items (same pattern as invoice builder)
    - Notes and terms text areas
  - Template detail view:
    - Basic info card
    - Items table
    - Generation history log with status badges
  - Action buttons: Trigger Now, Skip Next, Edit, Deactivate
  - Mobile-friendly layout
- [ ] **3.2.4**: Wire routes: `/billing/recurring`
- [ ] **3.2.5**: Register cron job in the app's initialization (or as a scheduled task via Schedule tool)

### Task 3.3: Email Delivery

- [ ] **3.3.1**: Create `api/lib/email.ts`:
  - Configure email transport (SendGrid, SMTP, or SES)
  - `sendInvoiceEmail(invoiceId)` — Send invoice to customer email with PDF attachment
  - `sendPaymentReminder(invoiceId, reminderType)` — Send reminder email
  - `sendPaymentReceipt(invoiceId, paymentId)` — Send receipt email
  - Track delivery status (sent, failed, bounced)
  - Create invoice_email_log entries
  - Configurable sender name/email from business_profiles
- [ ] **3.3.2**: Create `api/email-router.ts`:
  - `email.sendInvoice` — Send invoice email (called from invoices.send)
  - `email.resendInvoice` — Resend to same or different email
  - `email.getEmailLogs` — Delivery logs for an invoice
  - `email.sendReminder` — Send manual reminder
- [ ] **3.3.3**: Create `api/cron/payment-reminders.ts`:
  - Daily cron for overdue invoices
  - Finds invoices where status IN ('sent', 'partial') AND dueDate < today AND balanceDue > 0
  - Groups by days overdue:
    - 7 days → first_reminder (if no reminder sent yet)
    - 14 days → second_reminder (if first was sent)
    - 30+ days → final_reminder (if second was sent)
  - Creates payment_reminders entries
  - Sends reminder emails via email service
  - Updates payment_reminders status after sending

### Task 3.4: Business Branding / Profile

- [ ] **3.4.1**: Create `api/billing-profile-router.ts`:
  - `billingProfile.get` — Get business profile (create default if not exists)
  - `billingProfile.update` — Update branding settings:
    - Logo upload (store as base64 or file path)
    - Business name, address, phone, email, website
    - Tax registration number
    - Default tax rate
    - Invoice prefix, invoice number start
    - Default payment terms text
    - Footer text
    - Accent color (hex)
- [ ] **3.4.2**: Create billing settings section (integrated into existing Settings page or separate page):
  - Business profile tab with upload logo
  - Invoice settings tab (prefix, default terms, default tax rate)
  - Email settings tab (sender name, sender email, reminder intervals)
  - Same UI patterns as existing Settings page

---

## Phase 4: Reports & Dashboard

### Task 4.1: Billing Dashboard

- [ ] **4.1.1**: Create `api/billing-dashboard-router.ts`:
  - `billingDashboard.summary` — Revenue KPIs:
    - Invoiced this month (sum of grandTotal where status != 'void' AND issueDate in current month)
    - Collected this month (sum of invoice_payments where paymentDate in current month)
    - Outstanding (sum of balanceDue where status IN ('sent', 'partial', 'overdue'))
    - Overdue total (sum of balanceDue where status IN ('sent', 'partial') AND dueDate < today)
    - Invoice count by status
    - Month-over-month change percentages
  - `billingDashboard.recentInvoices` — Last 10 invoices with customer name
  - `billingDashboard.upcomingRecurring` — Next 5 recurring templates by nextDueDate
  - `billingDashboard.agingSummary` — Total outstanding by bucket (0-30, 31-60, 61-90, 90+)
  - `billingDashboard.monthlyRevenue` — Monthly revenue trend (last 12 months, sum of payments by month)
- [ ] **4.1.2**: Create `src/pages/billing/BillingDashboard.tsx`:
  - Revenue summary cards (same card pattern as main Dashboard):
    - Invoiced This Month (with trend indicator)
    - Collected This Month (with trend indicator)
    - Outstanding
    - Overdue (in red if > 0)
  - Monthly revenue trend chart (recharts BarChart)
  - Recent invoices list (last 10, mini table)
  - Upcoming recurring invoices (next 5, list view)
  - Aging summary cards (buckets with amounts)
  - FinaFlow design patterns: rounded-2xl cards, serif titles, monospace amounts
- [ ] **4.1.3**: Wire route: `/billing` (also `/billing/dashboard`)

### Task 4.2: Billing Reports

- [ ] **4.2.1**: Create `api/billing-reports-router.ts`:
  - `billingReports.revenueByPeriod`:
    - Input: dateRange, grouping (monthly/quarterly/yearly)
    - Output: periods with invoiced, collected, outstanding
    - Group by period using SQL date truncation
  - `billingReports.customerAging`:
    - Input: asOf date (default: today)
    - Output: buckets (0-30, 31-60, 61-90, 90+) with customer counts and totals
    - Query: invoices with status IN ('sent', 'partial') AND dueDate <= asOf
  - `billingReports.invoiceStatusDistribution`:
    - Output: count and total amount by status
  - `billingReports.revenueByCategory`:
    - Input: dateRange
    - Output: revenue categories with totals (from invoice_items.revenueCategoryId → revenue_categories.name)
  - All endpoints: CSV export option
- [ ] **4.2.2**: Create `src/pages/billing/BillingReports.tsx`:
  - Tab-based layout: Revenue, Aging, Status Distribution, Revenue by Category
  - FinaFlow button-tab pattern (border-b-2)
  - Revenue by period:
    - Date range picker
    - Grouping selector (monthly/quarterly/yearly)
    - Bar chart (recharts)
    - Data table below
    - CSV export button
  - Customer aging:
    - As-of date display
    - Bucket breakdown cards
    - Table with bucket, count, total
  - Invoice status distribution:
    - Pie chart (recharts PieChart)
    - Summary table
  - Revenue by category:
    - Bar chart
    - Table with category, amount, percentage
  - Mobile responsive: charts stack vertically
- [ ] **4.2.3**: Wire route: `/billing/reports`

### Task 4.3: Integration with Existing Reports

- [ ] **4.3.1**: Update `api/reports-router.ts` to include billing data:
  - P&L Statement: Include revenue from invoice payments (through journal entries) alongside existing expense data
  - Balance Sheet: Accounts receivable (sum of balanceDue for non-void invoices) as a current asset
  - Cash Flow: Include incoming payments in operating cash inflows
- [ ] **4.3.2**: Update Reports.tsx main tab to include billing-related report sections
  - Only visible if user has billing permissions and has billing data

---

## Phase 5: Onboarding & Polish

### Task 5.1: Business Onboarding Flow

- [ ] **5.1.1**: Add `primaryMode` selection step to business creation flow (in `api/businesses-router.ts`):
  - Accept `primaryMode` in create mutation
  - Set default mode based on selection
- [ ] **5.1.2**: Create onboarding UI step for primary mode selection:
  - Three-option card selector (Track Expenses, Send Invoices, Both)
  - Clean design with icons
  - Store selection in business creation payload
- [ ] **5.1.3**: Update `useBillingContext` to respect `primaryMode` on initial load:
  - Read `user.currentBusiness.primaryMode`
  - Set default mode accordingly
  - Override with localStorage preference if user has manually switched before

### Task 5.2: Mobile Optimization

- [ ] **5.2.1**: Audit all billing pages for mobile responsiveness:
  - Invoices list: card-based layout at sm breakpoint
  - Invoice builder: stacked form, touch line items
  - Customers list: card-based layout
  - Customer detail: stacked cards
  - Billing dashboard: single-column grid at sm
  - Reports: vertical stacking of charts and tables
- [ ] **5.2.2**: Bottom navigation context-switching fully functional
- [ ] **5.2.3**: Touch targets minimum 44px on all interactive elements
- [ ] **5.2.4**: Dialogs full-screen on mobile

### Task 5.3: Testing

- [ ] **5.3.1**: Unit tests for invoice calculation utilities:
  - calculateSubtotal, calculateTax, calculateDiscount, calculateGrandTotal
  - generateInvoiceNumber
  - computeDueDate (net15, net30, net60, due_on_receipt)
  - nextDateByFrequency (weekly, monthly, quarterly, annually)
  - isOverdue, formatCurrency
- [ ] **5.3.2**: Integration tests for customer CRUD:
  - Create customer → list includes customer → getById returns correct data
  - Update customer → getById returns updated data
  - Delete customer with invoices → blocked
  - Delete customer without invoices → soft deleted
- [ ] **5.3.3**: Integration tests for invoice lifecycle:
  - Create draft invoice → status is 'draft'
  - Add line items → totals calculated correctly
  - Send invoice → status is 'sent'
  - Record partial payment → status is 'partial', balance updated
  - Record full payment → status is 'paid', balance is 0
  - Void unpaid invoice → status is 'void'
  - Void partially paid invoice → status is 'void' (with credit note)
- [ ] **5.3.4**: Integration tests for recurring invoice engine:
  - Create template → list shows active
  - Trigger now → invoice created, nextDueDate advanced
  - Skip next → nextDueDate advanced without invoice
  - Daily cron generates for due templates only
- [ ] **5.3.5**: Integration tests for payment → journal entries:
  - Record payment → journal entry created with Dr = Cr
  - Cash payment → Debit cash account, Credit revenue account
  - M-PESA payment → Debit mpesa account, Credit revenue account
- [ ] **5.3.6**: E2E test: Create customer → Create invoice → Send → Record payment → Verify report data

---

## Task Dependencies

- **Phase 1 (Foundation)** is prerequisite for all other phases
  - Task 1.1 (DB schema) must complete before any API work
  - Task 1.2 (Context switching) must complete before billing UI work
  - Task 1.3 (Permissions) can run in parallel with 1.1 and 1.2
- **Phase 2 (Core Features)** depends on Phase 1:
  - Task 2.1 (Customers) depends on 1.1
  - Task 2.2 (Invoices) depends on 2.1 and 1.1
  - Task 2.3 (PDF) depends on 2.2
- **Phase 3 (Billing Operations)** depends on Phase 2:
  - Task 3.1 (Payments) depends on 2.2
  - Task 3.2 (Recurring) depends on 2.1 and 2.2
  - Task 3.3 (Email) depends on 2.2
  - Task 3.4 (Branding) can run in parallel with other Phase 3 tasks
- **Phase 4 (Reports & Dashboard)** depends on Phase 3:
  - Task 4.1 (Dashboard) depends on 3.1 and 2.2
  - Task 4.2 (Reports) depends on 3.1
  - Task 4.3 (Integration) depends on all Phase 3
- **Phase 5 (Polish)** has no strict dependencies on Phase 4 — can run in parallel
