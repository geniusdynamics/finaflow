# Database Migration Runbook

This runbook describes how to safely apply schema changes to FinaFlow's PostgreSQL database. It was created specifically for the performance and integrity improvements (indexes and foreign keys) identified in the codebase audit.

## Core principles

1. **No data loss.** All migrations in this project add constraints or indexes. They do not drop columns, delete rows, or tighten `NOT NULL` in place.
2. **Minimal lock time.** Index builds use `CREATE INDEX CONCURRENTLY`. Foreign keys use `NOT VALID` + `VALIDATE CONSTRAINT`.
3. **Idempotency.** Migration statements use `IF NOT EXISTS` / `IF NOT EXISTS` (for indexes) and `IF NOT EXISTS` (for constraints) so rerunning is safe.
4. **Orphan checks before FKs.** A foreign key must never be added while orphan rows exist.
5. **Backup first.** Always take a logical backup before applying migrations to production.

## Pre-flight checklist

- [ ] `pg_dump` backup completed and verified.
- [ ] Migration SQL reviewed by another engineer.
- [ ] `npm run db:generate` produced the expected migration file.
- [ ] `npm run check` and `npm run lint` pass.
- [ ] Safety check script ran successfully:
  ```bash
  npx tsx scripts/migration-safety-check.ts
  ```
- [ ] For FK migrations, orphan report shows zero orphans:
  ```bash
  npx tsx scripts/migration-safety-check.ts --report=orphans
  ```
- [ ] Maintenance window or low-traffic period scheduled.
- [ ] Rollback commands copied into the incident channel.

## Safe index migrations

Indexes are the lowest-risk change. The only danger is building them inside a long transaction, which holds an `ACCESS EXCLUSIVE` lock.

### Generated SQL (example)

```sql
-- Migration: add core indexes
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_bills_location_deleted;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_location_deleted
  ON bills ("locationId", "deletedAt")
  WHERE "deletedAt" IS NULL;
--> statement-breakpoint
```

### Rules

- Use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.
- Use `--> statement-breakpoint` between statements so Drizzle does not wrap them in a single transaction.
- Prefer partial indexes for soft-deleted tables: `WHERE "deletedAt" IS NULL`.
- Run `ANALYZE` on affected tables after the migration so the planner uses the new indexes.

## Safe foreign-key migrations

Foreign keys protect data integrity but can fail if orphan rows exist. They can also lock tables if added with a full validation scan.

### Two-step DDL

```sql
-- Step 1: add the constraint without validating existing rows.
-- This takes only a short lock and does not scan the child table.
ALTER TABLE bills
  ADD CONSTRAINT fk_bills_supplier
  FOREIGN KEY ("supplierId") REFERENCES suppliers(id)
  ON DELETE NO ACTION
  NOT VALID;
--> statement-breakpoint

-- Step 2: validate existing rows.
-- This scans the child table but only needs SHARE UPDATE EXCLUSIVE lock.
ALTER TABLE bills VALIDATE CONSTRAINT fk_bills_supplier;
--> statement-breakpoint
```

### Rollback

```sql
ALTER TABLE bills DROP CONSTRAINT IF EXISTS fk_bills_supplier;
```

### Handling orphan rows

If the safety check reports orphans, do **not** add the FK yet. Choose one of:

1. **Delete orphan children** only if they are clearly invalid and unreferenced.
2. **Null the FK column** if the relationship is optional.
3. **Create a placeholder parent** and link orphans to it.
4. **Flag for manual review** if the data is financially sensitive.

Example investigation query:

```sql
SELECT c.id, c."supplierId"
FROM bills c
LEFT JOIN suppliers p ON c."supplierId" = p.id
WHERE c."supplierId" IS NOT NULL AND p.id IS NULL
LIMIT 100;
```

## Running migrations

### 1. Generate

```bash
npm run db:generate
```

### 2. Harden the generated SQL

Open the generated file in `db/migrations/` and:
- Replace plain `CREATE INDEX` with `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.
- Split FK additions into `NOT VALID` + `VALIDATE CONSTRAINT`.
- Add rollback comments.
- Ensure `--> statement-breakpoint` separates non-transactional statements.

### 3. Safety-check

```bash
npx tsx scripts/migration-safety-check.ts
```

### 4. Apply

```bash
npm run db:migrate
```

Or apply a single migration manually:

```bash
psql "$DATABASE_URL" -f db/migrations/0026_add_core_indexes.sql
```

### 5. Validate

```bash
npx tsx scripts/migration-safety-check.ts
```

Then run `ANALYZE`:

```sql
ANALYZE bills;
ANALYZE expenses;
ANALYZE daily_sales;
ANALYZE ledger_entries;
```

## Drizzle-specific notes

- `drizzle-kit generate` compares `db/schema.ts` to the latest snapshot and produces SQL.
- `drizzle-kit migrate` runs pending migrations from `db/migrations/` and updates `db/migrations/meta/_journal.json`.
- Drizzle does not generate down migrations automatically. Keep manual rollback scripts in this runbook or in `scripts/migration-rollbacks/`.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Use `--> statement-breakpoint` or apply the index migration manually.

## Emergency rollback

If a migration causes unexpected locking or errors:

1. Stop the application deploy.
2. Connect to the database with `psql`.
3. Run the rollback commands documented in each migration file.
4. Restore from the `pg_dump` backup if data integrity was compromised.

## Contacts

- Database owner: __________
- On-call engineer: __________
- Sentry project: __________
