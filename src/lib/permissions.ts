export const PERMISSIONS = {
  SALES_VIEW: "sales:view",
  SALES_CREATE: "sales:create",
  SALES_VIEW_OWN: "sales:view_own",
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_CREATE: "expenses:create",
  EXPENSES_MANAGE: "expenses:manage",
  EXPENSES_VIEW_OWN: "expenses:view_own",
  BILLS_VIEW: "bills:view",
  BILLS_CREATE: "bills:create",
  BILLS_PAY: "bills:pay",
  SUPPLIERS_VIEW: "suppliers:view",
  SUPPLIERS_MANAGE: "suppliers:manage",
  SUPPLIER_PRICES_VIEW: "supplier_prices:view",
  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_MANAGE: "accounts:manage",
  PAYROLL_VIEW: "payroll:view",
  PAYROLL_PROCESS: "payroll:process",
  MPESA_VIEW: "mpesa:view",
  MPESA_IMPORT: "mpesa:import",
  WALLET_VIEW: "wallet:view",
  WALLET_IMPORT: "wallet:import",
  WALLET_ADMIN: "wallet:admin",
  REPORTS_VIEW: "reports:view",
  USERS_MANAGE: "users:manage",
  SETTINGS_MANAGE: "settings:manage",
  FEEDBACK_MANAGE: "feedback:manage",
  BUSINESS_MANAGE: "business:manage",
  INQUIRY_VIEW: "inquiry:view",
  API_KEYS_MANAGE: "api_keys:manage",
  WEBHOOKS_MANAGE: "webhooks:manage",
  PARTNER_VIEW: "partner:view",
  PURCHASE_ORDERS_VIEW: "po:view",
  PURCHASE_ORDERS_MANAGE: "po:manage",
  CALENDAR_VIEW: "calendar:view",
  BUDGET_MANAGE: "budget:manage",
  COGS_MANAGE: "cogs:manage",
  ALERTS_CONFIG: "alerts:config",
  LEDGER_VIEW: "ledger:view",
  DASHBOARD_VIEW: "dashboard:view",
  BUDGETS_VIEW: "budgets:view",
  RESET_TRANSACTIONS: "transactions:reset",
  DEBTS_VIEW: "debts:view",
  DEBTS_MANAGE: "debts:manage",
  PAYMENT_METHODS_VIEW: "payment_methods:view",
  PAYMENT_METHODS_MANAGE: "payment_methods:manage",
  EXPENSE_CATEGORIES_MANAGE: "expense_categories:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Hard-coded defaults (frontend only). Backend can override via DB rolePermissions table.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE,
    PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW, PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS,
    PERMISSIONS.MPESA_VIEW, PERMISSIONS.MPESA_IMPORT,
    PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_IMPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.BUSINESS_MANAGE,
    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW, PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.BUDGET_MANAGE, PERMISSIONS.BUDGETS_VIEW, PERMISSIONS.COGS_MANAGE,
    PERMISSIONS.ALERTS_CONFIG, PERMISSIONS.LEDGER_VIEW, PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DEBTS_VIEW, PERMISSIONS.DEBTS_MANAGE,
    PERMISSIONS.PAYMENT_METHODS_VIEW, PERMISSIONS.PAYMENT_METHODS_MANAGE,
    PERMISSIONS.EXPENSE_CATEGORIES_MANAGE,
  ],
  manager: [
    PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE,
    PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE, PERMISSIONS.BILLS_PAY,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS,
    PERMISSIONS.MPESA_VIEW, PERMISSIONS.MPESA_IMPORT,
    PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_IMPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.INQUIRY_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW, PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.BUDGET_MANAGE, PERMISSIONS.BUDGETS_VIEW, PERMISSIONS.COGS_MANAGE,
    PERMISSIONS.ALERTS_CONFIG, PERMISSIONS.LEDGER_VIEW, PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DEBTS_VIEW, PERMISSIONS.DEBTS_MANAGE,
  ],
  employee: [
    // Sole permission: can create new daily sales entries only
    PERMISSIONS.SALES_CREATE,
  ],
  viewer: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.BILLS_VIEW,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIER_PRICES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.MPESA_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.FEEDBACK_MANAGE,
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CALENDAR_VIEW, PERMISSIONS.BUDGETS_VIEW,
  ],
};

export function hasPermission(roleOrPerms: string | string[], permission: Permission): boolean {
  const perms = Array.isArray(roleOrPerms) ? roleOrPerms : (ROLE_PERMISSIONS[roleOrPerms] || []);
  return perms.includes(permission);
}

export function hasAnyPermission(roleOrPerms: string | string[], permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(roleOrPerms, p));
}

// Ordered list of post-login landing candidates. The first page the user's role
// has any permission for becomes their default entry point after authentication.
const LANDING_PAGE_ORDER: { path: string; perms: Permission[] }[] = [
  { path: "/dashboard", perms: [PERMISSIONS.DASHBOARD_VIEW] },
  { path: "/daily-sales", perms: [PERMISSIONS.SALES_VIEW, PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW_OWN] },
  { path: "/expenses", perms: [PERMISSIONS.EXPENSES_VIEW, PERMISSIONS.EXPENSES_CREATE] },
  { path: "/bills", perms: [PERMISSIONS.BILLS_VIEW, PERMISSIONS.BILLS_CREATE] },
  { path: "/suppliers", perms: [PERMISSIONS.SUPPLIERS_VIEW, PERMISSIONS.SUPPLIERS_MANAGE] },
  { path: "/accounts", perms: [PERMISSIONS.ACCOUNTS_VIEW, PERMISSIONS.ACCOUNTS_MANAGE] },
  { path: "/payroll", perms: [PERMISSIONS.PAYROLL_VIEW, PERMISSIONS.PAYROLL_PROCESS] },
  { path: "/wallet", perms: [PERMISSIONS.WALLET_VIEW, PERMISSIONS.WALLET_IMPORT] },
  { path: "/calendar", perms: [PERMISSIONS.CALENDAR_VIEW] },
  { path: "/reports", perms: [PERMISSIONS.REPORTS_VIEW] },
  { path: "/budgets", perms: [PERMISSIONS.BUDGETS_VIEW, PERMISSIONS.BUDGET_MANAGE] },
  { path: "/users", perms: [PERMISSIONS.USERS_MANAGE] },
  { path: "/settings", perms: [PERMISSIONS.SETTINGS_MANAGE] },
  { path: "/partner", perms: [PERMISSIONS.PARTNER_VIEW] },
];

export function getDefaultLandingPage(roleOrPerms: string | string[]): string {
  const accessible = LANDING_PAGE_ORDER.find((item) => hasAnyPermission(roleOrPerms, item.perms));
  return accessible?.path ?? "/daily-sales";
}

/**
 * Merge a user's role-based default permissions with their individual
 * permissions (which may include DB-level overrides). When both are
 * available, the merged set ensures the user sees nav items and UI
 * features for every permission they actually hold.
 */
export function getEffectivePermissions(user: { role: string; permissions?: string[] }): string[] {
  const roleDefaults = ROLE_PERMISSIONS[user.role] || [];
  if (!user.permissions || user.permissions.length === 0) {
    return roleDefaults;
  }
  return [...new Set([...roleDefaults, ...user.permissions])];
}
