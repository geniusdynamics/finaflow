-- ABOUTME: Add foreign key constraints to recurring_bill_templates for locationId, businessId, supplierId, and categoryId.
-- ABOUTME: Cleans up orphaned records before applying constraints.

-- First, clean up any orphaned records
UPDATE "recurring_bill_templates" SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "suppliers" WHERE "suppliers"."id" = "recurring_bill_templates"."supplierId");

UPDATE "recurring_bill_templates" SET "categoryId" = NULL
WHERE "categoryId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "expense_categories" WHERE "expense_categories"."id" = "recurring_bill_templates"."categoryId");

DELETE FROM "recurring_bill_templates"
WHERE "locationId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "locations" WHERE "locations"."id" = "recurring_bill_templates"."locationId");

DELETE FROM "recurring_bill_templates"
WHERE "businessId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "businesses" WHERE "businesses"."id" = "recurring_bill_templates"."businessId");

-- Add foreign key constraints
ALTER TABLE "recurring_bill_templates"
  ADD CONSTRAINT "recurring_bill_templates_locationId_locations_id_fk"
  FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "recurring_bill_templates"
  ADD CONSTRAINT "recurring_bill_templates_businessId_businesses_id_fk"
  FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "recurring_bill_templates"
  ADD CONSTRAINT "recurring_bill_templates_supplierId_suppliers_id_fk"
  FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "recurring_bill_templates"
  ADD CONSTRAINT "recurring_bill_templates_categoryId_expense_categories_id_fk"
  FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id")
  ON DELETE set null ON UPDATE no action;
