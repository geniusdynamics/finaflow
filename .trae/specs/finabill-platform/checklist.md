# FinaFlow Billing Module - Verification Checklist

> **Implementation Location**: Inside `d:\DevCenter\abuilds\fina\finaflow\` (not a separate application)
> **Architecture**: Context-switching single app — full sidebar change between Expenses and Billing modes

---

## Phase 1: Foundation

### Database Schema
- [ ] `primaryMode` column added to `businesses` table (varchar(20), default 'both')
- [ ] All 9 new tables created with correct columns and types
- [ ] All foreign key constraints defined (cascade delete on invoice_items, recurring_template_items)
- [ ] All indexes created as specified
- [ ] TypeScript types exported for all new tables
- [ ] Drizzle migration generates and applies without errors
- [ ] Existing data unaffected — no destructive migrations

### Context Switching
- [ ] `useBillingContext` hook created with localStorage persistence
- [ ] `getDefaultMode` reads from business `primaryMode` field
- [ ] Sidebar mode toggle visible in Layout.tsx (desktop + mobile)
- [ ] Expenses mode sidebar shows correct nav items only
- [ ] Billing mode sidebar shows correct nav items only
- [ ] Switching modes preserves current route if it exists in both modes
- [ ] Mobile bottom navigation context-switches with sidebar
- [ ] All billing routes defined in App.tsx with lazy loading
- [ ] All billing routes wrapped in ProtectedRoute
- [ ] Old expense routes unaffected by context-switching

### Permissions
- [ ] New permission constants added to `src/lib/permissions.ts`
- [ ] Permissions added to DB schema (if DB-backed)
- [ ] Seed data configured for all roles
- [ ] Owner and Admin roles get all billing permissions
- [ ] Nav items filter by permissions in both modes

---

## Phase 2: Core Features

### Customer Management
- [ ] Customer list loads with paginated data
- [ ] Search filters by name, email, phone, customerNumber
- [ ] Customer creation saves all fields correctly
- [ ] Customer number auto-generates in CUST-XXXX format
- [ ] Customer update modifies saved data
- [ ] Customer soft-delete works (not visible in list, still referenced by invoices)
- [ ] Delete blocked if customer has non-void invoices
- [ ] Customer detail page shows info + invoice history + statement
- [ ] Customer detail shows aging breakdown (0-30, 31-60, 61-90, 90+)
- [ ] All endpoints filter by businessId
- [ ] Mobile: list adapts to card layout

### Invoice Management
- [ ] Invoice list loads with status filters
- [ ] Status tabs (All, Draft, Sent, Paid, Overdue, Void) filter correctly
- [ ] Status badges have correct color coding per status
- [ ] Invoice builder creates invoice with all fields
- [ ] Line items add/remove/update with real-time total recalculation
- [ ] Revenue category selector works per line item
- [ ] Invoice totals (subtotal, tax, discount, grand total) calculate correctly
- [ ] Discount (percentage and fixed) applied correctly
- [ ] Invoice number auto-generates in INV-XXXX format
- [ ] Invoice number is per-business (not global)
- [ ] Draft invoice can be edited; sent invoice cannot
- [ ] Send changes status from "draft" to "sent"
- [ ] Void with reason changes status and reverses payments
- [ ] Void reasons are logged
- [ ] Due date auto-computes from issue date + payment terms
- [ ] BalanceDue tracks correctly with partial payments
- [ ] Currency defaults to customer's preferred currency
- [ ] Search by invoice number or customer name works
- [ ] Date range filter works
- [ ] Mobile: invoice list uses card layout
- [ ] Mobile: invoice builder is scrollable with touch-friendly controls

### Invoice PDF
- [ ] PDF generates with business logo and branding info
- [ ] PDF includes customer info, invoice header, line items table
- [ ] PDF totals match invoice totals exactly (decimal.js precision)
- [ ] PDF includes payment terms and notes
- [ ] PDF includes amount in words
- [ ] Download returns valid PDF file with correct Content-Type and Content-Disposition

---

## Phase 3: Billing Operations

### Payment Recording
- [ ] Payment records against invoice update balance and status
- [ ] Full payment changes status to "paid"
- [ ] Partial payment changes status to "partial"
- [ ] Multiple partial payments accumulate correctly
- [ ] Payment amount validated against balanceDue
- [ ] Payment method maps to correct account type (cash/mpesa/bank)
- [ ] Journal entry created on payment: Dr = Cr (balanced)
- [ ] Debit account matches payment method (cash, mpesa, bank)
- [ ] Credit account matches revenue category's incomeAccountId
- [ ] Payment list filters by date range and payment method
- [ ] Payment method breakdown shows correct totals
- [ ] Payment reversal works within cancelation period
- [ ] Payment reversal reverses journal entry

### Recurring Invoice Engine
- [ ] Recurring template creates with customer, items, frequency
- [ ] Template list shows active/inactive status
- [ ] Manual trigger generates invoice immediately
- [ ] Generated invoice has correct items and totals from template
- [ ] Skip next advances due date without generating
- [ ] Daily/hourly cron generates invoices for due templates
- [ ] Next due date advances correctly after generation
- [ ] Weekly: +7 days, Monthly: +1 month, Quarterly: +3 months, Annually: +1 year
- [ ] End date respected — template deactivates after end date
- [ ] Generation log tracks all auto-generations with status
- [ ] Generation log records errors for failed generations

### Email Delivery
- [ ] Send invoice delivers email with PDF attachment
- [ ] Resend delivers to same or different email
- [ ] Payment reminder sends for overdue invoices
- [ ] Reminder schedule: 7 days → first, 14 days → second, 30+ → final
- [ ] Email log tracks delivery status (sent, delivered, bounced, failed)
- [ ] Cron-based reminders send at configured intervals
- [ ] Duplicate reminder not sent (checks existing reminders)

### Business Branding
- [ ] Business profile settings save and persist
- [ ] Logo upload works (stored as base64 or file path)
- [ ] Invoice prefix configurable (defaults to "INV")
- [ ] Invoice number start configurable (defaults to 1)
- [ ] Default tax rate applied to new invoice items
- [ ] Default payment terms configurable
- [ ] Accent color configurable and reflected in PDF

---

## Phase 4: Reports & Dashboard

### Billing Dashboard
- [ ] Revenue summary cards show correct KPIs:
  - [ ] Invoiced this month matches sum of non-void invoice totals
  - [ ] Collected this month matches sum of payments in current month
  - [ ] Outstanding matches sum of balanceDue for unpaid invoices
  - [ ] Overdue matches sum of balanceDue for past-due invoices
- [ ] Monthly revenue trend chart renders correctly (12 months)
- [ ] Recent invoices list shows last 10
- [ ] Upcoming recurring shows next 5 scheduled
- [ ] Aging summary shows correct bucket amounts

### Billing Reports
- [ ] Revenue by period groups correctly by month/quarter/year
- [ ] Revenue by period shows invoiced, collected, outstanding per period
- [ ] Customer aging report shows correct bucket amounts and counts
- [ ] Invoice status distribution shows correct count and amount by status
- [ ] Revenue by category breaks down correctly from invoice items
- [ ] All reports have date range filtering
- [ ] CSV export generates valid file with correct data
- [ ] Charts render correctly on all screen sizes

### Integration with Existing Reports
- [ ] P&L Statement includes revenue from invoice payments
- [ ] Balance Sheet shows accounts receivable (sum of balanceDue) as current asset
- [ ] Cash Flow shows incoming payments in operating cash inflows
- [ ] Reports page shows billing reports section (if user has billing data)

---

## Phase 5: Onboarding & Polish

### Business Onboarding
- [ ] Primary mode selection step in business creation flow
- [ ] Three options: Track Expenses, Send Invoices, Both
- [ ] Selection stored in businesses.primaryMode
- [ ] Existing businesses default to 'both'
- [ ] `useBillingContext` respects primaryMode on initial load
- [ ] Manual mode switch overrides primaryMode (persisted in localStorage)

### Mobile Responsiveness
- [ ] Invoice list adapts to card layout on mobile (sm breakpoint)
- [ ] Invoice builder form is scrollable with touch-friendly controls
- [ ] Customer list adapts to card layout on mobile
- [ ] Customer detail stacks cards vertically on mobile
- [ ] Billing dashboard grid becomes single column on mobile
- [ ] Reports charts stack vertically on mobile
- [ ] All dialogs are full-screen on mobile
- [ ] Touch targets at least 44px on all interactive elements
- [ ] Bottom navigation context-switches correctly
- [ ] Sidebar hamburger menu accessible on mobile

### Security
- [ ] All list endpoints filter by businessId
- [ ] All mutations require authentication
- [ ] All mutations check permissions
- [ ] Input validation on all mutations (Zod schemas)
- [ ] Rate limiting on all mutation endpoints (20-30/min)
- [ ] Sensible defaults for all optional fields
- [ ] No SQL injection vectors (parameterized queries via Drizzle)
- [ ] Decimal.js used for all financial calculations (not parseFloat)
- [ ] Multi-step operations wrapped in db.transaction()

### Testing
- [ ] Unit tests for invoice calculation utilities pass
- [ ] Unit tests for date helpers (computeDueDate, nextDateByFrequency) pass
- [ ] Integration tests for customer CRUD pass
- [ ] Integration tests for invoice lifecycle (create → send → pay → void) pass
- [ ] Integration tests for recurring engine pass
- [ ] Integration tests for payment → journal entry pass
- [ ] E2E test: create customer → create invoice → send → record payment → verify reports passes
- [ ] No test marked as mocking or skipped without explicit authorization
