-- ABOUTME: Backfill missing AR debit entries for existing daily sales with unpaidAmount > 0
-- ABOUTME: Creates Accounts Receivable (1300) debit entries for historical credit sales
-- ABOUTME: Note: daily_sales links to business via locationId -> locations -> businessId

DO $$
DECLARE
    ar_account_id BIGINT;
    ar_balance NUMERIC;
    r RECORD;
    b RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT l."businessId"::BIGINT AS bid
        FROM daily_sales ds
        JOIN locations l ON l.id = ds."locationId"
        WHERE ds."deletedAt" IS NULL
          AND ds."unpaidAmount" > 0
    LOOP
        SELECT id INTO ar_account_id
        FROM accounts
        WHERE "accountCode" = '1300'
          AND "businessId" = r.bid
          AND "deletedAt" IS NULL
        LIMIT 1;

        IF ar_account_id IS NOT NULL THEN
            SELECT "currentBalance"::NUMERIC INTO ar_balance FROM accounts WHERE id = ar_account_id;

            FOR b IN
                SELECT
                    ds.id AS sale_id,
                    ds."unpaidAmount"::NUMERIC AS amt,
                    ds."saleDate" AS sdate,
                    COALESCE(ds."unpaidNotes", '') AS notes
                FROM daily_sales ds
                JOIN locations l ON l.id = ds."locationId"
                WHERE ds."deletedAt" IS NULL
                  AND ds."unpaidAmount" > 0
                  AND l."businessId" = r.bid
            LOOP
                INSERT INTO ledger_entries ("accountId", "transactionType", "transactionId", "entryType", "amount", "balanceAfter", "entryDate", "createdBy", "refNo", description)
                VALUES (
                    ar_account_id,
                    'sale',
                    b.sale_id,
                    'debit',
                    b.amt,
                    ar_balance + b.amt,
                    b.sdate,
                    0,
                    'BACKFILL-' || b.sale_id,
                    'Credit Sale ' || b.notes
                );
                ar_balance := ar_balance + b.amt;
            END LOOP;

            UPDATE accounts SET "currentBalance" = ar_balance WHERE id = ar_account_id;
            RAISE NOTICE 'Backfill complete for businessId %: AR account % updated', r.bid, ar_account_id;
        ELSE
            RAISE WARNING 'No AR account (1300) found for businessId %', r.bid;
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_sales_unpaid_amount
    ON daily_sales("unpaidAmount" DESC);
