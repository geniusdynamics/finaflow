ALTER TABLE "accounts" DROP CONSTRAINT "accounts_accountCode_unique";--> statement-breakpoint
DROP INDEX "idx_accounts_code";--> statement-breakpoint
ALTER TABLE "expense_categories" ALTER COLUMN "defaultAccountId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD COLUMN "businessId" bigint;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD COLUMN "categoryId" bigint;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD COLUMN "liabilityAccountId" bigint;--> statement-breakpoint
CREATE INDEX "idx_expense_categories_default_account" ON "expense_categories" USING btree ("defaultAccountId");