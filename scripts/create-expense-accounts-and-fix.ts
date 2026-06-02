import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createExpenseAccountsAndFixRecords() {
  const client = await pool.connect();
  
  try {
    console.log("=== CREATING EXPENSE ACCOUNTS AND FIXING ORPHANED RECORDS ===\n");
    
    await client.query("BEGIN");
    
    // 1. Get locations to create accounts under
    const locations = await client.query(`
      SELECT id, "businessId" FROM locations LIMIT 10
    `);
    
    if (locations.rows.length === 0) {
      throw new Error("No locations found!");
    }
    
    console.log(`Found ${locations.rows.length} locations`);
    
    // 2. Create standard expense accounts
    const expenseAccounts = [
      { code: '5000', name: 'Cost of Goods Sold', subtype: 'cogs' },
      { code: '5100', name: 'Food Cost', subtype: 'cogs' },
      { code: '5200', name: 'Beverage Cost', subtype: 'cogs' },
      { code: '6000', name: 'Operating Expenses', subtype: 'operating_expense' },
      { code: '6100', name: 'Rent Expense', subtype: 'operating_expense' },
      { code: '6200', name: 'Utilities Expense', subtype: 'operating_expense' },
      { code: '6300', name: 'Salaries & Wages', subtype: 'operating_expense' },
      { code: '6400', name: 'Transport Expense', subtype: 'operating_expense' },
      { code: '6500', name: 'Maintenance Expense', subtype: 'operating_expense' },
      { code: '7000', name: 'Administrative Expenses', subtype: 'admin_expense' },
      { code: '7200', name: 'Professional Fees', subtype: 'admin_expense' },
      { code: '8000', name: 'Marketing Expenses', subtype: 'marketing_expense' },
      { code: '9000', name: 'Depreciation Expense', subtype: 'depreciation_expense' },
    ];
    
    let createdCount = 0;
    let defaultExpenseId = null;
    let defaultBusinessId = null;
    
    for (const loc of locations.rows) {
      for (const exp of expenseAccounts) {
        const existing = await client.query(`
          SELECT id FROM accounts 
          WHERE "businessId" = $1 AND "accountCode" = $2
          AND "deletedAt" IS NULL
        `, [loc.businessId, exp.code]);
        
        if (existing.rows.length === 0) {
          await client.query(`
            INSERT INTO accounts ("locationId", "businessId", name, "accountCode", "accountType", "accountSubType", type, "openingBalance", "currentBalance", "isActive")
            VALUES ($1, $2, $3, $4, 'expense', $5, 'bank_account', '0.00', '0.00', true)
          `, [loc.id, loc.businessId, exp.name, exp.code, exp.subtype]);
          
          createdCount++;
        }
        
        if (exp.code === '6000' && !defaultExpenseId) {
          const acct = await client.query(`
            SELECT id, "businessId" FROM accounts 
            WHERE "businessId" = $1 AND "accountCode" = '6000'
            AND "deletedAt" IS NULL
            LIMIT 1
          `, [loc.businessId]);
          if (acct.rows[0]) {
            defaultExpenseId = acct.rows[0].id;
            defaultBusinessId = acct.rows[0].businessId;
          }
        }
      }
    }
    
    console.log(`Created ${createdCount} expense accounts`);
    
    // 3. Get or create a default expense account
    if (!defaultExpenseId) {
      const anyExpense = await client.query(`
        SELECT id, "businessId" FROM accounts
        WHERE "accountType" = 'expense'
        AND "deletedAt" IS NULL
        LIMIT 1
      `);
      
      if (anyExpense.rows.length > 0) {
        defaultExpenseId = anyExpense.rows[0].id;
        defaultBusinessId = anyExpense.rows[0].businessId;
      }
    }
    
    if (!defaultExpenseId) {
      const loc = locations.rows[0];
      await client.query(`
        INSERT INTO accounts ("locationId", "businessId", name, "accountCode", "accountType", "accountSubType", type, "openingBalance", "currentBalance", "isActive")
        VALUES ($1, $2, 'Operating Expenses', '6000', 'expense', 'operating_expense', 'bank_account', '0.00', '0.00', true)
        RETURNING id
      `, [loc.id, loc.businessId]);
      
      defaultExpenseId = (await client.query(`SELECT LASTVAL() as id`)).rows[0].id;
      defaultBusinessId = loc.businessId;
    }
    
    console.log(`Default expense account ID: ${defaultExpenseId} (Business ${defaultBusinessId})`);
    
    // 4. Get a cash account for credit side
    const cashAccount = await client.query(`
      SELECT id FROM accounts
      WHERE "accountSubType" IN ('cash', 'bank')
      AND "deletedAt" IS NULL
      LIMIT 1
    `);
    
    if (cashAccount.rows.length === 0) {
      throw new Error("No cash account found!");
    }
    
    const cashAccountId = cashAccount.rows[0].id;
    console.log(`Using cash account ID: ${cashAccountId}`);
    
    // 5. Fix orphaned expenses
    console.log("\n--- Fixing Orphaned Expenses ---");
    const orphanedExpenses = await client.query(`
      SELECT * FROM expenses
      WHERE "journalEntryId" IS NULL
      AND "deletedAt" IS NULL
      ORDER BY id
    `);
    
    let expenseCount = 0;
    let nextJeNum = await getNextJeNumber(client);
    
    for (const expense of orphanedExpenses.rows) {
      const jeNumber = `JE-${String(nextJeNum++).padStart(4, '0')}`;
      const businessId = expense.businessId || defaultBusinessId;
      
      const jeResult = await client.query(`
        INSERT INTO journal_entries (
          "entryNumber", "entryDate", description, "sourceType", "sourceId", 
          "businessId", "isPosted", "createdBy"
        ) VALUES ($1, $2, $3, 'expense', $4, $5, true, $6)
        RETURNING id
      `, [
        jeNumber, 
        expense.expenseDate, 
        `Expense: ${expense.description}`,
        expense.id,
        businessId,
        expense.enteredBy || 1
      ]);
      
      const journalEntryId = jeResult.rows[0].id;
      
      // Create debit line (expense)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", debit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, defaultExpenseId, expense.amount]);
      
      // Create credit line (cash)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", credit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, cashAccountId, expense.amount]);
      
      // Update expense
      await client.query(`
        UPDATE expenses SET "journalEntryId" = $1 WHERE id = $2
      `, [journalEntryId, expense.id]);
      
      expenseCount++;
      console.log(`  ✅ Expense ${expense.id}: ${expense.description.substring(0, 35)} -> JE #${jeNumber}`);
    }
    
    console.log(`Fixed ${expenseCount} orphaned expenses`);
    
    // 6. Fix orphaned bills
    console.log("\n--- Fixing Orphaned Bills ---");
    const orphanedBills = await client.query(`
      SELECT * FROM bills
      WHERE "journalEntryId" IS NULL
      AND "deletedAt" IS NULL
      ORDER BY id
    `);
    
    const apAccount = await client.query(`
      SELECT id FROM accounts
      WHERE "accountSubType" IN ('accounts_payable', 'accrued_expense')
      AND "deletedAt" IS NULL
      LIMIT 1
    `);
    
    const apAccountId = apAccount.rows[0]?.id || cashAccountId;
    console.log(`Using AP account ID: ${apAccountId}`);
    
    let billCount = 0;
    for (const bill of orphanedBills.rows) {
      const jeNumber = `JE-${String(nextJeNum++).padStart(4, '0')}`;
      const businessId = bill.businessId || defaultBusinessId;
      
      const jeResult = await client.query(`
        INSERT INTO journal_entries (
          "entryNumber", "entryDate", description, "sourceType", "sourceId", 
          "businessId", "isPosted", "createdBy"
        ) VALUES ($1, $2, $3, 'bill', $4, $5, true, $6)
        RETURNING id
      `, [
        jeNumber, 
        bill.issueDate, 
        `Bill: ${bill.description}`,
        bill.id,
        businessId,
        1
      ]);
      
      const journalEntryId = jeResult.rows[0].id;
      
      // Create debit line (expense)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", debit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, defaultExpenseId, bill.amount]);
      
      // Create credit line (AP)
      await client.query(`
        INSERT INTO journal_lines ("journalEntryId", "accountId", credit)
        VALUES ($1, $2, $3)
      `, [journalEntryId, apAccountId, bill.amount]);
      
      // Update bill
      await client.query(`
        UPDATE bills SET "journalEntryId" = $1 WHERE id = $2
      `, [journalEntryId, bill.id]);
      
      billCount++;
      console.log(`  ✅ Bill ${bill.id}: ${bill.description.substring(0, 35)} -> JE #${jeNumber}`);
    }
    
    console.log(`Fixed ${billCount} orphaned bills`);
    
    await client.query("COMMIT");
    console.log("\n✅ All orphaned journal entries have been created!");
    
    // Verify
    console.log("\n--- Verification ---");
    const remainingExpenses = await client.query(`SELECT COUNT(*) as count FROM expenses WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL`);
    const remainingBills = await client.query(`SELECT COUNT(*) as count FROM bills WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL`);
    
    console.log(`Orphaned Expenses remaining: ${remainingExpenses.rows[0].count}`);
    console.log(`Orphaned Bills remaining: ${remainingBills.rows[0].count}`);
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNextJeNumber(client: any) {
  const result = await client.query(`SELECT MAX(CAST(SUBSTRING("entryNumber" FROM 4) AS INTEGER)) as max_num FROM journal_entries`);
  return (result.rows[0]?.max_num || 0) + 1;
}

createExpenseAccountsAndFixRecords();
