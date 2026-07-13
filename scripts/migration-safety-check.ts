// ABOUTME: Read-only safety check for database migrations.
// ABOUTME: Reports table row counts, missing indexes, and orphan rows for proposed foreign keys.
// ABOUTME: Exits non-zero if any proposed FK has orphan rows, so CI can gate unsafe migrations.
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const args = process.argv.slice(2);
const reportMode = args.find((a) => a.startsWith("--report="))?.split("=")[1] ?? "all";
const verbose = args.includes("--verbose");

interface ProposedIndex {
  name: string;
  table: string;
  columns: string[];
  where?: string;
}

interface ProposedFk {
  table: string;
  column: string;
  parentTable: string;
  parentColumn: string;
}

// These must stay in sync with the migrations we are about to apply.
const proposedIndexes: ProposedIndex[] = [
  // bills
  { name: "idx_bills_location_deleted", table: "bills", columns: ["locationId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_bills_business_deleted", table: "bills", columns: ["businessId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_bills_status_due_date", table: "bills", columns: ["status", "dueDate"] },
  { name: "idx_bills_supplier", table: "bills", columns: ["supplierId"] },
  { name: "idx_bills_journal_entry", table: "bills", columns: ["journalEntryId"] },
  { name: "idx_bills_debt", table: "bills", columns: ["debtId"] },
  { name: "idx_bills_entered_by", table: "bills", columns: ["enteredBy"] },
  // expenses
  { name: "idx_expenses_location_deleted", table: "expenses", columns: ["locationId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_expenses_business_deleted", table: "expenses", columns: ["businessId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_expenses_category_date", table: "expenses", columns: ["categoryId", "expenseDate"] },
  { name: "idx_expenses_supplier", table: "expenses", columns: ["supplierId"] },
  { name: "idx_expenses_bill", table: "expenses", columns: ["billId"] },
  { name: "idx_expenses_journal_entry", table: "expenses", columns: ["journalEntryId"] },
  { name: "idx_expenses_fixed_asset", table: "expenses", columns: ["fixedAssetItemId"] },
  { name: "idx_expenses_entered_by", table: "expenses", columns: ["enteredBy"] },
  // daily_sales
  { name: "idx_daily_sales_location_date", table: "daily_sales", columns: ["locationId", "saleDate"] },
  { name: "idx_daily_sales_deleted", table: "daily_sales", columns: ["deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_daily_sales_source_batch", table: "daily_sales", columns: ["sourceBatchId"] },
  // ledger_entries
  { name: "idx_ledger_entries_account_date", table: "ledger_entries", columns: ["accountId", "entryDate", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_ledger_entries_transaction", table: "ledger_entries", columns: ["transactionType", "transactionId"] },
  // bill_payments
  { name: "idx_bill_payments_bill", table: "bill_payments", columns: ["billId"] },
  { name: "idx_bill_payments_journal_entry", table: "bill_payments", columns: ["journalEntryId"] },
  // recurring_bill_templates
  { name: "idx_recurring_bills_location_next", table: "recurring_bill_templates", columns: ["locationId", "nextDueDate", "isActive", "deletedAt"], where: `"deletedAt" IS NULL` },
  // debts
  { name: "idx_debts_business_deleted", table: "debts", columns: ["businessId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_debts_location_deleted", table: "debts", columns: ["locationId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_debts_status", table: "debts", columns: ["status"] },
  // mpesa_transactions
  { name: "idx_mpesa_location_date", table: "mpesa_transactions", columns: ["locationId", "txnDate"] },
  { name: "idx_mpesa_source_account", table: "mpesa_transactions", columns: ["sourceAccountId"] },
  { name: "idx_mpesa_destination_account", table: "mpesa_transactions", columns: ["destinationAccountId"] },
  { name: "idx_mpesa_linked_expense", table: "mpesa_transactions", columns: ["linkedExpenseId"] },
  { name: "idx_mpesa_linked_bill", table: "mpesa_transactions", columns: ["linkedBillId"] },
  // api_keys
  { name: "idx_api_keys_business", table: "api_keys", columns: ["businessId"] },
  { name: "idx_api_keys_key_hash", table: "api_keys", columns: ["keyHash"] },
  // supporting tables used in hot paths
  { name: "idx_locations_business_deleted", table: "locations", columns: ["businessId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_businesses_account_deleted", table: "businesses", columns: ["accountId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_users_account", table: "users", columns: ["accountId"] },
  { name: "idx_accounts_location_deleted", table: "accounts", columns: ["locationId", "deletedAt"], where: `"deletedAt" IS NULL` },
  { name: "idx_audit_log_table_record", table: "audit_log", columns: ["tableName", "recordId"] },
  { name: "idx_audit_log_created_at", table: "audit_log", columns: ["createdAt"] },
  { name: "idx_exchange_rates_pair_valid", table: "exchange_rates", columns: ["fromCurrency", "toCurrency", "validFrom"] },
];

const proposedFks: ProposedFk[] = [
  // bills
  { table: "bills", column: "supplierId", parentTable: "suppliers", parentColumn: "id" },
  { table: "bills", column: "categoryId", parentTable: "expense_categories", parentColumn: "id" },
  { table: "bills", column: "journalEntryId", parentTable: "journal_entries", parentColumn: "id" },
  { table: "bills", column: "debtId", parentTable: "debts", parentColumn: "id" },
  { table: "bills", column: "enteredBy", parentTable: "users", parentColumn: "id" },
  // expenses
  { table: "expenses", column: "categoryId", parentTable: "expense_categories", parentColumn: "id" },
  { table: "expenses", column: "supplierId", parentTable: "suppliers", parentColumn: "id" },
  { table: "expenses", column: "billId", parentTable: "bills", parentColumn: "id" },
  { table: "expenses", column: "journalEntryId", parentTable: "journal_entries", parentColumn: "id" },
  { table: "expenses", column: "fixedAssetItemId", parentTable: "items", parentColumn: "id" },
  { table: "expenses", column: "enteredBy", parentTable: "users", parentColumn: "id" },
  // line items
  { table: "bill_items", column: "billId", parentTable: "bills", parentColumn: "id" },
  { table: "bill_items", column: "categoryId", parentTable: "expense_categories", parentColumn: "id" },
  { table: "expense_items", column: "expenseId", parentTable: "expenses", parentColumn: "id" },
  { table: "expense_items", column: "categoryId", parentTable: "expense_categories", parentColumn: "id" },
  // payments
  { table: "bill_payments", column: "billId", parentTable: "bills", parentColumn: "id" },
  { table: "bill_payments", column: "journalEntryId", parentTable: "journal_entries", parentColumn: "id" },
  { table: "bill_payments", column: "enteredBy", parentTable: "users", parentColumn: "id" },
  // payroll
  { table: "employees", column: "locationId", parentTable: "locations", parentColumn: "id" },
  { table: "employees", column: "userId", parentTable: "users", parentColumn: "id" },
  { table: "payroll_entries", column: "periodId", parentTable: "payroll_periods", parentColumn: "id" },
  { table: "payroll_entries", column: "employeeId", parentTable: "employees", parentColumn: "id" },
  { table: "payroll_advances", column: "employeeId", parentTable: "employees", parentColumn: "id" },
  { table: "payroll_advances", column: "payrollPeriodId", parentTable: "payroll_periods", parentColumn: "id" },
  { table: "payroll_advances", column: "approvedBy", parentTable: "users", parentColumn: "id" },
  // daily sales
  { table: "daily_sales", column: "locationId", parentTable: "locations", parentColumn: "id" },
  { table: "daily_sale_payments", column: "dailySaleId", parentTable: "daily_sales", parentColumn: "id" },
  // mpesa
  { table: "mpesa_transactions", column: "locationId", parentTable: "locations", parentColumn: "id" },
];

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, "\"\"")}"`;
}

async function tableExists(table: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return result.rowCount > 0;
}

async function getRowCount(table: string): Promise<number> {
  const exists = await tableExists(table);
  if (!exists) return 0;
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`);
  return result.rows[0]?.count ?? 0;
}

async function indexExists(name: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    [name]
  );
  return result.rowCount > 0;
}

async function fkExists(table: string, column: string, parentTable: string, parentColumn: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND tc.table_name = $1
       AND kcu.column_name = $2
       AND ccu.table_name = $3
       AND ccu.column_name = $4`,
    [table, column, parentTable, parentColumn]
  );
  return result.rowCount > 0;
}

async function countOrphans(fk: ProposedFk): Promise<{ orphans: number; sampleIds: number[] }> {
  const childExists = await tableExists(fk.table);
  const parentExists = await tableExists(fk.parentTable);
  if (!childExists || !parentExists) return { orphans: 0, sampleIds: [] };

  const result = await pool.query(
    `SELECT c.${quoteIdent("id")} AS id
     FROM ${quoteIdent(fk.table)} c
     LEFT JOIN ${quoteIdent(fk.parentTable)} p
       ON c.${quoteIdent(fk.column)} = p.${quoteIdent(fk.parentColumn)}
     WHERE c.${quoteIdent(fk.column)} IS NOT NULL
       AND p.${quoteIdent(fk.parentColumn)} IS NULL
     LIMIT 10`
  );
  const sampleIds = result.rows.map((r) => r.id as number);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM ${quoteIdent(fk.table)} c
     LEFT JOIN ${quoteIdent(fk.parentTable)} p
       ON c.${quoteIdent(fk.column)} = p.${quoteIdent(fk.parentColumn)}
     WHERE c.${quoteIdent(fk.column)} IS NOT NULL
       AND p.${quoteIdent(fk.parentColumn)} IS NULL`
  );
  return { orphans: countResult.rows[0]?.count ?? 0, sampleIds };
}

async function main() {
  let failed = false;
  let checkedOrphans = false;
  console.log("=== FinaFlow Migration Safety Check ===\n");

  const tables = Array.from(new Set([
    ...proposedIndexes.map((i) => i.table),
    ...proposedFks.map((fk) => fk.table),
    ...proposedFks.map((fk) => fk.parentTable),
  ]));

  if (reportMode === "all" || reportMode === "counts") {
    console.log("--- Table row counts ---");
    for (const table of tables.sort()) {
      const count = await getRowCount(table);
      const exists = await tableExists(table);
      console.log(`  ${table}: ${exists ? count.toLocaleString() : "TABLE NOT FOUND"}`);
    }
    console.log();
  }

  if (reportMode === "all" || reportMode === "indexes") {
    console.log("--- Proposed indexes ---");
    let missing = 0;
    for (const idx of proposedIndexes) {
      const exists = await indexExists(idx.name);
      if (exists) {
        console.log(`  EXISTS: ${idx.name}`);
      } else {
        missing++;
        console.log(`  MISSING: ${idx.name} ON ${idx.table}(${idx.columns.join(", ")})${idx.where ? ` WHERE ${idx.where}` : ""}`);
      }
    }
    console.log(`\nIndex summary: ${missing} missing, ${proposedIndexes.length - missing} already exist.\n`);
  }

  if (reportMode === "all" || reportMode === "orphans") {
    checkedOrphans = true;
    console.log("--- Proposed foreign keys (orphan check) ---");
    for (const fk of proposedFks) {
      const alreadyExists = await fkExists(fk.table, fk.column, fk.parentTable, fk.parentColumn);
      if (alreadyExists) {
        console.log(`  EXISTS: ${fk.table}.${fk.column} -> ${fk.parentTable}.${fk.parentColumn}`);
        continue;
      }
      const { orphans, sampleIds } = await countOrphans(fk);
      const childCount = await getRowCount(fk.table);
      const status = orphans === 0 ? "OK" : "FAIL";
      if (orphans > 0) failed = true;
      console.log(
        `  ${status}: ${fk.table}.${fk.column} -> ${fk.parentTable}.${fk.parentColumn} ` +
        `(child_rows=${childCount.toLocaleString()}, orphans=${orphans})`
      );
      if (verbose && sampleIds.length > 0) {
        console.log(`        sample orphan ids: ${sampleIds.join(", ")}`);
      }
    }
    console.log();
  }

  await pool.end();

  if (failed) {
    console.error("ERROR: One or more proposed foreign keys have orphan rows. Clean them before applying the migration.");
    process.exit(1);
  }

  if (checkedOrphans) {
    console.log("OK: No orphan rows found for proposed foreign keys.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Safety check failed:", err);
  pool.end().finally(() => process.exit(1));
});
