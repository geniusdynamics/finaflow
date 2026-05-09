# Restaurant Cashflow MVP — Enhanced Product Specification

> **Version:** 1.1.0  
> **Status:** Draft — Enhanced based on real-world data analysis  
> **Date:** 2026-05-03  
> **Audience:** Engineering, QA, Product, Deployment Teams  

---

## Table of Contents

1. [Executive Summary: What We Learned From Real Data](#1-executive-summary-what-we-learned-from-real-data)
2. [Enhanced User Personas & Stories](#2-enhanced-user-personas--stories)
3. [Feature Decomposition (Enhanced)](#3-feature-decomposition-enhanced)
4. [MoSCoW Prioritization (Revised)](#4-moscow-prioritization-revised)
5. [Acceptance Criteria for New/Enhanced Features](#5-acceptance-criteria-for-newenhanced-features)
6. [Data Model Enhancements](#6-data-model-enhancements)
7. [M-PESA Integration Specification](#7-mpesa-integration-specification)
8. [Z-Report & Daily Sales Workflow](#8-z-report--daily-sales-workflow)
9. [Cash Reconciliation Engine](#9-cash-reconciliation-engine)
10. [Staff Settlement & Payroll Linkage](#10-staff-settlement--payroll-linkage)
11. [Receipt Photo Capture & OCR](#11-receipt-photo-capture--ocr)
12. [Assumptions, Constraints & Risks](#12-assumptions-constraints--risks)
13. [Open Questions](#13-open-questions)

---

## 1. Executive Summary: What We Learned From Real Data

### 1.1 The Reality Gap

The original MVP spec was architecturally sound but underestimated the **complexity of real-world data ingestion**. Analysis of 130 M-PESA transactions and 2 POS Z-report receipts from Karafuu Restaurant (operating Corner/Kena and Golden/Diani locations) revealed:

| Discovery | Implication for MVP |
|---|---|
| **M-PESA is only ~22% of revenue flow** | M-PESA tracks expenses, not sales. Sales flow through 5+ channels (Cash, KCB, Family Bank, Equity, COOP, Glovo, Bolt, Credit Card). |
| **Daily sales (Ksh 139K) >> M-PESA top-ups (Ksh 30K/day)** | The "inflow" side is far larger than the "reload" side. Cash reconciliation must track per-account inflows, not just M-PESA. |
| **Staff settlements are per-cashier, per-payment-method** | POS Z-reports break down each staff member's settlements by cash, bank, and delivery. This must be captured for payroll linkage. |
| **Voids and gift orders are material** | 4–14 voids + 5–14 gift orders per day per location affect net sales calculation. |
| **M-PESA SMS parsing is error-prone** | 130 transactions over 5 days = 26/day. Manual transcription into spreadsheets is the #1 source of errors. |
| **Suppliers are a mix of businesses + individuals** | 50 unique payees: 20% are formal suppliers (NAIVAS, CARREFOUR), 80% are individuals paid via M-PESA (staff, freelancers, casual labor). |

### 1.2 Key Metrics from Real Data

**M-PESA Period (25–30 April 2026):**
- Total Top-ups Loaded: **Ksh 177,840.00**
- Total Outflows: **Ksh 184,306.00**
- Transaction Fees: **Ksh 1,295.50**
- Net M-PESA Position: **Ksh -6,466.00**
- Unique Suppliers/Payees: **50**
- Transactions: **130**

**Daily Sales Sample (1–2 May 2026 Z-Reports):**
- Corner (Kena): **Ksh 43,070.00** (73 tickets, 194 orders)
- Golden (Diani): **Ksh 96,085.00** (88 tickets, 235 orders)
- **Combined: Ksh 139,155.00**

### 1.3 Critical Enhancement Themes

Based on the real data, the MVP needs **4 major enhancements** beyond the original spec:

1. **M-PESA Statement Auto-Import** — Parse M-PESA SMS/CSV to eliminate manual entry
2. **Multi-Channel Sales Entry** — Match Z-report format exactly (cash, card, bank, delivery per location)
3. **Per-Account Cash Reconciliation** — M-PESA + Cash Drawer + Bank accounts = true daily position
4. **Staff Settlement Tracking** — Link POS settlement data to payroll/advance calculations

---

## 2. Enhanced User Personas & Stories

### 2.1 Personas

| Persona | Role | Core Goal | Primary Pain Point |
|---|---|---|---|
| **Owner** | Business director | See consolidated cash position across both locations without visiting daily | Current view is 3 days behind because managers WhatsApp photos of Z-reports |
| **Admin** | Operations manager / accountant | Reconcile M-PESA, bank, and cash daily; ensure all expenses are categorized | Manually transcribing 26 M-PESA SMS messages per day into a spreadsheet |
| **Location Manager** | On-site manager (Corner or Golden) | Enter daily sales and expenses in <2 minutes on a phone | Has to take photo of Z-report, then later sit at laptop to type numbers |
| **Cashier/Staff** | POS operator | See their daily settlement total vs what the system recorded | Disputes about settlement amounts because there's no digital record per staff |

### 2.2 User Stories

#### Owner
- **US-O-01**: As an Owner, I want to see today's net cash position across all locations and accounts, so that I know if we can pay suppliers tomorrow.
- **US-O-02**: As an Owner, I want to view a 7-day trend of sales vs expenses per location, so that I can identify which location is underperforming.
- **US-O-03**: As an Owner, I want to receive an alert when M-PESA balance drops below Ksh 5,000, so that I can authorize a top-up before critical payments fail.
- **US-O-04**: As an Owner, I want to see a monthly profit/loss view (sales minus categorized expenses), so that I can report to investors.

#### Admin
- **US-A-01**: As an Admin, I want to bulk-import M-PESA transactions from a CSV or by forwarding SMS, so that I don't type 130 transactions manually.
- **US-A-02**: As an Admin, I want to categorize 50+ suppliers automatically based on name patterns, so that NAIVAS always maps to "Food Supplies" and KPLC always maps to "Utilities".
- **US-A-03**: As an Admin, I want to reconcile the M-PESA ledger against Safaricom's statement at month-end, so that I catch any missing transactions.
- **US-A-04**: As an Admin, I want to export a monthly expense report by category for KRA tax filing, so that I have compliant documentation.

#### Location Manager
- **US-M-01**: As a Location Manager, I want to snap a photo of the Z-report and have the system read the numbers, so that I don't manually type cash, card, and bank splits.
- **US-M-02**: As a Location Manager, I want to log an expense immediately after paying via M-PESA, so that I don't forget what I bought by end of day.
- **US-M-03**: As a Location Manager, I want to see today's running M-PESA balance after each expense, so that I know if I need to request more funds.
- **US-M-04**: As a Location Manager, I want to record which staff member was on the POS today, so that settlements can be tracked per person.

#### Cashier/Staff
- **US-S-01**: As a Cashier, I want to view my daily settlement breakdown (cash + M-PESA + bank), so that I can verify it matches what the POS printed.
- **US-S-02**: As a Cashier, I want to request a salary advance through the app, so that I don't have to ask the manager in person.
- **US-S-03**: As a Cashier, I want to see my remaining advance balance, so that I know how much will be deducted from my next pay.

---

## 3. Feature Decomposition (Enhanced)

### 3.1 Functional Requirements — New & Enhanced

| Feature ID | Feature Name | User Story | Description | Status (Original → Enhanced) |
|---|---|---|---|---|
| F-001 | Daily Sales Entry | US-M-01 | Enter daily sales per location with cash/card/bank/delivery breakdown | **Enhanced** — add Z-report photo upload + OCR |
| F-002 | Expense Logging | US-M-02 | Record expenses with category, supplier, receipt photo | **Enhanced** — add M-PESA auto-link |
| F-003 | Supplier Management | US-A-02 | Track supplier profiles, debts, payment terms | **Enhanced** — add auto-categorization rules |
| F-004 | M-PESA Integration | US-A-01 | Import and parse M-PESA transactions | **NEW** — not in original spec |
| F-005 | Multi-Account Ledger | US-O-01 | Track balances for Cash, M-PESA, KCB, Equity, Family, COOP | **Enhanced** — original had generic accounts; now location-specific payment accounts |
| F-006 | Cash Reconciliation | US-A-03 | Daily opening + inflows - outflows - fees = closing | **NEW** — derived from real data need |
| F-007 | Staff Settlement Tracking | US-M-04, US-S-01 | Per-staff POS settlement from Z-report | **NEW** — links to payroll |
| F-008 | Z-Report OCR | US-M-01 | Extract numbers from Z-report photo | **NEW** — Phase 2 feature, design for it now |
| F-009 | Recurring Bills | Original spec | Rent, electricity, internet scheduled bills | Unchanged |
| F-010 | Payroll Processing | Original spec | Monthly salaries, advances, deductions | **Enhanced** — link to staff settlements |
| F-011 | Unified Calendar | Original spec | Due dates for bills, payroll, supplier payments | Unchanged |
| F-012 | Dashboard & Alerts | US-O-03 | KPIs, low balance alerts, overdue warnings | **Enhanced** — add cash position alerts |
| F-013 | Audit & Soft Delete | Original spec | Immutable audit trail, soft-delete | Unchanged |
| F-014 | Role-Based Access | Original spec | Owner/Admin/Manager/Employee permissions | Unchanged |
| F-015 | Expense Category Auto-Mapping | US-A-02 | Map supplier names to categories automatically | **NEW** |
| F-016 | M-PESA SMS Forward Parsing | US-A-01 | Forward M-PESA SMS to a number/email for auto-import | **NEW** — future-proofing |

### 3.2 Non-Functional Requirements

| Dimension | Requirement | Priority |
|---|---|---|
| **Performance** | Daily sales entry < 30 seconds; M-PESA import of 30 transactions < 5 seconds | Must |
| **Performance** | Dashboard load < 2 seconds on 3G connection | Must |
| **Security** | All financial data encrypted at rest; JWT auth with 1-hour expiry | Must |
| **Security** | Manager can only view their location's data; no cross-location leakage | Must |
| **Availability** | 99.5% uptime during business hours (6 AM–11 PM EAT) | Should |
| **Scalability** | Support up to 10 locations without schema changes | Should |
| **Usability** | Works on Android 8+ phones with 2GB RAM (target device for managers) | Must |
| **Compatibility** | Web app (PWA) works on Chrome, Safari, Samsung Internet | Must |
| **Compliance** | KRA tax record retention (7 years); Kenya Data Protection Act 2019 | Must |

### 3.3 Feature Dependencies

```
F-004 (M-PESA Import)
  → F-002 (Expense Logging) [needs transactions to log against]
  → F-006 (Cash Reconciliation) [needs inflow/outflow data]
  → F-015 (Auto-Mapping) [needs supplier list from import]

F-001 (Daily Sales)
  → F-005 (Multi-Account Ledger) [sales credit accounts]
  → F-006 (Cash Reconciliation) [sales are inflows]
  → F-007 (Staff Settlements) [derived from sales data]

F-007 (Staff Settlements)
  → F-010 (Payroll) [settlements feed into advance/pay calculations]

F-005 (Multi-Account Ledger)
  → F-012 (Dashboard) [balances feed KPIs]
  → F-006 (Cash Reconciliation) [ledger is the source of truth]
```

---

## 4. MoSCoW Prioritization (Revised)

### 4.1 Priority Matrix

| Feature ID | Feature Name | Priority | Rationale |
|---|---|---|---|
| F-001 | Daily Sales Entry | **Must** | Core function; without it there is no cashflow visibility |
| F-002 | Expense Logging | **Must** | Core function; 50+ suppliers need tracking |
| F-004 | M-PESA Integration | **Must** | Real data shows 130 txns/5 days — manual entry is the #1 pain point |
| F-005 | Multi-Account Ledger | **Must** | Sales flow through 5+ channels; single M-PESA view is insufficient |
| F-006 | Cash Reconciliation | **Must** | Owner needs true daily position, not just M-PESA balance |
| F-010 | Payroll Processing | **Must** | Staff are paid via M-PESA; 80% of outflows are to individuals |
| F-014 | Role-Based Access | **Must** | Multi-location requires location-scoped permissions |
| F-013 | Audit & Soft Delete | **Must** | Financial data requires immutability and audit trail |
| F-003 | Supplier Management | **Should** | Important for payable tracking, but workaround = manual list |
| F-009 | Recurring Bills | **Should** | Rent/electricity are predictable; can be logged as regular expenses |
| F-011 | Unified Calendar | **Should** | Great for owners; dashboard alerts are a partial workaround |
| F-012 | Dashboard & Alerts | **Should** | Visualization is valuable but raw data export is workaround |
| F-007 | Staff Settlement Tracking | **Could** | Enhances payroll accuracy; manual settlement sheet is workaround |
| F-015 | Expense Category Auto-Mapping | **Could** | Saves admin time; manual categorization works for 50 suppliers |
| F-008 | Z-Report OCR | **Could** | Major UX win but photo upload + manual entry is acceptable |
| F-016 | M-PESA SMS Forward Parsing | **Won't Have** | Complex telecom integration; CSV upload covers 90% of need |

### 4.2 Release Planning

- **MVP v1.0 (Week 1–4)**: F-001, F-002, F-004, F-005, F-006, F-010, F-013, F-014
- **v1.1 (Week 5–6)**: F-003, F-009, F-011, F-012
- **v1.2 (Week 7–8)**: F-007, F-015
- **v2.0 (Future)**: F-008, F-016

---

## 5. Acceptance Criteria for New/Enhanced Features

### F-004: M-PESA Integration

**AC-F004-01: CSV Import**
Given the Admin has downloaded an M-PESA statement CSV from Safaricom
When they upload the CSV via the app
Then the system parses all rows, extracts date, amount, party, fee, and balance
And creates corresponding transactions in the ledger
And shows a summary: "130 transactions imported, 0 errors"

**AC-F004-02: Duplicate Detection**
Given a transaction with TxnID "UDP9H1ZKXB" already exists in the system
When the Admin imports a CSV containing the same TxnID
Then the system skips the duplicate
And increments a "duplicates skipped" counter in the import summary

**AC-F004-03: Partial Import Error Handling**
Given a CSV with 130 rows where 1 row has an unparseable amount
When the Admin imports the CSV
Then 129 rows are imported successfully
And 1 row is listed in an error log with the raw text and reason "Amount format not recognized"
And the Admin can manually edit and re-import the failed row

### F-006: Cash Reconciliation

**AC-F006-01: Daily Reconciliation Calculation**
Given M-PESA opening balance of Ksh 15,118.70 on 30 April 2026
And M-PESA loaded Ksh 38,830.00 that day
And M-PESA outflows of Ksh 53,618.00
And M-PESA fees of Ksh 270.00
When the Admin views the reconciliation for 30 April
Then the system displays M-PESA closing balance as Ksh 60.70
And shows a green check if this matches the last M-PESA transaction balance

**AC-F006-02: Multi-Account View**
Given Cash sales of Ksh 25,420, Bank deposits of Ksh 98,955, and Delivery collections of Ksh 3,980 on 1 May
When the Owner views the daily reconciliation
Then the system shows per-account inflows and a combined net position of Ksh 128,355

**AC-F006-03: Reconciliation Discrepancy Alert**
Given the system-calculated M-PESA closing is Ksh 60.70
And the Admin manually enters a physical count of Ksh 100.00
When the discrepancy of Ksh 39.30 exceeds the threshold of Ksh 20.00
Then the system shows a red alert: "Discrepancy detected: Ksh 39.30"
And prompts the Admin to add a note explaining the difference

### F-007: Staff Settlement Tracking

**AC-F007-01: Settlement Entry**
Given the Z-report shows Asia settled Ksh 24,850 (Cash Ksh 4,260 + Family Bank Ksh 14,840 + COOP Ksh 3,220 + Equity Ksh 900 + Glovo Ksh 1,730)
When the Manager enters the settlement breakdown per staff
Then the system stores each channel amount separately
And calculates the total settled per staff

**AC-F007-02: Settlement vs Payroll Linkage**
Given Asia's total settlement for May 1 is Ksh 24,850
And her basic monthly salary is Ksh 35,000
When the Admin processes payroll for the period
Then the system suggests an advance deduction if Asia's settlements exceed her daily prorated salary

### F-001: Daily Sales Entry (Enhanced)

**AC-F001-01: Z-Report Photo Upload**
Given the Manager has a Z-report printed on thermal paper
When they take a photo and upload it with the daily sales entry
Then the system stores the image and links it to the sales record
And displays a thumbnail in the sales list view

**AC-F001-02: Multi-Channel Breakdown Validation**
Given the Manager enters Cash Ksh 8,770 + Family Bank Ksh 23,780 + COOP Ksh 3,220 + Equity Ksh 4,520 + Glovo Ksh 2,780
When they save the entry
Then the system computes net sales as Ksh 43,070
And validates that the sum of all channels equals the ticket grand total
If not equal, show a warning: "Channel total (Ksh X) does not match grand total (Ksh Y)"

**AC-F001-03: Location Uniqueness**
Given a sales entry already exists for Corner on 2026-05-01
When the Manager tries to create a second entry for the same location and date
Then the system returns a 409 CONFLICT
And offers to "Update existing" or "Cancel"

### F-002: Expense Logging (Enhanced)

**AC-F002-01: M-PESA Auto-Link**
Given an M-PESA transaction of Ksh 2,334 paid to NAIVAS UKUNDA DIANI exists in the system
When the Manager logs an expense and selects the supplier "NAIVAS UKUNDA DIANI"
Then the system suggests the linked M-PESA transaction
And pre-fills the amount, date, and payment method

**AC-F002-02: Receipt Photo Attachment**
Given the Manager has a paper receipt from NAIVAS
When they log the expense and attach a photo
Then the system stores the image (max 5MB, JPG/PNG)
And displays it in the expense detail view with a lightbox zoom option

**AC-F002-03: Expense Category Dropdown**
Given the Manager is logging a fuel expense
When they open the category field
Then they see: Food Supplies, Beverages, Utilities, Rent, Salaries, Marketing, Maintenance, Transport, Licenses, Miscellaneous
And the system remembers their last 3 used categories for quick selection

---

## 6. Data Model Enhancements

### 6.1 New Tables

#### `mpesa_imports`
Tracks bulk M-PESA statement imports.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| location_id | BIGINT | FK → locations | Which location this import belongs to |
| import_date | TIMESTAMP | NOT NULL | When the import was performed |
| file_name | VARCHAR(255) | | Original CSV/SMS dump filename |
| total_rows | INTEGER | | Rows in the file |
| imported_rows | INTEGER | | Successfully parsed |
| error_rows | INTEGER | | Failed to parse |
| imported_by | BIGINT | FK → users | |
| status | ENUM('pending','processing','completed','failed') | | |
| created_at | TIMESTAMP | NOT NULL | |

#### `mpesa_import_errors`
Individual errors during import.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| import_id | BIGINT | FK → mpesa_imports | |
| raw_text | TEXT | | The unparseable line |
| error_reason | VARCHAR(255) | | e.g., "Amount format", "Missing date" |
| row_number | INTEGER | | Line number in source file |
| created_at | TIMESTAMP | NOT NULL | |

#### `staff_settlements`
Per-staff daily settlement from POS.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| location_id | BIGINT | FK → locations | |
| settlement_date | DATE | NOT NULL | Business date |
| employee_id | BIGINT | FK → employees | |
| cash_amount | DECIMAL(15,2) | DEFAULT 0 | |
| mpesa_amount | DECIMAL(15,2) | DEFAULT 0 | |
| card_amount | DECIMAL(15,2) | DEFAULT 0 | |
| bank_amount | DECIMAL(15,2) | DEFAULT 0 | Combined bank channels |
| delivery_amount | DECIMAL(15,2) | DEFAULT 0 | Glovo, Bolt, etc. |
| total_settled | DECIMAL(15,2) | NOT NULL | Computed sum |
| entered_by | BIGINT | FK → users | |
| created_at | TIMESTAMP | NOT NULL | |

#### `reconciliation_snapshots`
Daily account balance checkpoints.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| location_id | BIGINT | FK → locations | |
| account_id | BIGINT | FK → accounts | |
| snapshot_date | DATE | NOT NULL | |
| opening_balance | DECIMAL(15,2) | NOT NULL | |
| total_inflows | DECIMAL(15,2) | DEFAULT 0 | |
| total_outflows | DECIMAL(15,2) | DEFAULT 0 | |
| total_fees | DECIMAL(15,2) | DEFAULT 0 | |
| system_closing | DECIMAL(15,2) | NOT NULL | Computed |
| physical_count | DECIMAL(15,2) | | Manual count (NULL = not counted) |
| discrepancy | DECIMAL(15,2) | | system_closing - physical_count |
| discrepancy_note | TEXT | | Explanation |
| created_at | TIMESTAMP | NOT NULL | |

### 6.2 Enhanced Tables

#### `accounts` (Enhanced)
Add `location_id` linkage and `account_code` for mapping payment methods.

| New Column | Type | Notes |
|---|---|---|
| account_code | VARCHAR(20) | Short code: CASH, MPESA, KCB, EQUITY, FAMILY, COOP, GLOVO, BOLT, CARD |
| is_payment_method | BOOLEAN | TRUE if this account represents a sales collection channel |

#### `expenses` (Enhanced)
Add M-PESA linkage and auto-categorization.

| New Column | Type | Notes |
|---|---|---|
| mpesa_txn_id | VARCHAR(20) | FK to M-PESA transaction (optional) |
| auto_category | BOOLEAN | TRUE if category was set by auto-mapping rule |
| expense_ref | VARCHAR(50) | Internal reference for matching |

#### `daily_sales` (Enhanced)
Expand payment method columns to match Z-report.

| New Column | Type | Notes |
|---|---|---|
| family_bank_total | DECIMAL(15,2) | DEFAULT 0 |
| coop_bank_total | DECIMAL(15,2) | DEFAULT 0 |
| equity_bank_total | DECIMAL(15,2) | DEFAULT 0 |
| bolt_total | DECIMAL(15,2) | DEFAULT 0 |
| glovo_total | DECIMAL(15,2) | DEFAULT 0 |
| credit_card_total | DECIMAL(15,2) | DEFAULT 0 |
| ticket_count | INTEGER | Number of tickets |
| order_count | INTEGER | Number of orders |
| void_count | INTEGER | Voided orders |
| gift_count | INTEGER | Gift orders |
| z_report_image_url | TEXT | Path to uploaded Z-report photo |
| staff_on_duty | JSONB | Array of {employee_id, name} for the day |

---

## 7. M-PESA Integration Specification

### 7.1 Supported Import Formats

1. **Safaricom M-PESA CSV Export** (from M-PESA app or Safaricom web)
2. **Bulk SMS forward** (semi-structured text dump)
3. **Manual entry form** (fallback)

### 7.2 Parsing Rules

```
TxnID: First word (e.g., UDP9H1ZKXB)
Type detection:
  "You have received" → Top-up (positive)
  "paid to" → Expense (negative)
  "sent to" + bank/paybill → Bank Transfer (negative)
  "sent to" + individual → Transfer (negative)
  "You bought" + airtime → Airtime (negative)
  "Withdraw" → Withdrawal (negative)

Amount: Ksh([\d,]+\.\d{2})
Balance: Ksh([\d,]+\.\d{2}) after "New M-PESA balance is"
Fee: Ksh([\d,]+\.\d{2}) after "Transaction cost"
Date: on (\d{1,2}/\d{1,2}/\d{2}) at (\d{1,2}:\d{2} [AP]M)
Party: Extracted from "from X", "paid to X", "sent to X"
```

### 7.3 Auto-Categorization Rules (Seed Data)

| Supplier Name Pattern | Category |
|---|---|
| NAIVAS | Food Supplies |
| CARREFOUR | Food Supplies |
| GRAND PETROLEUM, SHELL | Fuel |
| KPLC | Utilities |
| SAFARICOM DATA, DATA BUNDLE | Airtime/Data |
| CO-OPERATIVE BANK, EQUITY, KCB, FAMILY BANK, NBK | Bank Transfer |
| SPIRO EV | Fuel |

---

## 8. Z-Report & Daily Sales Workflow

### 8.1 Entry Flow

```
1. Manager takes photo of Z-report thermal paper
2. Manager opens "Daily Sales" screen
3. Selects location and date
4. Either:
   a. Types numbers from Z-report (MVP)
   b. Uploads photo (v1.1) — system stores image
   c. OCR auto-extracts (v2.0) — system fills fields
5. Enters: Cash, Bank splits, Card, Delivery, Voids, Gifts
6. System validates: sum of channels = grand total
7. System auto-creates ledger entries per account
8. Manager confirms and submits
```

### 8.2 Validation Rules

- `UNIQUE(location_id, sale_date)` — one entry per location per day
- `CHECK(sale_date <= CURRENT_DATE)` — no future sales
- `CHECK(net_sales >= 0)` — sales cannot be negative
- `CHECK(sum(channels) == grand_total)` — channels must reconcile (warning, not blocking)

---

## 9. Cash Reconciliation Engine

### 9.1 Per-Account Formula

```
Closing Balance = Opening Balance
                + Sales Inflows (to this account)
                + Transfers In (to this account)
                - Expense Outflows (from this account)
                - Transfer Outflows (from this account)
                - Fees (from this account)
```

### 9.2 Daily Reconciliation Checklist

For each location, each business day:
- [ ] M-PESA system closing matches last transaction balance
- [ ] Cash drawer physical count matches cash sales minus cash expenses
- [ ] Bank deposit slip total matches bank sales minus bank transfers
- [ ] Delivery partner payout matches delivery collections
- [ ] Any discrepancy > Ksh 500 flagged for review

---

## 10. Staff Settlement & Payroll Linkage

### 10.1 Settlement → Payroll Flow

```
Daily Settlement (per staff)
  → Sum for pay period = Gross handled
  → Compare to basic salary prorated per day
  → If gross handled > prorated salary × 2 → flag for advance check
  → If gross handled < prorated salary × 0.5 → flag for underperformance
```

### 10.2 Advance Logic

- Cashiers can request advances up to 50% of prorated monthly salary
- Advances are deducted from next payroll period
- Settlement data provides evidence of cash handling responsibility

---

## 11. Receipt Photo Capture & OCR

### 11.1 MVP (v1.0)
- Upload JPG/PNG, max 5MB
- Store on local filesystem or S3-compatible
- Display thumbnail in list, lightbox on click
- No OCR — manual transcription required

### 11.2 v1.1 Enhancement
- Extract total amount from receipt using OCR
- Suggest supplier name from OCR text
- Pre-fill expense form fields

### 11.3 v2.0 Enhancement
- Full receipt parsing: supplier, items, amounts, date
- Auto-match against M-PESA transaction
- Flag if receipt total ≠ M-PESA amount

---

## 12. Assumptions, Constraints & Risks

### 12.1 Assumptions

- Managers have smartphones with cameras and 3G/4G data
- Safaricom provides CSV export of M-PESA statements
- Z-reports are printed on thermal paper and legible for photos
- Staff have Kenya national IDs and KRA PINs for payroll
- Each location has a reliable POS system that produces Z-reports

### 12.2 Constraints

- **Currency**: KES only; no multi-currency support in MVP
- **Locations**: Starting with 2, architecture supports up to 10
- **M-PESA**: Only Safaricom M-PESA; Airtel Money not in scope
- **Devices**: Web PWA, not native iOS/Android apps
- **Offline**: No offline mode in MVP; internet required for data entry

### 12.3 Risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| M-PESA CSV format changes | High | Medium | Build parser with fallback to raw text; monitor Safaricom updates |
| Z-report thermal paper fades before photo | Medium | High | Prompt managers to photo immediately; store digital backup |
| Staff share phones (multiple users) | Medium | Medium | Enforce login per session; auto-logout after 15 min idle |
| Mobile data costs deter daily entry | High | Medium | Optimize PWA < 1MB per page load; consider offline-first in v1.2 |
| Duplicate M-PESA transactions on re-import | Medium | Medium | TxnID-based deduplication; show import preview before commit |
| Manager enters wrong location for transaction | High | Low | Default to assigned location; require confirmation for other |

---

## 13. Open Questions

- [ ] **Q1**: Can we get API access from Safaricom M-PESA for real-time transaction webhooks, or is CSV the only route?
- [ ] **Q2**: Does the POS system (Khaos/Positouch) support digital Z-report export (PDF/CSV), or is thermal paper the only output?
- [ ] **Q3**: Should staff settlements be entered daily per shift, or only when there is a staff change during the day?
- [ ] **Q4**: How should we handle "gift orders" in the ledger — are they promotional expenses or revenue recognition adjustments?
- [ ] **Q5**: What is the opening balance for each account on Day 1 — do we need a data migration from the existing Excel?
- [ ] **Q6**: Should the Owner receive daily summary via WhatsApp/SMS, or only in-app notifications?
- [ ] **Q7**: Are there any county health permit or license expenses that need renewal reminders?

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Z-Report** | End-of-day POS summary printed on thermal paper showing sales, payment splits, voids, and staff settlements |
| **M-PESA** | Safaricom mobile money platform; primary payment rail for Kenyan businesses |
| **Top-up** | Loading money into an M-PESA account, typically from a bank |
| **Settlement** | The process of reconciling a cashier's handled transactions against the POS total |
| **TxnID** | Unique transaction identifier from M-PESA (e.g., UDP9H1ZKXB) |
| **PWA** | Progressive Web App; runs in browser but behaves like a native app |
| **Soft Delete** | Marking a record as deleted without removing it from the database |

## Appendix B: Reference Documents

- Original Comprehensive Spec: `restaurant_cashflow_mvp_COMPREHENSIVE_SPEC.md`
- Original MVP Spec: `spec.md`
- Task Tracking: `tasks.md`
- Verification Checklist: `checklist.md`
- M-PESA Transaction Register (Excel): `Karafuu_Advanced_Transaction_Register.xlsx`
