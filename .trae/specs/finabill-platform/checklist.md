# FinaBill Platform — Verification Checklist

> **Project Location**: `d:\DevCenter\abuilds\fina\finabill\` — sibling to FinaFlow
> **Architecture**: Standalone application (NOT embedded)
> **Integration**: Bi-directional API sync with FinaFlow via integration page

---

## Phase 1: Foundation

### Project Scaffold
- [ ] Monorepo root exists with package.json, tsconfig.json
- [ ] `apps/web/` builds and serves via Vite on port 5173
- [ ] `api/` starts via Hono on port 3001 with tRPC
- [ ] `packages/shared/` compiles types and utilities
- [ ] `db/` connects to PostgreSQL with Drizzle
- [ ] Path aliases resolve in all sub-projects
- [ ] ESLint + Prettier pass on all files
- [ ] HMR works on both frontend and backend

### Authentication
- [ ] User registration creates business + owner user
- [ ] Login sets JWT in httpOnly cookie
- [ ] Logout clears the cookie
- [ ] `auth.me` returns user + business context
- [ ] ProtectedRoute redirects unauthenticated users
- [ ] useAuth hook returns current user and helpers
- [ ] Role/permission extracted from JWT on every request

### Database Foundation
- [ ] `businesses` table created with all required columns
- [ ] `users` table created with businessId FK
- [ ] `subscription_tiers` enum (free/standard/premium/finance_plus)
- [ ] Drizzle migration generates and applies without errors
- [ ] Seed script creates default admin user

### UI Foundation
- [ ] Tailwind CSS configured with FinaBill color palette
- [ ] shadcn/ui primitives installed and functional
- [ ] Sidebar Layout renders with navigation items
- [ ] Global search command palette (⌘K) works
- [ ] Inline form wrapper component exists and is reusable
- [ ] Mobile navigation works (hamburger or bottom bar)
- [ ] Responsive at 320px, 768px, 1440px breakpoints

### Shared Library
- [ ] `@finabill/shared` builds without errors
- [ ] All TypeScript types export correctly
- [ ] Zod schemas validate valid/invalid inputs
- [ ] Utility functions produce correct results
- [ ] Decimal.js used for all financial calculations

### Security
- [ ] Rate limiting on login (10/min) and API (100/min)
- [ ] Audit logging on all mutation endpoints
- [ ] CSRF protection enabled
- [ ] Input validation on all mutation endpoints

---

## Phase 2: Core CRM & Sales

### Customers
- [ ] List loads with paginated data
- [ ] Search filters by name, email, phone, customer number
- [ ] Inline create form works on list page
- [ ] Customer type: Business or Individual radio toggle
- [ ] Fields: salutation, first name, last name, company name, display name
- [ ] Contact fields: email, phone, work phone, mobile, language
- [ ] Other Details collapsible: tax rate, company ID, currency, payment terms, enable portal
- [ ] Customer number auto-generates (CUST-XXXX)
- [ ] Inline edit works on detail page
- [ ] Tabbed detail sections: Address, Contact Persons, Custom Fields, Reporting Tags
- [ ] Address tab: billing address + shipping address (attention, country, street1/2, city, state, ZIP, phone, fax)
- [ ] Contact Persons tab: add/remove rows (salutation, name, email, work phone, mobile)
- [ ] Document upload: max 10 files, 10MB each
- [ ] Soft delete works (not visible, still referenced by invoices)
- [ ] Statement shows invoice history + aging
- [ ] Delete blocked if customer has non-void invoices
- [ ] All endpoints filter by businessId

### Items (Catalogue)
- [ ] List loads with paginated data
- [ ] Search by name, SKU
- [ ] Inline create with SKU auto-generation
- [ ] Type: Goods or Service radio toggle
- [ ] Unit: dropdown (pieces, hours, kg, box, etc.) with autocomplete
- [ ] Sales info: selling price, **COA income account selection** (full chart of accounts), description, tax
- [ ] Trackable vs non-trackable items
- [ ] Price lists created with item overrides
- [ ] Multi-currency pricing works

### Quotes
- [ ] List loads with status filters (Draft, Sent, Accepted, Declined, Expired, Converted)
- [ ] Inline quote builder creates quote with line items
- [ ] Quote number auto-generates (QOT-XXXX)
- [ ] Line items from catalogue
- [ ] Tax + discount calculated correctly
- [ ] Quote sent → status changes to 'sent', email dispatched
- [ ] Quote accepted → status to 'accepted'
- [ ] Quote declined → status to 'declined'
- [ ] Convert to invoice → creates invoice from quote
- [ ] PDF download generates valid file
- [ ] Quote expiry auto-calculated (default 30 days)

### Invoices
- [ ] List loads with status tabs (All, Draft, Sent, Paid, Overdue, Void)
- [ ] Status badges have correct color coding
- [ ] Inline invoice builder creates invoice with line items
- [ ] Header: customer name (with inline create), order number (optional), invoice date, terms, due date, salesperson, subject
- [ ] Invoice number auto-generates (INV-XXXX)
- [ ] Item table with draggable row reorder (Item Details, Quantity default 1, Rate, Tax, Amount)
- [ ] Totals calculated correctly (subtotal, tax, discount, grand total)
- [ ] Discount (percentage + fixed) works
- [ ] Shipping Charges and Adjustment fields present
- [ ] Send → status to 'sent', email with PDF
- [ ] Void → status to 'void' with reason
- [ ] Partial payment → status to 'partial', balance updates
- [ ] Full payment → status to 'paid'
- [ ] Due date auto-computed from payment terms
- [ ] Currency defaults to customer preference
- [ ] BalanceDue tracks correctly with multiple partial payments
- [ ] Payment gateway prompt shown if not configured
- [ ] File attachments: max 10 files, 10MB each

### Sales Receipts
- [ ] Receipt creation records payment immediately
- [ ] Receipt number auto-generates (SR-XXXX)
- [ ] Header: customer name, receipt date, salesperson
- [ ] Payment Details section: Payment Mode + Deposit To (COA account)
- [ ] File attachments: max 5 files, 10MB each
- [ ] Receipt can be downloaded as PDF

### Credit Notes
- [ ] Credit note linked to original invoice
- [ ] Credit note number auto-generates (CN-XXXX)
- [ ] Reference number field
- [ ] Item table has **Account column (full COA selection)** — all account types and sub-types
- [ ] Credit remaining tracked
- [ ] Credit can be applied to future invoices

### PDF Generation
- [ ] Quote PDF has business branding, line items, totals
- [ ] Invoice PDF has logo, customer block, items, totals
- [ ] Receipt PDF has payment details
- [ ] Credit note PDF has reversal details
- [ ] All PDFs styled with business accent color
- [ ] Downloads return valid PDF file

---

## Phase 3: Payments & Expenses

### Payments Received
- [ ] Payment records against invoice update balance and status
- [ ] Full payment changes status to 'paid'
- [ ] Partial payment changes status to 'partial'
- [ ] Multiple partial payments accumulate correctly
- [ ] Payment amount validated against balanceDue
- [ ] Payment methods: cash, mpesa, bank_transfer, card, stripe
- [ ] Payment list filters by date range and method
- [ ] Payment method breakdown shows correct totals
- [ ] Refund works within cancellation period
- [ ] Payment form: customer name (autocomplete), amount received, bank charges, payment date, auto payment number
- [ ] Payment Details: payment mode, deposit to (COA account), reference#
- [ ] TDS support: No Tax deducted / Yes TDS radio toggle
- [ ] Unpaid invoices table: date, invoice#, amount, due, payment received on, payment input
- [ ] Summary computed: amount received, amount used, amount refunded, amount in excess
- [ ] Internal notes + attachments (max 5 files, 5MB each)

### Payment Links
- [ ] Shareable payment link generates
- [ ] Link validation at checkout
- [ ] Usage tracking (maxUses, currentUses)
- [ ] Link expiry

### Expenses
- [ ] Expense list with category/date filters
- [ ] Inline create form
- [ ] Receipt upload (photo capture)
- [ ] Recurring expenses with frequency
- [ ] Expense categories CRUD
- [ ] All fields: date, category, amount, description, receipt

---

## Phase 4: Subscriptions & Recurring

### Plans & Addons
- [ ] Plan list with inline create/edit
- [ ] Plan detail with associated items
- [ ] Product selector with inline create dialog (name, description, email recipients, redirect URL, auto-gen numbers)
- [ ] Plan pricing: billing frequency (day/week/month/year), billing cycles, pricing model (flat/per-unit/tiered/volume)
- [ ] Free trial (days) + setup fee
- [ ] Plan type: Goods or Service radio toggle with sales tax
- [ ] Billing intervals: monthly, quarterly, annual + custom periods
- [ ] Hosted Payment Pages & Portal config section
- [ ] Addons with one-time or recurring billing, pricing interval
- [ ] Addon type: Goods or Service with sales tax
- [ ] Addons associate with specific plans (multi-select)
- [ ] Coupons with redemption types (one-time/multiple/unlimited)
- [ ] Coupon applicability: all plans, specific plans, specific addons

### Pricing Widgets
- [ ] Tiered pricing (e.g., $10 for 0-100, $8 for 101-500)
- [ ] Volume discounts
- [ ] Usage-based pricing configuration

### Subscriptions Engine
- [ ] Subscription created with plan + addons + coupon
- [ ] Subscription list with status filters
- [ ] Status badges: active, paused, past_due, canceled, expired
- [ ] Pause → billing stops
- [ ] Resume → billing resumes
- [ ] Cancel → subscription ends at period end
- [ ] Plan change with proration
- [ ] Addon attach/detach
- [ ] Stripe integration (customer, subscription, payment method)
- [ ] Stripe webhooks handled correctly
- [ ] Invoice auto-generated at each billing cycle
- [ ] Failed payment retry (3 attempts)
- [ ] Dunning: email → suspend → cancel
- [ ] Hosted payment pages functional

---

## Phase 5: Time Tracking & Projects

### Projects
- [ ] Project list with customer/status filters
- [ ] Inline create with project name, code, customer, billing method (flat/hourly/non-billable)
- [ ] Description: max 2000 characters
- [ ] Budget: cost budget + revenue budget
- [ ] Users section: add/remove users on project
- [ ] Project Tasks section: add tasks with name, description, billable toggle, import from existing
- [ ] Status: active, completed, on_hold, canceled
- [ ] Watchlist toggle: 'Add to the watchlist on my dashboard'
- [ ] Budget tracking (actual vs budget)
- [ ] Project profitability report

### Timesheets
- [ ] Keyboard shortcut C+T for quick time entry
- [ ] Weekly timesheet grid view (days × projects)
- [ ] Inline time entry with: date, project, task, time spent (HH:MM), billable, user, notes
- [ ] Billable/non-billable flags
- [ ] Approval workflow: submit → approve → reject
- [ ] Export approved entries to invoice
- [ ] All entries filterable by date, project, user

### Events & Activity Log
- [ ] Events table logs all system actions
- [ ] Auto-logging on: customer created/invoiced, invoice created/paid/voided, payment recorded, subscription events, quote events
- [ ] Activity log page with filterable list (date range, action type, actor, entity type)
- [ ] Timestamp, action type, actor, details displayed per entry

---

## Phase 6: Reports & Intelligence

### Reports
- [ ] Report viewer framework with category sidebar (15 categories), report list (middle), report view (right)
- [ ] Date range picker (From/To)
- [ ] Filter bar: Entities dropdown, More Filters
- [ ] Compare With: None, Previous Period, Previous Year
- [ ] Customize Report Columns interface
- [ ] Empty state message: "There were no [data] during the selected date range."
- [ ] Placeholder system for unimplemented reports
- [ ] 7 Sales reports: by Customer, Item, Plan, Addon, Coupon, Sales Person, Summary
- [ ] 7 Receivables reports: AR Aging Summary/Details, Invoice Details, Bad Debts, Customer Balance Summary, Receivable Summary/Details
- [ ] 5 Acquisition Insight reports: Active/Inactive Trials, Trial to Live, Sales Cycle, Lost Opportunities
- [ ] 3 Signups & Activations reports: Signups, Activations, Activations by Country
- [ ] 8 Subscription reports: Active Subscriptions, Net Customers, Details, Upgrades, Downgrades, Summary, ARPU, LTV
- [ ] 3 Revenue reports: Net Revenue, Revenue by Country, Revenue Retention Cohort
- [ ] 5 Retention reports: Revenue Retention Cohort, Revenue Retention Rate, Renewal Summary/Failures, Subscription Retention Rate
- [ ] 3 MRR & ARR reports: MRR, ARR, MRR Quick Ratio
- [ ] 6 Churn reports: Under Risk, Non Renewing, Churned After Retries, Churned Subscriptions, Subscription Expiry, Net Cancellations
- [ ] 5 Churn Insights: Net Cancellations, Churn Rate, by Country, by Product, Revenue Churn
- [ ] 6 Payments Received: Payments, Time to Get Paid, Credit Note Details, Refund History, Payment Failures, Card Expiry
- [ ] 5 Expense reports: Expense Details, by Category, by Customer, by Project, Billable Expenses
- [ ] 1 Tax report: Tax Summary
- [ ] 4 Project & Timesheet: Timesheet Details, Project Summary/Details, Projects Revenue Summary
- [ ] 5 Activity reports: System Mails, Activity Logs, Exception Report, Portal Activities, Customer Reviews, API Usage
- [ ] All reports have date range filtering
- [ ] CSV export generates valid files

### Dashboard
- [ ] KPI cards show correct values
- [ ] Revenue trend chart renders (12 months)
- [ ] Recent invoices list (last 10)
- [ ] Upcoming subscription renewals
- [ ] Aging summary buckets
- [ ] Bento-grid layout responsive

---

## Phase 7: Integration & Polish

### FinaFlow Integration (FinaBill Side)
- [ ] Integration page with Connect button
- [ ] API key entry + validation
- [ ] Smart customer matching (email scan)
- [ ] Matched customers show "Connect" button
- [ ] No matches show "Try FinaFlow" button
- [ ] Payment sync pushes journal entry to FinaFlow
- [ ] Customer sync pushes profile to FinaFlow
- [ ] Disconnect removes integration
- [ ] Sync status indicators

### FinaFlow Integration (FinaFlow Side)
- [ ] Integration page in FinaFlow
- [ ] "Connect to FinaBill" button
- [ ] Smart customer/supplier matching
- [ ] "Try FinaBill" button when no match
- [ ] Payment sync receives journal entries
- [ ] COA endpoint returns account list

### Documents & Email
- [ ] Document upload/download works
- [ ] Invoice email sends with PDF attachment
- [ ] Quote email sends with PDF attachment
- [ ] Payment receipt email sends
- [ ] Payment reminder sends at correct intervals
- [ ] Email delivery tracking (sent, delivered, bounced)
- [ ] Prevent duplicate reminders

### Settings
- [ ] Business profile saves (logo, name, address, tax reg)
- [ ] Invoice defaults (prefix, terms, tax rate, numbering)
- [ ] Email settings (sender name, email, signature)
- [ ] Users & Roles management

### Mobile
- [ ] All pages responsive at sm breakpoint
- [ ] Tables convert to card layout
- [ ] Inline forms stack vertically
- [ ] Touch targets ≥ 44px
- [ ] Bottom navigation functional

---

## Phase 8: FinaGen Vision

- [ ] Unified database schema designed
- [ ] Module merger strategy documented
- [ ] Inventory management module built
- [ ] Warehouse management built
- [ ] Order management (sales + purchase orders) built
- [ ] FinaFlow + FinaBill codebases merged
- [ ] Unified dashboard across all modules
- [ ] Unified reporting
- [ ] Data migration from separate apps completed
- [ ] Single sign-on across all modules

---

## Cross-Cutting Concerns

### Security
- [ ] All list endpoints filter by businessId
- [ ] All mutations require authentication
- [ ] Rate limiting on all mutation endpoints
- [ ] Input validation (Zod schemas) on all endpoints
- [ ] No SQL injection vectors (parameterized Drizzle queries)
- [ ] Decimal.js for ALL financial calculations
- [ ] Multi-step operations in db.transaction()
- [ ] API keys stored securely (hashed)

### Architecture
- [ ] Free tier gating: 50/mo quotes, invoices, receipts
- [ ] Single user enforced in free tier
- [ ] Multi-currency blocked in free tier
- [ ] Subscriptions blocked in free tier
- [ ] Standard tier enables: 3 users, multi-currency, payment links
- [ ] Premium tier enables: subscriptions, coupons, dunning, hosted pages
- [ ] Finance Plus tier enables: inventory, warehouses, orders
- [ ] Subscription-gate middleware blocks unauthorized access

### Testing
- [ ] Unit tests for all utility functions pass
- [ ] Integration tests for customer CRUD pass
- [ ] Integration tests for invoice lifecycle pass
- [ ] Integration tests for quote → invoice conversion pass
- [ ] Integration tests for subscription billing pass
- [ ] Integration tests for payment recording pass
- [ ] Integration tests for FinaFlow sync pass
- [ ] E2E test: Customer → Quote → Invoice → Payment → Report passes
- [ ] E2E test: Customer → Subscription → Auto-invoice → Payment passes
- [ ] E2E test: Integration → Customer matching → Sync passes
- [ ] No tests marked as skipped or mocked without explicit authorization
