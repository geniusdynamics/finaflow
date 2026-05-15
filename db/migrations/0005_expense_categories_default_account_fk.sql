-- ABOUTME: Adds FK constraint and NOT NULL enforcement on expense_categories.defaultAccountId
-- ABOUTME: Backfills existing categories by linking them to appropriate expense accounts

-- Step 1: Backfill any expense categories that don't have a defaultAccountId
-- Categories may have NULL businessId, so we look for matching accounts by accountSubType
-- across all businesses, taking the first match (lowest id)
DO $$
DECLARE
    cat RECORD;
    target_account_id INTEGER;
BEGIN
    FOR cat IN
        SELECT ec.id, ec.name, ec."accountingClass"
        FROM expense_categories ec
        WHERE ec."defaultAccountId" IS NULL
          AND ec."deletedAt" IS NULL
    LOOP
        target_account_id := NULL;

        -- Map accountingClass to accountSubType and find first matching expense account
        IF cat."accountingClass" = 'cogs' THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'cogs' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        ELSIF cat."accountingClass" = 'operating_expense' THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'operating_expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        ELSIF cat."accountingClass" = 'admin_expense' THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'admin_expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        ELSIF cat."accountingClass" = 'marketing' THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'marketing_expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        ELSIF cat."accountingClass" = 'depreciation' THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'depreciation_expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        ELSE
            -- For 'other' or NULL accountingClass, find any operating_expense account
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountSubType" = 'operating_expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        END IF;

        -- If still no match, try any expense account
        IF target_account_id IS NULL THEN
            SELECT id INTO target_account_id FROM accounts
            WHERE "accountType" = 'expense' AND "deletedAt" IS NULL
            ORDER BY id LIMIT 1;
        END IF;

        -- If we found an account, update the category
        IF target_account_id IS NOT NULL THEN
            UPDATE expense_categories
            SET "defaultAccountId" = target_account_id,
                "updatedAt" = NOW()
            WHERE id = cat.id;
            RAISE NOTICE 'Linked category "%" (id: %) to account id: %', cat.name, cat.id, target_account_id;
        ELSE
            RAISE WARNING 'Could not find any expense account for category "%" (id: %). It must be linked manually.',
                cat.name, cat.id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Verify there are no remaining NULL defaultAccountIds before adding constraint
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM expense_categories
    WHERE "defaultAccountId" IS NULL AND "deletedAt" IS NULL;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot enforce NOT NULL: % active expense categories still lack a default_account_id', orphan_count;
    END IF;
END $$;

-- Step 3: Add NOT NULL constraint
ALTER TABLE expense_categories
    ALTER COLUMN "defaultAccountId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE expense_categories
    ADD CONSTRAINT fk_expense_categories_default_account
    FOREIGN KEY ("defaultAccountId")
    REFERENCES accounts(id)
    ON DELETE RESTRICT;

-- Step 5: Add index on the FK column for query performance
CREATE INDEX IF NOT EXISTS idx_expense_categories_default_account
    ON expense_categories("defaultAccountId");
