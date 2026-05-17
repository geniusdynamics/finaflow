import { getDb } from "../api/queries/connection";
import { accounts, expenseCategories } from "./schema";
import { eq, and } from "drizzle-orm";

const defaultAccounts = [
  { accountCode: "1000", name: "Cash - Main", accountType: "asset", accountSubType: "cash", type: "cash" as const, openingBalance: "0.00" },
  { accountCode: "1100", name: "Bank - Current Account", accountType: "asset", accountSubType: "bank", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1200", name: "M-Pesa Account", accountType: "asset", accountSubType: "cash", type: "mpesa" as const, openingBalance: "0.00" },
  { accountCode: "1300", name: "Accounts Receivable", accountType: "asset", accountSubType: "accounts_receivable", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1400", name: "Inventory", accountType: "asset", accountSubType: "inventory", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1500", name: "Prepaid Expenses", accountType: "asset", accountSubType: "prepaid_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1550", name: "Supplier Prepayments", accountType: "asset", accountSubType: "accounts_receivable", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1600", name: "Office Equipment", accountType: "asset", accountSubType: "fixed_asset", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1610", name: "Accumulated Depreciation - Office Equipment", accountType: "asset", accountSubType: "accumulated_depreciation", type: "bank_account" as const, isContra: true, openingBalance: "0.00" },
  { accountCode: "1700", name: "Furniture & Fixtures", accountType: "asset", accountSubType: "fixed_asset", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1710", name: "Accumulated Depreciation - Furniture", accountType: "asset", accountSubType: "accumulated_depreciation", type: "bank_account" as const, isContra: true, openingBalance: "0.00" },
  { accountCode: "1800", name: "Vehicles", accountType: "asset", accountSubType: "fixed_asset", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "1810", name: "Accumulated Depreciation - Vehicles", accountType: "asset", accountSubType: "accumulated_depreciation", type: "bank_account" as const, isContra: true, openingBalance: "0.00" },

  { accountCode: "2000", name: "Accounts Payable", accountType: "liability", accountSubType: "accounts_payable", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2100", name: "Accrued Expenses", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2110", name: "Rent Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2120", name: "Insurance Premiums Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2100", name: "Salaries Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2130", name: "Subscriptions Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2140", name: "Utilities Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2200", name: "PAYE Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2300", name: "NSSF Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2400", name: "NHIF Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2500", name: "VAT Payable", accountType: "liability", accountSubType: "accrued_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2600", name: "Current Loan Payable", accountType: "liability", accountSubType: "current_loan", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "2700", name: "Long-Term Loan Payable", accountType: "liability", accountSubType: "long_term_loan", type: "bank_account" as const, openingBalance: "0.00" },

  { accountCode: "3000", name: "Owner's Capital", accountType: "equity", accountSubType: "capital", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "3100", name: "Retained Earnings", accountType: "equity", accountSubType: "retained_earnings", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "3200", name: "Owner's Drawings", accountType: "equity", accountSubType: "drawings", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "3900", name: "Current Year Earnings", accountType: "equity", accountSubType: "current_year_earnings", type: "bank_account" as const, openingBalance: "0.00" },

  { accountCode: "4000", name: "Sales Revenue", accountType: "revenue", accountSubType: "sales_revenue", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "4100", name: "Food Sales", accountType: "revenue", accountSubType: "sales_revenue", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "4200", name: "Beverage Sales", accountType: "revenue", accountSubType: "sales_revenue", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "4300", name: "Service Revenue", accountType: "revenue", accountSubType: "service_revenue", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "4400", name: "Subscription Revenue", accountType: "revenue", accountSubType: "subscription_revenue", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "4900", name: "Other Income", accountType: "revenue", accountSubType: "other_income", type: "bank_account" as const, openingBalance: "0.00" },

  { accountCode: "5000", name: "Cost of Goods Sold", accountType: "expense", accountSubType: "cogs", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "5100", name: "Food Cost", accountType: "expense", accountSubType: "cogs", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "5200", name: "Beverage Cost", accountType: "expense", accountSubType: "cogs", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6000", name: "Operating Expenses", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6100", name: "Rent Expense", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6200", name: "Utilities Expense", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6300", name: "Salaries & Wages", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6400", name: "Transport Expense", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "6500", name: "Maintenance Expense", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "7000", name: "Administrative Expenses", accountType: "expense", accountSubType: "admin_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "7100", name: "Office Supplies", accountType: "expense", accountSubType: "admin_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "7200", name: "Professional Fees", accountType: "expense", accountSubType: "admin_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "7300", name: "Insurance Expense", accountType: "expense", accountSubType: "admin_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "8000", name: "Marketing Expenses", accountType: "expense", accountSubType: "marketing_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "9000", name: "Depreciation Expense", accountType: "expense", accountSubType: "depreciation_expense", type: "bank_account" as const, openingBalance: "0.00" },
  { accountCode: "9900", name: "Other Expenses", accountType: "expense", accountSubType: "operating_expense", type: "bank_account" as const, openingBalance: "0.00" },
];

const defaultExpenseCategories = [
  { name: "Food Supplies", description: "Ingredients and raw materials", color: "#C73E1D" },
  { name: "Beverages", description: "Drinks and beverages stock", color: "#D4A854" },
  { name: "Utilities", description: "Electricity, water, internet", color: "#2D7D46" },
  { name: "Rent", description: "Property lease payments", color: "#4A5568" },
  { name: "Salaries & Wages", description: "Staff payroll", color: "#3182CE" },
  { name: "Marketing", description: "Advertising and promotions", color: "#805AD5" },
  { name: "Maintenance & Repairs", description: "Equipment fixes", color: "#DD6B20" },
  { name: "Transport & Delivery", description: "Logistics costs", color: "#38B2AC" },
  { name: "Licenses & Permits", description: "County health permits", color: "#718096" },
  { name: "Fuel", description: "Petrol and diesel", color: "#E53E3E" },
  { name: "Airtime/Data", description: "Mobile communication", color: "#319795" },
  { name: "Miscellaneous", description: "Uncategorized expenses", color: "#A0AEC0" },
];

const expenseCategoryMappings: Record<string, { accountingClass: string; defaultAccountCode: string }> = {
  "Food Supplies": { accountingClass: "cogs", defaultAccountCode: "5100" },
  "Beverages": { accountingClass: "cogs", defaultAccountCode: "5200" },
  "Utilities": { accountingClass: "operating_expense", defaultAccountCode: "6200" },
  "Rent": { accountingClass: "operating_expense", defaultAccountCode: "6100" },
  "Salaries & Wages": { accountingClass: "operating_expense", defaultAccountCode: "6300" },
  "Marketing": { accountingClass: "marketing", defaultAccountCode: "8000" },
  "Maintenance & Repairs": { accountingClass: "operating_expense", defaultAccountCode: "6500" },
  "Transport & Delivery": { accountingClass: "operating_expense", defaultAccountCode: "6400" },
  "Licenses & Permits": { accountingClass: "admin_expense", defaultAccountCode: "7200" },
  "Miscellaneous": { accountingClass: "other", defaultAccountCode: "9900" },
  "Fuel": { accountingClass: "operating_expense", defaultAccountCode: "6400" },
  "Airtime/Data": { accountingClass: "operating_expense", defaultAccountCode: "6000" },
};

export async function seedAccountingData(businessId: number, locationId?: number) {
  const db = getDb();

  for (const account of defaultAccounts) {
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.accountCode, account.accountCode),
        eq(accounts.businessId, businessId)
      ),
    });

    if (!existing) {
      await db.insert(accounts).values({
        businessId,
        locationId,
        name: account.name,
        accountCode: account.accountCode,
        accountType: account.accountType as any,
        accountSubType: account.accountSubType as any,
        type: account.type,
        openingBalance: account.openingBalance,
        currentBalance: account.openingBalance,
        isContra: account.isContra || false,
        isPaymentMethod: account.accountSubType === "cash" || account.accountSubType === "bank",
        isActive: true,
      } as any);
    }
  }

  for (const cat of defaultExpenseCategories) {
    const existing = await db.query.expenseCategories.findFirst({
      where: and(eq(expenseCategories.name, cat.name), eq(expenseCategories.businessId, businessId)),
    });
    if (!existing) {
      const mapping = expenseCategoryMappings[cat.name];
      let defaultAccountId: number | undefined;
      if (mapping) {
        const account = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.accountCode, mapping.defaultAccountCode),
            eq(accounts.businessId, businessId)
          ),
        });
        if (account) {
          defaultAccountId = account.id;
        }
      }
      await db.insert(expenseCategories).values({
        ...cat,
        businessId,
        locationId,
        accountingClass: (mapping?.accountingClass || "operating_expense") as any,
        defaultAccountId: defaultAccountId || 1,
      } as any);
    }
  }

  for (const [categoryName, mapping] of Object.entries(expenseCategoryMappings)) {
    const category = await db.query.expenseCategories.findFirst({
      where: and(eq(expenseCategories.name, categoryName), eq(expenseCategories.businessId, businessId)),
    });

    if (category) {
      const account = await db.query.accounts.findFirst({
        where: and(
          eq(accounts.accountCode, mapping.defaultAccountCode),
          eq(accounts.businessId, businessId)
        ),
      });

      if (account && category.defaultAccountId !== account.id) {
        await db.update(expenseCategories).set({
          defaultAccountId: account.id,
        } as any).where(eq(expenseCategories.id, category.id));
      }
    }
  }
}
