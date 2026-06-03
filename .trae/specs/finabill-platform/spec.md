# FinaBill Platform — Specification

> **Project Location**: `d:\DevCenter\abuilds\fina\finabill\` — sibling directory to FinaFlow
> **Architecture**: Standalone application — NOT embedded in FinaFlow
> **Integration**: Bi-directional API sync with FinaFlow via integration page
> **Future**: FinaGen — unified platform combining FinaFlow + FinaBill + Inventory
> **Spec Status**: Living document

---

## Executive Summary

FinaBill is a standalone business operations platform purpose-built for **invoicing, billing, customer management, subscriptions, time tracking, and revenue operations**. It is the receivables/income counterpart to FinaFlow (which handles expenses/payables/cashflow).

Rather than forcing billing features into FinaFlow (which would create an unwieldy accounting system), FinaBill lives as its own application with its own identity, UI, and database — connected to FinaFlow through a clean integration API.

### The Fina Ecosystem

```
                    FINAGEN
  (Future — Complete end-to-end platform)

   [FinaFlow]  ←API→  [FinaBill]        +      [Inventory]
   Expenses            Billing                   Warehouses
   Payables            Invoicing                 Orders
   Cashflow            Customers
   Payroll             Subs/TT
   COA/Journal         Catalog
```

---

## Platform Architecture

### Repository Structure

```
d:\DevCenter\abuilds\fina\finabill\
├── apps/web/                    # Vite + React 19 + TypeScript
│   └── src/
│       ├── pages/               # Route pages
│       ├── components/          # Shared components
│       ├── features/            # Feature components
│       ├── hooks/               # Custom hooks
│       ├── lib/                 # Utilities
│       └── providers/           # tRPC, auth
├── api/                         # Hono.js + tRPC
│   ├── routers/                 # One per module
│   ├── middleware/              # Auth, rate-limit, audit
│   ├── lib/                     # Business logic
│   └── cron/                    # Scheduled tasks
├── db/                          # Drizzle ORM
│   ├── schema.ts                # All tables
│   ├── migrations/              # Generated
│   ├── seed.ts                  # Seed data
│   └── connection.ts            # DB pool
├── packages/shared/             # @finabill/shared
│   └── src/                    # types, schemas, utils
├── scripts/
├── package.json
├── tsconfig.json
├── AGENTS.md
└── .env.example
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Hono.js + tRPC |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (httpOnly cookies) |
| Payments | Stripe |
| Email | Resend / SendGrid |
| PDF | pdfkit |
| Charts | Recharts |
| UI | Tailwind CSS + shadcn/ui |
| Color Palette | Blue accent (#2563EB), cool grays |

---

## Feature Catalogue — Complete Field-Level UI Specifications

### Customers Module

#### Customer Form Fields

**Header Section**
- Customer Type: `Business` | `Individual` (radio toggle)
- Salutation: dropdown (Mr, Ms, Mrs, Dr, etc.)
- First Name: text input
- Last Name: text input
- Company Name: text input
- Display Name: text/autocomplete — _'Select or type to add'_

**Contact Section**
- Email Address: email input
- Phone: tel input
- Work Phone: tel input
- Mobile: tel input
- Customer Language: dropdown (English, Swahili, etc.)

**Other Details Section** (collapsible)
- Remarks: textarea
- Tax Rate: dropdown (or link to create tax group in Settings)
- Company ID: text input
- Currency: dropdown
- Payment Terms: dropdown (Due on Receipt, Net 15, Net 30, Net 60)
- Enable Portal?: toggle — _'Allow portal access for this customer'_

**Documents Section**
- File upload: drag-and-drop area, max 10 files, 10MB each

**Tabbed Sections** (below main form):

##### Address Tab
- **Billing Address**
  - Attention: text
  - Country/Region: autocomplete
  - Address Street 1: text
  - Address Street 2: text
  - City: text
  - State: autocomplete
  - ZIP Code: text
  - Phone: tel
  - Fax Number: tel
- **Shipping Address** (same fields, collapsible with toggle: Same as Billing)
- Note: _'Add and manage additional addresses from this Customer details section.'_

##### Contact Persons Tab
- Table: Salutation | First Name | Last Name | Email Address | Work Phone | Mobile | Delete
- Add row button

##### Custom Fields Tab
- _'Start adding custom fields for your Customers by going to Settings > Preferences > Customers.'_

##### Reporting Tags Tab
- _'You've not created any Reporting Tags. Start creating by going to More Settings > Reporting Tags.'_

---

### Product Catalogue — Items

#### Item Form

**Basic Section**
- Name: text (required)
- Type: `Goods` | `Service` (radio toggle)
- Unit: dropdown (pieces, hours, kg, box, etc.) with autocomplete
- Image: drag-and-drop upload area

**Sales Information Section**
- Selling Price: decimal input with currency selector
- Account: dropdown — **full Chart of Accounts tree** (all account types and sub-types)
- Description: textarea
- Tax: dropdown (tax rates, or link to Settings for tax groups)

---

### Plans & Addons

#### Plan Form

**Basic Section**
- Product: dropdown (with inline popup dialog to create new product)
- Plan Name: text
- Plan Code: text (auto-generated or manual)
- Billing Frequency: number input + period dropdown (Day(s) / Week(s) / Month(s) / Year(s))
- Billing Cycles: number (0 = unlimited)
- Plan Description: textarea (max 2000 chars)
- Image: drag-and-drop upload

**Pricing Section**
- Pricing Model: dropdown (Flat Fee, Per Unit, Tiered, Volume)
- Unit Name: text (if per-unit pricing)
- Price: decimal with currency selector
- Billing: `/unit /month` display (dynamic based on frequency)
- Free Trial: number (Days)
- Setup Fee: decimal

**Type & Tax Section**
- Type: `Goods` | `Service` (radio)
- Sales Tax: dropdown — _'Add tax to your Plan or Addon. Use tax group for more than one tax.'_

**Hosted Payment Pages & Portal Section**
- Configure how the plan appears on customer-facing portals

**Other Details Section**
- Additional settings (collapsible)

#### New Product Dialog (Inline popup inside Plans)

| Field | Type |
|-------|------|
| Name | text |
| Description | textarea |
| Email Notification Recipients | email list |
| Redirection URL | URL with placeholder insert: `https://yourredirecturl.com?planname=%PlanName%` |
| Auto-Generate Subscription Numbers | toggle |

#### Addon Form

**Basic Section**
- Product: dropdown
- Addon Name: text
- Addon Code: text
- Addon Description: textarea
- Addon Type: `One-time` | `Recurring` (radio)
- Pricing Interval: dropdown (if recurring)
- Image: upload

**Pricing Section**
- Pricing Model: dropdown
- Unit Name: text
- Price: decimal with currency
- Billing: `/unit /month` (dynamic)

**Type & Tax Section**
- Type: `Goods` | `Service`
- Sales Tax: dropdown

**Plans Section**
- Associate with specific plans (multi-select)

**Hosted Payment Pages & Portal Section**

**Other Details Section**

#### Coupon Form

**Basic Section**
- Product: dropdown
- Coupon Name: text
- Coupon Code: text (auto or manual)
- Discount: decimal with currency — or percentage toggle
- Redemption Type: dropdown (One Time, Multiple Times, Unlimited)

**Applicability Section**
- Applicability: `All Plans` | `Specific Plans` | `Specific Addons`
- Associate Plans: multi-select (if specific)
- Associate Addons: multi-select (if specific)

---

### Sales — Quotes

#### Quote Builder

**Header**
- Customer Name: autocomplete/search with inline create customer dialog
- Quote#: auto QOT-XXXXXX (read-only)
- Quote Date: datepicker
- Expiry Date: datepicker (default: +30 days)
- Salesperson: dropdown
- Subject: text — _'Let your customer know what this Quote is for'_

**Item Table** (draggable rows for reordering)
| Field | Type |
|-------|------|
| Item Details | autocomplete from catalogue + description |
| Quantity | number |
| Rate | decimal (auto-filled from item/price list) |
| Tax | dropdown (auto-filled from item) |
| Amount | computed (read-only) |

**Footer**
- Customer Notes: textarea — _'Will be displayed on the quote'_
- Sub Total: computed
- Discount: percentage input + fixed input → computed amount
- Shipping Charges: decimal
- Adjustment: decimal (+ or -)
- Total: computed
- Terms & Conditions: textarea — _'Enter the terms and conditions of your business'_
- Attach File(s): drag-drop, max 10 files, 10MB each

---

### Sales — Invoices

#### Invoice Builder

**Header**
- Customer Name: autocomplete/search with inline create customer dialog
- Invoice#: auto INV-000001 (read-only)
- Order Number: text (optional reference)
- Invoice Date: datepicker
- Terms: dropdown (Due on Receipt, Net 15, Net 30, Net 60)
- Due Date: auto-computed from Terms, or manual override
- Salesperson: dropdown
- Subject: text — _'Let your customer know what this Invoice is for'_

**Item Table** (draggable rows for reordering)
| Field | Type |
|-------|------|
| Item Details | autocomplete from catalogue + description |
| Quantity | number (default 1.00) |
| Rate | decimal (auto-filled from item/price list) |
| Tax | dropdown (auto-filled) |
| Amount | computed (read-only) |

**Footer**
- Customer Notes: textarea — _'Thanks for your business. Will be displayed on the invoice'_
- Sub Total: computed
- Discount: percentage input + fixed input → computed amount
- Shipping Charges: decimal
- Adjustment: decimal (+ or -)
- Total: computed (with currency label)
- Terms & Conditions: textarea
- Attach File(s): drag-drop, max 10 files, 10MB each

**Payment Gateway Prompt**
- _'Want to get paid faster? Configure payment gateways and receive payments online.'_ → [Set up Payment Gateway] link

**Additional Fields Link**
- _'Start adding custom fields by going to Settings > Sales > Invoices.'_

---

### Sales — Sales Receipts

#### Sales Receipt Form

**Header**
- Customer Name: autocomplete
- Receipt Date: datepicker
- Sales Receipt#: auto SR-00001 (read-only)
- Salesperson: dropdown

**Item Table**
| Field | Type |
|-------|------|
| Item Details | autocomplete from catalogue |
| Quantity | number |
| Rate | decimal |
| Tax | dropdown |
| Amount | computed |

**Footer**
- Notes: textarea
- Sub Total | Discount | Shipping Charge | Adjustment | Total
- Terms & Conditions: textarea
- Attach File(s): max **5 files**, 10MB each

**Payment Details Section** (below items)
- Payment Mode: dropdown (Cash, M-PESA, Bank Transfer, Card, Stripe)
- Deposit To: dropdown (settlement account from COA)

---

### Sales — Credit Notes

#### Credit Note Form

**Header**
- Customer Name: autocomplete
- Credit Note#: auto CN-00001 (read-only)
- Reference#: text (optional reference to original invoice)
- Credit Note Date: datepicker
- Salesperson: dropdown
- Subject: text — _'Let your customer know what this Credit Note is for'_

**Item Table**
| Field | Type |
|-------|------|
| Item Details | autocomplete from catalogue |
| **Account** | dropdown — **full Chart of Accounts tree** listing all accounts, sub-types, and names |
| Quantity | number |
| Rate | decimal |
| Tax | dropdown |
| Amount | computed |

- Customer Notes: textarea
- Sub Total | Discount | Shipping Charges | Adjustment | Total
- Terms & Conditions: textarea
- Additional Fields link

---

### Payments — Payments Received

#### Payment Received Form

**Header**
- Customer Name: autocomplete
- Amount Received: decimal
- Bank Charges: decimal (if any)
- Payment Date: datepicker
- Payment#: auto PAY-XXXXX (read-only)

**Payment Details Section**
- Payment Mode: dropdown (Cash, M-PESA, Bank Transfer, Card, Stripe)
- Deposit To: dropdown (settlement account from COA)
- Reference#: text (M-PESA code, cheque no., transaction ID)

**Tax Deduction Section**
- Tax deducted?: `No Tax deducted` | `Yes, TDS` (radio)
- TDS fields appear if Yes

**Unpaid Invoices Table**
| Column | Description |
|--------|-------------|
| Date | invoice date |
| Invoice Number | linked invoice |
| Invoice Amount | grand total |
| Amount Due | balance due |
| Payment Received On | datepicker |
| Payment | decimal input |

- _'List contains only SENT invoices'_
- _'There are no unpaid invoices associated with this customer.'_ (empty state)
- **Total** row at bottom

**Summary Section** (computed)
- Amount Received: (from header)
- Amount used for Payments: (sum of payments applied)
- Amount Refunded: decimal
- Amount in Excess: computed (Received - Used - Refunded)

**Internal Notes & Attachments**
- Notes: textarea — _'Internal use. Not visible to customer'_
- Attachments: max **5 files**, 5MB each

**Additional Fields link** → _'Settings > Sales > Payments Received'_

---

### Time Tracking — Projects

#### Project Form

**Basic Section**
- Project Name: text
- Project Code: text (auto or manual)
- Customer Name: autocomplete
- Billing Method: dropdown (Flat Fee, Hourly, Non-Billable)
- Description: textarea (max 2000 chars)

**Budget Section**
- Cost Budget: decimal (AFN) — maximum cost allowed
- Revenue Budget: decimal (AFN) — expected revenue

**Users Section** (table)
| S.No | User | Email | Remove |
|------|------|-------|--------|
| 1 | dropdown | auto-filled | button |

- Add User button

**Project Tasks Section**
- _'Import project tasks from existing projects'_ link
| S.No | Task Name | Description | Billable (toggle) | Remove |
|------|-----------|-------------|--------------------|--------|
| 1 | text | text | checkbox | button |

**Watchlist Option**
- 'Add to the watchlist on my dashboard' checkbox

---

### Time Tracking — Timesheets

#### Log Timesheet Entry (Inline Dialog)

- Shortcut: `C + T` keys for quick entry
- Date: datepicker (default: today)
- Project Name: dropdown
- Task Name: dropdown (from project tasks)
- Time Spent: HH:MM input
- Billable: toggle
- User: dropdown (default: current user)
- Notes: textarea

---

### Events

#### Activity Log

A chronological log of all system actions:
- Item added, customer created, customer subscribed
- Invoice created, invoice sent, invoice paid, invoice voided
- Payment recorded, payment refunded
- Quote created, accepted, declined, converted
- Subscription started, paused, resumed, canceled
- Plan/addon/coupon created or modified
- User login/logout
- Integration sync events

Display: list view with timestamp, action type, actor, details
Filterable by: date range, action type, actor, entity type

---

## Reports Catalogue — Complete 72 Reports

Reports are organized into **15 categories**. Each report has a name, category, and is system-generated. The report viewer has: date range, filters, compare-with (previous period), and customizable columns.

### Report Viewer Layout

```
┌─────────────────────────────────────────────────────────┐
│  Category: [Sales ▼]                                    │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Report Name            Category    By   Visited   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Sales by Customer      Sales       System   -    ►│ │
│  │  Sales by Item          Sales       System   -    ►│ │
│  │  Sales Summary          Sales       System   -    ►│ │
│  │  ...                                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  [Clicking a report opens the viewer]                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Sales by Customer                                 │ │
│  │  From [01 Jun 2026] To [30 Jun 2026]               │ │
│  │                                                     │ │
│  │  Filters: Date Range ▼  Entities: All ▼ More ▼     │ │
│  │  Compare With: [None ▼]  Customize Columns [4]     │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │  There were no sales during the selected      │  │ │
│  │  │  date range.                                  │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Report Categories and Reports

#### Sales (7 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 1 | Sales by Customer | Sales totals grouped by customer |
| 2 | Sales by Item | Sales totals grouped by item/product |
| 3 | Sales by Plan | Sales/subscription revenue by plan |
| 4 | Sales by Addon | Addon revenue breakdown |
| 5 | Sales by Coupon | Discount usage and impact |
| 6 | Sales by Sales Person | Sales performance by user |
| 7 | Sales Summary | Aggregated sales summary |

#### Receivables (7 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 8 | AR Aging Summary | Accounts receivable aging buckets |
| 9 | AR Aging Details | Detailed aging per invoice |
| 10 | Invoice Details | All invoice data |
| 11 | Bad Debts | Uncollectible receivables |
| 12 | Customer Balance Summary | Customer-wise balance totals |
| 13 | Receivable Summary | Aggregated receivable totals |
| 14 | Receivable Details | Detailed receivable per entity |

#### Acquisition Insights (5 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 15 | Active Trials | Currently active trial subscriptions |
| 16 | Inactive Trials | Expired/canceled trials |
| 17 | Trial to Live Conversions | Trial → paid conversion tracking |
| 18 | Average Sales Cycle Length | Time from lead to customer |
| 19 | Lost Opportunities | Quotes declined or expired |

#### Signups & Activations (2 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 20 | Signups | New customer signups over time |
| 21 | Activations | Activated customers (first payment) |
| 22 | Activations By Country | Geographic activation breakdown |

#### Subscriptions (7 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 23 | Active Subscriptions | Currently active subscription count |
| 24 | Net Customers | Net customer growth |
| 25 | Subscription Details | Per-subscription data |
| 26 | Upgrades | Plan upgrade tracking |
| 27 | Downgrades | Plan downgrade tracking |
| 28 | Summary | Subscription KPIs |
| 29 | ARPU | Average Revenue Per User |
| 30 | LTV | Lifetime Value estimation |

#### Revenue (3 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 31 | Net Revenue | Total revenue net of discounts/refunds |
| 32 | Revenue By Country | Geographic revenue breakdown |
| 33 | Revenue Retention Cohort | Cohort-based retention analysis |

#### Retention (4 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 34 | Revenue Retention Cohort | Revenue retained over time by cohort |
| 35 | Revenue Retention Rate | Percentage of revenue retained |
| 36 | Renewal Summary | Subscription renewal rates |
| 37 | Renewal Failures | Failed renewals |
| 38 | Subscription Retention Rate | Subscriber retention rate |

#### MRR & ARR (3 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 39 | MRR | Monthly Recurring Revenue |
| 40 | ARR | Annual Recurring Revenue |
| 41 | MRR Quick Ratio | (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR) |

#### Churn (6 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 42 | Under Risk | Subscriptions at risk of churning |
| 43 | Non Renewing Profiles | Profiles not renewing |
| 44 | Churned After Retries | Churned despite payment retries |
| 45 | Churned Subscriptions | All churned subscriptions |
| 46 | Subscription Expiry | Subscriptions due to expire |
| 47 | Net Cancellations | Cancellation net of reactivations |

#### Churn Insights (5 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 48 | Net Cancellations | Detailed net cancellation metrics |
| 49 | Churn Rate | Customer churn percentage |
| 50 | Cancellations by Country | Geographic churn breakdown |
| 51 | Cancellations by Product | Product-level churn analysis |
| 52 | Revenue Churn | Revenue lost to churn |

#### Payments Received (6 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 53 | Payments Received | All payments with details |
| 54 | Time to Get Paid | Days from invoice to payment |
| 55 | Credit Note Details | Credit note usage |
| 56 | Refund History | All refunds and reversals |
| 57 | Payment Failures | Failed payment attempts |
| 58 | Card Expiry | Credit cards nearing expiry |

#### Purchases and Expenses (5 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 59 | Expense Details | All expense entries |
| 60 | Expenses by Category | Expense totals per category |
| 61 | Expenses by Customer | Customer-linked expenses |
| 62 | Expenses by Project | Project-linked expenses |
| 63 | Billable Expense Details | Billable expense breakdown |

#### Taxes (1 report)
| # | Report Name | Description |
|---|-------------|-------------|
| 64 | Tax Summary | Tax collected and owed |

#### Projects and Timesheet (4 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 65 | Timesheet Details | All time entries |
| 66 | Project Summary | Project-level KPIs |
| 67 | Project Details | Per-project detailed data |
| 68 | Projects Revenue Summary | Revenue vs cost per project |

#### Activity (5 reports)
| # | Report Name | Description |
|---|-------------|-------------|
| 69 | System Mails | Email delivery logs |
| 70 | Activity Logs | All system events |
| 71 | Exception Report | System errors and exceptions |
| 72 | Portal Activities | Customer portal interactions |
| 73 | Customer Reviews | Customer feedback |
| 74 | API Usage | API call volume and performance |

**Total: 74 reports across 15 categories.**

Reports will be built incrementally over time, with placeholders for unimplemented reports showing an appropriate empty state.

---

## UI Design Philosophy

### Core Principles

FinaBill's UI is intentionally different from FinaFlow.

| Principle | Description |
|-----------|-------------|
| **Inline Forms** | Forms render inline on the page, NOT in modals/dialogs. Create/edit happens without overlays. |
| **Tabbed Detail Sections** | Customer detail uses tabs (Address, Contact Persons, Custom Fields, Reporting Tags) |
| **Bento Grid Layout** | Dashboard uses asymmetric grid |
| **Searchable Dropdowns** | All entity selectors use autocomplete with 'type to search' |
| **Draggable Item Rows** | Item tables support drag-to-reorder |
| **Inline Item Lines** | Adding items to invoices/quotes happens inline, not in a modal |
| **Dynamic Totals** | All financial fields recalculate in real-time |
| **Empty States** | Every list/table has a helpful empty state message |
| **Collapsible Sections** | Optional details collapse by default (Other Details) |
| **Keyboard Shortcuts** | `C + T` for quick timesheet entry, `⌘K` for global search |
| **Inline Entity Creation** | Customer/Product dialogs open inline within the parent form |
| **Status Badges** | Color-coded badges for all status fields |
| **Responsive** | Full mobile support with stacked layouts |

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#F8F9FA` | Page backgrounds |
| Surface | `#FFFFFF` | Cards, forms |
| Text Primary | `#1A1A2E` | Headings, body |
| Text Secondary | `#6B7280` | Labels, captions |
| Accent | `#2563EB` | Primary buttons, links |
| Accent Hover | `#1D4ED8` | Hover states |
| Success | `#059669` | Paid, active |
| Warning | `#D97706` | Partial, pending |
| Danger | `#DC2626` | Overdue, void, failed |
| Border | `#E5E7EB` | Dividers, inputs |
| Muted | `#9CA3AF` | Disabled, hints |

---

## Database Schema (Complete)

### customers
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
| email | varchar(255) | |
| phone | varchar(50) | |
| workPhone | varchar(50) | |
| mobile | varchar(50) | |
| language | varchar(10) | |
| billingAddress | jsonb | attention, country, street1, street2, city, state, zip, phone, fax |
| shippingAddress | jsonb | same structure |
| paymentTerms | varchar(20) | due_on_receipt, net15, net30, net60 |
| creditLimit | decimal(15,2) | |
| currency | varchar(3) DEFAULT 'KES' | |
| taxRate | decimal(5,2) | |
| taxExempt | boolean DEFAULT false | |
| companyId | varchar(50) | business registration |
| remarks | text | |
| enablePortal | boolean DEFAULT false | |
| portalPasswordHash | varchar(255) | |
| isActive | boolean DEFAULT true | |
| linkedFinaflowId | int | integration FK |
| externalId | varchar(255) | |
| externalSystem | varchar(50) | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

### customers_contact_persons
| Column | Type |
|--------|------|
| id | serial PK |
| customerId | int FK→customers |
| salutation | varchar(10) |
| firstName | varchar(100) |
| lastName | varchar(100) |
| email | varchar(255) |
| workPhone | varchar(50) |
| mobile | varchar(50) |

### items
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
| incomeAccountId | int FK→chart_of_accounts | **full COA selection** |
| taxRate | decimal(5,2) | |
| taxId | int FK→taxes | |
| isTrackable | boolean DEFAULT false | inventory |
| imageUrl | text | |
| isActive | boolean DEFAULT true | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

### plans
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
| imageUrl | text |
| pricingModel | varchar(20) | flat_fee, per_unit, tiered, volume |
| unitName | varchar(50) |
| price | decimal(15,2) |
| currency | varchar(3) |
| freeTrialDays | int DEFAULT 0 |
| setupFee | decimal(15,2) DEFAULT 0 |
| type | varchar(10) | goods, service |
| salesTaxId | int FK→taxes |
| isActive | boolean DEFAULT true |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

### products
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(200) |
| description | text |
| emailNotificationRecipients | text |
| redirectUrl | text |
| autoGenerateSubscriptionNumbers | boolean DEFAULT true |

### addons
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| productId | int FK→products |
| name | varchar(200) |
| code | varchar(50) |
| description | text |
| addonType | varchar(10) | one_time, recurring |
| pricingInterval | varchar(10) | if recurring |
| imageUrl | text |
| pricingModel | varchar(20) |
| unitName | varchar(50) |
| price | decimal(15,2) |
| currency | varchar(3) |
| type | varchar(10) | goods, service |
| salesTaxId | int FK→taxes |
| isActive | boolean DEFAULT true |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

### addon_plan_links
| Column | Type |
|--------|------|
| id | serial PK |
| addonId | int FK→addons |
| planId | int FK→plans |

### coupons
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| name | varchar(200) |
| code | varchar(50) UNIQUE |
| discountType | varchar(10) | percentage, flat |
| discountValue | decimal(15,2) |
| currency | varchar(3) |
| redemptionType | varchar(20) | one_time, multiple, unlimited |
| maxRedemptions | int |
| currentRedemptions | int DEFAULT 0 |
| applicability | varchar(20) | all, specific_plans, specific_addons |
| expiresAt | date |
| isActive | boolean DEFAULT true |
| createdAt | timestamptz |

### quotes
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerId | int FK→customers | |
| quoteNumber | varchar(20) UNIQUE | QOT-XXXXXX |
| status | varchar(20) | draft, sent, accepted, declined, expired, converted |
| issueDate | date | |
| expiryDate | date | |
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

### invoices
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| businessId | int FK→businesses | |
| customerId | int FK→customers | |
| invoiceNumber | varchar(20) UNIQUE | INV-XXXXXX |
| orderNumber | varchar(50) | optional |
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
| sourceType | varchar(20) | |
| sourceId | int | |
| voidReason | text | |
| voidedAt | timestamptz | |
| gatewaySetupPrompted | boolean DEFAULT false | |
| createdBy | int FK→users | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz | |

### invoice_items
| Column | Type |
|--------|------|
| id | serial PK |
| invoiceId | int FK→invoices (cascade) |
| lineNumber | int |
| itemId | int FK→items (nullable) |
| description | text NOT NULL |
| quantity | decimal(15,2) DEFAULT 1 |
| rate | decimal(15,2) |
| taxRate | decimal(5,2) |
| taxAmount | decimal(15,2) |
| amount | decimal(15,2) |
| sortOrder | int | for drag-reorder |

### sales_receipts
Same structure as invoices but with:
| Column | Type |
|--------|------|
| receiptNumber | varchar(20) UNIQUE | SR-XXXXXX |
| paymentMode | varchar(20) |
| depositToAccountId | int FK→chart_of_accounts |
| paymentDetails | jsonb | payment method, reference |

### credit_notes
Same structure as invoices but with:
| Column | Type |
|--------|------|
| creditNoteNumber | varchar(20) UNIQUE | CN-XXXXXX |
| referenceNumber | varchar(50) |
| linkedInvoiceId | int FK→invoices |
| remainingCredit | decimal(15,2) |

### credit_note_items
Same as invoice_items but with:
| Column | Type |
|--------|------|
| accountId | int FK→chart_of_accounts | **full COA** |

### payments
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| customerId | int FK→customers |
| paymentNumber | varchar(20) UNIQUE | PAY-XXXXX |
| amountReceived | decimal(15,2) |
| bankCharges | decimal(15,2) DEFAULT 0 |
| paymentDate | date |
| paymentMode | varchar(20) |
| depositToAccountId | int FK→chart_of_accounts |
| reference | varchar(255) |
| taxDeducted | boolean DEFAULT false |
| tdsAmount | decimal(15,2) |
| amountUsed | decimal(15,2) DEFAULT 0 | applied to invoices |
| amountRefunded | decimal(15,2) DEFAULT 0 |
| amountInExcess | decimal(15,2) GENERATED | amountReceived - amountUsed - amountRefunded |
| notes | text |
| stripePaymentIntentId | varchar(255) |
| createdBy | int FK→users |
| createdAt | timestamptz |

### payment_applications
| Column | Type |
|--------|------|
| id | serial PK |
| paymentId | int FK→payments |
| invoiceId | int FK→invoices |
| amount | decimal(15,2) |

### projects
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
| startDate | date |
| endDate | date |
| createdAt | timestamptz |
| updatedAt | timestamptz |
| deletedAt | timestamptz |

### project_tasks
| Column | Type |
|--------|------|
| id | serial PK |
| projectId | int FK→projects |
| name | varchar(200) |
| description | text |
| isBillable | boolean DEFAULT true |
| sortOrder | int |

### project_users
| Column | Type |
|--------|------|
| id | serial PK |
| projectId | int FK→projects |
| userId | int FK→users |

### timesheet_entries
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| projectId | int FK→projects |
| taskId | int FK→project_tasks |
| userId | int FK→users |
| date | date |
| timeSpent | int | minutes |
| isBillable | boolean DEFAULT true |
| notes | text |
| isApproved | boolean DEFAULT false |
| approvedBy | int FK→users |
| approvedAt | timestamptz |
| invoicedToInvoiceId | int FK→invoices |
| createdAt | timestamptz |

### events
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| actionType | varchar(50) | customer.created, invoice.paid, etc. |
| entityType | varchar(20) | customer, invoice, subscription, etc. |
| entityId | int | |
| actorId | int FK→users |
| details | jsonb | change details |
| createdAt | timestamptz |

### subscriptions
| Column | Type |
|--------|------|
| id | serial PK |
| businessId | int FK→businesses |
| customerId | int FK→customers |
| planId | int FK→plans |
| productId | int FK→products |
| status | varchar(20) | active, paused, past_due, canceled, expired |
| currentPeriodStart | date |
| currentPeriodEnd | date |
| trialEnd | date |
| cancelledAt | timestamptz |
| cancellationReason | text |
| pausedAt | timestamptz |
| pauseResumeAt | date |
| addonIds | jsonb | linked addons |
| couponId | int FK→coupons |
| stripeSubscriptionId | varchar(255) |
| metadata | jsonb | usage, custom fields |
| createdAt | timestamptz |
| updatedAt | timestamptz |

---

## API Router Structure

```
api/
├── index.ts
├── middleware/
│   ├── auth.ts
│   ├── rate-limit.ts
│   ├── audit.ts
│   └── subscription-gate.ts
├── routers/
│   ├── auth-router.ts
│   ├── customers-router.ts         # + contact persons, addresses
│   ├── items-router.ts
│   ├── price-lists-router.ts
│   ├── products-router.ts          # NEW — for plan products
│   ├── quotes-router.ts
│   ├── invoices-router.ts
│   ├── sales-receipts-router.ts
│   ├── credit-notes-router.ts
│   ├── plans-router.ts
│   ├── addons-router.ts
│   ├── coupons-router.ts
│   ├── subscriptions-router.ts
│   ├── payments-router.ts          # + payment_applications
│   ├── payment-links-router.ts
│   ├── expenses-router.ts
│   ├── expense-categories-router.ts
│   ├── projects-router.ts
│   ├── project-tasks-router.ts     # NEW
│   ├── timesheets-router.ts
│   ├── events-router.ts            # NEW — activity log
│   ├── reports-router.ts           # 74 reports, single router
│   ├── dashboard-router.ts
│   ├── documents-router.ts
│   ├── email-router.ts
│   ├── integration-router.ts
│   └── settings-router.ts
├── lib/
│   ├── pdf-generator.ts
│   ├── email.ts
│   ├── stripe.ts
│   ├── invoice-calc.ts
│   ├── subscription-engine.ts
│   ├── reports/                    # NEW — one file per report category
│   │   ├── sales.ts
│   │   ├── receivables.ts
│   │   ├── subscriptions.ts
│   │   ├── mrr-arr.ts
│   │   ├── churn.ts
│   │   ├── retention.ts
│   │   ├── payments.ts
│   │   ├── expenses.ts
│   │   ├── projects.ts
│   │   └── activity.ts
│   └── integrations/
│       ├── finaflow-client.ts
│       └── customer-matcher.ts
├── cron/
│   ├── recurring-invoices.ts
│   ├── payment-reminders.ts
│   ├── dunning.ts
│   └── integration-sync.ts
```

---

## Phase Plan

### Phase 1: Foundation — Monorepo & Auth
- Project scaffold, DB foundation, auth, UI foundation (sidebar, palette, inline forms)
- Shared library

### Phase 2: Core CRM & Sales
- Customers (full: type, contacts, addresses, tabs, tags, custom fields)
- Items (with COA account selection)
- Quotes, Invoices, Sales Receipts, Credit Notes
- PDF generation for all documents

### Phase 3: Payments & Expenses
- Payments Received (with TDS, excess tracking, unpaid invoices table)
- Payment Links
- Simplified expenses + recurring expenses

### Phase 4: Subscriptions & Recurring
- Products (inline dialog), Plans, Addons, Coupons
- Subscriptions engine (Stripe, dunning, proration)
- Hosted payment pages

### Phase 5: Time Tracking & Projects
- Projects (with budgets, tasks, users, watchlist)
- Timesheets (C+T shortcut, weekly grid, approval)

### Phase 6: Reports (Build Incrementally)
- Report viewer framework (date range, filters, compare, customize)
- Build incrementally — start with Sales + Receivables, then add categories
- Placeholder states for unimplemented reports
- Full 74-report roadmap with 15 categories

### Phase 7: Integration & Polish
- FinaFlow integration (smart customer matching, payment sync, expense sync)
- Events/activity log
- Documents & email
- Settings & branding
- Mobile optimization

### Phase 8: FinaGen Vision
- Inventory, warehouses, orders
- Unified platform merger

---

## Key Design Decisions

1. **Standalone Application** — FinaBill is its own app. Too many features to embed.

2. **Inline Forms Everywhere** — All create/edit operations happen inline on the page. No modal dialogs for primary actions.

3. **Full COA Selection on Items & Credit Notes** — Items link to an income account. Credit note items link to any COA account. This mirrors real accounting workflows.

4. **Tabbed Customer Detail** — Address, Contact Persons, Custom Fields, and Reporting Tags are tabs within the customer record, not separate pages.

5. **74 Reports, Built Incrementally** — Reports have a common viewer framework. Each report is a plugin. Start with Sales and Receivables, add more over time.

6. **Smart Integration** — Email-based customer matching between FinaBill and FinaFlow. If same email exists → Connect. If not → Try.

7. **Free Tier is Real** — 50/month limits on documents, 1 user, no subscriptions, no multi-currency. Genuinely useful, intentionally limited.

8. **Events Log Everything** — All system actions create an event entry. Activity reports, exception tracking, and audit all derive from the same events table.

9. **Drag-to-Reorder Item Lines** — Item tables in quotes/invoices support drag reordering. sortOrder column in schema.

10. **FinaGen is the North Star** — All data models designed for eventual unification.
