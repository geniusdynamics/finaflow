// ABOUTME: Validates the boundary between simple operational accounts and the advanced chart of accounts.
// ABOUTME: Prevents invalid subtype combinations and cross-location account links in operational workflows.
import type { AccountSubType, AccountType } from "@db/schema";

import {
  getOperationalAccountLinkRequirements,
  isOperationalLinkSubTypeAllowed,
  type OperationalAccountType,
} from "./accounting-maps";

export function validateOperationalAccountClassification(
  operationalType: OperationalAccountType,
  accountType?: AccountType | null,
  accountSubType?: string | null,
): { accountType: "asset"; accountSubType: Extract<AccountSubType, "cash" | "bank"> } {
  const required = getOperationalAccountLinkRequirements(operationalType);
  const resolvedAccountType = accountType ?? required.accountType;
  const resolvedAccountSubType = accountSubType ?? required.accountSubType;

  if (resolvedAccountType !== "asset" || !isOperationalLinkSubTypeAllowed(operationalType, resolvedAccountSubType)) {
    throw new Error(
      `Operational ${operationalType} accounts must link to an asset ${required.accountSubType} chart account`,
    );
  }

  return {
    accountType: required.accountType,
    accountSubType: required.accountSubType,
  };
}
