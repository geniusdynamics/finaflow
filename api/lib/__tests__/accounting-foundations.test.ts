// ABOUTME: Verifies shared accounting mapping rules used across expenses, bills, and operational accounts.
// ABOUTME: Locks down system account keys and allowed COA link targets before router refactors begin.
import { describe, expect, it } from "vitest";

import {
  getExpenseAccountSubType,
  getOperationalAccountLinkRequirements,
  getPaymentMethodAccountConfig,
  isManualCoaSubtypeAllowed,
} from "../accounting-maps";
import { buildSystemAccountKey } from "../accounting-accounts";

describe("accounting mapping foundations", () => {
  it("maps expense classes to valid chart sub-types", () => {
    expect(getExpenseAccountSubType("marketing")).toBe("marketing_expense");
    expect(getExpenseAccountSubType("depreciation")).toBe("depreciation_expense");
    expect(getExpenseAccountSubType("other")).toBe("operating_expense");
  });

  it("maps payment methods to operational account configs", () => {
    expect(getPaymentMethodAccountConfig("cash")).toEqual({
      operationalType: "cash",
      assetSubType: "cash",
      coaSystemKey: "asset:cash",
    });
    expect(getPaymentMethodAccountConfig("wallet")).toEqual({
      operationalType: "wallet",
      assetSubType: "cash",
      coaSystemKey: "asset:cash",
    });
    expect(getPaymentMethodAccountConfig("card")).toEqual({
      operationalType: "bank_account",
      assetSubType: "bank",
      coaSystemKey: "asset:bank",
    });
  });

  it("describes allowed operational COA linkage requirements", () => {
    expect(getOperationalAccountLinkRequirements("cash")).toEqual({
      accountType: "asset",
      accountSubType: "cash",
      coaSystemKey: "asset:cash",
      coaName: "Cash Accounts",
    });
    expect(getOperationalAccountLinkRequirements("bank_account")).toEqual({
      accountType: "asset",
      accountSubType: "bank",
      coaSystemKey: "asset:bank",
      coaName: "Bank Accounts",
    });
  });

  it("validates manual CoA sub-type selections — allows only asset subtypes", () => {
    expect(isManualCoaSubtypeAllowed("cash", "asset", "cash")).toBe(true);
    expect(isManualCoaSubtypeAllowed("bank_account", "asset", "bank")).toBe(true);
    expect(isManualCoaSubtypeAllowed("wallet", "asset", "prepaid_expense")).toBe(true);
    expect(isManualCoaSubtypeAllowed("cash", "liability", "accounts_payable")).toBe(false);
    expect(isManualCoaSubtypeAllowed("wallet", "equity", "capital")).toBe(false);
    expect(isManualCoaSubtypeAllowed("bank_account", "expense", "operating_expense")).toBe(false);
  });
});

describe("system account keys", () => {
  it("builds stable keys for generated asset and expense accounts", () => {
    expect(buildSystemAccountKey("asset", "cash")).toBe("asset:cash");
    expect(buildSystemAccountKey("asset", "bank")).toBe("asset:bank");
    expect(buildSystemAccountKey("expense", "marketing_expense")).toBe(
      "expense:marketing_expense",
    );
  });
});
