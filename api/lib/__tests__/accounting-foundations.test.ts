// ABOUTME: Verifies shared accounting mapping rules used across expenses, bills, and operational accounts.
// ABOUTME: Locks down system account keys and allowed COA link targets before router refactors begin.
import { describe, expect, it } from "vitest";

import {
  getExpenseAccountSubType,
  getOperationalAccountLinkRequirements,
  getPaymentMethodAccountConfig,
  isOperationalLinkSubTypeAllowed,
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
    });
    expect(getPaymentMethodAccountConfig("mpesa")).toEqual({
      operationalType: "mpesa",
      assetSubType: "cash",
    });
    expect(getPaymentMethodAccountConfig("card")).toEqual({
      operationalType: "bank_account",
      assetSubType: "bank",
    });
  });

  it("describes allowed operational COA linkage requirements", () => {
    expect(getOperationalAccountLinkRequirements("cash")).toEqual({
      accountType: "asset",
      accountSubType: "cash",
    });
    expect(getOperationalAccountLinkRequirements("bank_account")).toEqual({
      accountType: "asset",
      accountSubType: "bank",
    });
  });

  it("rejects liability-only sub-types in the operational accounts module", () => {
    expect(isOperationalLinkSubTypeAllowed("cash", "cash")).toBe(true);
    expect(isOperationalLinkSubTypeAllowed("bank_account", "bank")).toBe(true);
    expect(isOperationalLinkSubTypeAllowed("cash", "accounts_payable")).toBe(false);
    expect(isOperationalLinkSubTypeAllowed("mpesa", "accounts_payable")).toBe(false);
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
