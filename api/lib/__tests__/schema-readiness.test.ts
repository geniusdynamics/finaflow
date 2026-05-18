// ABOUTME: Verifies startup schema-readiness checks detect missing columns required by accounting screens.
// ABOUTME: Prevents stale databases from silently booting into blank lists and broken reports.
import { describe, expect, it } from "vitest";

import { REQUIRED_SCHEMA_COLUMNS, findMissingSchemaColumns, hasBlockingSchemaIssues } from "../schema-readiness";

describe("schema readiness", () => {
  it("flags missing accounting columns on bills and accounts", () => {
    const report = findMissingSchemaColumns(
      REQUIRED_SCHEMA_COLUMNS,
      [
        { tableName: "accounts", columnName: "id" },
        { tableName: "accounts", columnName: "locationId" },
        { tableName: "bills", columnName: "id" },
        { tableName: "bills", columnName: "dueDate" },
      ],
    );

    expect(report.accounts).toContain("businessId");
    expect(report.accounts).toContain("accountType");
    expect(report.bills).toContain("categoryId");
    expect(report.bills).toContain("reversedAt");
    expect(hasBlockingSchemaIssues(report)).toBe(true);
  });

  it("passes when all required columns are present", () => {
    const rows = Object.entries(REQUIRED_SCHEMA_COLUMNS).flatMap(([tableName, columnNames]) =>
      columnNames.map((columnName) => ({ tableName, columnName })),
    );

    const report = findMissingSchemaColumns(REQUIRED_SCHEMA_COLUMNS, rows);

    expect(report).toEqual({});
    expect(hasBlockingSchemaIssues(report)).toBe(false);
  });
});
