// ABOUTME: Declares Drizzle relation mappings between tables for typed joins and relational queries.
// ABOUTME: Keeps account, user, business, and financial table relationships centralized in one place.
import { relations } from "drizzle-orm";
import {
  businesses,
  customerAccounts,
  users,
  locations,
  accounts,
  dailySales,
  expenses,
  expenseCategories,
  suppliers,
  bills,
  billItems,
  masterItems,
  billPayments,
  employees,
  payrollPeriods,
  payrollEntries,
  payrollAdvances,
  mpesaTransactions,
  ledgerEntries,
  paymentMethods,
} from "./schema";

export const customerAccountsRelations = relations(customerAccounts, ({ many }) => ({
  users: many(users),
  businesses: many(businesses),
  paymentMethods: many(paymentMethods),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  account: one(customerAccounts, {
    fields: [users.accountRefId],
    references: [customerAccounts.id],
  }),
  sales: many(dailySales),
  expenses: many(expenses),
}));

export const businessesRelations = relations(businesses, ({ one }) => ({
  account: one(customerAccounts, {
    fields: [businesses.accountRefId],
    references: [customerAccounts.id],
  }),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  accounts: many(accounts),
  sales: many(dailySales),
  expenses: many(expenses),
  employees: many(employees),
  bills: many(bills),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  location: one(locations, {
    fields: [accounts.locationId],
    references: [locations.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  bills: many(bills),
  expenses: many(expenses),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  location: one(locations, {
    fields: [bills.locationId],
    references: [locations.id],
  }),
  supplier: one(suppliers, {
    fields: [bills.supplierId],
    references: [suppliers.id],
  }),
  payments: many(billPayments),
  items: many(billItems),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, {
    fields: [billItems.billId],
    references: [bills.id],
  }),
  category: one(expenseCategories, {
    fields: [billItems.categoryId],
    references: [expenseCategories.id],
  }),
}));

export const masterItemsRelations = relations(masterItems, ({ one }) => ({
  lastCategory: one(expenseCategories, {
    fields: [masterItems.lastCategoryId],
    references: [expenseCategories.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  location: one(locations, {
    fields: [expenses.locationId],
    references: [locations.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  supplier: one(suppliers, {
    fields: [expenses.supplierId],
    references: [suppliers.id],
  }),
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  location: one(locations, {
    fields: [employees.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  payrollEntries: many(payrollEntries),
  advances: many(payrollAdvances),
}));

export const payrollPeriodsRelations = relations(payrollPeriods, ({ one, many }) => ({
  location: one(locations, {
    fields: [payrollPeriods.locationId],
    references: [locations.id],
  }),
  entries: many(payrollEntries),
}));

export const payrollEntriesRelations = relations(payrollEntries, ({ one }) => ({
  period: one(payrollPeriods, {
    fields: [payrollEntries.periodId],
    references: [payrollPeriods.id],
  }),
  employee: one(employees, {
    fields: [payrollEntries.employeeId],
    references: [employees.id],
  }),
}));

export const payrollAdvancesRelations = relations(payrollAdvances, ({ one }) => ({
  employee: one(employees, {
    fields: [payrollAdvances.employeeId],
    references: [employees.id],
  }),
}));

export const mpesaTransactionsRelations = relations(mpesaTransactions, ({ one }) => ({
  location: one(locations, {
    fields: [mpesaTransactions.locationId],
    references: [locations.id],
  }),
  sourceAccount: one(accounts, {
    fields: [mpesaTransactions.sourceAccountId],
    references: [accounts.id],
  }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(accounts, {
    fields: [ledgerEntries.accountId],
    references: [accounts.id],
  }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  account: one(customerAccounts, {
    fields: [paymentMethods.accountRefId],
    references: [customerAccounts.id],
  }),
}));
