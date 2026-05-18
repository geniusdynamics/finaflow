-- Migration: Add expense_items table for expense line items with multiple categories
-- Created for: Multi-category expense support

CREATE TABLE IF NOT EXISTS "expense_items" (
	"id" serial PRIMARY KEY,
	"expenseId" bigint NOT NULL,
	"itemName" varchar(255) NOT NULL,
	"quantity" numeric(10, 3) DEFAULT '1.000' NOT NULL,
	"unitPrice" numeric(15, 2) NOT NULL,
	"totalPrice" numeric(15, 2) NOT NULL,
	"categoryId" bigint NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);

-- Index for querying items by expense
CREATE INDEX IF NOT EXISTS "expense_items_expense_id_idx" ON "expense_items" ("expenseId");
CREATE INDEX IF NOT EXISTS "expense_items_category_id_idx" ON "expense_items" ("categoryId");
CREATE INDEX IF NOT EXISTS "expense_items_deleted_at_idx" ON "expense_items" ("deletedAt");

-- Add foreign key constraint
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expense_id_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE NO ACTION;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_category_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE NO ACTION;

COMMENT ON TABLE "expense_items" IS 'Line items for expenses with multiple category support';
COMMENT ON COLUMN "expense_items"."expenseId" IS 'Reference to the parent expense';
COMMENT ON COLUMN "expense_items"."categoryId" IS 'Category for this line item (allows different categories per expense)';
