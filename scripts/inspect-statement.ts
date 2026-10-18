// ABOUTME: Local CLI to inspect a statement with the shared parser (row counts, totals, diagnostics).
// ABOUTME: Reads the file in memory only; prints masked details and never persists the statement.

import fs from "node:fs";
import path from "node:path";
import { extractPdfDocument } from "../shared/statements/extract/pdf-node.ts";
import { parseMpesaStatement } from "../shared/statements/parsers/mpesa.ts";
import { sumAmounts } from "../shared/statements/normalize/amount.ts";

function usage(): never {
  console.error("Usage: npx tsx scripts/inspect-statement.ts <file.pdf> [password] [--show-details]");
  process.exit(1);
}

function mask(text: string): string {
  return text
    .replace(/\b\d{3,}\b/g, (m) => m.slice(0, 3) + "*".repeat(Math.max(2, m.length - 5)) + m.slice(-2))
    .replace(/\b([A-Z][A-Z' ]{3,})\b/g, (m) => (m.length > 18 ? `${m.slice(0, 18)}…` : m));
}

async function main() {
  const [, , file, passwordArg, ...flags] = process.argv;
  if (!file) usage();
  const password = passwordArg && !passwordArg.startsWith("--") ? passwordArg : undefined;
  const showDetails = flags.includes("--show-details");

  const bytes = new Uint8Array(fs.readFileSync(path.resolve(file)));
  const started = Date.now();
  const doc = await extractPdfDocument(bytes, { password });
  const parsed = parseMpesaStatement(doc);
  const elapsed = Date.now() - started;

  console.log(`file        ${path.basename(file)} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`parsed in   ${elapsed} ms · ${doc.pages} pages · ${doc.charCount} chars`);
  console.log(`parser      ${parsed.parserId} v${parsed.parserVersion} · ${parsed.kind}`);
  console.log(`period      ${parsed.metadata.periodStart ?? "?"} → ${parsed.metadata.periodEnd ?? "?"}`);
  console.log(`rows        ${parsed.rows.length}`);
  console.log(`totals      in ${parsed.totals.totalIn} · out ${parsed.totals.totalOut} · fees ${parsed.totals.totalFees}`);
  if (parsed.statementSummary) {
    console.log(`statement   in ${parsed.statementSummary.totalIn} · out ${parsed.statementSummary.totalOut}`);
  }

  const byRail = new Map<string, { n: number; in: string[]; out: string[] }>();
  for (const row of parsed.rows) {
    const entry = byRail.get(row.rail) ?? { n: 0, in: [], out: [] };
    entry.n++;
    if (row.direction === "in") entry.in.push(row.paidIn);
    else entry.out.push(row.withdrawn);
    byRail.set(row.rail, entry);
  }
  console.log("\nrail breakdown");
  for (const [rail, v] of [...byRail.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(
      `  ${rail.padEnd(18)} n=${String(v.n).padStart(4)}  in=${sumAmounts(v.in).padStart(12)}  out=${sumAmounts(v.out).padStart(12)}`,
    );
  }

  const categories = new Map<string, number>();
  for (const row of parsed.rows) {
    const key = row.categoryKey ?? "(none)";
    categories.set(key, (categories.get(key) ?? 0) + 1);
  }
  console.log("\ncategory hints");
  for (const [key, n] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(18)} ${n}`);
  }

  // Balance continuity: a diagnostic, not a verdict.
  let ok = 0;
  const explained: string[] = [];
  const unexplained: string[] = [];
  for (let i = 0; i < parsed.rows.length - 1; i++) {
    const current = parsed.rows[i];
    const next = parsed.rows[i + 1];
    const expected = Number(next.balance) + (current.direction === "in" ? Number(current.paidIn) : -Number(current.withdrawn));
    if (Math.abs(expected - Number(current.balance)) <= 0.005) {
      ok++;
      continue;
    }
    const bundle = current.groupId === next.groupId
      || /fuliza|overdraft|charge/i.test(current.details)
      || /fuliza|overdraft|charge/i.test(next.details);
    if (bundle) explained.push(`${current.externalId} / ${next.externalId}`);
    else unexplained.push(`${current.externalId} ${current.details.slice(0, 50)} (${current.balance} → ${next.balance})`);
  }
  console.log(`\nbalance continuity: ${ok} ok · ${explained.length} bundle legs · ${unexplained.length} to review`);
  unexplained.slice(0, 8).forEach((u) => console.log(`  ? ${mask(u)}`));

  const unclassified = parsed.rows
    .filter((r) => !r.categoryKey && (r.rail === "paybill" || r.rail === "till"))
    .slice(0, 12);
  if (unclassified.length > 0) {
    console.log("\nuncategorised merchants (sample)");
    unclassified.forEach((r) => console.log(`  ${mask(r.details).slice(0, 90)}`));
  }

  if (parsed.warnings.length > 0) {
    console.log("\nwarnings");
    parsed.warnings.slice(0, 10).forEach((w) => console.log(`  - ${w}`));
  }
  if (showDetails) {
    console.log("\nfirst 10 rows");
    parsed.rows.slice(0, 10).forEach((r) => {
      console.log(`  ${r.externalId} ${r.date} ${r.time} ${r.direction === "in" ? "+" : "-"}${r.amount} ${r.rail} ${mask(r.details).slice(0, 70)}`);
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
  process.exit(1);
});
