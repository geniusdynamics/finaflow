import { getDb } from "../queries/connection";
import { accounts, journalEntries, journalLines, ledgerEntries, items, fixedAssetDepreciation, expenseCategories, locations } from "@db/schema";
import { eq, and, isNull, sql, gte, lte, desc, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import { d } from "./decimal";

interface ReportSection {
  title: string;
  items: ReportLineItem[];
  total?: string;
  totalLabel?: string;
}

interface ReportLineItem {
  accountCode?: string;
  accountName: string;
  amount: string;
  indent?: number;
}

interface IncomeStatementData {
  sections: ReportSection[];
  grossProfit: string;
  operatingIncome: string;
  netIncome: string;
  totalRevenue: string;
  totalCOGS: string;
  totalExpenses: string;
}

interface BalanceSheetData {
  assets: {
    current: ReportLineItem[];
    fixed: ReportLineItem[];
    total: string;
  };
  liabilities: {
    current: ReportLineItem[];
    longTerm: ReportLineItem[];
    total: string;
  };
  equity: {
    items: ReportLineItem[];
    total: string;
  };
  totalLiabilitiesAndEquity: string;
  balanceCheck: boolean;
}

interface TrialBalanceData {
  accounts: {
    accountCode: string;
    accountName: string;
    accountType: string;
    debit: string;
    credit: string;
  }[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

interface AssetRegisterData {
  assets: {
    id: number;
    name: string;
    purchaseDate: string;
    purchasePrice: string;
    usefulLifeMonths: number;
    depreciationMethod: string;
    accumulatedDepreciation: string;
    currentBookValue: string;
    monthlyDepreciation: string;
    status: "active" | "fully_depreciated" | "disposed";
  }[];
  totals: {
    totalCost: string;
    totalAccumulatedDepreciation: string;
    totalBookValue: string;
  };
}

async function getAllBusinessAccounts(businessId: number) {
  const db = getDb();
  const locs = await db.select({ id: locations.id }).from(locations).where(
    and(eq(locations.businessId, businessId), isNull(locations.deletedAt))
  );
  const locIds = locs.map((l: { id: number }) => l.id);

  const conditions: any[] = [
    isNull(accounts.deletedAt),
    sql`(${accounts.businessId} = ${businessId} OR ${accounts.locationId} IN (${sql.join(locIds.map((id: number) => sql`${id}`), sql`, `)}))`,
  ];

  return db.select().from(accounts).where(and(...conditions)).orderBy(accounts.accountCode);
}

export async function generateIncomeStatement(
  businessId: number,
  startDate: Date,
  endDate: Date
): Promise<IncomeStatementData> {
  const db = getDb();
  const allAccounts = await getAllBusinessAccounts(businessId);

  const revenueAccounts = allAccounts.filter((a: any) => a.accountType === "revenue");
  const cogsAccounts = allAccounts.filter((a: any) => a.accountSubType === "cogs");
  const expenseAccounts = allAccounts.filter((a: any) => a.accountType === "expense");

  const revenueSection: ReportSection = {
    title: "Revenue",
    items: revenueAccounts.map((acc: any) => ({
      accountCode: acc.accountCode || undefined,
      accountName: acc.name,
      amount: formatCurrency(acc.currentBalance || "0"),
    })),
  };

  const totalRevenue = revenueAccounts.reduce(
    (sum: Decimal, acc: any) => sum.plus(d(acc.currentBalance || "0")),
    d("0")
  );

  const cogsSection: ReportSection = {
    title: "Cost of Goods Sold",
    items: cogsAccounts.map((acc: any) => ({
      accountCode: acc.accountCode || undefined,
      accountName: acc.name,
      amount: formatCurrency(acc.currentBalance || "0"),
    })),
  };

  const totalCOGS = cogsAccounts.reduce(
    (sum: Decimal, acc: any) => sum.plus(d(acc.currentBalance || "0")),
    d("0")
  );

  const grossProfit = totalRevenue.minus(totalCOGS);

  const expensesByClass: Record<string, ReportLineItem[]> = {
    operating_expense: [],
    admin_expense: [],
    marketing: [],
    depreciation: [],
    other: [],
  };

  for (const acc of expenseAccounts) {
    const classification = acc.accountSubType || "other";
    if (!expensesByClass[classification]) {
      expensesByClass[classification] = [];
    }
    expensesByClass[classification].push({
      accountCode: acc.accountCode || undefined,
      accountName: acc.name,
      amount: formatCurrency(acc.currentBalance || "0"),
    });
  }

  const expenseSections: ReportSection[] = [];
  let totalExpensesNum = d("0");

  const classLabels: Record<string, string> = {
    operating_expense: "Operating Expenses",
    admin_expense: "Administrative Expenses",
    marketing: "Marketing Expenses",
    depreciation: "Depreciation & Amortization",
    other: "Other Expenses",
  };

  for (const [classType, lineItems] of Object.entries(expensesByClass)) {
    if (lineItems.length > 0) {
      const classTotal = lineItems.reduce(
        (sum: Decimal, item: ReportLineItem) => sum.plus(d(item.amount.replace(/[^0-9.-]/g, "") || "0")),
        d("0")
      );
      totalExpensesNum = totalExpensesNum.plus(classTotal);

      expenseSections.push({
        title: classLabels[classType] || classType,
        items: lineItems,
        total: formatCurrency(classTotal.toString()),
        totalLabel: "Total",
      });
    }
  }

  const operatingIncome = grossProfit.minus(totalExpensesNum);
  const netIncome = operatingIncome;

  return {
    sections: [revenueSection, cogsSection, ...expenseSections],
    grossProfit: formatCurrency(grossProfit.toString()),
    operatingIncome: formatCurrency(operatingIncome.toString()),
    netIncome: formatCurrency(netIncome.toString()),
    totalRevenue: formatCurrency(totalRevenue.toString()),
    totalCOGS: formatCurrency(totalCOGS.toString()),
    totalExpenses: formatCurrency(totalExpensesNum.toString()),
  };
}

export async function generateBalanceSheet(
  businessId: number,
  asOfDate: Date
): Promise<BalanceSheetData> {
  const allAccounts = await getAllBusinessAccounts(businessId);

  const assetAccounts = allAccounts.filter((a: any) => a.accountType === "asset" || !a.accountType);
  const liabilityAccounts = allAccounts.filter((a: any) => a.accountType === "liability");
  const equityAccounts = allAccounts.filter((a: any) => a.accountType === "equity");
  const revenueAccounts = allAccounts.filter((a: any) => a.accountType === "revenue");
  const expenseAccounts = allAccounts.filter((a: any) => a.accountType === "expense");

  const currentAssets = assetAccounts.filter((a: any) => 
    !a.accountType ||
    a.accountSubType === "cash" || 
    a.accountSubType === "bank" || 
    a.accountSubType === "accounts_receivable" ||
    a.accountSubType === "inventory" ||
    a.accountSubType === "prepaid_expense"
  );

  const fixedAssets = assetAccounts.filter((a: any) => 
    a.accountSubType === "fixed_asset" ||
    a.accountSubType === "accumulated_depreciation" ||
    a.accountSubType === "intangible_asset"
  );

  const currentLiabilities = liabilityAccounts.filter((a: any) => 
    a.accountSubType === "accounts_payable" ||
    a.accountSubType === "accrued_expense"
  );

  const longTermLiabilities = liabilityAccounts.filter((a: any) => 
    a.accountSubType === "current_loan" ||
    a.accountSubType === "long_term_loan"
  );

  const getAccountBalance = (acc: any): Decimal => {
    const balance = d(acc.currentBalance || "0");
    if (acc.isContra || acc.accountSubType === "accumulated_depreciation") {
      return balance.abs().negated();
    }
    return balance;
  };

  const formatAccountBalance = (acc: any): string => {
    const balance = getAccountBalance(acc);
    if (balance.isNegative()) {
      return `(${formatCurrency(balance.abs().toString())})`;
    }
    return formatCurrency(balance.toString());
  };

  const assetsCurrent: ReportLineItem[] = currentAssets.map((acc: any) => ({
    accountCode: acc.accountCode || undefined,
    accountName: acc.name,
    amount: formatAccountBalance(acc),
  }));

  const assetsFixed: ReportLineItem[] = fixedAssets.map((acc: any) => ({
    accountCode: acc.accountCode || undefined,
    accountName: acc.name,
    amount: formatAccountBalance(acc),
  }));

  const totalCurrentAssets = currentAssets.reduce((sum: Decimal, acc: any) => {
    return sum.plus(getAccountBalance(acc));
  }, d("0"));

  const totalFixedAssets = fixedAssets.reduce((sum: Decimal, acc: any) => {
    return sum.plus(getAccountBalance(acc));
  }, d("0"));

  const totalAssets = totalCurrentAssets.plus(totalFixedAssets);

  const liabilitiesCurrent: ReportLineItem[] = currentLiabilities.map((acc: any) => ({
    accountCode: acc.accountCode || undefined,
    accountName: acc.name,
    amount: formatCurrency(getAccountBalance(acc).abs().toString()),
  }));

  const liabilitiesLongTerm: ReportLineItem[] = longTermLiabilities.map((acc: any) => ({
    accountCode: acc.accountCode || undefined,
    accountName: acc.name,
    amount: formatCurrency(getAccountBalance(acc).abs().toString()),
  }));

  const totalCurrentLiabilities = currentLiabilities.reduce(
    (sum: Decimal, acc: any) => sum.plus(getAccountBalance(acc).abs()),
    d("0")
  );

  const totalLongTermLiabilities = longTermLiabilities.reduce(
    (sum: Decimal, acc: any) => sum.plus(getAccountBalance(acc).abs()),
    d("0")
  );

  const totalLiabilities = totalCurrentLiabilities.plus(totalLongTermLiabilities);

  const totalRevenue = revenueAccounts.reduce(
    (sum: Decimal, acc: any) => sum.plus(getAccountBalance(acc)),
    d("0")
  );

  const totalExpenses = expenseAccounts.reduce(
    (sum: Decimal, acc: any) => sum.plus(getAccountBalance(acc)),
    d("0")
  );

  const netIncome = totalRevenue.minus(totalExpenses);

  const equityItems: ReportLineItem[] = equityAccounts.map((acc: any) => ({
    accountCode: acc.accountCode || undefined,
    accountName: acc.name,
    amount: formatCurrency(getAccountBalance(acc).abs().toString()),
  }));

  if (netIncome.gte(0)) {
    equityItems.push({
      accountName: "Net Income (Current Period)",
      amount: formatCurrency(netIncome.toString()),
    });
  } else {
    equityItems.push({
      accountName: "Net Loss (Current Period)",
      amount: `(${formatCurrency(netIncome.abs().toString())})`,
    });
  }

  const totalEquity = equityAccounts.reduce(
    (sum: Decimal, acc: any) => sum.plus(getAccountBalance(acc).abs()),
    d("0")
  ).plus(netIncome);

  const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const balanceCheck = totalAssets.eq(totalLiabilitiesAndEquity);

  return {
    assets: {
      current: assetsCurrent,
      fixed: assetsFixed,
      total: formatCurrency(totalAssets.toString()),
    },
    liabilities: {
      current: liabilitiesCurrent,
      longTerm: liabilitiesLongTerm,
      total: formatCurrency(totalLiabilities.toString()),
    },
    equity: {
      items: equityItems,
      total: formatCurrency(totalEquity.toString()),
    },
    totalLiabilitiesAndEquity: formatCurrency(totalLiabilitiesAndEquity.toString()),
    balanceCheck,
  };
}

export async function generateTrialBalance(
  businessId: number,
  asOfDate: Date
): Promise<TrialBalanceData> {
  const allAccounts = await getAllBusinessAccounts(businessId);

  const accountsWithBalance = allAccounts.filter((acc: any) => {
    const balance = d(acc.currentBalance || "0");
    return !balance.eq(0);
  });

  let totalDebits = d("0");
  let totalCredits = d("0");

  const formattedAccounts = accountsWithBalance.map((acc: any) => {
    const balance = d(acc.currentBalance || "0");
    const isDebitNormal = acc.accountType === "asset" || acc.accountType === "expense" || !acc.accountType;

    let debit = "0.00";
    let credit = "0.00";

    if (isDebitNormal) {
      if (balance.gte(0)) {
        debit = balance.toFixed(2);
        totalDebits = totalDebits.plus(balance);
      } else {
        credit = balance.abs().toFixed(2);
        totalCredits = totalCredits.plus(balance.abs());
      }
    } else {
      if (balance.gte(0)) {
        credit = balance.toFixed(2);
        totalCredits = totalCredits.plus(balance);
      } else {
        debit = balance.abs().toFixed(2);
        totalDebits = totalDebits.plus(balance.abs());
      }
    }

    return {
      accountCode: acc.accountCode || "",
      accountName: acc.name,
      accountType: acc.accountType || "operational",
      debit,
      credit,
    };
  });

  return {
    accounts: formattedAccounts,
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    isBalanced: totalDebits.eq(totalCredits),
  };
}

export async function generateAssetRegister(
  businessId: number
): Promise<AssetRegisterData> {
  const db = getDb();

  const fixedAssets = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.businessId, businessId),
        eq(items.isFixedAsset, true),
        isNull(items.deletedAt)
      )
    );

  let totalCost = d("0");
  let totalAccumulatedDepreciation = d("0");
  let totalBookValue = d("0");

  const formattedAssets = fixedAssets.map((asset: any) => {
    const purchasePrice = d(asset.purchasePrice || "0");
    const accumulatedDep = d(asset.accumulatedDepreciation || "0");
    const bookValue = d(asset.currentBookValue || "0");
    const usefulLife = asset.usefulLifeMonths || 60;

    let monthlyDepreciation: string;
    if (asset.depreciationMethod === "declining_balance") {
      const rate = new Decimal(2).dividedBy(usefulLife / 12);
      monthlyDepreciation = bookValue.times(rate).toFixed(2);
    } else {
      monthlyDepreciation = purchasePrice
        .minus(d(asset.salvageValue || "0"))
        .dividedBy(usefulLife)
        .toFixed(2);
    }

    let status: "active" | "fully_depreciated" | "disposed" = "active";
    if (asset.disposalDate) {
      status = "disposed";
    } else if (bookValue.lte(0)) {
      status = "fully_depreciated";
    }

    totalCost = totalCost.plus(purchasePrice);
    totalAccumulatedDepreciation = totalAccumulatedDepreciation.plus(accumulatedDep);
    totalBookValue = totalBookValue.plus(bookValue);

    return {
      id: asset.id,
      name: asset.name,
      purchaseDate: asset.purchaseDate || "",
      purchasePrice: formatCurrency(purchasePrice.toString()),
      usefulLifeMonths: usefulLife,
      depreciationMethod: asset.depreciationMethod || "straight_line",
      accumulatedDepreciation: formatCurrency(accumulatedDep.toString()),
      currentBookValue: formatCurrency(bookValue.toString()),
      monthlyDepreciation: formatCurrency(monthlyDepreciation),
      status,
    };
  });

  return {
    assets: formattedAssets,
    totals: {
      totalCost: formatCurrency(totalCost.toString()),
      totalAccumulatedDepreciation: formatCurrency(totalAccumulatedDepreciation.toString()),
      totalBookValue: formatCurrency(totalBookValue.toString()),
    },
  };
}

function formatCurrency(amount: string): string {
  const num = d(amount || "0");
  return num.toFixed(2).replace(/\B(?=(?=(\d{3})+(?!\d))(?!^)(?!\())/g, ",");
}
