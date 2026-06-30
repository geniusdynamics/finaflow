import { authRouter } from "./auth-router";
import { accountSubscriptionsRouter } from "./account-subscriptions-router";
import { localAuthRouter } from "./local-auth-router";
import { locationsRouter } from "./locations-router";
import { accountsRouter } from "./accounts-router";
import { dailySalesRouter } from "./daily-sales-router";
import { expensesRouter } from "./expenses-router";
import { suppliersRouter } from "./suppliers-router";
import { billsRouter } from "./bills-router";
import { employeesRouter, payrollRouter } from "./employees-payroll-router";
import { dashboardRouter } from "./dashboard-router";
import { mpesaRouter } from "./mpesa-router";
import { dailyLedgerRouter } from "./daily-ledger-router";
import { permissionsRouter } from "./permissions-router";
import { usersRouter } from "./users-router";
import { businessesRouter } from "./businesses-router";
import { settingsRouter } from "./settings-router";
import { feedbackRouter } from "./feedback-router";
import { inquiryRouter } from "./inquiry-router";
import { paymentMethodsRouter } from "./payment-methods-router";
import { budgetsRouter } from "./budgets-router";
import { reportsRouter } from "./reports-router";
import { alertsRouter } from "./alerts-router";
import { payrollSettingsRouter } from "./payroll-settings-router";
import { poRouter } from "./po-router";
import { integrationsRouter } from "./integrations-router";
import { partnerRouter } from "./partner-router";
import { notificationsRouter } from "./notifications-router";
import { supplierPricesRouter } from "./supplier-prices-router";
import { journalRouter } from "./journal-router";
import { itemsRouter } from "./items-router";
import { depreciationRouter } from "./depreciation-router";
import { chartOfAccountsRouter } from "./chart-of-accounts-router";
import { walletRouter } from "./wallet-router";
import { walletManagementRouter } from "./wallet-management-router";
import { debtsRouter } from "./debts-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  admin: adminRouter,
  accountSubscriptions: accountSubscriptionsRouter,
  auth: authRouter,
  localAuth: localAuthRouter,
  locations: locationsRouter,
  accounts: accountsRouter,
  dailySales: dailySalesRouter,
  expenses: expensesRouter,
  suppliers: suppliersRouter,
  bills: billsRouter,
  employees: employeesRouter,
  payroll: payrollRouter,
  dashboard: dashboardRouter,
  mpesa: mpesaRouter,
  dailyLedger: dailyLedgerRouter,
  permissions: permissionsRouter,
  users: usersRouter,
  businesses: businessesRouter,
  settings: settingsRouter,
  feedback: feedbackRouter,
  inquiry: inquiryRouter,
  paymentMethods: paymentMethodsRouter,
  reports: reportsRouter,
  alerts: alertsRouter,
  payrollSettings: payrollSettingsRouter,
  po: poRouter,
  integrations: integrationsRouter,
  partner: partnerRouter,
  notifications: notificationsRouter,
  supplierPrices: supplierPricesRouter,
  journal: journalRouter,
  items: itemsRouter,
  depreciation: depreciationRouter,
  chartOfAccounts: chartOfAccountsRouter,
  wallet: walletRouter,
  walletManagement: walletManagementRouter,
  debts: debtsRouter,
  budgets: budgetsRouter,
});

export type AppRouter = typeof appRouter;
