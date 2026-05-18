import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixOrphanedRecords() {
  const client = await pool.connect();
  
  try {
    console.log("=== FIXING ORPHANED JOURNAL ENTRIES ===\n");
    
    await client.query("BEGIN");
    
    // 1. Get the default cash/bank account and AP account for the business
    const defaultAccounts = await client.query(`
      SELECT id, "accountCode", "accountSubType" 
      FROM accounts 
      WHERE "businessId" IN (SELECT id FROM businesses LIMIT 1)
      AND "deletedAt" IS NULL
      AND "accountSubType" IN ('cash', 'bank')
      ORDER BY "accountCode"
      LIMIT 1
    `);
    
    const apAccount = await client.query(`
      SELECT id, "accountCode", "accountSubType" 
      FROM accounts 
      WHERE "businessId" IN (SELECT id FROM businesses LIMIT 1)
      AND "deletedAt" IS NULL
      AND ("accountSubType" = 'accounts_payable' OR "accountSubType" = 'accrued_expense')
      ORDER BY "accountCode"
      LIMIT 1
    `);
    
    let cashAccountId = defaultAccounts.rows[0]?.id;
    let apAccountId = apAccount.rows[0]?.id;
    
    if (!cashAccountId) {
      // Try any cash-like account
      const anyCash = await client.query(`
        SELECT id FROM accounts 
        WHERE "accountSubType" IN ('cash', 'bank')
        AND "deletedAt" IS NULL
        LIMIT 1
      `);
      if (anyCash.rows[0]) cashAccountId = anyCash.rows[0].id;
    }
    
    if (!cashAccountId) {
      throw new Error("No cash/bank account found!");
    }
    if (!apAccountId) {
      // Use cash account for AP as fallback
      apAccountId = cashAccountId;
    }
    
    console.log(`Using Cash Account ID: ${cashAccountId}`);
    console.log(`Using AP Account ID: ${apAccountId}`);
    
    // 2. Get the next journal entry number
    const jeNumResult = await client.query(`SELECT MAX(CAST(SUBSTRING("entryNumber" FROM 4) AS INTEGER)) as max_num FROM journal_entries`);
    let nextJeNum = (jeNumResult.rows[0]?.max_num || 0) + 1;
    
    // 3. Fix orphaned expenses
    console.log("\n--- Fixing Orphaned Expenses ---");
    const orphanedExpenses = await client.query(`
      SELECT e.*, ec."accountingClass", ec."defaultAccountId", ec.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e."categoryId"
      WHERE e."journalEntryId" IS NULL
      AND e."deletedAt" IS NULL
      ORDER BY e.id
    `);
    
    let expenseCount = 0;
    for (const expense of orphanedExpenses.rows) {
      // Get expense account based on category
      let expenseAccountId = expense.defaultAccountId;
      if (!expenseAccountId) {
        const subtypeMap: Record<string, string> = {
          'cogs': 'cogs',
          'operating_expense': 'operating_expense',
          'admin_expense': 'admin_expense',
          'marketing': 'marketing_expense',
          'depreciation': 'depreciation_expense',
          'other': 'other_expense',
        };
        const subtype = subtypeMap[expense.accountingClass] || 'operating_expense';
        
        const expenseAccount = await client.query(`
          SELECT id FROM accounts 
          WHERE "businessId" = $1 
          AND "accountSubType" = $2
          AND "deletedAt" IS NULL
          LIMIT 1
        `, [expense.businessId, subtype]);
        
        if (expenseAccount.rows[0]) {
          expenseAccountId = expenseAccount.rows[0].id;
        } else {
          // Try any expense account
          const anyExpense = await client.query(`
            SELECT id FROM accounts 
            WHERE "businessId" = $1
            AND "accountType" = 'expense'
            AND "deletedAt" IS NULL
            LIMIT 1
          `, [expense.businessId]);
          if (anyExpense.rows[0]) expenseAccountId = anyExpense.rows[0].id;
        }
      }
      
      // Final fallback
      if (!expenseAccountId) {
        const anyExpense = await client.query(`
          SELECT id FROM accounts 
          WHERE "accountType" = 'expense'
          AND "deletedAt" IS NULL
          LIMIT 1
        `);
        if (anyExpense.rows[0]) expenseAccountId = anyExpense.rows[0].id;
      }
      
      if (!expenseAccountId) {
        console.log(`  ⚠️  Skipping expense ${expense.id}: No expense account found`);
        continue;
      }
      
      // Create journal entry
      const jeNumber = `JE-${String(nextJeNum++).padStart(4, '0')}`;
      
      const jeResult = await client.query(`
        INSERT INTO journal_entries (
          "entryNumber", "entryDate", description, "sourceType", "sourceId", 
          "businessId", "locationId", "isPosted", "enteredBy"
        ) VALUES ($1, $2, $3, 'expense', $4, $5, $6, true, $7)
        RETURNING id
      `, [
        jeNumber, 
        expense.expenseDate, 
        `Expense: ${expense.description}`,
        expense.id,
        expense.businessId,
        expense.locationId,
        expense.enteredBy || 1
      ]);
      
      const journalEntryId = jeResult.rows[0].id;
      
      // Create debit line (expense account)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", debit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, expenseAccountId, expense.amount]);
      
      // Create credit line (cash/bank - money going out)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", credit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, cashAccountId, expense.amount]);
      
      // Update expense with journal entry ID
      await client.query(`
        UPDATE expenses SET "journalEntryId" = $1 WHERE id = $2
      `, [journalEntryId, expense.id]);
      
      // Update account balances
      await client.query(`
        UPDATE accounts SET "currentBalance" = "currentBalance" - $1::numeric WHERE id = $2
      `, [expense.amount, expenseAccountId]);
      await client.query(`
        UPDATE accounts SET "currentBalance" = "currentBalance" - $1::numeric WHERE id = $2
      `, [expense.amount, cashAccountId]);
      
      expenseCount++;
      console.log(`  ✅ Expense ${expense.id}: ${expense.description.substring(0, 40)} -> JE #${jeNumber}`);
    }
    
    console.log(`Fixed ${expenseCount} orphaned expenses`);
    
    // 4. Fix orphaned bills
    console.log("\n--- Fixing Orphaned Bills ---");
    const orphanedBills = await client.query(`
      SELECT b.*, ec."accountingClass", ec."defaultAccountId", ec.name as category_name
      FROM bills b
      LEFT JOIN expense_categories ec ON ec.id = b."categoryId"
      WHERE b."journalEntryId" IS NULL
      AND b."deletedAt" IS NULL
      ORDER BY b.id
    `);
    
    let billCount = 0;
    for (const bill of orphanedBills.rows) {
      // Get expense account based on category
      let expenseAccountId = bill.defaultAccountId;
      if (!expenseAccountId) {
        const subtypeMap: Record<string, string> = {
          'cogs': 'cogs',
          'operating_expense': 'operating_expense',
          'admin_expense': 'admin_expense',
          'marketing': 'marketing_expense',
          'depreciation': 'depreciation_expense',
          'other': 'other_expense',
        };
        const subtype = subtypeMap[bill.accountingClass] || 'operating_expense';
        
        const expenseAccount = await client.query(`
          SELECT id FROM accounts 
          WHERE "businessId" = $1 
          AND "accountSubType" = $2
          AND "deletedAt" IS NULL
          LIMIT 1
        `, [bill.businessId, subtype]);
        
        if (expenseAccount.rows[0]) {
          expenseAccountId = expenseAccount.rows[0].id;
        } else {
          const anyExpense = await client.query(`
            SELECT id FROM accounts 
            WHERE "businessId" = $1
            AND "accountType" = 'expense'
            AND "deletedAt" IS NULL
            LIMIT 1
          `, [bill.businessId]);
          if (anyExpense.rows[0]) expenseAccountId = anyExpense.rows[0].id;
        }
      }
      
      // Final fallback
      if (!expenseAccountId) {
        const anyExpense = await client.query(`
          SELECT id FROM accounts 
          WHERE "accountType" = 'expense'
          AND "deletedAt" IS NULL
          LIMIT 1
        `);
        if (anyExpense.rows[0]) expenseAccountId = anyExpense.rows[0].id;
      }
      
      if (!expenseAccountId) {
        console.log(`  ⚠️  Skipping bill ${bill.id}: No expense account found`);
        continue;
      }
      
      // Create journal entry
      const jeNumber = `JE-${String(nextJeNum++).padStart(4, '0')}`;
      
      const jeResult = await client.query(`
        INSERT INTO journal_entries (
          "entryNumber", "entryDate", description, "sourceType", "sourceId", 
          "businessId", "locationId", "isPosted", "enteredBy"
        ) VALUES ($1, $2, $3, 'bill', $4, $5, $6, true, $7)
        RETURNING id
      `, [
        jeNumber, 
        bill.issueDate, 
        `Bill: ${bill.description}`,
        bill.id,
        bill.businessId,
        bill.locationId,
        1  // system user
      ]);
      
      const journalEntryId = jeResult.rows[0].id;
      
      // Create debit line (expense account)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", debit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, expenseAccountId, bill.amount]);
      
      // Create credit line (Accounts Payable)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", credit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, apAccountId, bill.amount]);
      
      // Update bill with journal entry ID
      await client.query(`
        UPDATE bills SET "journalEntryId" = $1 WHERE id = $2
      `, [journalEntryId, bill.id]);
      
      // Update account balances (AP increases with bill)
      await client.query(`
        UPDATE accounts SET "currentBalance" = "currentBalance" + $1::numeric WHERE id = $2
      `, [bill.amount, apAccountId]);
      
      billCount++;
      console.log(`  ✅ Bill ${bill.id}: ${bill.description.substring(0, 40)} -> JE #${jeNumber}`);
    }
    
    console.log(`Fixed ${billCount} orphaned bills`);
    
    await client.query("COMMIT");
    console.log("\n✅ All orphaned journal entries have been created!");
    
    // Verify
    console.log("\n--- Verification ---");
    const remainingOrphanedExpenses = await client.query(`
      SELECT COUNT(*) as count FROM expenses WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL
    `);
    const remainingOrphanedBills = await client.query(`
      SELECT COUNT(*) as count FROM bills WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL
    `);
    
    console.log(`Orphaned Expenses remaining: ${remainingOrphanedExpenses.rows[0].count}`);
    console.log(`Orphaned Bills remaining: ${remainingOrphanedBills.rows[0].count}`);
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

fixOrphanedRecords();
