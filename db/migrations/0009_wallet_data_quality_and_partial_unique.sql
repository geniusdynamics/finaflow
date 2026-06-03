-- ABOUTME: Strengthens the mobile_wallet_transactions uniqueness guarantee and backfills
-- ABOUTME: known data-quality gaps in description, direction, amount, txnType, currency, and partyName.
-- ABOUTME: Idempotent — safe to re-run; uses IF EXISTS / IF NOT EXISTS / DO $$ guards throughout.

-- ── 1. Convert the unique index to a partial index ─────────────────
-- The original idx_wallet_txn_provider_txn is a plain UNIQUE index on (provider, provider_txn_id).
-- That means soft-deleted rows (deletedAt IS NOT NULL) still occupy the unique slot,
-- which silently blocks re-imports of an SMS the user previously deleted. Replace it with a
-- PARTIAL UNIQUE index that only enforces uniqueness on live rows.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'mobile_wallet_transactions'
      AND indexname = 'idx_wallet_txn_provider_txn'
      AND indexdef NOT LIKE '%WHERE%'
  ) THEN
    -- Drop the existing plain unique index
    DROP INDEX "idx_wallet_txn_provider_txn";
    RAISE NOTICE 'Dropped non-partial idx_wallet_txn_provider_txn';
  END IF;
END $$;

-- Re-create as a partial unique index that ignores soft-deleted rows.
-- The WHERE clause is wrapped in a check so re-runs don't fail.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'mobile_wallet_transactions'
      AND indexname = 'idx_wallet_txn_provider_txn'
  ) THEN
    CREATE UNIQUE INDEX "idx_wallet_txn_provider_txn"
      ON "mobile_wallet_transactions" ("provider", "provider_txn_id")
      WHERE "deletedAt" IS NULL;
    RAISE NOTICE 'Created partial unique idx_wallet_txn_provider_txn (WHERE deletedAt IS NULL)';
  ELSE
    -- Index exists; if it is still non-partial, replace it.
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'mobile_wallet_transactions'
        AND indexname = 'idx_wallet_txn_provider_txn'
        AND indexdef NOT LIKE '%WHERE%'
    ) THEN
      DROP INDEX "idx_wallet_txn_provider_txn";
      CREATE UNIQUE INDEX "idx_wallet_txn_provider_txn"
        ON "mobile_wallet_transactions" ("provider", "provider_txn_id")
        WHERE "deletedAt" IS NULL;
      RAISE NOTICE 'Replaced non-partial idx_wallet_txn_provider_txn with partial unique';
    ELSE
      RAISE NOTICE 'Partial unique idx_wallet_txn_provider_txn already exists — no change';
    END IF;
  END IF;
END $$;

-- ── 2. Backfill description for rows that have NULL ─────────────────
UPDATE "mobile_wallet_transactions"
SET "description" = COALESCE("rawText", 'Unknown party')
WHERE "description" IS NULL;

-- ── 3. Backfill partyName (it's nullable, but the renderer prefers a value) ──
UPDATE "mobile_wallet_transactions"
SET "partyName" = 'Unknown party'
WHERE "partyName" IS NULL;

-- ── 4. Normalize direction based on amount sign (defensive) ──────────
-- amount is numeric(15,2); direction is varchar(5). The import code now stores amount as
-- absolute value, but legacy rows from older parsers may still have negative amounts.
-- Compute direction = 'in' when amount >= 0, else 'out', and store amount as its absolute value.
UPDATE "mobile_wallet_transactions"
SET "direction" = CASE WHEN "amount" >= 0 THEN 'in' ELSE 'out' END
WHERE "direction" NOT IN ('in', 'out');

UPDATE "mobile_wallet_transactions"
SET "amount" = ABS("amount")
WHERE "amount" < 0;

-- ── 5. Backfill txnType (NOT NULL with default 'transfer' on import, but defensive) ──
UPDATE "mobile_wallet_transactions"
SET "txn_type" = 'transfer'
WHERE "txn_type" IS NULL OR LENGTH(TRIM("txn_type")) = 0;

-- ── 6. Backfill currency (NOT NULL with default 'KES' on import, but defensive) ──
UPDATE "mobile_wallet_transactions"
SET "currency" = 'KES'
WHERE "currency" IS NULL OR LENGTH(TRIM("currency")) = 0;

-- ── 7. Backfill txnFee (NOT NULL with default '0.00' on import, but defensive) ──
UPDATE "mobile_wallet_transactions"
SET "txnFee" = '0.00'
WHERE "txnFee" IS NULL;

-- ── 8. Backfill baseCurrency on rows where the import code set it null ──
UPDATE "mobile_wallet_transactions"
SET "base_currency" = "currency"
WHERE "base_currency" IS NULL;
