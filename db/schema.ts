// ABOUTME: Defines the PostgreSQL schema and typed Drizzle table models used by the API.
// ABOUTME: Keeps database structure, constraints, and inferred TypeScript types in one shared module.
import {
  pgTable,
  pgEnum,
  serial,
  bigint,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  boolean,
  integer,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "manager", "employee", "viewer"]);
export const typeEnum = pgEnum("type", ["cash", "mpesa", "bank_account"]);
export const transactionTypeEnum = pgEnum("transactionType", [
    "sale", "expense", "bill_payment", "supplier_payment",
    "payroll", "advance", "transfer", "opening_balance", "mpesa_topup",
    "drawing", "deposit",
  ]);
export const entryTypeEnum = pgEnum("entryType", ["debit", "credit"]);
export const paymentMethodEnum = pgEnum("paymentMethod", ["cash", "mpesa", "bank_transfer"]);
export const statusEnum = pgEnum("status", ["open", "resolved", "partial"]);
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "annually"]);
export const salaryTypeEnum = pgEnum("salaryType", ["monthly", "weekly", "daily", "hourly"]);
export const txnTypeEnum = pgEnum("txnType", ["topup", "expense", "transfer", "bank_transfer", "airtime", "utility", "withdrawal"]);
export const actionEnum = pgEnum("action", ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT"]);
export const severityEnum = pgEnum("severity", ["info", "warning", "critical"]);
export const paymentMethod2Enum = pgEnum("paymentMethod2", ["cash", "mpesa", "bank_transfer", "card"]);
export const billStatusEnum = pgEnum("billStatus", ["pending", "partial", "paid", "overdue", "cancelled"]);
export const payrollStatusEnum = pgEnum("payrollStatus", ["open", "processing", "paid", "cancelled"]);
export const advanceStatusEnum = pgEnum("advanceStatus", ["pending", "approved", "partially_repaid", "repaid", "cancelled"]);
export const leadStatusEnum = pgEnum("leadStatus", ["new", "contacted", "converted", "declined"]);
export const orderStatusEnum = pgEnum("orderStatus", ["draft", "sent", "delivered", "billed", "cancelled"]);


export const customerAccounts = pgTable("customer_accounts", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  plan: varchar("plan", { length: 20 }).default("free").notNull(),
  maxBusinesses: integer("maxBusinesses").default(1).notNull(),
  maxUsers: integer("maxUsers").default(1).notNull(),
  maxTransactionsPerMonth: integer("maxTransactionsPerMonth").default(100).notNull(),
  features: json("features"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 20 }).default("active").notNull(),
  subscriptionExpiry: date("subscriptionExpiry"),
  isActive: boolean("isActive").default(true).notNull(),
  migratedAt: timestamp("migratedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  accountIdIdx: uniqueIndex("idx_customer_accounts_accountId").on(table.accountId),
}));

export type CustomerAccount = typeof customerAccounts.$inferSelect;
export type InsertCustomerAccount = typeof customerAccounts.$inferInsert;

// Users table (supports both OAuth and local auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).unique(),
  username: varchar("username", { length: 100 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: roleEnum("role").default("viewer").notNull(),
  phone: varchar("phone", { length: 20 }),
  locationId: bigint("locationId", { mode: "number" }),
  currentBusinessId: bigint("currentBusinessId", { mode: "number" }),
  accountId: varchar("accountId", { length: 100 }),
  accountRefId: bigint("accountRefId", { mode: "number" }).references(() => customerAccounts.id),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  userIdIdx: index("idx_users_id").on(table.id),
  userDeletedAtIdx: index("idx_users_deletedAt").on(table.deletedAt),
  userIsActiveIdx: index("idx_users_isActive").on(table.isActive),
  userCurrentBusinessIdx: index("idx_users_currentBusinessId").on(table.currentBusinessId),
  userUsernameAccountIdIdx: uniqueIndex("idx_users_username_accountId").on(table.username, table.accountId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Permission matrix - granular permissions per role
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleKey: varchar("roleKey", { length: 50 }).notNull(),
  roleLabel: varchar("roleLabel", { length: 100 }).notNull(),
  permissions: json("permissions").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type RolePermission = typeof rolePermissions.$inferSelect;

// Locations table
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  businessType: varchar("businessType", { length: 50 }),
  country: varchar("country", { length: 100 }),
  county: varchar("county", { length: 100 }),
  subCounty: varchar("subCounty", { length: 100 }),
  address: text("address"),
  businessRegNumber: varchar("businessRegNumber", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  natureOfBusiness: varchar("natureOfBusiness", { length: 255 }),
  kraPin: varchar("kraPin", { length: 20 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  defaultMpesaAccountId: bigint("defaultMpesaAccountId", { mode: "number" }),
  defaultCashAccountId: bigint("defaultCashAccountId", { mode: "number" }),
  nextBillNumber: bigint("nextBillNumber", { mode: "number" }).default(1).notNull(),
  nextExpenseNumber: bigint("nextExpenseNumber", { mode: "number" }).default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Location = typeof locations.$inferSelect;

// Accounts table (cash, mpesa, bank accounts per location)
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: typeEnum("type").notNull(),
  accountCode: varchar("accountCode", { length: 20 }),
  accountNumber: varchar("accountNumber", { length: 100 }),
  openingBalance: numeric("openingBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currentBalance: numeric("currentBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  isPaymentMethod: boolean("isPaymentMethod").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Account = typeof accounts.$inferSelect;

// Ledger entries - now includes drawing and deposit
export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  accountId: bigint("accountId", { mode: "number" }).notNull(),
  transactionType: transactionTypeEnum("transactionType").notNull(),
  transactionId: bigint("transactionId", { mode: "number" }).notNull(),
  entryType: entryTypeEnum("entryType").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: numeric("balanceAfter", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  refNo: varchar("refNo", { length: 50 }),
  entryDate: date("entryDate").notNull(),
  createdBy: bigint("createdBy", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type LedgerEntry = typeof ledgerEntries.$inferSelect;

// Daily sales
export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  saleDate: date("saleDate").notNull(),
  cashTotal: numeric("cashTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  cardTotal: numeric("cardTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  mpesaTotal: numeric("mpesaTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  familyBankTotal: numeric("familyBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  coopBankTotal: numeric("coopBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  equityBankTotal: numeric("equityBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  boltTotal: numeric("boltTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  glovoTotal: numeric("glovoTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  creditCardTotal: numeric("creditCardTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  deliveryPartnerTotal: numeric("deliveryPartnerTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netSales: numeric("netSales", { precision: 15, scale: 2 }).default("0.00").notNull(),
  discountAmount: numeric("discountAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  voidAmount: numeric("voidAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  unpaidAmount: numeric("unpaidAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ticketCount: integer("ticketCount").default(0),
  orderCount: integer("orderCount").default(0),
  voidCount: integer("voidCount").default(0),
  giftCount: integer("giftCount").default(0),
  notes: text("notes"),
  unpaidNotes: text("unpaidNotes"),
  enteredBy: bigint("enteredBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type DailySale = typeof dailySales.$inferSelect;

// Expense categories
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#C73E1D"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;

// Expenses
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  categoryId: bigint("categoryId", { mode: "number" }).notNull(),
  supplierId: bigint("supplierId", { mode: "number" }),
  expenseNumber: varchar("expenseNumber", { length: 50 }),
  billId: bigint("billId", { mode: "number" }),
  refNo: varchar("refNo", { length: 50 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  expenseDate: date("expenseDate").notNull(),
  paymentMethod: paymentMethod2Enum("paymentMethod").notNull(),
  accountId: bigint("accountId", { mode: "number" }),
  receiptImageUrl: text("receiptImageUrl"),
  mpesaTxnId: varchar("mpesaTxnId", { length: 20 }),
  expenseRef: varchar("expenseRef", { length: 50 }),
  isReimbursable: boolean("isReimbursable").default(false),
  reimbursedTo: bigint("reimbursedTo", { mode: "number" }),
  enteredBy: bigint("enteredBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Expense = typeof expenses.$inferSelect;

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  locationId: bigint("locationId", { mode: "number" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  contactPerson: varchar("contactPerson", { length: 255 }),
  kraPin: varchar("kraPin", { length: 20 }),
  paymentTermsDays: integer("paymentTermsDays").default(30).notNull(),
  creditLimit: numeric("creditLimit", { precision: 15, scale: 2 }),
  currentBalance: numeric("currentBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalBilled: numeric("totalBilled", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalPaid: numeric("totalPaid", { precision: 15, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  autoCategoryId: bigint("autoCategoryId", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  businessIdx: index("business_idx").on(table.businessId),
  locationIdx: index("location_idx").on(table.locationId),
  deletedIdx: index("deleted_idx").on(table.deletedAt),
}));

export type Supplier = typeof suppliers.$inferSelect;

// Bills (accounts payable)
export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  supplierId: bigint("supplierId", { mode: "number" }),
  billNumber: varchar("billNumber", { length: 100 }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  amountPaid: numeric("amountPaid", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balanceDue: numeric("balanceDue", { precision: 15, scale: 2 }).notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate").notNull(),
  status: billStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Bill = typeof bills.$inferSelect;

// Bill line items
export const billItems = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: bigint("billId", { mode: "number" }).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  unitPrice: numeric("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: numeric("totalPrice", { precision: 15, scale: 2 }).notNull(),
  categoryId: bigint("categoryId", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type BillItem = typeof billItems.$inferSelect;

// Master items - for autocomplete and price memory
export const masterItems = pgTable("master_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  lastUnitPrice: numeric("lastUnitPrice", { precision: 15, scale: 2 }),
  lastCategoryId: bigint("lastCategoryId", { mode: "number" }),
  lastSupplierId: bigint("lastSupplierId", { mode: "number" }),
  usageCount: integer("usageCount").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type MasterItem = typeof masterItems.$inferSelect;

// Bill payments
export const billPayments = pgTable("bill_payments", {
  id: serial("id").primaryKey(),
  billId: bigint("billId", { mode: "number" }).notNull(),
  paymentMethod: paymentMethod2Enum("paymentMethod").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("paymentDate").notNull(),
  reference: varchar("reference", { length: 100 }),
  notes: text("notes"),
  accountId: bigint("accountId", { mode: "number" }),
  enteredBy: bigint("enteredBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type BillPayment = typeof billPayments.$inferSelect;

// Recurring bill templates
export const recurringBillTemplates = pgTable("recurring_bill_templates", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  supplierId: bigint("supplierId", { mode: "number" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  frequency: frequencyEnum("frequency").notNull(),
  dayOfWeek: integer("dayOfWeek"),
  dayOfMonth: integer("dayOfMonth"),
  monthOfYear: integer("monthOfYear"),
  nextDueDate: date("nextDueDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type RecurringBillTemplate = typeof recurringBillTemplates.$inferSelect;

// Employees
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  userId: bigint("userId", { mode: "number" }),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  idNumber: varchar("idNumber", { length: 20 }),
  kraPin: varchar("kraPin", { length: 20 }),
  nssfNumber: varchar("nssfNumber", { length: 20 }),
  nhifNumber: varchar("nhifNumber", { length: 20 }),
  salaryType: salaryTypeEnum("salaryType").notNull(),
  basicSalary: numeric("basicSalary", { precision: 15, scale: 2 }).notNull(),
  bankName: varchar("bankName", { length: 100 }),
  bankAccount: varchar("bankAccount", { length: 50 }),
  bankCode: varchar("bankCode", { length: 10 }),
  employmentDate: date("employmentDate").notNull(),
  terminationDate: date("terminationDate"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Employee = typeof employees.$inferSelect;

// Payroll
export const payrollPeriods = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  periodName: varchar("periodName", { length: 50 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  paymentDate: date("paymentDate").notNull(),
  status: payrollStatusEnum("status").default("open").notNull(),
  generatedBillId: bigint("generatedBillId", { mode: "number" }),
  totalNetPay: numeric("totalNetPay", { precision: 15, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollPeriod = typeof payrollPeriods.$inferSelect;

export const payrollEntries = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  periodId: bigint("periodId", { mode: "number" }).notNull(),
  employeeId: bigint("employeeId", { mode: "number" }).notNull(),
  basicPay: numeric("basicPay", { precision: 15, scale: 2 }).notNull(),
  advancesDeducted: numeric("advancesDeducted", { precision: 15, scale: 2 }).default("0.00").notNull(),
  deductions: numeric("deductions", { precision: 15, scale: 2 }).default("0.00").notNull(),
  bonuses: numeric("bonuses", { precision: 15, scale: 2 }).default("0.00").notNull(),
  overtimePay: numeric("overtimePay", { precision: 15, scale: 2 }).default("0.00").notNull(),
  payeDeducted: numeric("payeDeducted", { precision: 15, scale: 2 }).default("0.00").notNull(),
  nhifDeducted: numeric("nhifDeducted", { precision: 15, scale: 2 }).default("0.00").notNull(),
  nssfDeducted: numeric("nssfDeducted", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netPay: numeric("netPay", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").default("mpesa").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollEntry = typeof payrollEntries.$inferSelect;

export const payrollAdvances = pgTable("payroll_advances", {
  id: serial("id").primaryKey(),
  employeeId: bigint("employeeId", { mode: "number" }).notNull(),
  payrollPeriodId: bigint("payrollPeriodId", { mode: "number" }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  balanceRemaining: numeric("balanceRemaining", { precision: 15, scale: 2 }).notNull(),
  requestDate: date("requestDate").notNull(),
  repaymentPeriods: integer("repaymentPeriods").default(1),
  status: advanceStatusEnum("status").default("pending").notNull(),
  approvedBy: bigint("approvedBy", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollAdvance = typeof payrollAdvances.$inferSelect;

// M-PESA transactions
export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  txnId: varchar("txnId", { length: 20 }).notNull().unique(),
  txnDate: date("txnDate").notNull(),
  txnTime: varchar("txnTime", { length: 10 }),
  txnType: txnTypeEnum("txnType").notNull(),
  partyName: varchar("partyName", { length: 255 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  txnFee: numeric("txnFee", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }),
  description: text("description"),
  rawText: text("rawText"),
  isLinked: boolean("isLinked").default(false).notNull(),
  linkedExpenseId: bigint("linkedExpenseId", { mode: "number" }),
  linkedBillId: bigint("linkedBillId", { mode: "number" }),
  linkedSupplierId: bigint("linkedSupplierId", { mode: "number" }),
  sourceAccountId: bigint("sourceAccountId", { mode: "number" }), // bank account that funded this topup
  destinationAccountId: bigint("destinationAccountId", { mode: "number" }), // M-PESA wallet that received this topup
  importedBy: bigint("importedBy", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type MpesaTransaction = typeof mpesaTransactions.$inferSelect;

// Daily M-PESA Ledger
export const dailyMpesaLedger = pgTable("daily_mpesa_ledger", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  accountId: bigint("accountId", { mode: "number" }).notNull(), // specific M-PESA wallet
  ledgerDate: date("ledgerDate").notNull(),
  openingBalance: numeric("openingBalance", { precision: 15, scale: 2 }).notNull(),
  totalTopups: numeric("totalTopups", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalExpenditures: numeric("totalExpenditures", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalFees: numeric("totalFees", { precision: 15, scale: 2 }).default("0.00").notNull(),
  closingBalance: numeric("closingBalance", { precision: 15, scale: 2 }).notNull(),
  transactionCount: integer("transactionCount").default(0).notNull(),
  notes: text("notes"),
  enteredBy: bigint("enteredBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type DailyMpesaLedger = typeof dailyMpesaLedger.$inferSelect;

// Audit log
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  recordId: bigint("recordId", { mode: "number" }).notNull(),
  action: actionEnum("action").notNull(),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  changedBy: bigint("changedBy", { mode: "number" }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;

// Businesses (multi-tenancy)
export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull(),
  accountRefId: bigint("accountRefId", { mode: "number" }).references(() => customerAccounts.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  businessType: varchar("businessType", { length: 50 }),
  country: varchar("country", { length: 100 }),
  county: varchar("county", { length: 100 }),
  subCounty: varchar("subCounty", { length: 100 }),
  address: text("address"),
  businessRegNumber: varchar("businessRegNumber", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  natureOfBusiness: varchar("natureOfBusiness", { length: 255 }),
  kraPin: varchar("kraPin", { length: 20 }),
  email: varchar("email", { length: 255 }),
  plan: varchar("plan", { length: 20 }).default("free").notNull(),
  maxBranches: integer("maxBranches").default(1),
  maxUsers: integer("maxUsers").default(1),
  maxTransactionsPerMonth: integer("maxTransactionsPerMonth").default(100),
  features: json("features"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 20 }).default("active"),
  subscriptionExpiry: date("subscriptionExpiry"),
  isMultiLocation: boolean("isMultiLocation").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  isWhiteLabel: boolean("isWhiteLabel").default(false).notNull(),
  whiteLabelDomain: varchar("whiteLabelDomain", { length: 255 }),
  referralCode: varchar("referralCode", { length: 50 }),
  referredByBusinessId: bigint("referredByBusinessId", { mode: "number" }),
  referredByUserId: bigint("referredByUserId", { mode: "number" }),
  firstMonthDiscountApplied: boolean("firstMonthDiscountApplied").default(false).notNull(),
  partnerId: bigint("partnerId", { mode: "number" }),
  revSharePercent: numeric("revSharePercent", { precision: 5, scale: 2 }).default("20.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Business = typeof businesses.$inferSelect;

// Business logos (letterheads and brand assets)
export const businessLogos = pgTable("business_logos", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileData: text("fileData").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("sizeBytes").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  uploadedBy: bigint("uploadedBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  bizLogoBusinessIdx: index("idx_business_logos_businessId").on(table.businessId),
  bizLogoIsActiveIdx: index("idx_business_logos_isActive").on(table.isActive),
  bizLogoUploadedByIdx: index("idx_business_logos_uploadedBy").on(table.uploadedBy),
  bizLogoDeletedAtIdx: index("idx_business_logos_deletedAt").on(table.deletedAt),
}));

export type BusinessLogo = typeof businessLogos.$inferSelect;

// Business documents (registration certs, KRA, licenses, etc.)
export const businessDocuments = pgTable("business_documents", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  documentType: varchar("documentType", { length: 50 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileData: text("fileData").notNull(),
  mimeType: varchar("mimeType", { length: 50 }),
  notes: text("notes"),
  uploadedBy: bigint("uploadedBy", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type BusinessDocument = typeof businessDocuments.$inferSelect;

// User-Business junction (many-to-many)
export const userBusinesses = pgTable("user_businesses", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  role: varchar("role", { length: 50 }).default("admin"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBusiness = typeof userBusinesses.$inferSelect;

// Generic attachments (photos for daily_sales, expenses, bills)
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  recordType: varchar("recordType", { length: 50 }).notNull(),
  recordId: bigint("recordId", { mode: "number" }).notNull(),
  imageData: text("imageData").notNull(),
  mimeType: varchar("mimeType", { length: 50 }).default("image/jpeg"),
  caption: varchar("caption", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Attachment = typeof attachments.$inferSelect;

// App settings (feature toggles)
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type AppSetting = typeof appSettings.$inferSelect;

// Feedback questionnaires
export const feedbackQuestionnaires = pgTable("feedback_questionnaires", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  questions: json("questions").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackQuestionnaire = typeof feedbackQuestionnaires.$inferSelect;

// Feedback responses
export const feedbackResponses = pgTable("feedback_responses", {
  id: serial("id").primaryKey(),
  questionnaireId: bigint("questionnaireId", { mode: "number" }).notNull(),
  respondentName: varchar("respondentName", { length: 255 }),
  respondentEmail: varchar("respondentEmail", { length: 320 }),
  answers: json("answers").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackResponse = typeof feedbackResponses.$inferSelect;

// Payment methods - configurable per business (account linking happens at branch level)
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }),
  accountRefId: bigint("accountRefId", { mode: "number" }).references(() => customerAccounts.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).default("#C73E1D"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

// Location-PaymentMethod junction (which methods a location accepts + which account they link to)
export const locationPaymentMethods = pgTable("location_payment_methods", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  paymentMethodId: bigint("paymentMethodId", { mode: "number" }).notNull(),
  linkedAccountId: bigint("linkedAccountId", { mode: "number" }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocationPaymentMethod = typeof locationPaymentMethods.$inferSelect;

// Daily sale payments (child records linking daily sales to payment methods)
export const dailySalePayments = pgTable("daily_sale_payments", {
  id: serial("id").primaryKey(),
  dailySaleId: bigint("dailySaleId", { mode: "number" }).notNull(),
  paymentMethodId: bigint("paymentMethodId", { mode: "number" }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailySalePayment = typeof dailySalePayments.$inferSelect;

// Business inquiries (landing page registrations)
export const businessInquiries = pgTable("business_inquiries", {
  id: serial("id").primaryKey(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  suggestedPrice: numeric("suggestedPrice", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: leadStatusEnum("status").default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BusinessInquiry = typeof businessInquiries.$inferSelect;

// Budgets per category per location per month
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }),
  categoryId: bigint("categoryId", { mode: "number" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Budget = typeof budgets.$inferSelect;

// Payroll settings (statutory deduction rates per location)
export const payrollSettings = pgTable("payroll_settings", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }),
  nhifRate: numeric("nhifRate", { precision: 5, scale: 2 }).default("2.75"),
  nssfTier1Limit: numeric("nssfTier1Limit", { precision: 15, scale: 2 }).default("7000.00"),
  nssfTier1Employee: numeric("nssfTier1Employee", { precision: 15, scale: 2 }).default("420.00"),
  nssfTier1Employer: numeric("nssfTier1Employer", { precision: 15, scale: 2 }).default("420.00"),
  nssfTier2Limit: numeric("nssfTier2Limit", { precision: 15, scale: 2 }).default("36000.00"),
  nssfTier2Employee: numeric("nssfTier2Employee", { precision: 15, scale: 2 }).default("1740.00"),
  nssfTier2Employer: numeric("nssfTier2Employer", { precision: 15, scale: 2 }).default("1740.00"),
  personalRelief: numeric("personalRelief", { precision: 15, scale: 2 }).default("2400.00"),
  insuranceRelief: numeric("insuranceRelief", { precision: 15, scale: 2 }).default("0.00"),
  payeBands: json("payeBands"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PayrollSetting = typeof payrollSettings.$inferSelect;

// COGS (food cost) targets per location
export const cogsTargets = pgTable("cogs_targets", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }),
  targetFoodCostPercent: numeric("targetFoodCostPercent", { precision: 5, scale: 2 }).default("35.00"),
  alertThresholdPercent: numeric("alertThresholdPercent", { precision: 5, scale: 2 }).default("38.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CogsTarget = typeof cogsTargets.$inferSelect;

// Account balance alert configuration
export const alertsConfig = pgTable("alerts_config", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }),
  accountId: bigint("accountId", { mode: "number" }),
  minBalance: numeric("minBalance", { precision: 15, scale: 2 }).default("10000.00"),
  notifyEmail: varchar("notifyEmail", { length: 320 }),
  notifyPhone: varchar("notifyPhone", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type AlertConfig = typeof alertsConfig.$inferSelect;

// Alerts log
export const alertsLog = pgTable("alerts_log", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: severityEnum("severity").default("info").notNull(),
  locationId: bigint("locationId", { mode: "number" }),
  accountId: bigint("accountId", { mode: "number" }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertLog = typeof alertsLog.$inferSelect;

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number" }).notNull(),
  supplierId: bigint("supplierId", { mode: "number" }),
  billId: bigint("billId", { mode: "number" }),
  poNumber: varchar("poNumber", { length: 50 }),
  description: text("description"),
  status: orderStatusEnum("status").default("draft").notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0.00"),
  taxAmount: numeric("taxAmount", { precision: 15, scale: 2 }).default("0.00"),
  total: numeric("total", { precision: 15, scale: 2 }).default("0.00"),
  deliveryDate: date("deliveryDate"),
  deliveryNotes: text("deliveryNotes"),
  terms: text("terms"),
  createdBy: bigint("createdBy", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: bigint("poId", { mode: "number" }).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  unitPrice: numeric("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: numeric("totalPrice", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// M-PESA reconciliation
export const mpesaReconciliation = pgTable("mpesa_reconciliation", {
  id: serial("id").primaryKey(),
  txnDate: date("txnDate").notNull(),
  orphanCount: integer("orphanCount").default(0),
  orphanTotal: numeric("orphanTotal", { precision: 15, scale: 2 }).default("0.00"),
  matchedCount: integer("matchedCount").default(0),
  matchedTotal: numeric("matchedTotal", { precision: 15, scale: 2 }).default("0.00"),
  status: statusEnum("status").default("open").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type MpesaReconciliation = typeof mpesaReconciliation.$inferSelect;

// Notifications (push + in-app)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: severityEnum("severity").default("info").notNull(),
  locationId: bigint("locationId", { mode: "number" }),
  entityType: varchar("entityType", { length: 50 }),
  entityId: bigint("entityId", { mode: "number" }),
  isRead: boolean("isRead").default(false).notNull(),
  isPushed: boolean("isPushed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// Supplier price history
export const supplierPriceHistory = pgTable("supplier_price_history", {
  id: serial("id").primaryKey(),
  supplierId: bigint("supplierId", { mode: "number" }),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  billId: bigint("billId", { mode: "number" }),
  unitPrice: numeric("unitPrice", { precision: 15, scale: 2 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  priceDate: date("priceDate").notNull(),
  locationId: bigint("locationId", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplierPriceHistory = typeof supplierPriceHistory.$inferSelect;

// Price alert rules
export const priceAlertRules = pgTable("price_alert_rules", {
  id: serial("id").primaryKey(),
  supplierId: bigint("supplierId", { mode: "number" }),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  expectedPrice: numeric("expectedPrice", { precision: 15, scale: 2 }),
  variancePercent: numeric("variancePercent", { precision: 5, scale: 2 }).default("10.00"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PriceAlertRule = typeof priceAlertRules.$inferSelect;

// Quick actions log
export const quickActionsLog = pgTable("quick_actions_log", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: bigint("entityId", { mode: "number" }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuickActionLog = typeof quickActionsLog.$inferSelect;

// Web push subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }),
  subscription: json("subscription").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// API Keys for external integrations
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 20 }).notNull(),
  scopes: json("scopes"),
  lastUsedAt: timestamp("lastUsedAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type ApiKey = typeof apiKeys.$inferSelect;

// Webhooks
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  events: json("events").notNull(),
  secret: varchar("secret", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastStatus: varchar("lastStatus", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Webhook = typeof webhooks.$inferSelect;

// Webhook delivery log
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: bigint("webhookId", { mode: "number" }).notNull(),
  event: varchar("event", { length: 50 }).notNull(),
  payload: json("payload"),
  status: varchar("status", { length: 50 }).notNull(),
  statusCode: integer("statusCode"),
  response: text("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// Partner commission tracking
export const partnerCommissions = pgTable("partner_commissions", {
  id: serial("id").primaryKey(),
  partnerId: bigint("partnerId", { mode: "number" }).notNull(),
  businessId: bigint("businessId", { mode: "number" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  subscriptionAmount: numeric("subscriptionAmount", { precision: 15, scale: 2 }).default("0.00"),
  commissionPercent: numeric("commissionPercent", { precision: 5, scale: 2 }).default("20.00"),
  commissionAmount: numeric("commissionAmount", { precision: 15, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerCommission = typeof partnerCommissions.$inferSelect;

// Refresh tokens for session management
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  deviceInfo: text("deviceInfo"),
  isRevoked: boolean("isRevoked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  refreshUserIdx: index("idx_refresh_tokens_userId").on(table.userId),
  refreshTokenHashIdx: index("idx_refresh_tokens_tokenHash").on(table.tokenHash),
  refreshExpiresIdx: index("idx_refresh_tokens_expires").on(table.expiresAt),
}));

export type RefreshToken = typeof refreshTokens.$inferSelect;

