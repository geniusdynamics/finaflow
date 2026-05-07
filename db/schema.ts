import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  boolean,
  int,
  json,
} from "drizzle-orm/mysql-core";

// Users table (supports both OAuth and local auth)
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).unique(),
  username: varchar("username", { length: 100 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["owner", "admin", "manager", "employee", "viewer"]).default("viewer").notNull(),
  phone: varchar("phone", { length: 20 }),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  currentBusinessId: bigint("currentBusinessId", { mode: "number", unsigned: true }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Permission matrix - granular permissions per role
export const rolePermissions = mysqlTable("role_permissions", {
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
export const locations = mysqlTable("locations", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  defaultMpesaAccountId: bigint("defaultMpesaAccountId", { mode: "number", unsigned: true }),
  defaultCashAccountId: bigint("defaultCashAccountId", { mode: "number", unsigned: true }),
  nextBillNumber: bigint("nextBillNumber", { mode: "number", unsigned: true }).default("1").notNull(),
  nextExpenseNumber: bigint("nextExpenseNumber", { mode: "number", unsigned: true }).default("1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Location = typeof locations.$inferSelect;

// Accounts table (cash, mpesa, bank accounts per location)
export const accounts = mysqlTable("accounts", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["cash", "mpesa", "bank_account"]).notNull(),
  accountCode: varchar("accountCode", { length: 20 }),
  accountNumber: varchar("accountNumber", { length: 100 }),
  openingBalance: decimal("openingBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currentBalance: decimal("currentBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  isPaymentMethod: boolean("isPaymentMethod").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Account = typeof accounts.$inferSelect;

// Ledger entries - now includes drawing and deposit
export const ledgerEntries = mysqlTable("ledger_entries", {
  id: serial("id").primaryKey(),
  accountId: bigint("accountId", { mode: "number", unsigned: true }).notNull(),
  transactionType: mysqlEnum("transactionType", [
    "sale", "expense", "bill_payment", "supplier_payment",
    "payroll", "advance", "transfer", "opening_balance", "mpesa_topup",
    "drawing", "deposit",
  ]).notNull(),
  transactionId: bigint("transactionId", { mode: "number", unsigned: true }).notNull(),
  entryType: mysqlEnum("entryType", ["debit", "credit"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 15, scale: 2 }).notNull(),
  description: text("description"),
  refNo: varchar("refNo", { length: 50 }),
  entryDate: date("entryDate").notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type LedgerEntry = typeof ledgerEntries.$inferSelect;

// Daily sales
export const dailySales = mysqlTable("daily_sales", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  saleDate: date("saleDate").notNull(),
  cashTotal: decimal("cashTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  cardTotal: decimal("cardTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  mpesaTotal: decimal("mpesaTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  familyBankTotal: decimal("familyBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  coopBankTotal: decimal("coopBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  equityBankTotal: decimal("equityBankTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  boltTotal: decimal("boltTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  glovoTotal: decimal("glovoTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  creditCardTotal: decimal("creditCardTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  deliveryPartnerTotal: decimal("deliveryPartnerTotal", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netSales: decimal("netSales", { precision: 15, scale: 2 }).default("0.00").notNull(),
  discountAmount: decimal("discountAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  voidAmount: decimal("voidAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  unpaidAmount: decimal("unpaidAmount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ticketCount: int("ticketCount").default(0),
  orderCount: int("orderCount").default(0),
  voidCount: int("voidCount").default(0),
  giftCount: int("giftCount").default(0),
  notes: text("notes"),
  unpaidNotes: text("unpaidNotes"),
  enteredBy: bigint("enteredBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type DailySale = typeof dailySales.$inferSelect;

// Expense categories
export const expenseCategories = mysqlTable("expense_categories", {
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
export const expenses = mysqlTable("expenses", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  categoryId: bigint("categoryId", { mode: "number", unsigned: true }).notNull(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  expenseNumber: varchar("expenseNumber", { length: 50 }),
  billId: bigint("billId", { mode: "number", unsigned: true }),
  refNo: varchar("refNo", { length: 50 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  expenseDate: date("expenseDate").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "mpesa", "bank_transfer", "card"]).notNull(),
  accountId: bigint("accountId", { mode: "number", unsigned: true }),
  receiptImageUrl: text("receiptImageUrl"),
  mpesaTxnId: varchar("mpesaTxnId", { length: 20 }),
  expenseRef: varchar("expenseRef", { length: 50 }),
  isReimbursable: boolean("isReimbursable").default(false),
  reimbursedTo: bigint("reimbursedTo", { mode: "number", unsigned: true }),
  enteredBy: bigint("enteredBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Expense = typeof expenses.$inferSelect;

// Suppliers
export const suppliers = mysqlTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  contactPerson: varchar("contactPerson", { length: 255 }),
  kraPin: varchar("kraPin", { length: 20 }),
  paymentTermsDays: int("paymentTermsDays").default(30).notNull(),
  creditLimit: decimal("creditLimit", { precision: 15, scale: 2 }),
  currentBalance: decimal("currentBalance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalBilled: decimal("totalBilled", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalPaid: decimal("totalPaid", { precision: 15, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  autoCategoryId: bigint("autoCategoryId", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Supplier = typeof suppliers.$inferSelect;

// Bills (accounts payable)
export const bills = mysqlTable("bills", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  billNumber: varchar("billNumber", { length: 100 }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  amountPaid: decimal("amountPaid", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balanceDue: decimal("balanceDue", { precision: 15, scale: 2 }).notNull(),
  issueDate: date("issueDate").notNull(),
  dueDate: date("dueDate").notNull(),
  status: mysqlEnum("status", ["pending", "partial", "paid", "overdue", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Bill = typeof bills.$inferSelect;

// Bill line items
export const billItems = mysqlTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: bigint("billId", { mode: "number", unsigned: true }).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 15, scale: 2 }).notNull(),
  categoryId: bigint("categoryId", { mode: "number", unsigned: true }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type BillItem = typeof billItems.$inferSelect;

// Master items - for autocomplete and price memory
export const masterItems = mysqlTable("master_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  lastUnitPrice: decimal("lastUnitPrice", { precision: 15, scale: 2 }),
  lastCategoryId: bigint("lastCategoryId", { mode: "number", unsigned: true }),
  lastSupplierId: bigint("lastSupplierId", { mode: "number", unsigned: true }),
  usageCount: int("usageCount").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type MasterItem = typeof masterItems.$inferSelect;

// Bill payments
export const billPayments = mysqlTable("bill_payments", {
  id: serial("id").primaryKey(),
  billId: bigint("billId", { mode: "number", unsigned: true }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "mpesa", "bank_transfer", "card"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("paymentDate").notNull(),
  reference: varchar("reference", { length: 100 }),
  notes: text("notes"),
  accountId: bigint("accountId", { mode: "number", unsigned: true }),
  enteredBy: bigint("enteredBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type BillPayment = typeof billPayments.$inferSelect;

// Recurring bill templates
export const recurringBillTemplates = mysqlTable("recurring_bill_templates", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "quarterly", "annually"]).notNull(),
  dayOfWeek: int("dayOfWeek"),
  dayOfMonth: int("dayOfMonth"),
  monthOfYear: int("monthOfYear"),
  nextDueDate: date("nextDueDate").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type RecurringBillTemplate = typeof recurringBillTemplates.$inferSelect;

// Employees
export const employees = mysqlTable("employees", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  idNumber: varchar("idNumber", { length: 20 }),
  kraPin: varchar("kraPin", { length: 20 }),
  nssfNumber: varchar("nssfNumber", { length: 20 }),
  nhifNumber: varchar("nhifNumber", { length: 20 }),
  salaryType: mysqlEnum("salaryType", ["monthly", "weekly", "daily", "hourly"]).notNull(),
  basicSalary: decimal("basicSalary", { precision: 15, scale: 2 }).notNull(),
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
export const payrollPeriods = mysqlTable("payroll_periods", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  periodName: varchar("periodName", { length: 50 }).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  paymentDate: date("paymentDate").notNull(),
  status: mysqlEnum("status", ["open", "processing", "paid", "cancelled"]).default("open").notNull(),
  generatedBillId: bigint("generatedBillId", { mode: "number", unsigned: true }),
  totalNetPay: decimal("totalNetPay", { precision: 15, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollPeriod = typeof payrollPeriods.$inferSelect;

export const payrollEntries = mysqlTable("payroll_entries", {
  id: serial("id").primaryKey(),
  periodId: bigint("periodId", { mode: "number", unsigned: true }).notNull(),
  employeeId: bigint("employeeId", { mode: "number", unsigned: true }).notNull(),
  basicPay: decimal("basicPay", { precision: 15, scale: 2 }).notNull(),
  advancesDeducted: decimal("advancesDeducted", { precision: 15, scale: 2 }).default("0.00").notNull(),
  deductions: decimal("deductions", { precision: 15, scale: 2 }).default("0.00").notNull(),
  bonuses: decimal("bonuses", { precision: 15, scale: 2 }).default("0.00").notNull(),
  overtimePay: decimal("overtimePay", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netPay: decimal("netPay", { precision: 15, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "mpesa", "bank_transfer"]).default("mpesa").notNull(),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollEntry = typeof payrollEntries.$inferSelect;

export const payrollAdvances = mysqlTable("payroll_advances", {
  id: serial("id").primaryKey(),
  employeeId: bigint("employeeId", { mode: "number", unsigned: true }).notNull(),
  payrollPeriodId: bigint("payrollPeriodId", { mode: "number", unsigned: true }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  balanceRemaining: decimal("balanceRemaining", { precision: 15, scale: 2 }).notNull(),
  requestDate: date("requestDate").notNull(),
  repaymentPeriods: int("repaymentPeriods").default(1),
  status: mysqlEnum("status", ["pending", "approved", "partially_repaid", "repaid", "cancelled"]).default("pending").notNull(),
  approvedBy: bigint("approvedBy", { mode: "number", unsigned: true }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PayrollAdvance = typeof payrollAdvances.$inferSelect;

// M-PESA transactions
export const mpesaTransactions = mysqlTable("mpesa_transactions", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  txnId: varchar("txnId", { length: 20 }).notNull().unique(),
  txnDate: date("txnDate").notNull(),
  txnTime: varchar("txnTime", { length: 10 }),
  txnType: mysqlEnum("txnType", ["topup", "expense", "transfer", "bank_transfer", "airtime", "utility", "withdrawal"]).notNull(),
  partyName: varchar("partyName", { length: 255 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  txnFee: decimal("txnFee", { precision: 15, scale: 2 }).default("0.00").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }),
  description: text("description"),
  rawText: text("rawText"),
  isLinked: boolean("isLinked").default(false).notNull(),
  linkedExpenseId: bigint("linkedExpenseId", { mode: "number", unsigned: true }),
  linkedBillId: bigint("linkedBillId", { mode: "number", unsigned: true }),
  linkedSupplierId: bigint("linkedSupplierId", { mode: "number", unsigned: true }),
  sourceAccountId: bigint("sourceAccountId", { mode: "number", unsigned: true }), // bank account that funded this topup
  destinationAccountId: bigint("destinationAccountId", { mode: "number", unsigned: true }), // M-PESA wallet that received this topup
  importedBy: bigint("importedBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type MpesaTransaction = typeof mpesaTransactions.$inferSelect;

// Daily M-PESA Ledger
export const dailyMpesaLedger = mysqlTable("daily_mpesa_ledger", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  accountId: bigint("accountId", { mode: "number", unsigned: true }).notNull(), // specific M-PESA wallet
  ledgerDate: date("ledgerDate").notNull(),
  openingBalance: decimal("openingBalance", { precision: 15, scale: 2 }).notNull(),
  totalTopups: decimal("totalTopups", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalExpenditures: decimal("totalExpenditures", { precision: 15, scale: 2 }).default("0.00").notNull(),
  totalFees: decimal("totalFees", { precision: 15, scale: 2 }).default("0.00").notNull(),
  closingBalance: decimal("closingBalance", { precision: 15, scale: 2 }).notNull(),
  transactionCount: int("transactionCount").default(0).notNull(),
  notes: text("notes"),
  enteredBy: bigint("enteredBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type DailyMpesaLedger = typeof dailyMpesaLedger.$inferSelect;

// Audit log
export const auditLog = mysqlTable("audit_log", {
  id: serial("id").primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  recordId: bigint("recordId", { mode: "number", unsigned: true }).notNull(),
  action: mysqlEnum("action", ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT"]).notNull(),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  changedBy: bigint("changedBy", { mode: "number", unsigned: true }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;

// Businesses (multi-tenancy)
export const businesses = mysqlTable("businesses", {
  id: serial("id").primaryKey(),
  accountId: varchar("accountId", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  plan: varchar("plan", { length: 20 }).default("free").notNull(),
  maxBranches: int("maxBranches").default(1),
  maxUsers: int("maxUsers").default(1),
  maxTransactionsPerMonth: int("maxTransactionsPerMonth").default(100),
  features: json("features"),
  subscriptionStatus: varchar("subscriptionStatus", { length: 20 }).default("active"),
  subscriptionExpiry: date("subscriptionExpiry"),
  isMultiLocation: boolean("isMultiLocation").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  isWhiteLabel: boolean("isWhiteLabel").default(false).notNull(),
  whiteLabelDomain: varchar("whiteLabelDomain", { length: 255 }),
  referralCode: varchar("referralCode", { length: 50 }),
  referredByBusinessId: bigint("referredByBusinessId", { mode: "number", unsigned: true }),
  referredByUserId: bigint("referredByUserId", { mode: "number", unsigned: true }),
  firstMonthDiscountApplied: boolean("firstMonthDiscountApplied").default(false).notNull(),
  partnerId: bigint("partnerId", { mode: "number", unsigned: true }),
  revSharePercent: decimal("revSharePercent", { precision: 5, scale: 2 }).default("20.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Business = typeof businesses.$inferSelect;

// User-Business junction (many-to-many)
export const userBusinesses = mysqlTable("user_businesses", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }).notNull(),
  role: varchar("role", { length: 50 }).default("admin"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserBusiness = typeof userBusinesses.$inferSelect;

// Generic attachments (photos for daily_sales, expenses, bills)
export const attachments = mysqlTable("attachments", {
  id: serial("id").primaryKey(),
  recordType: varchar("recordType", { length: 50 }).notNull(),
  recordId: bigint("recordId", { mode: "number", unsigned: true }).notNull(),
  imageData: text("imageData").notNull(),
  mimeType: varchar("mimeType", { length: 50 }).default("image/jpeg"),
  caption: varchar("caption", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Attachment = typeof attachments.$inferSelect;

// App settings (feature toggles)
export const appSettings = mysqlTable("app_settings", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type AppSetting = typeof appSettings.$inferSelect;

// Feedback questionnaires
export const feedbackQuestionnaires = mysqlTable("feedback_questionnaires", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  questions: json("questions").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackQuestionnaire = typeof feedbackQuestionnaires.$inferSelect;

// Feedback responses
export const feedbackResponses = mysqlTable("feedback_responses", {
  id: serial("id").primaryKey(),
  questionnaireId: bigint("questionnaireId", { mode: "number", unsigned: true }).notNull(),
  respondentName: varchar("respondentName", { length: 255 }),
  respondentEmail: varchar("respondentEmail", { length: 320 }),
  answers: json("answers").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeedbackResponse = typeof feedbackResponses.$inferSelect;

// Payment methods - configurable per business (account linking happens at branch level)
export const paymentMethods = mysqlTable("payment_methods", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).default("#C73E1D"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

// Location-PaymentMethod junction (which methods a location accepts + which account they link to)
export const locationPaymentMethods = mysqlTable("location_payment_methods", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  paymentMethodId: bigint("paymentMethodId", { mode: "number", unsigned: true }).notNull(),
  linkedAccountId: bigint("linkedAccountId", { mode: "number", unsigned: true }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocationPaymentMethod = typeof locationPaymentMethods.$inferSelect;

// Daily sale payments (child records linking daily sales to payment methods)
export const dailySalePayments = mysqlTable("daily_sale_payments", {
  id: serial("id").primaryKey(),
  dailySaleId: bigint("dailySaleId", { mode: "number", unsigned: true }).notNull(),
  paymentMethodId: bigint("paymentMethodId", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DailySalePayment = typeof dailySalePayments.$inferSelect;

// Business inquiries (landing page registrations)
export const businessInquiries = mysqlTable("business_inquiries", {
  id: serial("id").primaryKey(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  position: varchar("position", { length: 100 }),
  suggestedPrice: decimal("suggestedPrice", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "contacted", "converted", "declined"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BusinessInquiry = typeof businessInquiries.$inferSelect;

// Budgets per category per location per month
export const budgets = mysqlTable("budgets", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  categoryId: bigint("categoryId", { mode: "number", unsigned: true }),
  month: int("month").notNull(),
  year: int("year").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type Budget = typeof budgets.$inferSelect;

// Payroll settings (statutory deduction rates per location)
export const payrollSettings = mysqlTable("payroll_settings", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  nhifRate: decimal("nhifRate", { precision: 5, scale: 2 }).default("2.75"),
  nssfTier1Limit: decimal("nssfTier1Limit", { precision: 15, scale: 2 }).default("7000.00"),
  nssfTier1Employee: decimal("nssfTier1Employee", { precision: 15, scale: 2 }).default("420.00"),
  nssfTier1Employer: decimal("nssfTier1Employer", { precision: 15, scale: 2 }).default("420.00"),
  nssfTier2Limit: decimal("nssfTier2Limit", { precision: 15, scale: 2 }).default("36000.00"),
  nssfTier2Employee: decimal("nssfTier2Employee", { precision: 15, scale: 2 }).default("1740.00"),
  nssfTier2Employer: decimal("nssfTier2Employer", { precision: 15, scale: 2 }).default("1740.00"),
  personalRelief: decimal("personalRelief", { precision: 15, scale: 2 }).default("2400.00"),
  insuranceRelief: decimal("insuranceRelief", { precision: 15, scale: 2 }).default("0.00"),
  payeBands: json("payeBands"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PayrollSetting = typeof payrollSettings.$inferSelect;

// COGS (food cost) targets per location
export const cogsTargets = mysqlTable("cogs_targets", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  targetFoodCostPercent: decimal("targetFoodCostPercent", { precision: 5, scale: 2 }).default("35.00"),
  alertThresholdPercent: decimal("alertThresholdPercent", { precision: 5, scale: 2 }).default("38.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CogsTarget = typeof cogsTargets.$inferSelect;

// Account balance alert configuration
export const alertsConfig = mysqlTable("alerts_config", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  accountId: bigint("accountId", { mode: "number", unsigned: true }),
  minBalance: decimal("minBalance", { precision: 15, scale: 2 }).default("10000.00"),
  notifyEmail: varchar("notifyEmail", { length: 320 }),
  notifyPhone: varchar("notifyPhone", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type AlertConfig = typeof alertsConfig.$inferSelect;

// Alerts log
export const alertsLog = mysqlTable("alerts_log", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  accountId: bigint("accountId", { mode: "number", unsigned: true }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertLog = typeof alertsLog.$inferSelect;

// Purchase Orders
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: serial("id").primaryKey(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }).notNull(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  billId: bigint("billId", { mode: "number", unsigned: true }),
  poNumber: varchar("poNumber", { length: 50 }),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "sent", "delivered", "billed", "cancelled"]).default("draft").notNull(),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).default("0.00"),
  taxAmount: decimal("taxAmount", { precision: 15, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 15, scale: 2 }).default("0.00"),
  deliveryDate: date("deliveryDate"),
  deliveryNotes: text("deliveryNotes"),
  terms: text("terms"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp("deletedAt"),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: bigint("poId", { mode: "number", unsigned: true }).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// M-PESA reconciliation
export const mpesaReconciliation = mysqlTable("mpesa_reconciliation", {
  id: serial("id").primaryKey(),
  txnDate: date("txnDate").notNull(),
  orphanCount: int("orphanCount").default(0),
  orphanTotal: decimal("orphanTotal", { precision: 15, scale: 2 }).default("0.00"),
  matchedCount: int("matchedCount").default(0),
  matchedTotal: decimal("matchedTotal", { precision: 15, scale: 2 }).default("0.00"),
  status: mysqlEnum("status", ["open", "resolved", "partial"]).default("open").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type MpesaReconciliation = typeof mpesaReconciliation.$inferSelect;

// Notifications (push + in-app)
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  entityType: varchar("entityType", { length: 50 }),
  entityId: bigint("entityId", { mode: "number", unsigned: true }),
  isRead: boolean("isRead").default(false).notNull(),
  isPushed: boolean("isPushed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// Supplier price history
export const supplierPriceHistory = mysqlTable("supplier_price_history", {
  id: serial("id").primaryKey(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  billId: bigint("billId", { mode: "number", unsigned: true }),
  unitPrice: decimal("unitPrice", { precision: 15, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).default("1.000").notNull(),
  priceDate: date("priceDate").notNull(),
  locationId: bigint("locationId", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupplierPriceHistory = typeof supplierPriceHistory.$inferSelect;

// Price alert rules
export const priceAlertRules = mysqlTable("price_alert_rules", {
  id: serial("id").primaryKey(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  expectedPrice: decimal("expectedPrice", { precision: 15, scale: 2 }),
  variancePercent: decimal("variancePercent", { precision: 5, scale: 2 }).default("10.00"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PriceAlertRule = typeof priceAlertRules.$inferSelect;

// Quick actions log
export const quickActionsLog = mysqlTable("quick_actions_log", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: bigint("entityId", { mode: "number", unsigned: true }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuickActionLog = typeof quickActionsLog.$inferSelect;

// Web push subscriptions
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  subscription: json("subscription").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// API Keys for external integrations
export const apiKeys = mysqlTable("api_keys", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }).notNull(),
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
export const webhooks = mysqlTable("webhooks", {
  id: serial("id").primaryKey(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }).notNull(),
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
export const webhookDeliveries = mysqlTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  webhookId: bigint("webhookId", { mode: "number", unsigned: true }).notNull(),
  event: varchar("event", { length: 50 }).notNull(),
  payload: json("payload"),
  status: varchar("status", { length: 50 }).notNull(),
  statusCode: int("statusCode"),
  response: text("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// Partner commission tracking
export const partnerCommissions = mysqlTable("partner_commissions", {
  id: serial("id").primaryKey(),
  partnerId: bigint("partnerId", { mode: "number", unsigned: true }).notNull(),
  businessId: bigint("businessId", { mode: "number", unsigned: true }).notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  subscriptionAmount: decimal("subscriptionAmount", { precision: 15, scale: 2 }).default("0.00"),
  commissionPercent: decimal("commissionPercent", { precision: 5, scale: 2 }).default("20.00"),
  commissionAmount: decimal("commissionAmount", { precision: 15, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PartnerCommission = typeof partnerCommissions.$inferSelect;
