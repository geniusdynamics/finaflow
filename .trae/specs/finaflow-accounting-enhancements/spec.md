# FinaFlow Accounting Enhancements Specification

## Why

FinaFlow currently provides cashflow tracking with an enhanced single-entry ledger system, but lacks proper accounting features required by businesses for financial reporting, tax compliance, and integration with external accounting systems (QuickBooks, ERPNext). This spec details the database schema enhancements, accounting infrastructure, and UI improvements needed to support proper double-entry bookkeeping, asset management, and financial reporting while maintaining the simplicity that makes FinaFlow accessible to non-accountants.

## What Changes

### Database Schema Enhancements
- Enhance `accounts` table to support full Chart of Accounts with account classification hierarchy
- Create new `items` table for inventory, fixed assets, and services with accounting linkages
- Create `journal_entries` and `journal_lines` tables for proper double-entry bookkeeping
- Create `revenue_categories` table for FinaBill revenue classification (future implementation note)
- Create `fixed_asset_depreciation` table for automated depreciation tracking
- Add accounting classification fields to `expense_categories`
- Add external system sync fields to key tables for QuickBooks/ERPNext integration

### API Layer Enhancements
- Add journal entry creation/update/posting endpoints
- Add account classification management endpoints
- Add item management endpoints (inventory and fixed assets)
- Add financial report generation endpoints
- Add chart of accounts listing and management endpoints
- Add external system sync configuration endpoints

### UI Enhancements
- Enhance Accounts page with account classification display and filtering
- Add new "Chart of Accounts" management page
- Add "Items" page for inventory and fixed asset management
- Enhance expense creation UI with asset flag and category classification
- Add "Journal Entries" page for manual journal entries
- Add "Asset Register" page for fixed asset tracking and depreciation
- Add "Reports" section with P&L, Balance Sheet, and Trial Balance views

### Business Logic Enhancements
- Implement automatic journal entry creation for expense/asset purchases
- Implement depreciation calculation engine (straight-line and declining balance)
- Implement account balance calculation respecting account classification
- Implement trial balance generation
- Implement income statement (P&L) generation
- Implement balance sheet generation
- Implement contra-account handling (Accumulated Depreciation, etc.)

## Impact

- **Affected specs**: This extends the existing Restaurant Cashflow MVP spec with proper accounting capabilities
- **Affected code**: 
  - `db/schema.ts` - New tables and column additions
  - `api/accounts-router.ts` - Enhanced account management
  - `api/expenses-router.ts` - Asset flag handling and journal creation
  - `api/journal-router.ts` (NEW) - Journal entry management
  - `api/items-router.ts` (NEW) - Item/inventory management
  - `api/reports-router.ts` (NEW) - Financial report generation
  - `api/sync-router.ts` (NEW) - External system sync
  - `src/pages/Accounts.tsx` - Enhanced with classification display
  - `src/pages/Expenses.tsx` - Enhanced with asset flag
  - `src/pages/ChartOfAccounts.tsx` (NEW) - COA management UI
  - `src/pages/Items.tsx` (NEW) - Inventory/assets UI
  - `src/pages/JournalEntries.tsx` (NEW) - Journal entry UI
  - `src/pages/AssetRegister.tsx` (NEW) - Fixed asset tracking
  - `src/pages/Reports.tsx` (NEW) - Financial reports

## FinaBill Integration Notes (Future Implementation)

The following tables and structures are defined now to support FinaBill when it becomes implemented:

### FinaBill-Related Tables (Defined Now, Implemented Later)
- `customers` - Customer management for invoicing
- `customer_invoices` - Invoice header for customer bills
- `invoice_items` - Line items for customer invoices
- `invoice_payments` - Payments received against invoices
- `invoice_reminders` - Automated reminder tracking
- `recurring_invoice_templates` - Template for recurring billing

### FinaBill Revenue Flow
When FinaBill is implemented, the `revenue_categories` table will be used to classify invoice line items. Each invoice will create journal entries:
1. At invoice creation: Dr Accounts Receivable, Cr Revenue (by category)
2. At payment: Dr Cash/Bank, Cr Accounts Receivable

### Shared Accounting Infrastructure
Both FinaFlow and FinaBill will share:
- `accounts` (Chart of Accounts)
- `journal_entries` and `journal_lines`
- `items` (for services/products sold)
- `revenue_categories`
- `expense_categories`
- Financial reporting engine

---

## ADDED Requirements

### Requirement: Enhanced Chart of Accounts

The system SHALL provide a complete Chart of Accounts structure with hierarchical classification supporting the five accounting account types: Assets, Liabilities, Equity, Revenue, and Expenses.

#### Scenario: Account Classification
- **WHEN** an admin creates a new account
- **THEN** they MUST select an account type (asset, liability, equity, revenue, expense)
- **AND** they MUST select a subtype appropriate to the account type
- **AND** the system assigns or validates an account code
- **AND** the account appears in the appropriate section of financial reports

#### Scenario: Account Hierarchy
- **WHEN** a user views the Chart of Accounts
- **THEN** accounts are grouped by type with subtotals displayed
- **AND** contra accounts (e.g., Accumulated Depreciation) show as negative balances
- **AND** parent-child account relationships are visually indicated

### Requirement: Item Management

The system SHALL provide item management for inventory products, fixed assets, and services with proper accounting linkages.

#### Scenario: Fixed Asset Creation from Expense
- **WHEN** a user creates an expense and marks it as "Fixed Asset"
- **THEN** the system creates an item record with itemType='fixed_asset'
- **AND** the item is linked to the expense account and a fixed asset account
- **AND** the item appears in the Asset Register
- **AND** the expense does NOT appear in the P&L expense report

#### Scenario: Inventory Item Creation
- **WHEN** a user creates an inventory item
- **THEN** they MUST specify income account (revenue) and expense account (COGS)
- **AND** they MAY specify stock tracking fields (unit cost, reorder level)
- **AND** the item can be used in both FinaFlow (for purchases) and FinaBill (for sales)

#### Scenario: Service Item Creation
- **WHEN** a user creates a service item
- **THEN** they MUST specify the income account for revenue recognition
- **AND** the item can be used in FinaBill invoices (future)

### Requirement: Double-Entry Journal System

The system SHALL provide proper double-entry bookkeeping through journal entries that maintain balanced debits and credits.

#### Scenario: Automatic Journal Entry from Expense
- **WHEN** an expense is recorded
- **THEN** the system creates a journal entry with:
  - A DEBIT line to the expense category's default account
  - A CREDIT line to the payment method's cash/bank account
- **AND** the journal entry is marked as posted automatically
- **AND** the entry links to the expense record for audit trail

#### Scenario: Manual Journal Entry
- **WHEN** a user creates a manual journal entry
- **THEN** they MUST provide at least two line items
- **AND** total debits MUST equal total credits (balanced entry)
- **AND** the entry is saved as draft until explicitly posted
- **AND** posted entries CANNOT be edited (only reversed)

#### Scenario: Journal Entry Reversal
- **WHEN** a user needs to correct a posted journal entry
- **THEN** they create a new reversal entry referencing the original
- **AND** debit/credit amounts are swapped
- **AND** the reversal entry is marked with reversalOf reference
- **AND** both entries appear in reports with reversal indicator

### Requirement: Fixed Asset Depreciation

The system SHALL automatically calculate and record depreciation for fixed assets.

#### Scenario: Straight-Line Depreciation
- **WHEN** a fixed asset has depreciationMethod='straight_line'
- **THEN** monthly depreciation = (purchasePrice - salvageValue) / usefulLifeMonths
- **AND** the system generates depreciation journal entries monthly
- **AND** accumulated depreciation account is credited
- **AND** depreciation expense account is debited
- **AND** current book value is updated in the asset record

#### Scenario: Declining Balance Depreciation
- **WHEN** a fixed asset has depreciationMethod='declining_balance'
- **THEN** annual depreciation = currentBookValue × (2 / usefulLifeYears)
- **AND** the system generates monthly depreciation journal entries
- **AND** depreciation is calculated on remaining book value each period

#### Scenario: Asset Disposal
- **WHEN** a fixed asset is disposed of
- **THEN** the system creates journal entries to:
  - Remove the asset cost from the asset account
  - Remove accumulated depreciation
  - Record cash received (if any) or loss on disposal
- **AND** the asset is marked as disposed with disposal date recorded

### Requirement: Expense Category Accounting Classification

The system SHALL allow expense categories to be classified for proper P&L grouping.

#### Scenario: Category Classification
- **WHEN** an admin creates or edits an expense category
- **THEN** they MUST select an accounting classification:
  - 'cogs' - Cost of Goods Sold (appears below gross profit)
  - 'operating_expense' - Operating expenses (appears in operating income section)
  - 'admin_expense' - Administrative expenses
  - 'marketing' - Marketing and advertising expenses
  - 'depreciation' - Depreciation and amortization
  - 'other' - Other expenses
- **AND** they MAY link to a specific account code for external sync
- **AND** the classification affects P&L report grouping

### Requirement: Financial Reports

The system SHALL generate standard financial reports from journal entry data.

#### Scenario: Income Statement (P&L)
- **WHEN** a user requests an income statement for a period
- **THEN** the system displays:
  - Revenue grouped by revenue category
  - Cost of Goods Sold (from cogs-classified expenses)
  - **Gross Profit** = Revenue - COGS
  - Operating Expenses (grouped by classification)
  - **Operating Income** = Gross Profit - Operating Expenses
  - Other Income and Expenses
  - **Net Income** = Operating Income + Other Income - Other Expenses

#### Scenario: Balance Sheet
- **WHEN** a user requests a balance sheet as of a date
- **THEN** the system displays:
  - **Assets** (Current assets followed by Fixed assets, net of depreciation)
  - **Liabilities** (Current liabilities followed by Long-term liabilities)
  - **Equity** (Capital + Net Income - Drawings)
  - **Total Liabilities + Equity** (must equal Total Assets)

#### Scenario: Trial Balance
- **WHEN** a user requests a trial balance
- **THEN** the system displays all accounts with debit or credit balances
- **AND** total debits MUST equal total credits
- **AND** only posted journal entries are included

#### Scenario: Asset Register Report
- **WHEN** a user requests the asset register
- **THEN** the system displays all fixed assets with:
  - Original cost, date placed in service
  - Depreciation method and useful life
  - Accumulated depreciation to date
  - Current book value
  - Monthly depreciation amount

### Requirement: External System Sync Configuration

The system SHALL provide configuration for syncing data with external accounting systems.

#### Scenario: QuickBooks Integration Setup
- **WHEN** an admin configures QuickBooks sync
- **THEN** they can map FinaFlow accounts to QuickBooks account IDs
- **AND** they can map expense categories to QuickBooks expense codes
- **AND** the system stores these mappings in account.externalId and category.externalAccountCode

#### Scenario: ERPNext Integration Setup
- **WHEN** an admin configures ERPNext sync
- **THEN** they can map FinaFlow accounts to ERPNext account codes
- **AND** the system stores these mappings for future sync operations

---

## MODIFIED Requirements

### Requirement: Daily Sales Recording

The system SHALL create journal entries for daily sales that properly credit revenue accounts.

#### Scenario: Sales with Revenue Classification
- **WHEN** daily sales are recorded
- **THEN** the system creates journal entries with:
  - CREDIT entries to the revenue accounts for each sales channel
  - DEBIT entries to the respective cash/bank/mpesa accounts
- **AND** revenue is categorized by sales type (food, beverage, delivery)
- **AND** entries appear in the P&L under appropriate revenue categories

### Requirement: Expense Recording

The system SHALL create balanced journal entries for all expenses, with optional fixed asset treatment.

#### Scenario: Expense vs Fixed Asset
- **WHEN** an expense is created with amount > configurable threshold (default KSh 50,000)
- **THEN** the system prompts: "Should this be treated as a Fixed Asset?"
- **IF** user selects Yes:
  - A fixed asset item is created
  - Journal entry debits the fixed asset account
  - The expense does NOT appear in P&L
- **IF** user selects No:
  - Journal entry debits the expense category's account
  - The expense appears in P&L under the category's classification

### Requirement: Bill Payments

The system SHALL create journal entries for bill payments that properly record the accounts payable reduction.

#### Scenario: Bill Payment Journal Entry
- **WHEN** a bill payment is recorded
- **THEN** the system creates journal entries with:
  - DEBIT to Accounts Payable (bills account)
  - CREDIT to the payment source account (cash/bank/mpesa)
- **AND** the entry links to the bill payment record

### Requirement: Account Balance Display

The system SHALL display account balances respecting account type conventions.

#### Scenario: Balance by Account Type
- **WHEN** an account balance is displayed
- **THEN** asset accounts show positive balances as DEBIT (normal balance)
- **AND** liability accounts show positive balances as CREDIT (normal balance)
- **AND** equity accounts show positive balances as CREDIT (normal balance)
- **AND** revenue accounts show positive balances as CREDIT (increases with credits)
- **AND** expense accounts show positive balances as DEBIT (increases with debits)

---

## Database Schema Changes

### New Enums

```typescript
// Account type classification
export const accountTypeEnum = pgEnum("accountType", [
  "asset", "liability", "equity", "revenue", "expense"
]);

// Account subtypes
export const accountSubTypeEnum = pgEnum("accountSubType", [
  // Assets
  "cash", "bank", "accounts_receivable", "inventory", "prepaid_expense",
  "fixed_asset", "accumulated_depreciation", "intangible_asset", "other_asset",
  // Liabilities
  "accounts_payable", "accrued_expense", "current_loan", "long_term_loan",
  // Equity
  "capital", "retained_earnings", "drawings", "current_year_earnings",
  // Revenue
  "sales_revenue", "service_revenue", "subscription_revenue", "other_income",
  // Expenses
  "cogs", "operating_expense", "admin_expense", "marketing_expense", "depreciation_expense"
]);

// Item type classification
export const itemTypeEnum = pgEnum("itemType", [
  "inventory", "fixed_asset", "service", "non_inventory"
]);

// Depreciation method
export const depreciationMethodEnum = pgEnum("depreciationMethod", [
  "straight_line", "declining_balance"
]);

// Accounting classification for expense categories
export const accountingClassEnum = pgEnum("accountingClass", [
  "cogs", "operating_expense", "admin_expense", "marketing", "depreciation", "other"
]);

// Revenue category types
export const revenueCategoryTypeEnum = pgEnum("revenueCategoryType", [
  "product_sales", "service_revenue", "subscription", "membership", "other"
]);
```

### Table: accounts (ENHANCED)

```typescript
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }),
  businessId: bigint("businessId", { mode: "number" }),
  
  // Basic info
  name: varchar("name", { length: 100 }).notNull(),
  accountCode: varchar("accountCode", { length: 20 }).unique(),
  description: text("description"),
  
  // Classification (Chart of Accounts)
  accountType: accountTypeEnum("accountType").notNull(),
  accountSubType: accountSubTypeEnum("accountSubType"),
  
  // Balance tracking
  openingBalance: numeric("openingBalance", { precision: 15, scale: 2 }).default("0.00"),
  currentBalance: numeric("currentBalance", { precision: 15, scale: 2 }).default("0.00"),
  
  // Hierarchy
  isContra: boolean("isContra").default(false),
  parentAccountId: bigint("parentAccountId", { mode: "number" }),
  
  // External sync
  externalId: varchar("externalId", { length: 255 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  
  // Existing fields preserved
  type: typeEnum("type").notNull(), // cash, mpesa, bank_account (legacy)
  accountNumber: varchar("accountNumber", { length: 100 }),
  isPaymentMethod: boolean("isPaymentMethod").default(false),
  isActive: boolean("isActive").default(true),
  
  // Standard fields
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  accountCodeIdx: uniqueIndex("idx_accounts_code").on(table.accountCode),
  accountTypeIdx: index("idx_accounts_type").on(table.accountType),
  businessIdx: index("idx_accounts_business").on(table.businessId),
}));
```

### Table: items (NEW)

```typescript
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  locationId: bigint("locationId", { mode: "number" }),
  
  // Item details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 50 }).unique(),
  
  // Classification
  itemType: itemTypeEnum("itemType").notNull(),
  
  // Accounting linkages
  incomeAccountId: bigint("incomeAccountId", { mode: "number" }),
  expenseAccountId: bigint("expenseAccountId", { mode: "number" }),
  assetAccountId: bigint("assetAccountId", { mode: "number" }),
  
  // Fixed asset fields
  isFixedAsset: boolean("isFixedAsset").default(false),
  purchaseDate: date("purchaseDate"),
  purchasePrice: numeric("purchasePrice", { precision: 15, scale: 2 }),
  usefulLifeMonths: integer("usefulLifeMonths"),
  depreciationMethod: depreciationMethodEnum("depreciationMethod"),
  salvageValue: numeric("salvageValue", { precision: 15, scale: 2 }).default("0.00"),
  accumulatedDepreciation: numeric("accumulatedDepreciation", { precision: 15, scale: 2 }).default("0.00"),
  currentBookValue: numeric("currentBookValue", { precision: 15, scale: 2 }),
  disposalDate: date("disposalDate"),
  disposalValue: numeric("disposalValue", { precision: 15, scale: 2 }),
  notes: text("notes"),
  
  // Inventory fields
  unitCost: numeric("unitCost", { precision: 15, scale: 2 }),
  unitPrice: numeric("unitPrice", { precision: 15, scale: 2 }),
  currentStock: numeric("currentStock", { precision: 15, scale: 2 }).default("0"),
  reorderLevel: numeric("reorderLevel", { precision: 15, scale: 2 }),
  
  // Tax
  taxRate: numeric("taxRate", { precision: 5, scale: 2 }),
  
  // External sync
  externalId: varchar("externalId", { length: 255 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  
  // Standard fields
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  skuIdx: uniqueIndex("idx_items_sku").on(table.sku),
  businessIdx: index("idx_items_business").on(table.businessId),
  itemTypeIdx: index("idx_items_type").on(table.itemType),
}));
```

### Table: journal_entries (NEW)

```typescript
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  entryNumber: varchar("entryNumber", { length: 50 }).unique(),
  entryDate: date("entryDate").notNull(),
  description: text("description").notNull(),
  reference: varchar("reference", { length: 100 }),
  
  // Source tracking
  sourceType: varchar("sourceType", { length: 50 }),
  // 'invoice' | 'payment' | 'expense' | 'journal' | 'depreciation' | 'payroll' | 'sales' | 'asset_disposal'
  sourceId: bigint("sourceId", { mode: "number" }),
  
  // Status
  isPosted: boolean("isPosted").default(false),
  postedBy: bigint("postedBy", { mode: "number" }),
  postedAt: timestamp("postedAt"),
  
  // Reversal
  isReversed: boolean("isReversed").default(false),
  reversedBy: bigint("reversedBy", { mode: "number" }),
  reversalOf: bigint("reversalOf", { mode: "number" }),
  
  // External sync
  externalId: varchar("externalId", { length: 255 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  
  // Audit
  createdBy: bigint("createdBy", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  entryNumberIdx: uniqueIndex("idx_journal_entry_number").on(table.entryNumber),
  entryDateIdx: index("idx_journal_entry_date").on(table.entryDate),
  sourceIdx: index("idx_journal_entry_source").on(table.sourceType, table.sourceId),
  businessIdx: index("idx_journal_entry_business").on(table.businessId),
}));
```

### Table: journal_lines (NEW)

```typescript
export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: bigint("journalEntryId", { mode: "number" }).notNull(),
  accountId: bigint("accountId", { mode: "number" }).notNull(),
  
  debit: numeric("debit", { precision: 15, scale: 2 }).default("0.00"),
  credit: numeric("credit", { precision: 15, scale: 2 }).default("0.00"),
  
  description: text("description"),
  lineNumber: integer("lineNumber"),
  
  // Standard fields
  createdAt: timestamp("createdAt").defaultNow(),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  journalIdx: index("idx_journal_line_entry").on(table.journalEntryId),
  accountIdx: index("idx_journal_line_account").on(table.accountId),
}));
```

### Table: revenue_categories (NEW)

```typescript
export const revenueCategories = pgTable("revenue_categories", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  
  // Accounting
  incomeAccountId: bigint("incomeAccountId", { mode: "number" }),
  accountCode: varchar("accountCode", { length: 20 }),
  
  // For reporting
  categoryType: revenueCategoryTypeEnum("categoryType").default("other"),
  
  // External mapping
  externalId: varchar("externalId", { length: 255 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  businessIdx: index("idx_revenue_category_business").on(table.businessId),
}));
```

### Table: fixed_asset_depreciation (NEW)

```typescript
export const fixedAssetDepreciation = pgTable("fixed_asset_depreciation", {
  id: serial("id").primaryKey(),
  itemId: bigint("itemId", { mode: "number" }).notNull(),
  journalEntryId: bigint("journalEntryId", { mode: "number" }),
  
  periodYear: integer("periodYear").notNull(),
  periodMonth: integer("periodMonth").notNull(),
  
  depreciationAmount: numeric("depreciationAmount", { precision: 15, scale: 2 }).notNull(),
  accumulatedAfter: numeric("accumulatedAfter", { precision: 15, scale: 2 }).notNull(),
  bookValueAfter: numeric("bookValueAfter", { precision: 15, scale: 2 }).notNull(),
  
  isPosted: boolean("isPosted").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
}, (table) => ({
  itemIdx: index("idx_depreciation_item").on(table.itemId),
  periodIdx: index("idx_depreciation_period").on(table.periodYear, table.periodMonth),
  itemPeriodIdx: uniqueIndex("idx_depreciation_item_period").on(table.itemId, table.periodYear, table.periodMonth),
}));
```

### Table: expense_categories (ENHANCED)

```typescript
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  locationId: bigint("locationId", { mode: "number" }),
  
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#C73E1D"),
  
  // Accounting classification
  accountingClass: accountingClassEnum("accountingClass").notNull().default("operating_expense"),
  defaultAccountId: bigint("defaultAccountId", { mode: "number" }),
  
  // External mapping
  externalAccountCode: varchar("externalAccountCode", { length: 50 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  businessIdx: index("idx_expense_category_business").on(table.businessId),
}));
```

### Table: financial_reports (NEW)

```typescript
export const financialReports = pgTable("financial_reports", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  
  reportType: varchar("reportType", { length: 50 }).notNull(),
  // 'income_statement' | 'balance_sheet' | 'cash_flow' | 'trial_balance' | 'asset_register'
  
  periodStart: date("periodStart").notNull(),
  periodEnd: date("periodEnd").notNull(),
  
  reportData: json("reportData").notNull(),
  reportMetadata: json("reportMetadata"),
  
  generatedBy: bigint("generatedBy", { mode: "number" }),
  generatedAt: timestamp("generatedAt").defaultNow(),
}, (table) => ({
  businessIdx: index("idx_financial_report_business").on(table.businessId),
  typePeriodIdx: index("idx_financial_report_type_period").on(table.reportType, table.periodStart, table.periodEnd),
}));
```

### Table: external_sync_config (NEW)

```typescript
export const externalSyncConfig = pgTable("external_sync_config", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  
  systemName: varchar("systemName", { length: 50 }).notNull(),
  // 'quickbooks' | 'erpnext' | 'sage' | 'xero'
  
  config: json("config").notNull(),
  // API keys, endpoints, sync preferences
  
  lastSyncAt: timestamp("lastSyncAt"),
  syncStatus: varchar("syncStatus", { length: 20 }).default("idle"),
  // 'idle' | 'syncing' | 'error'
  
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  businessSystemIdx: uniqueIndex("idx_sync_config_business_system").on(table.businessId, table.systemName),
}));
```

---

## UI Component Changes

### Enhanced: Accounts Page (`src/pages/Accounts.tsx`)

**Changes:**
- Add account type badge display (Asset, Liability, Equity, Revenue, Expense)
- Add account subtype indicator
- Add account code column
- Add filtering by account type
- Add "View Chart of Accounts" button linking to new page
- Enhanced balance display with normal balance indicator

### Enhanced: Expenses Page (`src/pages/Expenses.tsx`)

**Changes:**
- Add "Fixed Asset" toggle when creating/editing expense
- When enabled, show additional fields:
  - Useful life (months)
  - Depreciation method dropdown
  - Salvage value (optional)
- Show asset status badge for asset-linked expenses
- Link to asset register for asset expenses

### New: Chart of Accounts Page (`src/pages/ChartOfAccounts.tsx`)

**Features:**
- Hierarchical account tree view grouped by type
- Account list with filtering and search
- Add/Edit account modal with:
  - Account name and code
  - Account type and subtype selection
  - Parent account (for sub-accounts)
  - Contra account toggle
  - External system mapping
- Account balance summary by type
- Import from external system option

### New: Items Page (`src/pages/Items.tsx`)

**Features:**
- Tabbed interface: Inventory | Fixed Assets | Services
- Item list with:
  - SKU, Name, Type, Current Stock (inventory)
  - Purchase date, book value, depreciation status (assets)
- Add/Edit item modal with:
  - Basic info (name, SKU, description)
  - Item type selection
  - Account linkages (income, expense, asset)
  - For fixed assets: depreciation settings
  - For inventory: stock settings
- Item detail view with:
  - Transaction history
  - Depreciation schedule (for assets)
  - Stock movements (for inventory)

### New: Journal Entries Page (`src/pages/JournalEntries.tsx`)

**Features:**
- Journal entry list with:
  - Entry number, date, description
  - Source type indicator
  - Status (draft/posted)
  - Total amount
- Add/Edit journal entry modal with:
  - Entry date
  - Description
  - Line items grid (add/remove rows)
  - Account selection with search
  - Debit/Credit amount input
  - Validation: debits must equal credits
- Post/Unpost functionality
- Reversal entry creation
- Link to source transaction (if applicable)

### New: Asset Register Page (`src/pages/AssetRegister.tsx`)

**Features:**
- Fixed asset list with:
  - Asset name, purchase date
  - Original cost, accumulated depreciation
  - Current book value
  - Monthly depreciation amount
  - Status (active, fully depreciated, disposed)
- Asset detail view with:
  - Full depreciation history
  - Journal entry links
  - Depreciation schedule projection
  - Disposal option
- Depreciation schedule calendar view
- Bulk depreciation posting

### New: Reports Page (`src/pages/Reports.tsx`)

**Features:**
- Report type selector:
  - Income Statement (P&L)
  - Balance Sheet
  - Trial Balance
  - Cash Flow Statement
  - Asset Register
- Date range picker (for P&L, Cash Flow)
- As-of date picker (for Balance Sheet)
- Export options (PDF, Excel)
- Print-friendly formatting
- Comparison mode (vs previous period)

### New: Settings > Accounting Configuration (`src/pages/Settings.tsx` - new tab)

**Features:**
- Expense threshold for asset prompt (default: KSh 50,000)
- Default accounts configuration:
  - Default bank account
  - Default cash account
  - Default accounts receivable account
  - Default accounts payable account
  - Default COGS account
- Revenue categories management (links to revenue_categories table)
- External system connections:
  - QuickBooks configuration
  - ERPNext configuration
  - Sync settings

---

## API Changes

### New Routers

#### `api/journal-router.ts`
```typescript
// Endpoints
- list: Get journal entries with pagination and filters
- getById: Get single entry with lines
- create: Create draft journal entry
- update: Update draft entry
- post: Post a draft entry (makes it permanent)
- unpost: Unpost (convert back to draft, if allowed)
- reverse: Create reversal entry
- getBySource: Get entries for a specific source type/id
```

#### `api/items-router.ts`
```typescript
// Endpoints
- list: Get items with filters (type, business)
- getById: Get item with full details
- create: Create item
- update: Update item
- delete: Soft delete item
- getDepreciationSchedule: Get depreciation schedule for asset
- dispose: Mark asset as disposed
- getStockHistory: Get stock movement history for inventory
```

#### `api/reports-router.ts`
```typescript
// Endpoints
- incomeStatement: Generate P&L report
- balanceSheet: Generate balance sheet
- trialBalance: Generate trial balance
- cashFlow: Generate cash flow statement
- assetRegister: Generate asset register
- getReport: Retrieve saved report by ID
- saveReport: Save report snapshot
- listSavedReports: List saved reports
```

#### `api/chart-of-accounts-router.ts`
```typescript
// Endpoints
- list: Get all accounts grouped by type
- getByType: Get accounts of specific type
- create: Create account
- update: Update account
- delete: Soft delete (if no transactions)
- getAccountBalance: Get current balance with breakdown
- validateCode: Check if account code is unique
- importFromExternal: Import accounts from QuickBooks/ERPNext
```

#### `api/sync-router.ts`
```typescript
// Endpoints
- getConfig: Get sync configuration
- saveConfig: Save sync configuration
- getSyncStatus: Get current sync status
- syncAccounts: Sync chart of accounts
- syncTransactions: Sync journal entries
- getSyncLog: Get sync operation history
- testConnection: Test external system connection
```

### Modified Routers

#### `api/accounts-router.ts`
- Add `accountType`, `accountSubType`, `accountCode` to create/update
- Add endpoint to get accounts by classification
- Add endpoint to recalculate account balances

#### `api/expenses-router.ts`
- Add `isFixedAsset`, `itemId` fields to create expense
- When expense is fixed asset:
  - Create item record
  - Create journal entry debiting asset account
  - Do NOT create expense journal entry
- When expense is regular:
  - Create journal entry debiting expense account
  - Credit payment source account

#### `api/bills-router.ts`
- Create journal entry on bill creation:
  - Debit: Expense account (based on category)
  - Credit: Accounts Payable (liability account)
- Create journal entry on payment:
  - Debit: Accounts Payable
  - Credit: Payment source account

---

## Migration Strategy

### Phase 1: Database Migration
1. Add new enums to database
2. Add new columns to existing tables (with defaults for backward compatibility)
3. Create all new tables
4. Seed default chart of accounts structure based on existing accounts

### Phase 2: Data Backfill
1. Classify existing accounts by type (UI tool for admin)
2. Classify existing expense categories
3. Create journal entries for existing transactions (optional, for historical accuracy)

### Phase 3: API Layer
1. Implement new routers
2. Modify existing routers to create journal entries
3. Add validation for balanced entries

### Phase 4: UI Implementation
1. Implement new pages
2. Update existing pages with new fields
3. Add report generation and display

### Phase 5: Depreciation Engine
1. Implement depreciation calculation
2. Create scheduled task for monthly depreciation
3. Generate depreciation journal entries automatically

---

## Testing Requirements

### Unit Tests
- Journal entry creation validates balanced debits/credits
- Depreciation calculation for straight-line method
- Depreciation calculation for declining balance method
- Account balance calculation respecting account type
- Trial balance totals validation

### Integration Tests
- Expense creation creates correct journal entries
- Fixed asset creation creates item and journal entry
- Bill payment creates correct journal entries
- Journal reversal creates correct opposite entries

### E2E Tests
- Complete expense-to-journal-entry flow
- Fixed asset creation and depreciation posting
- Income statement generation from journal data
- Balance sheet generation from account balances
