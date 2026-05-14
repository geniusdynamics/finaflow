# FinaFlow Accounting Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use speckit-implement to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper double-entry bookkeeping, chart of accounts, fixed asset management, depreciation, and financial reporting to FinaFlow while maintaining backward compatibility with existing features.

**Architecture:** This enhancement builds on FinaFlow's existing enhanced single-entry ledger system by introducing proper double-entry journal entries. The approach adds new tables (journal_entries, journal_lines, items, fixed_asset_depreciation, etc.) while modifying existing tables to support accounting classifications. All new transactions will create balanced journal entries, and existing data will be classified via an admin UI tool.

**Tech Stack:** 
- PostgreSQL with Drizzle ORM (existing)
- Hono.js + tRPC API (existing)
- React 19 frontend (existing)
- decimal.js for financial calculations (existing)
- PDF/Excel export libraries (TBD)

---

## File Structure

### Database Layer
```
db/
├── schema.ts                          # Enhanced with new enums and tables
├── migrations/
│   └── (new migration files)         # Database migration scripts
├── relations.ts                       # May need updates for new relations
└── seed-accounting.ts                # Seed default chart of accounts
```

### API Layer (Backend)
```
api/
├── journal-router.ts                  # NEW: Journal entry CRUD
├── items-router.ts                   # NEW: Item/inventory/asset management
├── chart-of-accounts-router.ts       # NEW: Chart of accounts management
├── depreciation-router.ts             # NEW: Depreciation calculations and posting
├── reports-router.ts                 # NEW: Financial report generation
├── sync-router.ts                    # NEW: External system sync
├── expenses-router.ts                 # MODIFIED: Add fixed asset flag
├── bills-router.ts                    # MODIFIED: Add journal entry creation
├── daily-sales-router.ts             # MODIFIED: Add journal entry creation
├── employees-payroll-router.ts       # MODIFIED: Add journal entry creation
├── accounts-router.ts                 # MODIFIED: Add classification fields
└── lib/
    ├── journal.ts                     # NEW: Journal entry helpers
    ├── items.ts                       # NEW: Item management helpers
    ├── depreciation.ts                 # NEW: Depreciation calculation engine
    ├── depreciation-posting.ts         # NEW: Depreciation posting logic
    ├── reports.ts                      # NEW: Report generation engine
    └── sync/
        ├── quickbooks.ts              # NEW: QuickBooks sync helpers
        └── erpnext.ts                 # NEW: ERPNext sync helpers
```

### Frontend Layer
```
src/
├── pages/
│   ├── Accounts.tsx                   # MODIFIED: Add classification display
│   ├── Expenses.tsx                   # MODIFIED: Add fixed asset toggle
│   ├── ChartOfAccounts.tsx            # NEW: Chart of accounts management
│   ├── Items.tsx                      # NEW: Inventory/assets/services
│   ├── JournalEntries.tsx              # NEW: Journal entry management
│   ├── AssetRegister.tsx              # NEW: Fixed asset tracking
│   ├── Reports.tsx                    # NEW: Financial reports
│   └── Settings.tsx                   # MODIFIED: Add accounting settings
├── components/
│   ├── ui/
│   │   └── (existing components)     # May need new form components
│   └── (new components as needed)
└── App.tsx                           # MODIFIED: Add new routes
```

---

## Implementation Plan

### Phase 1: Database Foundation

### Task 1.1: Add New Enums to Schema

**Files:**
- Modify: `db/schema.ts` (add enums at top of file)
- Modify: `db/relations.ts` (if needed for new relations)

- [ ] **Step 1: Add account classification enums**

Add these enums after existing enums (around line 44):

```typescript
// Account type classification (Chart of Accounts)
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
```

- [ ] **Step 2: Add item and depreciation enums**

```typescript
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

- [ ] **Step 3: Run typecheck to verify enums**

Run: `npm run check`
Expected: No errors related to new enums

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(accounting): add accounting classification enums"
```

---

### Task 1.2: Enhance accounts Table

**Files:**
- Modify: `db/schema.ts` (enhance accounts table definition)
- Create: `db/migrations/0002_accounting_schema.sql`

- [ ] **Step 1: Enhance accounts table definition**

Modify the accounts table in `db/schema.ts` to include new fields:

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
  
  // Balance tracking (existing fields preserved)
  openingBalance: numeric("openingBalance", { precision: 15, scale: 2 }).default("0.00"),
  currentBalance: numeric("currentBalance", { precision: 15, scale: 2 }).default("0.00"),
  
  // Hierarchy
  isContra: boolean("isContra").default(false),
  parentAccountId: bigint("parentAccountId", { mode: "number" }),
  
  // External sync
  externalId: varchar("externalId", { length: 255 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  
  // Legacy fields (for backward compatibility)
  type: typeEnum("type").notNull(),
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

- [ ] **Step 2: Add type exports**

Add after existing type exports:

```typescript
export type AccountType = typeof accountTypeEnum.enumValues[number];
export type AccountSubType = typeof accountSubTypeEnum.enumValues[number];
export type ItemType = typeof itemTypeEnum.enumValues[number];
export type DepreciationMethod = typeof depreciationMethodEnum.enumValues[number];
export type AccountingClass = typeof accountingClassEnum.enumValues[number];
export type RevenueCategoryType = typeof revenueCategoryTypeEnum.enumValues[number];
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(accounting): enhance accounts table with classification"
```

---

### Task 1.3: Enhance expense_categories Table

**Files:**
- Modify: `db/schema.ts`

- [ ] **Step 1: Enhance expense_categories table**

Add new fields to the existing expense_categories table:

```typescript
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  locationId: bigint("locationId", { mode: "number" }),
  
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#C73E1D"),
  
  // Accounting classification (NEW)
  accountingClass: accountingClassEnum("accountingClass").notNull().default("operating_expense"),
  defaultAccountId: bigint("defaultAccountId", { mode: "number" }),
  
  // External mapping (NEW)
  externalAccountCode: varchar("externalAccountCode", { length: 50 }),
  externalSystem: varchar("externalSystem", { length: 50 }),
  
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  businessIdx: index("idx_expense_category_business").on(table.businessId),
}));
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add db/schema.ts
git commit -m "feat(accounting): enhance expense_categories with accounting classification"
```

---

### Task 1.4: Create journal_entries Table

**Files:**
- Modify: `db/schema.ts` (add table definition)
- Create: `api/lib/journal.ts` (helper functions)

- [ ] **Step 1: Add journal_entries table definition**

Add after accounts table definition:

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

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
```

- [ ] **Step 2: Add journal_lines table definition**

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

export type JournalLine = typeof journalLines.$inferSelect;
export type InsertJournalLine = typeof journalLines.$inferInsert;
```

- [ ] **Step 3: Create journal helper library**

Create `api/lib/journal.ts`:

```typescript
import { getDb } from "../queries/connection";
import { journalEntries, journalLines, accounts, ledgerEntries } from "@db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { d } from "./decimal";

export interface JournalLineInput {
  accountId: number;
  debit: string;
  credit: string;
  description?: string;
}

export interface CreateJournalEntryInput {
  businessId: number;
  entryDate: Date;
  description: string;
  reference?: string;
  sourceType?: string;
  sourceId?: number;
  lines: JournalLineInput[];
  createdBy: number;
  postImmediately?: boolean;
}

export async function createJournalEntry(input: CreateJournalEntryInput) {
  const db = getDb();
  
  // Validate balanced entry
  const totalDebits = input.lines.reduce((sum, line) => sum.plus(line.debit || "0"), d("0"));
  const totalCredits = input.lines.reduce((sum, line) => sum.plus(line.credit || "0"), d("0"));
  
  if (!totalDebits.eq(totalCredits)) {
    throw new Error(`Journal entry must be balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`);
  }
  
  // Generate entry number
  const entryNumber = await generateEntryNumber(input.businessId);
  
  return db.transaction(async (tx) => {
    // Create journal entry
    const [entry] = await tx.insert(journalEntries).values({
      businessId: input.businessId,
      entryNumber,
      entryDate: input.entryDate,
      description: input.description,
      reference: input.reference,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdBy: input.createdBy,
      isPosted: input.postImmediately ?? false,
    }).returning();
    
    // Create journal lines
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      await tx.insert(journalLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debit: line.debit || "0.00",
        credit: line.credit || "0.00",
        description: line.description,
        lineNumber: i + 1,
      });
    }
    
    // If posting immediately, create ledger entries and update account balances
    if (input.postImmediately) {
      await postJournalEntry(entry.id, input.createdBy, tx);
    }
    
    return entry;
  });
}

export async function postJournalEntry(entryId: number, postedBy: number, tx?: any) {
  const db = tx || getDb();
  
  // Get entry with lines
  const entry = await db.query.journalEntries.findFirst({
    where: and(eq(journalEntries.id, entryId), isNull(journalEntries.deletedAt)),
  });
  
  if (!entry) throw new Error("Journal entry not found");
  if (entry.isPosted) throw new Error("Journal entry already posted");
  
  const lines = await db.query.journalLines.findMany({
    where: and(eq(journalLines.journalEntryId, entryId), isNull(journalLines.deletedAt)),
  });
  
  return db.transaction(async (tx) => {
    // Update entry status
    await tx.update(journalEntries).set({
      isPosted: true,
      postedBy,
      postedAt: new Date(),
    }).where(eq(journalEntries.id, entryId));
    
    // Create ledger entries and update account balances
    for (const line of lines) {
      // Get current account balance
      const account = await tx.select().from(accounts).where(eq(accounts.id, line.accountId)).limit(1);
      if (!account[0]) throw new Error(`Account ${line.accountId} not found`);
      
      const currentBalance = d(account[0].currentBalance || "0");
      const amount = d(line.debit || "0").plus(d(line.credit || "0"));
      
      // Calculate new balance based on account type
      let newBalance;
      if (account[0].accountType === 'asset' || account[0].accountType === 'expense') {
        // Debits increase, credits decrease
        newBalance = d(line.debit || "0").gt(0)
          ? currentBalance.plus(line.debit)
          : currentBalance.minus(line.credit);
      } else {
        // Credits increase, debits decrease
        newBalance = d(line.credit || "0").gt(0)
          ? currentBalance.plus(line.credit)
          : currentBalance.minus(line.debit);
      }
      
      // Create ledger entry
      await tx.insert(ledgerEntries).values({
        accountId: line.accountId,
        transactionType: "journal",
        transactionId: entryId,
        entryType: d(line.debit || "0").gt(0) ? "debit" : "credit",
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: line.description || entry.description,
        entryDate: entry.entryDate,
        createdBy: postedBy,
      });
      
      // Update account balance
      await tx.update(accounts).set({
        currentBalance: newBalance.toFixed(2),
      }).where(eq(accounts.id, line.accountId));
    }
    
    return { success: true };
  });
}

export async function reverseJournalEntry(entryId: number, reversedBy: number) {
  const db = getDb();
  
  // Get original entry with lines
  const entry = await db.query.journalEntries.findFirst({
    where: and(eq(journalEntries.id, entryId), isNull(journalEntries.deletedAt)),
  });
  
  if (!entry) throw new Error("Journal entry not found");
  if (!entry.isPosted) throw new Error("Can only reverse posted entries");
  if (entry.isReversed) throw new Error("Entry already reversed");
  
  const lines = await db.query.journalLines.findMany({
    where: and(eq(journalLines.journalEntryId, entryId), isNull(journalLines.deletedAt)),
  });
  
  // Create reversal with swapped debits/credits
  const reversalLines = lines.map(line => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    description: `Reversal: ${line.description || entry.description}`,
  }));
  
  return db.transaction(async (tx) => {
    // Create reversal entry
    const [reversal] = await tx.insert(journalEntries).values({
      businessId: entry.businessId,
      entryDate: new Date(),
      description: `Reversal of ${entry.entryNumber}`,
      reference: entry.reference,
      sourceType: "journal",
      sourceId: entryId,
      createdBy: reversedBy,
      isPosted: true,
      postedBy: reversedBy,
      postedAt: new Date(),
      isReversed: false,
      reversalOf: entryId,
    }).returning();
    
    // Create reversal lines
    for (let i = 0; i < reversalLines.length; i++) {
      const line = reversalLines[i];
      await tx.insert(journalLines).values({
        journalEntryId: reversal.id,
        accountId: line.accountId,
        debit: line.debit || "0.00",
        credit: line.credit || "0.00",
        description: line.description,
        lineNumber: i + 1,
      });
    }
    
    // Mark original as reversed
    await tx.update(journalEntries).set({
      isReversed: true,
      reversedBy,
    }).where(eq(journalEntries.id, entryId));
    
    // Post the reversal entry
    await postJournalEntry(reversal.id, reversedBy, tx);
    
    return reversal;
  });
}

async function generateEntryNumber(businessId: number): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
  
  // Get last entry number for this business and year
  const last = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.businessId, businessId),
      sql`${journalEntries.entryNumber} LIKE ${prefix + '%'}`
    ),
    orderBy: (entries, { desc }) => [desc(entries.entryNumber)],
  });
  
  let nextNum = 1;
  if (last?.entryNumber) {
    const lastNum = parseInt(last.entryNumber.replace(prefix, ""), 10);
    nextNum = lastNum + 1;
  }
  
  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts api/lib/journal.ts
git commit -m "feat(accounting): add journal entries and journal lines tables"
```

---

### Task 1.5: Create items Table

**Files:**
- Modify: `db/schema.ts` (add items table)

- [ ] **Step 1: Add items table definition**

Add after journal_lines:

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

export type Item = typeof items.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
```

- [ ] **Step 2: Add related tables**

Add these tables after items:

```typescript
// Fixed asset depreciation tracking
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

export type FixedAssetDepreciation = typeof fixedAssetDepreciation.$inferSelect;

// Revenue categories (for FinaBill)
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

export type RevenueCategory = typeof revenueCategories.$inferSelect;
export type InsertRevenueCategory = typeof revenueCategories.$inferInsert;

// Financial reports storage
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

export type FinancialReport = typeof financialReports.$inferSelect;

// External sync configuration
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

export type ExternalSyncConfig = typeof externalSyncConfig.$inferSelect;
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts
git commit -m "feat(accounting): add items, depreciation, revenue categories, reports, and sync tables"
```

---

### Task 1.6: Generate and Apply Database Migration

**Files:**
- Create: `db/migrations/0002_accounting_schema.sql`
- Create: `db/migrations/meta/0002_snapshot.json`

- [ ] **Step 1: Generate migration**

Run: `npm run db:generate`
Expected: New migration files created in `db/migrations/` and `db/migrations/meta/`

- [ ] **Step 2: Review migration SQL**

Open the generated migration file and verify:
- All new columns are present
- All new tables are present
- Indexes are created
- Foreign keys are defined

- [ ] **Step 3: Apply migration (development only)**

Run: `npm run db:migrate`
Expected: Migration applied successfully

**Note:** In production, migrations would be applied via CI/CD pipeline.

- [ ] **Step 4: Commit migration files**

```bash
git add db/migrations/
git commit -m "chore(db): add accounting schema migration"
```

---

### Task 1.7: Seed Default Chart of Accounts

**Files:**
- Create: `db/seed-accounting.ts`

- [ ] **Step 1: Create seed script**

Create `db/seed-accounting.ts`:

```typescript
import { getDb } from "../api/queries/connection";
import { accounts, expenseCategories } from "./schema";
import { eq } from "drizzle-orm";

const defaultAccounts = [
  // Assets (1000-1999)
  { accountCode: "1000", name: "Cash", accountType: "asset", accountSubType: "cash", openingBalance: "0.00" },
  { accountCode: "1100", name: "Bank - Current Account", accountType: "asset", accountSubType: "bank", openingBalance: "0.00" },
  { accountCode: "1200", name: "M-Pesa Account", accountType: "asset", accountSubType: "cash", openingBalance: "0.00" },
  { accountCode: "1300", name: "Accounts Receivable", accountType: "asset", accountSubType: "accounts_receivable", openingBalance: "0.00" },
  { accountCode: "1400", name: "Inventory", accountType: "asset", accountSubType: "inventory", openingBalance: "0.00" },
  { accountCode: "1500", name: "Prepaid Expenses", accountType: "asset", accountSubType: "prepaid_expense", openingBalance: "0.00" },
  { accountCode: "1600", name: "Office Equipment", accountType: "asset", accountSubType: "fixed_asset", openingBalance: "0.00" },
  { accountCode: "1610", name: "Accumulated Depreciation - Office Equipment", accountType: "asset", accountSubType: "accumulated_depreciation", isContra: true, openingBalance: "0.00" },
  { accountCode: "1700", name: "Furniture & Fixtures", accountType: "asset", accountSubType: "fixed_asset", openingBalance: "0.00" },
  { accountCode: "1710", name: "Accumulated Depreciation - Furniture", accountType: "asset", accountSubType: "accumulated_depreciation", isContra: true, openingBalance: "0.00" },
  { accountCode: "1800", name: "Vehicles", accountType: "asset", accountSubType: "fixed_asset", openingBalance: "0.00" },
  { accountCode: "1810", name: "Accumulated Depreciation - Vehicles", accountType: "asset", accountSubType: "accumulated_depreciation", isContra: true, openingBalance: "0.00" },
  
  // Liabilities (2000-2999)
  { accountCode: "2000", name: "Accounts Payable", accountType: "liability", accountSubType: "accounts_payable", openingBalance: "0.00" },
  { accountCode: "2100", name: "Accrued Expenses", accountType: "liability", accountSubType: "accrued_expense", openingBalance: "0.00" },
  { accountCode: "2200", name: "PAYE Payable", accountType: "liability", accountSubType: "accrued_expense", openingBalance: "0.00" },
  { accountCode: "2300", name: "NSSF Payable", accountType: "liability", accountSubType: "accrued_expense", openingBalance: "0.00" },
  { accountCode: "2400", name: "NHIF Payable", accountType: "liability", accountSubType: "accrued_expense", openingBalance: "0.00" },
  { accountCode: "2500", name: "VAT Payable", accountType: "liability", accountSubType: "accrued_expense", openingBalance: "0.00" },
  
  // Equity (3000-3999)
  { accountCode: "3000", name: "Owner's Capital", accountType: "equity", accountSubType: "capital", openingBalance: "0.00" },
  { accountCode: "3100", name: "Retained Earnings", accountType: "equity", accountSubType: "retained_earnings", openingBalance: "0.00" },
  { accountCode: "3200", name: "Owner's Drawings", accountType: "equity", accountSubType: "drawings", openingBalance: "0.00" },
  { accountCode: "3900", name: "Current Year Earnings", accountType: "equity", accountSubType: "current_year_earnings", openingBalance: "0.00" },
  
  // Revenue (4000-4999)
  { accountCode: "4000", name: "Sales Revenue", accountType: "revenue", accountSubType: "sales_revenue", openingBalance: "0.00" },
  { accountCode: "4100", name: "Food Sales", accountType: "revenue", accountSubType: "sales_revenue", openingBalance: "0.00" },
  { accountCode: "4200", name: "Beverage Sales", accountType: "revenue", accountSubType: "sales_revenue", openingBalance: "0.00" },
  { accountCode: "4300", name: "Service Revenue", accountType: "revenue", accountSubType: "service_revenue", openingBalance: "0.00" },
  { accountCode: "4400", name: "Subscription Revenue", accountType: "revenue", accountSubType: "subscription_revenue", openingBalance: "0.00" },
  { accountCode: "4900", name: "Other Income", accountType: "revenue", accountSubType: "other_income", openingBalance: "0.00" },
  
  // Expenses (5000-5999)
  { accountCode: "5000", name: "Cost of Goods Sold", accountType: "expense", accountSubType: "cogs", openingBalance: "0.00" },
  { accountCode: "5100", name: "Food Cost", accountType: "expense", accountSubType: "cogs", openingBalance: "0.00" },
  { accountCode: "5200", name: "Beverage Cost", accountType: "expense", accountSubType: "cogs", openingBalance: "0.00" },
  { accountCode: "6000", name: "Operating Expenses", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "6100", name: "Rent Expense", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "6200", name: "Utilities Expense", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "6300", name: "Salaries & Wages", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "6400", name: "Transport Expense", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "6500", name: "Maintenance Expense", accountType: "expense", accountSubType: "operating_expense", openingBalance: "0.00" },
  { accountCode: "7000", name: "Administrative Expenses", accountType: "expense", accountSubType: "admin_expense", openingBalance: "0.00" },
  { accountCode: "7100", name: "Office Supplies", accountType: "expense", accountSubType: "admin_expense", openingBalance: "0.00" },
  { accountCode: "7200", name: "Professional Fees", accountType: "expense", accountSubType: "admin_expense", openingBalance: "0.00" },
  { accountCode: "7300", name: "Insurance Expense", accountType: "expense", accountSubType: "admin_expense", openingBalance: "0.00" },
  { accountCode: "8000", name: "Marketing Expenses", accountType: "expense", accountSubType: "marketing_expense", openingBalance: "0.00" },
  { accountCode: "9000", name: "Depreciation Expense", accountType: "expense", accountSubType: "depreciation_expense", openingBalance: "0.00" },
  { accountCode: "9900", name: "Other Expenses", accountType: "expense", accountSubType: "other_expense", openingBalance: "0.00" },
];

const expenseCategoryMappings: Record<string, { accountingClass: string; defaultAccountCode: string }> = {
  "Food Supplies": { accountingClass: "cogs", defaultAccountCode: "5100" },
  "Beverages": { accountingClass: "cogs", defaultAccountCode: "5200" },
  "Utilities": { accountingClass: "operating_expense", defaultAccountCode: "6200" },
  "Rent": { accountingClass: "operating_expense", defaultAccountCode: "6100" },
  "Salaries": { accountingClass: "operating_expense", defaultAccountCode: "6300" },
  "Marketing": { accountingClass: "marketing", defaultAccountCode: "8000" },
  "Maintenance": { accountingClass: "operating_expense", defaultAccountCode: "6500" },
  "Transport": { accountingClass: "operating_expense", defaultAccountCode: "6400" },
  "Licenses": { accountingClass: "admin_expense", defaultAccountCode: "7200" },
  "Miscellaneous": { accountingClass: "other", defaultAccountCode: "9900" },
};

export async function seedAccountingData(businessId: number, locationId?: number) {
  const db = getDb();
  
  // Seed accounts
  for (const account of defaultAccounts) {
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.accountCode, account.accountCode),
    });
    
    if (!existing) {
      await db.insert(accounts).values({
        businessId,
        locationId,
        ...account,
        currentBalance: account.openingBalance,
        type: account.accountSubType === "cash" || account.accountSubType === "bank" 
          ? (account.accountSubType === "bank" ? "bank_account" : "cash")
          : "bank_account",
      });
      console.log(`Created account: ${account.accountCode} - ${account.name}`);
    }
  }
  
  // Update expense categories with accounting classification
  for (const [categoryName, mapping] of Object.entries(expenseCategoryMappings)) {
    const category = await db.query.expenseCategories.findFirst({
      where: eq(expenseCategories.name, categoryName),
    });
    
    if (category) {
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.accountCode, mapping.defaultAccountCode),
      });
      
      await db.update(expenseCategories).set({
        accountingClass: mapping.accountingClass as any,
        defaultAccountId: account?.id,
      }).where(eq(expenseCategories.id, category.id));
      
      console.log(`Updated category: ${categoryName} -> ${mapping.accountingClass}`);
    }
  }
  
  console.log("Accounting data seeded successfully!");
}
```

- [ ] **Step 2: Run seed script**

Add to `db/seed.ts` or run standalone:

```bash
npx tsx db/seed-accounting.ts
```

Expected: Default chart of accounts created

- [ ] **Step 3: Commit**

```bash
git add db/seed-accounting.ts
git commit -m "feat(accounting): add default chart of accounts seeding"
```

---

### Phase 2: Core Business Logic (Tasks 2.1-2.5)

Following tasks are detailed in `tasks.md`. Key files to create:

**Task 2.1: Journal Entry System**
- Create: `api/journal-router.ts`
- Test: `api/__tests__/journal-entries.test.ts`

**Task 2.2: Item Management**
- Create: `api/items-router.ts`
- Test: `api/__tests__/items.test.ts`

**Task 2.3: Chart of Accounts API**
- Create: `api/chart-of-accounts-router.ts`
- Test: `api/__tests__/chart-of-accounts.test.ts`

**Task 2.4: Depreciation Engine**
- Create: `api/lib/depreciation.ts`
- Create: `api/depreciation-router.ts`
- Test: `api/__tests__/depreciation.test.ts`

**Task 2.5: Financial Reports**
- Create: `api/lib/reports.ts`
- Create: `api/reports-router.ts`
- Test: `api/__tests__/reports.test.ts`

---

### Phase 3: Integration with Existing Features (Tasks 3.1-3.4)

**Task 3.1: Expense Integration**
- Modify: `api/expenses-router.ts` (add journal entry creation)
- Modify: `src/pages/Expenses.tsx` (add fixed asset toggle)
- Test: `api/__tests__/expense-journal.test.ts`

**Task 3.2: Bill Integration**
- Modify: `api/bills-router.ts` (add journal entry creation)
- Test: `api/__tests__/bill-journal.test.ts`

**Task 3.3: Daily Sales Integration**
- Modify: `api/daily-sales-router.ts` (add journal entry creation)
- Test: `e2e/__tests__/sales-journal.test.ts`

**Task 3.4: Payroll Integration**
- Modify: `api/employees-payroll-router.ts` (add journal entry creation)
- Test: `e2e/__tests__/payroll-journal.test.ts`

---

### Phase 4: UI Implementation (Tasks 4.1-4.7)

**Task 4.1: Enhanced Accounts Page**
- Modify: `src/pages/Accounts.tsx`
- Test: Manual verification

**Task 4.2: Chart of Accounts Page**
- Create: `src/pages/ChartOfAccounts.tsx`
- Test: Manual verification

**Task 4.3: Items Page**
- Create: `src/pages/Items.tsx`
- Test: Manual verification

**Task 4.4: Journal Entries Page**
- Create: `src/pages/JournalEntries.tsx`
- Test: Manual verification

**Task 4.5: Asset Register Page**
- Create: `src/pages/AssetRegister.tsx`
- Test: Manual verification

**Task 4.6: Reports Page**
- Create: `src/pages/Reports.tsx`
- Test: Manual verification

**Task 4.7: Settings Enhancements**
- Modify: `src/pages/Settings.tsx` (add accounting tab)
- Test: Manual verification

---

### Phase 5: External System Integration (Tasks 5.1-5.2)

**Task 5.1: Sync Configuration UI**
- Create: `src/pages/SyncSettings.tsx`

**Task 5.2: Sync API**
- Create: `api/sync-router.ts`
- Create: `api/lib/sync/quickbooks.ts`
- Create: `api/lib/sync/erpnext.ts`

---

### Phase 6: Testing & Polish (Tasks 6.1-6.4)

**Task 6.1: Unit Tests**
- Create: `api/__tests__/journal.test.ts`
- Create: `api/__tests__/depreciation.test.ts`
- Create: `api/__tests__/reports.test.ts`

**Task 6.2: Integration Tests**
- Create: `api/__tests__/expense-journal.test.ts`
- Create: `e2e/__tests__/accounting-flow.test.ts`

**Task 6.3: UI Testing**
- Manual testing of all new pages

**Task 6.4: Documentation**
- Update: `AGENTS.md`
- Create: `docs/accounting-features.md`

---

## Task Dependencies Summary

```
Phase 1 (Database Foundation)
├── Task 1.1 (Enums) → no dependencies
├── Task 1.2 (accounts table) → Task 1.1
├── Task 1.3 (expense_categories) → Task 1.1
├── Task 1.4 (journal_entries) → Task 1.1
├── Task 1.5 (items, etc.) → Task 1.1
├── Task 1.6 (Migration) → Tasks 1.2-1.5
└── Task 1.7 (Seed) → Task 1.6

Phase 2 (Core Logic)
├── Task 2.1 (Journal router) → Task 1.6
├── Task 2.2 (Items router) → Task 1.6
├── Task 2.3 (COA router) → Task 1.6
├── Task 2.4 (Depreciation) → Tasks 2.1, 2.2
└── Task 2.5 (Reports) → Tasks 2.1, 2.2, 2.3, 2.4

Phase 3 (Integration)
├── Task 3.1 (Expense) → Tasks 2.1, 2.2
├── Task 3.2 (Bill) → Task 2.1
├── Task 3.3 (Sales) → Task 2.1
└── Task 3.4 (Payroll) → Task 2.1

Phase 4 (UI) - all depend on respective API tasks
Phase 5 (Sync) - depends on Phase 4
Phase 6 (Testing) - depends on all previous phases
```

---

## Spec Coverage Check

| Requirement | Tasks |
|-------------|-------|
| Enhanced Chart of Accounts | 1.2, 1.3, 2.3, 4.2 |
| Item Management | 1.5, 2.2, 4.3 |
| Double-Entry Journal | 1.4, 2.1, 4.4 |
| Fixed Asset Depreciation | 1.5, 2.4, 4.5 |
| Financial Reports | 2.5, 4.6 |
| Expense Integration | 3.1 |
| Bill Integration | 3.2 |
| Sales Integration | 3.3 |
| Payroll Integration | 3.4 |
| External Sync | 5.1, 5.2 |
| Testing | 6.1, 6.2, 6.3 |

All requirements from `spec.md` are covered by implementation tasks.

---

## Recommendations

1. **Start with Phase 1** - Database foundation is critical for everything else
2. **Use TDD** - Write tests before implementing each component
3. **Commit frequently** - Small, focused commits make reviews easier
4. **Test integration points early** - Verify expense → journal integration works before moving on
5. **UI last** - Complete API layer before building UI to ensure API contracts are stable
