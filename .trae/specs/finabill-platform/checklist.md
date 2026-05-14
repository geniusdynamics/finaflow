# FinaBill Platform - Verification Checklist

> **Project location**: `d:\DevCenter\abuilds\fina\finabill\` — sibling to `finaflow/`

## Phase 1: Foundation

### Monorepo Setup
- [ ] `/finabill/` project root exists with `package.json`, `tsconfig.json`, `.gitignore`
- [ ] Vite + React dev server starts without errors at configured URL
- [ ] Hono.js + tRPC API server starts without errors
- [ ] Path aliases resolve correctly in all sub-projects
- [ ] Tailwind CSS compiles with FinaFlow's color palette
- [ ] ESLint + Prettier configs pass on all files

### Shared Library
- [ ] `@finabill/shared` package builds without errors
- [ ] All type definitions export correctly from package entry point
- [ ] Zod validation schemas correctly validate valid/invalid inputs
- [ ] `calculateGrandTotal` returns correct totals with tax and discount
- [ ] `formatCurrency` handles edge cases (zero, negative, large numbers)
- [ ] `nextDateByFrequency` correctly computes next dates for weekly/monthly/quarterly/annually
- [ ] `isOverdue` correctly identifies past-due invoices
- [ ] `generateInvoiceNumber` produces correct sequential format
- [ ] Both FinaBill and FinaFlow can import from `@finabill/shared`

### Database Schema
- [ ] All 10 tables created with correct columns and types
- [ ] All enum types defined (invoiceStatus, paymentMethod, frequency, reminderType, emailStatus, emailType)
- [ ] Foreign key constraints exist on all relational columns
- [ ] All indexes created as specified
- [ ] Drizzle migration generates and applies without errors
- [ ] Seed script populates default revenue categories

## Phase 2: Core Features

### Customer Management
- [ ] Customer list page loads with paginated data
- [ ] Search filters by name, email, phone, customer number
- [ ] Customer creation saves all fields correctly
- [ ] Customer update modifies saved data
- [ ] Customer soft-delete works (not visible in list, still referenced by invoices)
- [ ] Customer detail page shows info + invoice history + statement
- [ ] Customer number auto-generates in CUST-XXXX format
- [ ] Delete blocked if customer has non-void invoices

### Invoice Management
- [ ] Invoice list loads with status filters
- [ ] Status tabs (All, Draft, Sent, Paid, Overdue, Void) filter correctly
- [ ] Invoice builder creates invoice with all fields
- [ ] Line items add/remove/update with real-time total recalculation
- [ ] Invoice totals (subtotal, tax, discount, grand total) calculate correctly
- [ ] Discount (percentage and fixed) applied correctly
- [ ] Invoice number auto-generates in INV-XXXX format
- [ ] Draft invoice can be edited; sent invoice cannot
- [ ] Send changes status from "draft" to "sent"
- [ ] Void with reason changes status and reverses payments
- [ ] Due date auto-computes from issue date + payment terms
- [ ] Balance tracks correctly with partial payments

### Invoice PDF
- [ ] PDF generates with business logo and branding
- [ ] PDF includes customer info, invoice header, line items table
- [ ] PDF totals match invoice totals
- [ ] PDF includes payment terms and notes
- [ ] Download returns valid PDF file

## Phase 3: Billing Operations

### Payment Recording
- [ ] Payment records against invoice update balance and status
- [ ] Full payment changes status to "paid"
- [ ] Partial payment changes status to "partial"
- [ ] Multiple partial payments accumulate correctly
- [ ] Payment list filters by date range and payment method
- [ ] Payment method breakdown shows correct totals

### Recurring Invoice Engine
- [ ] Recurring template creates with customer, items, frequency
- [ ] Template list shows active/inactive status
- [ ] Manual trigger generates invoice immediately
- [ ] Skip next advances due date without generating
- [ ] Daily cron job generates invoices for due templates
- [ ] Generated invoice has correct items and totals from template
- [ ] Next due date advances correctly after generation
- [ ] Generation log tracks all auto-generations

### Email Delivery
- [ ] Send invoice delivers email with PDF attachment
- [ ] Resend delivers to same or different email
- [ ] Payment reminder sends for overdue invoices
- [ ] Email log tracks delivery status
- [ ] Cron-based reminders send at configured intervals

### Revenue Reporting
- [ ] Revenue by period groups correctly by month/quarter/year
- [ ] Customer aging report shows correct bucket amounts
- [ ] Invoice status distribution chart shows correct counts
- [ ] Revenue by category breaks down correctly
- [ ] Customer statement shows all invoices with balances
- [ ] CSV export generates valid file with correct data

## Phase 4: Integration

### FinaFlow Integration Router
- [ ] FinaBill payment sync creates correct journal entry in FinaFlow
- [ ] Journal entry is balanced (Dr = Cr)
- [ ] Cash account selected matches payment method
- [ ] Revenue account selected matches invoice revenue category
- [ ] API key verification returns correct business context
- [ ] Batch reconciliation endpoint compares totals correctly

### FinaBill Integration Client
- [ ] API connection validated with test button
- [ ] Payment recording triggers auto-sync to FinaFlow
- [ ] Error handling: if sync fails, payment still records locally
- [ ] Integration settings saved and persisted

### Shared Library in FinaFlow
- [ ] FinaFlow imports and uses shared types
- [ ] Shared Zod schemas validate correctly in FinaFlow endpoints
- [ ] Shared currency utilities used consistently

## Phase 5: Polish & UI

### Business Branding
- [ ] Business profile settings save and persist
- [ ] Logo upload works and renders on invoices
- [ ] Invoice prefix and numbering configured in settings
- [ ] Default tax rate applied to new invoice items
- [ ] Branding settings reflected in PDF invoices

### Dashboard
- [ ] Revenue summary cards show correct KPI values
- [ ] Recent invoices list shows last 10
- [ ] Upcoming recurring shows next 5 scheduled
- [ ] Aging summary shows correct bucket amounts
- [ ] Revenue trend chart renders correctly

### Layout & Navigation
- [ ] Sidebar navigation matches FinaFlow pattern
- [ ] All nav links resolve to correct routes
- [ ] Active link highlighted correctly
- [ ] Mobile hamburger menu works
- [ ] Business selector dropdown works
- [ ] User avatar and logout in sidebar footer

### Mobile Responsiveness
- [ ] Invoice list adapts to card layout on mobile
- [ ] Invoice builder form is scrollable on small screens
- [ ] Customer list search works on mobile
- [ ] All dialogs are full-screen on mobile
- [ ] Touch targets are at least 44px (accessibility standard)
- [ ] Sidebar collapses to hamburger on mobile

### Security
- [ ] All list endpoints filter by businessId
- [ ] All mutations require authentication
- [ ] API key stored securely (not in frontend code)
- [ ] PDF generation doesn't expose internal file paths
- [ ] Email addresses validated before sending
- [ ] Input sanitization on all user-facing fields
- [ ] Rate limiting on email sending endpoints

### Testing
- [ ] All unit tests pass
- [ ] Invoice lifecycle integration test passes (create → send → pay → void)
- [ ] Recurring engine integration test passes
- [ ] FinaFlow sync integration test passes
- [ ] E2E critical flow test passes
