// ABOUTME: Centralizes accounting classification and operational-account mapping rules.
// ABOUTME: Keeps expense, bills, and payment flows aligned on valid account sub-type behavior.
import type { AccountingClass, AccountSubType } from "@db/schema";

export type OperationalAccountType = "cash" | "wallet" | "bank_account";
export type SupportedPaymentMethod = "cash" | "wallet" | "bank_transfer" | "card";

const EXPENSE_SUBTYPE_BY_CLASS: Record<AccountingClass, AccountSubType> = {
  cogs: "cogs",
  operating_expense: "operating_expense",
  admin_expense: "admin_expense",
  marketing: "marketing_expense",
  depreciation: "depreciation_expense",
  other: "operating_expense",
};

const PAYMENT_METHOD_ACCOUNT_CONFIG: Record<
  SupportedPaymentMethod,
  { operationalType: OperationalAccountType; assetSubType: Extract<AccountSubType, "cash" | "bank">; coaSystemKey: string }
> = {
  cash: { operationalType: "cash", assetSubType: "cash", coaSystemKey: "asset:cash" },
  wallet: { operationalType: "wallet", assetSubType: "cash", coaSystemKey: "asset:cash" },
  bank_transfer: { operationalType: "bank_account", assetSubType: "bank", coaSystemKey: "asset:bank" },
  card: { operationalType: "bank_account", assetSubType: "bank", coaSystemKey: "asset:bank" },
};

// ABOUTME: Maps operational account types to their default CoA system keys.
// ABOUTME: Wallet and Cash accounts both map to 'asset:cash' since the CoA entry
// ABOUTME: "1200 - Wallet Account (Cash)" has the cash subtype. The wallet_support
// ABOUTME: flag on coa_subtypes enables unlimited wallet accounts on this CoA entry.
const OPERATIONAL_LINK_REQUIREMENTS: Record<
  OperationalAccountType,
  { accountType: "asset"; accountSubType: Extract<AccountSubType, "cash" | "bank">; coaSystemKey: string; coaName: string }
> = {
  cash: { accountType: "asset", accountSubType: "cash", coaSystemKey: "asset:cash", coaName: "Cash Accounts" },
  wallet: { accountType: "asset", accountSubType: "cash", coaSystemKey: "asset:cash", coaName: "Wallet Accounts" },
  bank_account: { accountType: "asset", accountSubType: "bank", coaSystemKey: "asset:bank", coaName: "Bank Accounts" },
};

// ABOUTME: All asset sub-types available for manual CoA selection when "Show in Charts of Accounts" is used.
export const ALL_ASSET_SUBTYPES: { value: AccountSubType; label: string; description: string }[] = [
  { value: "cash", label: "Cash", description: "Physical currency and cash equivalents" },
  { value: "bank", label: "Bank", description: "Bank accounts and deposits" },
  { value: "prepaid_expense", label: "Prepaid Expenses", description: "Prepaid rent, insurance, etc." },
  { value: "accounts_receivable", label: "Accounts Receivable", description: "Money owed by customers" },
  { value: "fixed_asset", label: "Fixed Assets", description: "Property, plant, and equipment" },
];

export function getExpenseAccountSubType(accountingClass: AccountingClass | undefined): AccountSubType {
  return accountingClass ? EXPENSE_SUBTYPE_BY_CLASS[accountingClass] : "operating_expense";
}

export function getPaymentMethodAccountConfig(paymentMethod: SupportedPaymentMethod) {
  return PAYMENT_METHOD_ACCOUNT_CONFIG[paymentMethod];
}

export function getOperationalAccountLinkRequirements(operationalType: OperationalAccountType) {
  return OPERATIONAL_LINK_REQUIREMENTS[operationalType];
}

/** Returns a human-readable tooltip describing the default CoA mapping for an account type. */
export function getDefaultCoaMappingTooltip(operationalType: OperationalAccountType): string {
  const req = OPERATIONAL_LINK_REQUIREMENTS[operationalType];
  return `Auto-linked to ${req.coaName} (${req.accountType}/${req.accountSubType})`;
}

/** Validates that a manual CoA subtype selection is valid for the given account type. */
export function isManualCoaSubtypeAllowed(
  operationalType: OperationalAccountType,
  accountType: string | null | undefined,
  accountSubType: string | null | undefined,
): boolean {
  // For manual selection, only asset accounts are valid for operational account linking
  if (accountType !== "asset") return false;

  // All asset subtypes are allowed for manual selection
  const validSubtypes = ALL_ASSET_SUBTYPES.map((s) => s.value);
  return !!accountSubType && validSubtypes.includes(accountSubType as AccountSubType);
}

/** Checks if the given sub-type supports wallet accounts. */
export function isWalletSupportedSubType(subType: string): boolean {
  return subType === "cash";
}

/** Returns the CoA system key for an operational account type. */
export function getCoaSystemKeyForType(operationalType: OperationalAccountType): string {
  return OPERATIONAL_LINK_REQUIREMENTS[operationalType].coaSystemKey;
}

/** Returns the default CoA display name for an operational account type. */
export function getDefaultCoaNameForType(operationalType: OperationalAccountType): string {
  return OPERATIONAL_LINK_REQUIREMENTS[operationalType].coaName;
}
