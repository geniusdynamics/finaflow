// ABOUTME: Verifies the user_locations migration file exists, is journaled, and is included in bootstrap paths.
// ABOUTME: Guards the multi-location schema so fresh installs and test databases both create the table.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("0013 user_locations migration", () => {
  it("exists and starts with ABOUTME comments", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/0013_user_locations.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const content = readFileSync(migrationPath, "utf8");
    expect(content.startsWith("-- ABOUTME:")).toBe(true);
    expect(content).toContain("CREATE TABLE IF NOT EXISTS \"user_locations\"");
  });

  it("is registered in the migration journal", () => {
    const journalPath = resolve(import.meta.dirname, "../migrations/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: Array<{ tag: string }> };
    expect(journal.entries.some((entry) => entry.tag === "0013_user_locations")).toBe(true);
  });

  it("is applied by the API test bootstrap", () => {
    const setupPath = resolve(import.meta.dirname, "../../api/test/setup.ts");
    const content = readFileSync(setupPath, "utf8");
    expect(content).toContain("\"0013_user_locations.sql\"");
  });

  it("is represented in the base schema for fresh installs", () => {
    const basePath = resolve(import.meta.dirname, "../migrations/0000_outgoing_christian_walker.sql");
    const content = readFileSync(basePath, "utf8");
    expect(content).toContain("CREATE TABLE \"user_locations\"");
  });
});
