// ABOUTME: Deduplicates expense_categories that were duplicated by repeated accounting seeding.
// ABOUTME: Repoints every FK reference to the surviving row, soft-deletes the rest. Dry-run unless --apply.
import "dotenv/config";
import pg from "pg";

interface CategoryRow {
  id: number;
  businessId: string;
  locationId: string | null;
  name: string;
}

interface DuplicateGroup {
  key: string;
  name: string;
  businessId: number;
  locationId: number | null;
  ids: number[];
}

const apply = process.argv.includes("--apply");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString, max: 1 });

  // Discover every FK column that points at expense_categories(id).
  const fkResult = await pool.query<{ table_name: string; column_name: string }>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'expense_categories'
      AND ccu.column_name = 'id'
  `);
  const fkTables = fkResult.rows;

  const cats = await pool.query<CategoryRow>(`
    SELECT id, "businessId"::text AS "businessId", "locationId"::text AS "locationId", name
    FROM expense_categories
    WHERE "deletedAt" IS NULL
    ORDER BY id
  `);

  const groups = new Map<string, DuplicateGroup>();
  for (const row of cats.rows) {
    const key = `${row.businessId}|${row.locationId ?? "null"}|${row.name.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.ids.push(row.id);
    else
      groups.set(key, {
        key,
        name: row.name,
        businessId: Number(row.businessId),
        locationId: row.locationId ? Number(row.locationId) : null,
        ids: [row.id],
      });
  }

  const duplicates = [...groups.values()].filter((g) => g.ids.length > 1);
  if (duplicates.length === 0) {
    console.log("No duplicate expense categories found.");
    await pool.end();
    return;
  }

  let removed = 0;
  let repointed = 0;

  for (const group of duplicates) {
    // Keep the row with the most references (ties -> lowest id).
    const counts = new Map<number, number>();
    for (const fk of fkTables) {
      const res = await pool.query<{ categoryId: number; n: string }>(
        `SELECT "${fk.column_name}" AS "categoryId", COUNT(*)::text AS n
         FROM "${fk.table_name}"
         WHERE "${fk.column_name}" = ANY($1::bigint[])
         GROUP BY 1`,
        [group.ids],
      );
      for (const r of res.rows) {
        counts.set(Number(r.categoryId), (counts.get(Number(r.categoryId)) ?? 0) + Number(r.n));
      }
    }
    const keeper = [...group.ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a - b)[0];
    const losers = group.ids.filter((id) => id !== keeper);

    console.log(
      `[${apply ? "APPLY" : "DRY"}] ${group.name} (business ${group.businessId}, location ${group.locationId ?? "whole business"}): ` +
        `keep ${keeper}, remove ${losers.join(",")}`,
    );

    if (!apply) continue;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const fk of fkTables) {
        const res = await client.query(
          `UPDATE "${fk.table_name}" SET "${fk.column_name}" = $1 WHERE "${fk.column_name}" = ANY($2::bigint[])`,
          [keeper, losers],
        );
        repointed += res.rowCount ?? 0;
      }
      const res = await client.query(
        `UPDATE expense_categories SET "deletedAt" = NOW() WHERE id = ANY($1::bigint[]) AND "deletedAt" IS NULL`,
        [losers],
      );
      removed += res.rowCount ?? 0;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Failed for ${group.name}: ${(error as Error).message}`);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }

  if (apply) {
    console.log(`Done. Soft-deleted ${removed} duplicate categor(ies); repointed ${repointed} reference(s).`);
  } else {
    console.log(`Dry run complete: ${duplicates.length} duplicate name(s) found. Re-run with --apply to clean.`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
