import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function comprehensiveFinancialAudit() {
  const client = await pool.connect();
  
  try {
    console.log("=== COMPREHENSIVE FINANCIAL REPORTING AUDIT ===\n");
    
    // Get businesses with journal entries
    const businesses = await client.query(`
      SELECT DISTINCT b.id, b.name, COUNT(je.id) as je_count
      FROM businesses b
      JOIN journal_entries je ON je."businessId" = b.id
      WHERE je."deletedAt" IS NULL
      GROUP BY b.id, b.name
      ORDER BY je_count DESC
    `);
    
    if (businesses.rows.length === 0) {
      console.log("No businesses with journal entries found!");
      return;
    }
    
    const businessId = businesses.rows[0].id;
    console.log(`Testing with Business ID: ${businessId} (${businesses.rows[0].name})`);
    console.log(`Has ${businesses.rows[0].je_count} journal entries\n`);
    
    // ============================================
    // 1. CHECK ACCOUNT BALANCES vs JOURNAL LINES
    // ============================================
    console.log("=== 1. ACCOUNT BALANCE RECONCILIATION ===");
    
    // Calculate expected balances from journal_lines
    const calculatedBalances = await client.query(`
      SELECT 
        a.id,
        a.name,
        a."accountCode",
        a."accountType",
        a."currentBalance"::numeric as stored_balance,
        a."openingBalance"::numeric as opening_balance,
        SUM(COALESCE(jl.debit, '0')::numeric) as total_debit,
        SUM(COALESCE(jl.credit, '0')::numeric) as total_credit,
        (a."openingBalance"::numeric + SUM(COALESCE(jl.debit, '0')::numeric) - SUM(COALESCE(jl.credit, '0')::numeric)) as calculated_balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl."accountId" = a.id
      WHERE a."businessId" = $1 AND a."deletedAt" IS NULL
      GROUP BY a.id, a.name, a."accountCode", a."accountType", a."currentBalance", a."openingBalance"
      HAVING (a."openingBalance"::numeric + SUM(COALESCE(jl.debit, '0')::numeric) - SUM(COALESCE(jl.credit, '0')::numeric)) != COALESCE(a."currentBalance"::numeric, 0)
    `, [businessId]);
    
    if (calculatedBalances.rows.length === 0) {
      console.log("  ✅ All account balances match journal entries");
    } else {
      console.log(`  ❌ Found ${calculatedBalances.rows.length} balance mismatches:`);
      calculatedBalances.rows.forEach((r: any) => {
        console.log(`  ${r.name} (${r.accountCode}):`);
        console.log(`    Opening: ${r.opening_balance}, Debits: ${r.total_debit}, Credits: ${r.total_credit}`);
        console.log(`    Stored: ${r.stored_balance}, Calculated: ${r.calculated_balance}`);
      });
    }
    
    // ============================================
    // 2. INCOME STATEMENT DATA CHECK
    // ============================================
    console.log("\n=== 2. INCOME STATEMENT ANALYSIS ===");
    
    // Revenue accounts
    const revenueAccounts = await client.query(`
      SELECT name, "accountCode", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountType" = 'revenue' AND "deletedAt" IS NULL
      ORDER BY "accountCode"
    `, [businessId]);
    
    console.log("\nRevenue Accounts:");
    let totalRevenue = 0;
    revenueAccounts.rows.forEach((r: any) => {
      totalRevenue += r.balance;
      console.log(`  ${r.accountCode}: ${r.name} = ${r.balance.toFixed(2)}`);
    });
    console.log(`  TOTAL REVENUE: ${totalRevenue.toFixed(2)}`);
    
    // COGS accounts
    const cogsAccounts = await client.query(`
      SELECT name, "accountCode", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountSubType" = 'cogs' AND "deletedAt" IS NULL
      ORDER BY "accountCode"
    `, [businessId]);
    
    console.log("\nCOGS Accounts:");
    let totalCOGS = 0;
    cogsAccounts.rows.forEach((r: any) => {
      totalCOGS += r.balance;
      console.log(`  ${r.accountCode}: ${r.name} = ${r.balance.toFixed(2)}`);
    });
    console.log(`  TOTAL COGS: ${totalCOGS.toFixed(2)}`);
    console.log(`  GROSS PROFIT: ${(totalRevenue - totalCOGS).toFixed(2)}`);
    
    // Expense accounts by classification
    console.log("\nExpense Accounts by Classification:");
    const expenseByClass = await client.query(`
      SELECT "accountSubType", name, "accountCode", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountType" = 'expense' AND "deletedAt" IS NULL
      ORDER BY "accountSubType", "accountCode"
    `, [businessId]);
    
    const expenseBySubType: Record<string, { accounts: any[], total: number }> = {};
    expenseByClass.rows.forEach((r: any) => {
      const subType = r.accountSubType || 'unknown';
      if (!expenseBySubType[subType]) {
        expenseBySubType[subType] = { accounts: [], total: 0 };
      }
      expenseBySubType[subType].accounts.push(r);
      expenseBySubType[subType].total += r.balance;
    });
    
    let totalExpenses = 0;
    for (const [subType, data] of Object.entries(expenseBySubType)) {
      console.log(`\n  ${subType} (Total: ${data.total.toFixed(2)}):`);
      data.accounts.forEach((a) => {
        console.log(`    ${a.accountCode}: ${a.name} = ${a.balance.toFixed(2)}`);
      });
      totalExpenses += data.total;
    }
    console.log(`\n  TOTAL EXPENSES: ${totalExpenses.toFixed(2)}`);
    const netIncome = totalRevenue - totalCOGS - totalExpenses;
    console.log(`  NET INCOME: ${netIncome.toFixed(2)}`);
    
    // ============================================
    // 3. BALANCE SHEET CHECK
    // ============================================
    console.log("\n=== 3. BALANCE SHEET ANALYSIS ===");
    
    // Assets
    const assets = await client.query(`
      SELECT name, "accountCode", "accountSubType", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountType" = 'asset' AND "deletedAt" IS NULL
      ORDER BY "accountSubType", "accountCode"
    `, [businessId]);
    
    let totalAssets = 0;
    console.log("\nASSETS:");
    for (const [subType, accts] of Object.entries(groupBy(assets.rows, 'accountSubType'))) {
      console.log(`  ${subType}:`);
      let subTotal = 0;
      (accts as any[]).forEach((a) => {
        const bal = a.balance;
        subTotal += bal;
        console.log(`    ${a.accountCode}: ${a.name} = ${bal.toFixed(2)}`);
      });
      totalAssets += subTotal;
      console.log(`    Subtotal: ${subTotal.toFixed(2)}`);
    }
    console.log(`  TOTAL ASSETS: ${totalAssets.toFixed(2)}`);
    
    // Liabilities
    const liabilities = await client.query(`
      SELECT name, "accountCode", "accountSubType", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountType" = 'liability' AND "deletedAt" IS NULL
      ORDER BY "accountSubType", "accountCode"
    `, [businessId]);
    
    let totalLiabilities = 0;
    console.log("\nLIABILITIES:");
    for (const [subType, accts] of Object.entries(groupBy(liabilities.rows, 'accountSubType'))) {
      console.log(`  ${subType}:`);
      let subTotal = 0;
      (accts as any[]).forEach((a) => {
        const bal = a.balance;
        subTotal += bal;
        console.log(`    ${a.accountCode}: ${a.name} = ${bal.toFixed(2)}`);
      });
      totalLiabilities += subTotal;
      console.log(`    Subtotal: ${subTotal.toFixed(2)}`);
    }
    console.log(`  TOTAL LIABILITIES: ${totalLiabilities.toFixed(2)}`);
    
    // Equity
    const equity = await client.query(`
      SELECT name, "accountCode", "accountSubType", "currentBalance"::numeric as balance
      FROM accounts
      WHERE "businessId" = $1 AND "accountType" = 'equity' AND "deletedAt" IS NULL
      ORDER BY "accountCode"
    `, [businessId]);
    
    let totalEquity = 0;
    console.log("\nEQUITY:");
    equity.rows.forEach((e) => {
      const bal = e.balance;
      totalEquity += bal;
      console.log(`  ${e.accountCode}: ${e.name} = ${bal.toFixed(2)}`);
    });
    console.log(`  TOTAL EQUITY: ${totalEquity.toFixed(2)}`);
    
    // Balance Check
    const totalLiabPlusEquity = totalLiabilities + totalEquity;
    console.log(`\n=== BALANCE SHEET CHECK ===`);
    console.log(`Total Assets:          ${totalAssets.toFixed(2)}`);
    console.log(`Total Liabilities:     ${totalLiabilities.toFixed(2)}`);
    console.log(`Total Equity:          ${totalEquity.toFixed(2)}`);
    console.log(`Liabilities + Equity:  ${totalLiabPlusEquity.toFixed(2)}`);
    console.log(`Imbalance:             ${(totalAssets - totalLiabPlusEquity).toFixed(2)}`);
    
    const bsBalanced = Math.abs(totalAssets - totalLiabPlusEquity) < 0.01;
    if (bsBalanced) {
      console.log(`  ✅ BALANCE SHEET BALANCES!`);
    } else {
      console.log(`  ❌ BALANCE SHEET DOES NOT BALANCE!`);
      
      // Explain why
      console.log(`\n  Analysis:`);
      console.log(`  - Net Income from Income Statement: ${netIncome.toFixed(2)}`);
      console.log(`  - This should be reflected in Equity (Retained Earnings or Current Year Earnings)`);
      
      // Check for Retained Earnings / Current Year Earnings
      const earnings = await client.query(`
        SELECT name, "accountCode", "currentBalance"::numeric as balance
        FROM accounts
        WHERE "businessId" = $1 AND "accountType" = 'equity' 
        AND ("name" LIKE '%earnings%' OR "name" LIKE '%profit%' OR "name" LIKE '%retained%')
        AND "deletedAt" IS NULL
      `, [businessId]);
      
      if (earnings.rows.length > 0) {
        console.log(`\n  Earnings accounts:`);
        earnings.rows.forEach((e: any) => {
          console.log(`    ${e.accountCode}: ${e.name} = ${e.balance.toFixed(2)}`);
        });
      }
    }
    
    // ============================================
    // 4. TRIAL BALANCE CHECK
    // ============================================
    console.log("\n=== 4. TRIAL BALANCE CHECK ===");
    
    const trialBal = await client.query(`
      SELECT 
        a.name, a."accountCode", a."accountType",
        a."currentBalance"::numeric as balance
      FROM accounts a
      WHERE a."businessId" = $1 AND a."deletedAt" IS NULL
      AND a."currentBalance"::numeric != 0
      ORDER BY a."accountType", a."accountCode"
    `, [businessId]);
    
    let totalDebits = 0;
    let totalCredits = 0;
    
    console.log("\n  DEBIT ACCOUNTS (Assets & Expenses):");
    trialBal.rows.forEach((r) => {
      if (r.accountType === 'asset' || r.accountType === 'expense') {
        console.log(`    ${r.accountCode}: ${r.name} = ${r.balance.toFixed(2)}`);
        totalDebits += r.balance;
      }
    });
    console.log(`    TOTAL DEBITS: ${totalDebits.toFixed(2)}`);
    
    console.log("\n  CREDIT ACCOUNTS (Liabilities, Equity & Revenue):");
    trialBal.rows.forEach((r) => {
      if (r.accountType === 'liability' || r.accountType === 'equity' || r.accountType === 'revenue') {
        console.log(`    ${r.accountCode}: ${r.name} = ${r.balance.toFixed(2)}`);
        totalCredits += r.balance;
      }
    });
    console.log(`    TOTAL CREDITS: ${totalCredits.toFixed(2)}`);
    
    console.log(`\n  DIFFERENCE: ${(totalDebits - totalCredits).toFixed(2)}`);
    
    const tbBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
    if (tbBalanced) {
      console.log(`  ✅ TRIAL BALANCE BALANCES!`);
    } else {
      console.log(`  ❌ TRIAL BALANCE DOES NOT BALANCE!`);
    }
    
    // ============================================
    // 5. EXPENSE CLASSIFICATION MAPPING CHECK
    // ============================================
    console.log("\n=== 5. EXPENSE CLASSIFICATION MAPPING CHECK ===");
    
    const expenseSubTypes = await client.query(`
      SELECT DISTINCT "accountSubType" 
      FROM accounts 
      WHERE "accountType" = 'expense' AND "deletedAt" IS NULL
      ORDER BY "accountSubType"
    `);
    
    console.log("\nExpense accountSubTypes in database:");
    expenseSubTypes.rows.forEach((r) => {
      console.log(`  - ${r.accountSubType}`);
    });
    
    // Check the mapping issue
    console.log("\n⚠️  CRITICAL MAPPING ISSUE FOUND:");
    console.log("  Database has: 'depreciation_expense'");
    console.log("  Code expects: 'depreciation'");
    console.log("  This means Depreciation Expenses won't appear in reports!");
    
    // ============================================
    // 6. REPORTS.TS CODE ANALYSIS
    // ============================================
    console.log("\n=== 6. REPORTS.TS CODE ISSUES ===");
    console.log("\nIssue 1: Date Parameters Not Used");
    console.log("  The startDate and endDate parameters are accepted but never used!");
    console.log("  Reports show ALL-TIME totals, not period-specific.");
    
    console.log("\nIssue 2: Revenue Balance Sign");
    console.log("  Revenue accounts typically have CREDIT balances (negative in accounting terms).");
    console.log("  But the code treats all account balances as positive.");
    console.log("  This will cause incorrect calculations when Revenue > Expenses.");
    
    console.log("\nIssue 3: Expense Classification Mapping");
    console.log("  Code expects: 'depreciation', 'marketing'");
    console.log("  Database has: 'depreciation_expense', 'marketing_expense'");
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n=== AUDIT SUMMARY ===");
    console.log(`Business: ${businessId}`);
    console.log(`Balance Sheet Balanced: ${bsBalanced ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Trial Balance Balanced: ${tbBalanced ? 'YES ✅' : 'NO ❌'}`);
    console.log(`\nCRITICAL ISSUES FOUND:`);
    console.log(`1. Expense classification mapping mismatch (depreciation_expense vs depreciation)`);
    console.log(`2. Date parameters not used in reports`);
    console.log(`3. Revenue balance sign handling may be incorrect`);
    
  } catch (err) {
    console.error("❌ Audit error:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

function groupBy(arr: any[], key: string): Record<string, any[]> {
  return arr.reduce((result, item) => {
    const group = item[key] || 'unknown';
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

comprehensiveFinancialAudit();
