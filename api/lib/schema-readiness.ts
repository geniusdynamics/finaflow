// ABOUTME: Detects schema drift that would break accounting lists, reports, and reset flows at runtime.
// ABOUTME: Verifies required columns exist before the server serves requests against a stale database.
import type pg from "pg";

export const REQUIRED_SCHEMA_COLUMNS = {
  accounts: ["businessId", "systemKey", "accountType", "accountSubType", "isSystemGenerated"],
  bills: ["businessId", "categoryId", "journalEntryId", "reversedAt", "reversedBy"],
  expenses: ["businessId", "journalEntryId", "reversedAt", "reversedBy"],
  journal_entries: ["businessId", "isPosted", "isReversed", "reversedBy", "reversalOf"],
  journal_lines: ["journalEntryId", "accountId", "debit", "credit"],
} as const;

export type RequiredSchemaColumns = typeof REQUIRED_SCHEMA_COLUMNS;
export type SchemaColumnRow = { tableName: string; columnName: string };
export type MissingSchemaReport = Partial<Record<keyof RequiredSchemaColumns, string[]>>;

export function findMissingSchemaColumns(
  requiredColumns: RequiredSchemaColumns,
  rows: SchemaColumnRow[],
): MissingSchemaReport {
  const available = new Set(rows.map((row) => `${row.tableName}.${row.columnName}`));
  const report: MissingSchemaReport = {};

  for (const [tableName, columnNames] of Object.entries(requiredColumns) as [keyof RequiredSchemaColumns, readonly string[]][]) {
    const missing = columnNames.filter((columnName) => !available.has(`${tableName}.${columnName}`));
    if (missing.length > 0) {
      report[tableName] = missing;
    }
  }

  return report;
}

export function hasBlockingSchemaIssues(report: MissingSchemaReport): boolean {
  return Object.keys(report).length > 0;
}

export function formatSchemaIssues(report: MissingSchemaReport): string {
  return Object.entries(report)
    .map(([tableName, columnNames]) => `${tableName}: ${(columnNames ?? []).join(", ")}`)
    .join("; ");
}

export async function inspectRequiredSchemaColumns(pool: pg.Pool): Promise<MissingSchemaReport> {
  const tableNames = Object.keys(REQUIRED_SCHEMA_COLUMNS);
  const result = await pool.query<{
    table_name: string;
    column_name: string;
  }>(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [tableNames],
  );

  return findMissingSchemaColumns(
    REQUIRED_SCHEMA_COLUMNS,
    result.rows.map((row) => ({
      tableName: row.table_name,
      columnName: row.column_name,
    })),
  );
}
