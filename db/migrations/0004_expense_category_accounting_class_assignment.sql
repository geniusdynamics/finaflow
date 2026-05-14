-- Migration: Retroactively assign accounting classes to existing expense categories
-- This ensures all expense categories are properly classified for the advanced reporting module
-- NOTE: Column "accountingClass" requires double quotes (PostgreSQL camelCase preservation)

BEGIN;

-- Update existing expense categories with accounting classes based on category name patterns
-- COGS categories (Cost of Goods Sold)
UPDATE expense_categories 
SET "accountingClass" = 'cogs'
WHERE (LOWER(name) LIKE '%food%' 
   OR LOWER(name) LIKE '%beverage%' 
   OR LOWER(name) LIKE '%cost%'
   OR LOWER(name) LIKE '%groceries%'
   OR LOWER(name) LIKE '%ingredients%')
   AND ("accountingClass" IS NULL OR "accountingClass" = 'operating_expense');

-- Operating Expenses (day-to-day business operations)
UPDATE expense_categories 
SET "accountingClass" = 'operating_expense'
WHERE (LOWER(name) LIKE '%rent%'
   OR LOWER(name) LIKE '%utility%'
   OR LOWER(name) LIKE '%electricity%'
   OR LOWER(name) LIKE '%water%'
   OR LOWER(name) LIKE '%internet%'
   OR LOWER(name) LIKE '%phone%'
   OR LOWER(name) LIKE '%transport%'
   OR LOWER(name) LIKE '%delivery%'
   OR LOWER(name) LIKE '%fuel%'
   OR LOWER(name) LIKE '%maintenance%'
   OR LOWER(name) LIKE '%repair%'
   OR LOWER(name) LIKE '%salary%'
   OR LOWER(name) LIKE '%wage%'
   OR LOWER(name) LIKE '%commission%'
   OR LOWER(name) LIKE '%airtime%'
   OR LOWER(name) LIKE '%data%'
   OR LOWER(name) LIKE '%software%'
   OR LOWER(name) LIKE '%subscription%'
   OR (LOWER(name) LIKE '%marketing%' AND LOWER(name) NOT LIKE '%social media%')
   OR LOWER(name) LIKE '%advertising%'
   OR LOWER(name) LIKE '%packaging%'
   OR LOWER(name) LIKE '%cleaning%')
   AND ("accountingClass" IS NULL OR "accountingClass" = 'cogs');

-- Administrative Expenses (overhead not directly tied to operations)
UPDATE expense_categories 
SET "accountingClass" = 'admin_expense'
WHERE (LOWER(name) LIKE '%office%'
   OR LOWER(name) LIKE '%admin%'
   OR LOWER(name) LIKE '%management%'
   OR LOWER(name) LIKE '%license%'
   OR LOWER(name) LIKE '%permit%'
   OR LOWER(name) LIKE '%insurance%'
   OR LOWER(name) LIKE '%legal%'
   OR LOWER(name) LIKE '%professional%'
   OR LOWER(name) LIKE '%consulting%'
   OR LOWER(name) LIKE '%accounting%'
   OR LOWER(name) LIKE '%bank charge%'
   OR LOWER(name) LIKE '%interest%'
   OR LOWER(name) LIKE '%depreciation%')
   AND ("accountingClass" IS NULL);

-- Marketing Expenses (promotional activities)
UPDATE expense_categories 
SET "accountingClass" = 'marketing'
WHERE (LOWER(name) LIKE '%marketing%'
   OR LOWER(name) LIKE '%advertising%'
   OR LOWER(name) LIKE '%promotion%'
   OR LOWER(name) LIKE '%social media%'
   OR LOWER(name) LIKE '%seo%'
   OR LOWER(name) LIKE '%branding%'
   OR LOWER(name) LIKE '%pr%'
   OR LOWER(name) LIKE '%public relations%'
   OR LOWER(name) LIKE '%print%'
   OR LOWER(name) LIKE '%media%')
   AND ("accountingClass" IS NULL);

-- Other Expenses (non-operating expenses)
UPDATE expense_categories 
SET "accountingClass" = 'other'
WHERE (LOWER(name) LIKE '%misc%'
   OR LOWER(name) LIKE '%other%'
   OR LOWER(name) LIKE '%donation%'
   OR LOWER(name) LIKE '%charity%'
   OR LOWER(name) LIKE '%penalty%'
   OR LOWER(name) LIKE '%fine%'
   OR LOWER(name) LIKE '%bad debt%')
   AND ("accountingClass" IS NULL);

-- Ensure all categories have a default accounting class
UPDATE expense_categories 
SET "accountingClass" = 'operating_expense'
WHERE "accountingClass" IS NULL 
   OR "accountingClass" NOT IN ('cogs', 'operating_expense', 'admin_expense', 'marketing', 'depreciation', 'other');

COMMIT;
