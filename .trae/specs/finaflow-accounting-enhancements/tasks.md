# FinaFlow Accounting Enhancements - Implementation Tasks

## Phase 1: Database Foundation (Week 1)

### Task 1.1: Database Schema Changes
- [ ] **1.1.1**: Add new enums to `db/schema.ts`
  - Create `accountTypeEnum`, `accountSubTypeEnum`, `itemTypeEnum`, `depreciationMethodEnum`, `accountingClassEnum`, `revenueCategoryTypeEnum`
  - Add to exports

- [ ] **1.1.2**: Enhance `accounts` table
  - Add `accountType`, `accountSubType`, `businessId`, `description` columns
  - Add `accountCode` column (unique)
  - Add `isContra`, `parentAccountId` columns
  - Add external sync columns (`externalId`, `externalSystem`, `lastSyncedAt`)
  - Add index on `accountType`

- [ ] **1.1.3**: Enhance `expense_categories` table
  - Add `businessId`, `accountingClass`, `defaultAccountId` columns
  - Add external sync columns
  - Add index on `businessId`

- [ ] **1.1.4**: Create `items` table
  - Implement full item schema with itemType, accounting linkages
  - Fixed asset fields (depreciation settings, book value tracking)
  - Inventory fields (stock, unit cost/price, reorder level)
  - External sync columns
  - Add indexes on `sku`, `businessId`, `itemType`

- [ ] **1.1.5**: Create `journal_entries` table
  - Entry tracking with source type/id
  - Posting status, reversal tracking
  - External sync columns
  - Add indexes on `entryNumber`, `entryDate`, `sourceType/sourceId`, `businessId`

- [ ] **1.1.6**: Create `journal_lines` table
  - Line items with debit/credit amounts
  - Account linkage
  - Add indexes on `journalEntryId`, `accountId`

- [ ] **1.1.7**: Create `revenue_categories` table
  - Revenue classification for FinaBill
  - Income account linkage
  - External sync columns
  - Add index on `businessId`

- [ ] **1.1.8**: Create `fixed_asset_depreciation` table
  - Depreciation tracking per period
  - Journal entry linkage
  - Add indexes on `itemId`, `periodYear/periodMonth`
  - Add unique index on `itemId/periodYear/periodMonth`

- [ ] **1.1.9**: Create `financial_reports` table
  - Report storage with metadata
  - Add indexes on `businessId`, `reportType/periodStart/periodEnd`

- [ ] **1.1.10**: Create `external_sync_config` table
  - External system configuration storage
  - Add unique index on `businessId/systemName`

### Task 1.2: Database Migration
- [ ] **1.2.1**: Generate Drizzle migration
  - Run `npm run db:generate` or equivalent
  - Review generated SQL
  - Apply migration to database

- [ ] **1.2.2**: Seed default accounts
  - Create basic chart of accounts structure:
    - 1000-1999: Assets
    - 2000-2999: Liabilities
    - 3000-3999: Equity
    - 4000-4999: Revenue
    - 5000-5999: Expenses
  - Map existing accounts to appropriate types

- [ ] **1.2.3**: Seed default expense category classifications
  - Classify existing expense categories:
    - Food Supplies → cogs
    - Beverages → cogs
    - Utilities → operating_expense
    - Rent → operating_expense
    - Salaries → operating_expense
    - Marketing → marketing
    - Maintenance → operating_expense
    - Transport → operating_expense
    - Licenses → admin_expense
    - Miscellaneous → other

## Phase 2: Core Business Logic (Week 2-3)

### Task 2.1: Journal Entry System
- [ ] **2.1.1**: Create `api/journal-router.ts`
  - Implement `list` endpoint with pagination and filters
  - Implement `getById` with lines included
  - Implement `create` for draft entries
  - Implement `update` for draft entries only
  - Implement `post` to finalize entries
  - Implement `unpost` for draft conversion
  - Implement `reverse` for reversal entries
  - Implement `getBySource` for source lookups
  - Add Zod validation schemas
  - Add proper authorization checks

- [ ] **2.1.2**: Create journal entry helpers
  - Create `api/lib/journal.ts` utility module
  - Implement `createJournalEntry()` function
  - Implement `postJournalEntry()` function
  - Implement `reverseJournalEntry()` function
  - Implement `validateBalancedEntry()` function
  - Implement `getAccountBalance()` function

- [ ] **2.1.3**: Create journal entry triggers
  - Create trigger for expense creation
  - Create trigger for bill creation
  - Create trigger for bill payment
  - Create trigger for daily sales recording
  - Create trigger for payroll
  - Ensure all transactions create balanced journal entries

### Task 2.2: Item Management
- [ ] **2.2.1**: Create `api/items-router.ts`
  - Implement CRUD endpoints
  - Implement `getDepreciationSchedule` endpoint
  - Implement `dispose` endpoint
  - Implement `getStockHistory` endpoint
  - Add proper authorization checks

- [ ] **2.2.2**: Create item helpers
  - Create `api/lib/items.ts` utility module
  - Implement `createItemFromExpense()` function
  - Implement `calculateDepreciation()` function
  - Implement `updateBookValue()` function
  - Implement `disposeAsset()` function

### Task 2.3: Chart of Accounts API
- [ ] **2.3.1**: Create `api/chart-of-accounts-router.ts`
  - Implement `list` grouped by type
  - Implement `getByType` filtered by type
  - Implement `create` account
  - Implement `update` account
  - Implement `delete` account (with transaction check)
  - Implement `getAccountBalance` with breakdown
  - Implement `validateCode` uniqueness check
  - Add default accounts seeding

### Task 2.4: Depreciation Engine
- [ ] **2.4.1**: Create depreciation calculation engine
  - Create `api/lib/depreciation.ts` module
  - Implement `calculateStraightLine()` function
  - Implement `calculateDecliningBalance()` function
  - Implement `generateDepreciationSchedule()` function
  - Implement `getNextDepreciationDate()` function

- [ ] **2.4.2**: Create depreciation posting logic
  - Create `api/lib/depreciation-posting.ts` module
  - Implement `calculateMonthlyDepreciation()` function
  - Implement `createDepreciationJournalEntry()` function
  - Implement `postMonthlyDepreciation()` function
  - Implement `getDepreciationForPeriod()` function

- [ ] **2.4.3**: Create `api/depreciation-router.ts`
  - Implement `calculateSchedule` endpoint
  - Implement `postDepreciation` endpoint
  - Implement `getDepreciationHistory` endpoint
  - Implement `getUpcomingDepreciation` endpoint

### Task 2.5: Financial Reports
- [ ] **2.5.1**: Create report generation engine
  - Create `api/lib/reports.ts` module
  - Implement `generateIncomeStatement()` function
  - Implement `generateBalanceSheet()` function
  - Implement `generateTrialBalance()` function
  - Implement `generateCashFlow()` function
  - Implement `generateAssetRegister()` function

- [ ] **2.5.2**: Create `api/reports-router.ts`
  - Implement `incomeStatement` endpoint
  - Implement `balanceSheet` endpoint
  - Implement `trialBalance` endpoint
  - Implement `cashFlow` endpoint
  - Implement `assetRegister` endpoint
  - Implement `getReport` and `saveReport` endpoints
  - Implement `listSavedReports` endpoint

## Phase 3: Integration with Existing Features (Week 3-4)

### Task 3.1: Expense Integration
- [ ] **3.1.1**: Modify expense creation
  - Add `isFixedAsset` flag to expense input schema
  - Add fixed asset fields (usefulLifeMonths, depreciationMethod, salvageValue)
  - When `isFixedAsset=true`:
    - Create item record
    - Create journal entry debiting fixed asset account
    - Do NOT create expense journal entry
  - When `isFixedAsset=false`:
    - Create journal entry debiting expense account
    - Credit payment source account

- [ ] **3.1.2**: Enhance expense UI
  - Add "Fixed Asset" toggle in expense form
  - Show additional fields when asset toggle is on
  - Add asset threshold setting
  - Show asset status badge for asset-linked expenses

### Task 3.2: Bill Integration
- [ ] **3.2.1**: Modify bill creation
  - Create journal entry on bill creation:
    - Debit: Expense account (based on category)
    - Credit: Accounts Payable account
  - Update bill router to call journal creation

- [ ] **3.2.2**: Modify bill payment
  - Create journal entry on payment:
    - Debit: Accounts Payable
    - Credit: Payment source account
  - Update bill payment to call journal creation

### Task 3.3: Daily Sales Integration
- [ ] **3.3.1**: Modify daily sales recording
  - Create journal entries for each payment method:
    - Credit: Revenue account (by sales type)
    - Debit: Respective cash/bank/mpesa account
  - Map sales breakdown to appropriate revenue categories

### Task 3.4: Payroll Integration
- [ ] **4.4.1**: Modify payroll payment
  - Create journal entries:
    - Debit: Salary expense accounts
    - Credit: Bank/Cash account (net pay)
    - Credit: Tax liability accounts (PAYE, NHIF, NSSF)

## Phase 4: UI Implementation (Week 4-6)

### Task 4.1: Enhanced Accounts Page
- [ ] **4.1.1**: Update account list display
  - Add account type badge column
  - Add account code column
  - Add subtype indicator
  - Add filtering by account type
  - Add sorting by account code

- [ ] **4.1.2**: Update account form
  - Add account type selection
  - Add subtype selection (dependent on type)
  - Add account code field (auto-suggest next code)
  - Add parent account selection
  - Add contra account toggle
  - Add external system mapping fields

### Task 4.2: Chart of Accounts Page
- [ ] **4.2.1**: Create Chart of Accounts list view
  - Hierarchical tree grouped by account type
  - Expandable/collapsible sections
  - Account summary cards by type
  - Search and filter functionality

- [ ] **4.2.2**: Create account management modal
  - Create/Edit form with all account fields
  - Code validation
  - Parent account picker
  - External mapping configuration

### Task 4.3: Items Page
- [ ] **4.3.1**: Create items list view
  - Tabbed interface: Inventory | Fixed Assets | Services
  - Item cards with key info
  - Filter and search

- [ ] **4.3.2**: Create item form
  - Basic info section
  - Type selection with fields update
  - Account linkages (income, expense, asset)
  - Fixed asset specific fields
  - Inventory specific fields

- [ ] **4.3.3**: Create item detail view
  - Full item information
  - Transaction history table
  - Depreciation schedule (for assets)
  - Stock history (for inventory)
  - Edit/Dispose actions

### Task 4.4: Journal Entries Page
- [ ] **4.4.1**: Create journal entries list
  - List with entry number, date, description, amount, status
  - Filter by date range, source type, status
  - Quick actions (view, post, reverse)

- [ ] **4.4.2**: Create journal entry form
  - Date and description fields
  - Line items grid (add/remove rows)
  - Account search and select
  - Debit/credit input with running totals
  - Validation (debits = credits)
  - Save draft / Post options

- [ ] **4.4.3**: Create entry detail view
  - Full entry information
  - Line items breakdown
  - Source transaction link
  - Reversal history (if any)
  - Post/Unpost/Reverse actions

### Task 4.5: Asset Register Page
- [ ] **4.5.1**: Create asset list view
  - Asset cards with depreciation status
  - Filter by status (active, fully depreciated, disposed)
  - Sort by value, date, name

- [ ] **4.5.2**: Create depreciation schedule view
  - Timeline of depreciation amounts
  - Projected book value over time
  - Export schedule

- [ ] **4.5.3**: Create disposal form
  - Disposal date
  - Disposal value/condition
  - Reason for disposal
  - Generate disposal journal entry

### Task 4.6: Reports Page
- [ ] **4.6.1**: Create report selector
  - Report type cards
  - Date range picker
  - As-of date picker (for balance sheet)

- [ ] **4.6.2**: Create Income Statement view
  - Revenue section (grouped by category)
  - COGS section
  - Gross Profit calculation
  - Expense sections (grouped by classification)
  - Operating Income calculation
  - Net Income display

- [ ] **4.6.3**: Create Balance Sheet view
  - Assets section (current + fixed)
  - Liabilities section (current + long-term)
  - Equity section
  - Balance verification

- [ ] **4.6.4**: Create Trial Balance view
  - All accounts with debit/credit columns
  - Totals row
  - Balance verification

- [ ] **4.6.5**: Create Asset Register report
  - Asset list with depreciation details
  - Totals for cost, accumulated dep, book value

- [ ] **4.6.6**: Add export functionality
  - PDF export for all reports
  - Excel export option

### Task 4.7: Settings Enhancements
- [ ] **4.7.1**: Create Accounting Settings tab
  - Asset threshold configuration
  - Default accounts setup
  - Revenue categories management
  - External system configuration

- [ ] **4.7.2**: Create revenue categories management
  - CRUD for revenue categories
  - Account linkage
  - External mapping

## Phase 5: External System Integration (Week 6-7)

### Task 5.1: Sync Configuration UI
- [ ] **5.1.1**: Create external systems page
  - List of configured systems
  - Add/Edit system configuration
  - Connection status indicator
  - Last sync timestamp

- [ ] **5.1.2**: Create QuickBooks configuration form
  - API credentials input
  - Company selection
  - Sync preferences
  - Test connection button

- [ ] **5.1.3**: Create ERPNext configuration form
  - API endpoint and credentials
  - Company/database selection
  - Sync preferences
  - Test connection button

### Task 5.2: Sync API
- [ ] **5.2.1**: Create `api/sync-router.ts`
  - `getConfig` endpoint
  - `saveConfig` endpoint
  - `getSyncStatus` endpoint
  - `syncAccounts` endpoint
  - `syncTransactions` endpoint
  - `getSyncLog` endpoint
  - `testConnection` endpoint

- [ ] **5.2.2**: Create sync helpers
  - Create `api/lib/sync/quickbooks.ts` module
  - Create `api/lib/sync/erpnext.ts` module
  - Implement account mapping
  - Implement transaction sync
  - Implement sync logging

## Phase 6: Testing & Polish (Week 7-8)

### Task 6.1: Unit Tests
- [ ] **6.1.1**: Journal entry tests
  - Test balanced entry validation
  - Test unbalanced entry rejection
  - Test reversal entry creation

- [ ] **6.1.2**: Depreciation tests
  - Test straight-line calculation
  - Test declining balance calculation
  - Test monthly depreciation generation

- [ ] **6.1.3**: Report generation tests
  - Test income statement totals
  - Test trial balance balance
  - Test balance sheet equation

### Task 6.2: Integration Tests
- [ ] **6.2.1**: Expense journal creation test
- [ ] **6.2.2**: Fixed asset creation test
- [ ] **6.2.3**: Bill payment journal test
- [ ] **6.2.4**: Journal reversal test

### Task 6.3: UI Testing
- [ ] **6.3.1**: Chart of accounts CRUD test
- [ ] **6.3.2**: Journal entry creation test
- [ ] **6.3.3**: Report generation test

### Task 6.4: Documentation
- [ ] **6.4.1**: Update AGENTS.md with new commands
- [ ] **6.4.2**: Create accounting feature documentation
- [ ] **6.4.3**: Update API documentation

---

## Task Dependencies

### Phase 1 Dependencies
- Task 1.2 (Migration) depends on Task 1.1 (Schema)

### Phase 2 Dependencies
- Task 2.1 depends on Task 1.2 (migrations applied)
- Task 2.2 depends on Task 1.2
- Task 2.3 depends on Task 1.2
- Task 2.4 depends on Task 2.1 and Task 2.2
- Task 2.5 depends on Task 2.1, 2.2, 2.3, 2.4

### Phase 3 Dependencies
- Task 3.1 depends on Task 2.1 and Task 2.2
- Task 3.2 depends on Task 2.1
- Task 3.3 depends on Task 2.1
- Task 3.4 depends on Task 2.1

### Phase 4 Dependencies
- Task 4.1 depends on Task 2.3
- Task 4.2 depends on Task 2.3 and Task 4.1
- Task 4.3 depends on Task 2.2 and Task 2.3
- Task 4.4 depends on Task 2.1
- Task 4.5 depends on Task 2.4 and Task 4.3
- Task 4.6 depends on Task 2.5
- Task 4.7 depends on Task 2.3 and Task 4.2

### Phase 5 Dependencies
- Task 5.1 depends on Task 4.7
- Task 5.2 depends on Task 5.1

### Phase 6 Dependencies
- All Phase 6 tasks depend on all previous phases being complete
