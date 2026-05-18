import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function auditDoubleEntryRecords() {
  const client = await pool.connect();
  
  try {
    console.log("=== DOUBLE-ENTRY AUDIT FOR EXPENSES AND BILLS ===\n");
    
    // 1. Check expenses without journal entries
    console.log("1. EXPENSES WITHOUT JOURNAL ENTRIES:");
    const orphanedExpenses = await client.query(`
      SELECT COUNT(*) as count FROM expenses 
      WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL
    `);
    
    if (parseInt(orphanedExpenses.rows[0].count) > 0) {
      console.log(`   ❌ Found ${orphanedExpenses.rows[0].count} expenses WITHOUT journal entries`);
    } else {
      console.log("   ✅ All expenses have journal entries");
    }
    
    // 2. Check bills without journal entries
    console.log("\n2. BILLS WITHOUT JOURNAL ENTRIES:");
    const orphanedBills = await client.query(`
      SELECT COUNT(*) as count FROM bills 
      WHERE "journalEntryId" IS NULL AND "deletedAt" IS NULL
    `);
    
    if (parseInt(orphanedBills.rows[0].count) > 0) {
      console.log(`   ❌ Found ${orphanedBills.rows[0].count} bills WITHOUT journal entries`);
    } else {
      console.log("   ✅ All bills have journal entries");
    }
    
    // 3. Check for unbalanced journal entries
    console.log("\n3. UNBALANCED JOURNAL ENTRIES:");
    const unbalancedEntries = await client.query(`
      WITH entry_totals AS (
        SELECT 
          "journalEntryId",
          SUM(COALESCE(debit, '0')::numeric) as total_debit,
          SUM(COALESCE(credit, '0')::numeric) as total_credit
        FROM journal_lines
        GROUP BY "journalEntryId"
      )
      SELECT je.id, je."entryNumber", je.description, 
             et.total_debit::text, et.total_credit::text,
             ABS(et.total_debit - et.total_credit)::text as imbalance
      FROM entry_totals et
      JOIN journal_entries je ON je.id = et."journalEntryId"
      WHERE et.total_debit != et.total_credit
      AND je."deletedAt" IS NULL
      ORDER BY je.id
    `);
    
    if (unbalancedEntries.rows.length > 0) {
      console.log(`   ❌ Found ${unbalancedEntries.rows.length} UNBALANCED journal entries:`);
      unbalancedEntries.rows.slice(0, 10).forEach(r => {
        console.log(`      ID ${r.id}: ${r.entryNumber} - ${r.description}`);
        console.log(`         Debit: ${r.total_debit}, Credit: ${r.total_credit}, Imbalance: ${r.imbalance}`);
      });
      if (unbalancedEntries.rows.length > 10) {
        console.log(`      ... and ${unbalancedEntries.rows.length - 10} more`);
      }
    } else {
      console.log("   ✅ All journal entries are properly balanced (Debits = Credits)");
    }
    
    // 4. Summary counts
    console.log("\n4. SUMMARY COUNTS:");
    
    const expenseCount = await client.query(`SELECT COUNT(*) as count FROM expenses WHERE "deletedAt" IS NULL`);
    const expenseWithJE = await client.query(`SELECT COUNT(*) as count FROM expenses WHERE "journalEntryId" IS NOT NULL AND "deletedAt" IS NULL`);
    console.log(`   Expenses: ${expenseWithJE.rows[0].count}/${expenseCount.rows[0].count} with journal entries`);
    
    const billCount = await client.query(`SELECT COUNT(*) as count FROM bills WHERE "deletedAt" IS NULL`);
    const billWithJE = await client.query(`SELECT COUNT(*) as count FROM bills WHERE "journalEntryId" IS NOT NULL AND "deletedAt" IS NULL`);
    console.log(`   Bills: ${billWithJE.rows[0].count}/${billCount.rows[0].count} with journal entries`);
    
    const jeCount = await client.query(`SELECT COUNT(*) as count FROM journal_entries WHERE "deletedAt" IS NULL`);
    const jeLineCount = await client.query(`SELECT COUNT(*) as count FROM journal_lines`);
    console.log(`   Journal Entries: ${jeCount.rows[0].count}`);
    console.log(`   Journal Lines: ${jeLineCount.rows[0].count}`);
    
    // 5. Check expenses without category
    console.log("\n5. EXPENSES WITHOUT CATEGORY:");
    const noCategory = await client.query(`
      SELECT COUNT(*) as count FROM expenses 
      WHERE "categoryId" IS NULL AND "deletedAt" IS NULL
    `);
    
    if (parseInt(noCategory.rows[0].count) > 0) {
      console.log(`   ⚠️  Found ${noCategory.rows[0].count} expenses without category assignment`);
    } else {
      console.log("   ✅ All expenses have categories assigned");
    }
    
    // 6. Account types in use
    console.log("\n6. ACCOUNT DISTRIBUTION BY TYPE:");
    const accountCounts = await client.query(`
      SELECT "accountType", "accountSubType", COUNT(*) as count
      FROM accounts
      WHERE "deletedAt" IS NULL
      GROUP BY "accountType", "accountSubType"
      ORDER BY "accountType", count DESC
    `);
    
    accountCounts.rows.forEach(r => {
      console.log(`   ${r.accountType}/${r.accountSubType || 'N/A'}: ${r.count}`);
    });
    
    // 7. Sample journal entries showing double-entry structure
    console.log("\n7. SAMPLE JOURNAL ENTRIES (Double-Entry Structure):");
    const sampleEntries = await client.query(`
      SELECT je.id, je."entryNumber", je.description, je."sourceType",
             a.name as account_name, a."accountSubType", 
             jl.debit::text, jl.credit::text
      FROM journal_entries je
      JOIN journal_lines jl ON jl."journalEntryId" = je.id
      JOIN accounts a ON a.id = jl."accountId"
      WHERE je."deletedAt" IS NULL
      AND je."sourceType" IN ('expense', 'bill')
      ORDER BY je.id DESC
      LIMIT 20
    `);
    
    let currentEntry = null;
    sampleEntries.rows.forEach(r => {
      if (currentEntry !== r.id) {
        currentEntry = r.id;
        console.log(`\n   JE #${r.entryNumber} (${r.sourceType}): ${r.description}`);
      }
      const debit = r.debit && r.debit !== '0.00' ? `DR: ${r.debit}` : '';
      const credit = r.credit && r.credit !== '0.00' ? `CR: ${r.credit}` : '';
      console.log(`      ${r.account_name} (${r.accountSubType}) ${debit} ${credit}`);
    });
    
    console.log("\n=== AUDIT COMPLETE ===");
    
    // Final summary
    const allGood = parseInt(orphanedExpenses.rows[0].count) === 0 &&
                   parseInt(orphanedBills.rows[0].count) === 0 &&
                   unbalancedEntries.rows.length === 0;
    
    if (allGood) {
      console.log("\n✅ ALL CHECKS PASSED - Financial records are properly linked and balanced!");
    } else {
      console.log("\n⚠️  SOME ISSUES FOUND - Please review the above report");
    }
    
  } catch (err) {
    console.error("❌ Audit error:", err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

auditDoubleEntryRecords();
