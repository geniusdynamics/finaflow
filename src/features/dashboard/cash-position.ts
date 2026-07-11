// ABOUTME: Pure helper for the Cash Position card on the dashboard.
// ABOUTME: Buckets account balances by type using decimal.js and returns a flat summary for the UI.
import Decimal from "decimal.js";

export type AccountLike = {
  id: number;
  name: string;
  type: string | null;
  currentBalance: string;
};

export type CashPosition = {
  total: string;
  byType: {
    cash: string;
    bank: string;
    wallet: string;
    other: string;
  };
};

const emptyByType = (): CashPosition["byType"] => ({
  cash: "0.00",
  bank: "0.00",
  wallet: "0.00",
  other: "0.00",
});

export function aggregateCashPosition(accounts: AccountLike[]): CashPosition {
  const acc = (accounts ?? []).reduce(
    (state, a) => {
      const balance = new Decimal(a.currentBalance || "0");
      state.total = state.total.plus(balance);
      const t = (a.type ?? "other").toLowerCase();
      if (t === "cash") state.byType.cash = state.byType.cash.plus(balance);
      else if (t === "bank") state.byType.bank = state.byType.bank.plus(balance);
      else if (t === "wallet") state.byType.wallet = state.byType.wallet.plus(balance);
      else state.byType.other = state.byType.other.plus(balance);
      return state;
    },
    { total: new Decimal(0), byType: { cash: new Decimal(0), bank: new Decimal(0), wallet: new Decimal(0), other: new Decimal(0) } },
  );
  return {
    total: acc.total.toFixed(2),
    byType: {
      cash: acc.byType.cash.toFixed(2),
      bank: acc.byType.bank.toFixed(2),
      wallet: acc.byType.wallet.toFixed(2),
      other: acc.byType.other.toFixed(2),
    },
  };
}

export function emptyCashPosition(): CashPosition {
  return { total: "0.00", byType: emptyByType() };
}
