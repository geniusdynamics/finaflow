// ABOUTME: Centralizes accounting classification and operational-account mapping rules.
// ABOUTME: Keeps expense, bills, and payment flows aligned on valid account sub-type behavior.
import type { AccountingClass, AccountSubType } from "@db/schema";

export type OperationalAccountType = "cash" | "mpesa" | "bank_account";
export type SupportedPaymentMethod = "cash" | "mpesa" | "bank_transfer" | "card";

const EXPENSE_SUBTYPE_BY_CLASS: Record<AccountingClass, AccountSubType> = {
  cogs: "cogs",
  operating_expense: "operating_expense",
  admin_expense: "admin_expense",
  marketing: "marketing_expense",
  depreciation: "depreciation_expense",
  // The current schema has no `other_expense` subtype, so simple "other"
  // categories should land in the default operating expense bucket.
  other: "operating_expense",
};

const PAYMENT_METHOD_ACCOUNT_CONFIG: Record<
  SupportedPaymentMethod,
  { operationalType: OperationalAccountType; assetSubType: Extract<AccountSubType, "cash" | "bank"> }
> = {
  cash: { operationalType: "cash", assetSubType: "cash" },
  mpesa: { operationalType: "mpesa", assetSubType: "cash" },
  bank_transfer: { operationalType: "bank_account", assetSubType: "bank" },
  card: { operationalType: "bank_account", assetSubType: "bank" },
};

const OPERATIONAL_LINK_REQUIREMENTS: Record<
  OperationalAccountType,
  { accountType: "asset"; accountSubType: Extract<AccountSubType, "cash" | "bank"> }
> = {
  cash: { accountType: "asset", accountSubType: "cash" },
  mpesa: { accountType: "asset", accountSubType: "cash" },
  bank_account: { accountType: "asset", accountSubType: "bank" },
};

export function getExpenseAccountSubType(accountingClass: AccountingClass | undefined): AccountSubType {
  return accountingClass ? EXPENSE_SUBTYPE_BY_CLASS[accountingClass] : "operating_expense";
}

export function getPaymentMethodAccountConfig(paymentMethod: SupportedPaymentMethod) {
  return PAYMENT_METHOD_ACCOUNT_CONFIG[paymentMethod];
}

export function getOperationalAccountLinkRequirements(operationalType: OperationalAccountType) {
  return OPERATIONAL_LINK_REQUIREMENTS[operationalType];
}

export function isOperationalLinkSubTypeAllowed(
  operationalType: OperationalAccountType,
  accountSubType: string | null | undefined,
): boolean {
  if (!accountSubType) {
    return false;
  }

  return getOperationalAccountLinkRequirements(operationalType).accountSubType === accountSubType;
}
