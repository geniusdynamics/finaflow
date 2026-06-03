// ABOUTME: Validates the boundary between simple operational accounts and the advanced chart of accounts.
// ABOUTME: Prevents invalid subtype combinations and cross-location account links in operational workflows.
// ABOUTME: Now supports all asset sub-types for manual CoA selection and auto-links without checkbox.
import type { AccountSubType, AccountType } from "@db/schema";

import {
  getOperationalAccountLinkRequirements,
  isManualCoaSubtypeAllowed,
  type OperationalAccountType,
} from "./accounting-maps";

/** Returns the default CoA classification for an operational account type. */
export function getDefaultCoaClassification(
  operationalType: OperationalAccountType,
): { accountType: "asset"; accountSubType: Extract<AccountSubType, "cash" | "bank"> } {
  const required = getOperationalAccountLinkRequirements(operationalType);
  return {
    accountType: required.accountType,
    accountSubType: required.accountSubType,
  };
}

/** Validates manual CoA classification when user opts into "Show in Charts of Accounts".
 *  Allows all asset sub-types for manual selection. */
export function validateOperationalAccountClassification(
  operationalType: OperationalAccountType,
  accountType?: AccountType | null,
  accountSubType?: string | null,
): { accountType: "asset"; accountSubType: Extract<AccountSubType, "cash" | "bank"> } {
  const required = getOperationalAccountLinkRequirements(operationalType);

  // If no manual overrides, return the default
  if (!accountType && !accountSubType) {
    return {
      accountType: required.accountType,
      accountSubType: required.accountSubType,
    };
  }

  // If user wants manual selection, validate against allowed asset subtypes
  if (accountType && accountSubType) {
    if (!isManualCoaSubtypeAllowed(operationalType, accountType, accountSubType)) {
      throw new Error(
        `Invalid CoA assignment: ${operationalType} accounts can only be linked to Asset sub-types. ` +
        `Default mapping: ${required.accountType}/${required.accountSubType}`,
      );
    }
    return {
      accountType: "asset",
      accountSubType: accountSubType as Extract<AccountSubType, "cash" | "bank">,
    };
  }

  // Partial overrides - fall back to default for missing fields
  return {
    accountType: required.accountType,
    accountSubType: required.accountSubType,
  };
}
