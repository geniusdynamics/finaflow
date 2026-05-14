CREATE TYPE "public"."accountSubType" AS ENUM('cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid_expense', 'fixed_asset', 'accumulated_depreciation', 'intangible_asset', 'other_asset', 'accounts_payable', 'accrued_expense', 'current_loan', 'long_term_loan', 'capital', 'retained_earnings', 'drawings', 'current_year_earnings', 'sales_revenue', 'service_revenue', 'subscription_revenue', 'other_income', 'cogs', 'operating_expense', 'admin_expense', 'marketing_expense', 'depreciation_expense');--> statement-breakpoint
CREATE TYPE "public"."accountType" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."accountingClass" AS ENUM('cogs', 'operating_expense', 'admin_expense', 'marketing', 'depreciation', 'other');--> statement-breakpoint
CREATE TYPE "public"."allocation_invite_status" AS ENUM('active', 'consumed', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."allocation_rights" AS ENUM('view_only', 'create_view', 'manage');--> statement-breakpoint
CREATE TYPE "public"."depreciationMethod" AS ENUM('straight_line', 'declining_balance');--> statement-breakpoint
CREATE TYPE "public"."itemType" AS ENUM('inventory', 'fixed_asset', 'service', 'non_inventory');--> statement-breakpoint
CREATE TYPE "public"."partner_allocation_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."revenueCategoryType" AS ENUM('product_sales', 'service_revenue', 'subscription', 'membership', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('standard', 'partner');--> statement-breakpoint
ALTER TYPE "public"."transactionType" ADD VALUE 'journal';--> statement-breakpoint
ALTER TYPE "public"."transactionType" ADD VALUE 'depreciation';--> statement-breakpoint
ALTER TYPE "public"."transactionType" ADD VALUE 'asset_disposal';--> statement-breakpoint
CREATE TABLE "allocation_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"ownerAccountId" bigint NOT NULL,
	"businessId" bigint NOT NULL,
	"rightsProfile" "allocation_rights" NOT NULL,
	"status" "allocation_invite_status" DEFAULT 'active' NOT NULL,
	"createdBy" bigint NOT NULL,
	"consumedByPartnerAccountId" bigint,
	"consumedByPartnerUserId" bigint,
	"consumedAt" timestamp,
	"revokedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_sync_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"systemName" varchar(50) NOT NULL,
	"config" json NOT NULL,
	"lastSyncAt" timestamp,
	"syncStatus" varchar(20) DEFAULT 'idle',
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"reportType" varchar(50) NOT NULL,
	"periodStart" date NOT NULL,
	"periodEnd" date NOT NULL,
	"reportData" json NOT NULL,
	"reportMetadata" json,
	"generatedBy" bigint,
	"generatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_depreciation" (
	"id" serial PRIMARY KEY NOT NULL,
	"itemId" bigint NOT NULL,
	"journalEntryId" bigint,
	"periodYear" integer NOT NULL,
	"periodMonth" integer NOT NULL,
	"depreciationAmount" numeric(15, 2) NOT NULL,
	"accumulatedAfter" numeric(15, 2) NOT NULL,
	"bookValueAfter" numeric(15, 2) NOT NULL,
	"isPosted" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"locationId" bigint,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sku" varchar(50),
	"itemType" "itemType" NOT NULL,
	"incomeAccountId" bigint,
	"expenseAccountId" bigint,
	"assetAccountId" bigint,
	"isFixedAsset" boolean DEFAULT false,
	"purchaseDate" date,
	"purchasePrice" numeric(15, 2),
	"usefulLifeMonths" integer,
	"depreciationMethod" "depreciationMethod",
	"salvageValue" numeric(15, 2) DEFAULT '0.00',
	"accumulatedDepreciation" numeric(15, 2) DEFAULT '0.00',
	"currentBookValue" numeric(15, 2),
	"disposalDate" date,
	"disposalValue" numeric(15, 2),
	"notes" text,
	"unitCost" numeric(15, 2),
	"unitPrice" numeric(15, 2),
	"currentStock" numeric(15, 2) DEFAULT '0',
	"reorderLevel" numeric(15, 2),
	"taxRate" numeric(5, 2),
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"lastSyncedAt" timestamp,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp,
	CONSTRAINT "items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"entryNumber" varchar(50),
	"entryDate" date NOT NULL,
	"description" text NOT NULL,
	"reference" varchar(100),
	"sourceType" varchar(50),
	"sourceId" bigint,
	"isPosted" boolean DEFAULT false,
	"postedBy" bigint,
	"postedAt" timestamp,
	"isReversed" boolean DEFAULT false,
	"reversedBy" bigint,
	"reversalOf" bigint,
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"createdBy" bigint,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp,
	CONSTRAINT "journal_entries_entryNumber_unique" UNIQUE("entryNumber")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journalEntryId" bigint NOT NULL,
	"accountId" bigint NOT NULL,
	"debit" numeric(15, 2) DEFAULT '0.00',
	"credit" numeric(15, 2) DEFAULT '0.00',
	"description" text,
	"lineNumber" integer,
	"createdAt" timestamp DEFAULT now(),
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "partner_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerAccountId" bigint NOT NULL,
	"ownerBusinessId" bigint NOT NULL,
	"partnerAccountId" bigint NOT NULL,
	"partnerUserId" bigint NOT NULL,
	"rightsProfile" "allocation_rights" NOT NULL,
	"inviteId" bigint NOT NULL,
	"status" "partner_allocation_status" DEFAULT 'active' NOT NULL,
	"revokedAt" timestamp,
	"createdBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "revenue_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint,
	"name" varchar(100) NOT NULL,
	"description" text,
	"incomeAccountId" bigint,
	"accountCode" varchar(20),
	"categoryType" "revenueCategoryType" DEFAULT 'other',
	"externalId" varchar(255),
	"externalSystem" varchar(50),
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "businessId" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "accountType" "accountType";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "accountSubType" "accountSubType";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "isContra" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "parentAccountId" bigint;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "externalId" varchar(255);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "externalSystem" varchar(50);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "lastSyncedAt" timestamp;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD COLUMN "journalEntryId" bigint;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "businessId" bigint;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "journalEntryId" bigint;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "businessId" bigint;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "locationId" bigint;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "accountingClass" "accountingClass" DEFAULT 'operating_expense';--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "defaultAccountId" bigint;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "externalAccountCode" varchar(50);--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "externalSystem" varchar(50);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "businessId" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "isFixedAsset" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fixedAssetItemId" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "usefulLifeMonths" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "depreciationMethod" "depreciationMethod";--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "salvageValue" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "journalEntryId" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "userType" "user_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_allocation_invites_code" ON "allocation_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_ownerAccountId" ON "allocation_invites" USING btree ("ownerAccountId");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_businessId" ON "allocation_invites" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_status" ON "allocation_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_allocation_invites_deletedAt" ON "allocation_invites" USING btree ("deletedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_config_business_system" ON "external_sync_config" USING btree ("businessId","systemName");--> statement-breakpoint
CREATE INDEX "idx_financial_report_business" ON "financial_reports" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_financial_report_type_period" ON "financial_reports" USING btree ("reportType","periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX "idx_depreciation_item" ON "fixed_asset_depreciation" USING btree ("itemId");--> statement-breakpoint
CREATE INDEX "idx_depreciation_period" ON "fixed_asset_depreciation" USING btree ("periodYear","periodMonth");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_depreciation_item_period" ON "fixed_asset_depreciation" USING btree ("itemId","periodYear","periodMonth");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_items_sku" ON "items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_items_business" ON "items" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_items_type" ON "items" USING btree ("itemType");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_journal_entry_number" ON "journal_entries" USING btree ("entryNumber");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_date" ON "journal_entries" USING btree ("entryDate");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_source" ON "journal_entries" USING btree ("sourceType","sourceId");--> statement-breakpoint
CREATE INDEX "idx_journal_entry_business" ON "journal_entries" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_journal_line_entry" ON "journal_lines" USING btree ("journalEntryId");--> statement-breakpoint
CREATE INDEX "idx_journal_line_account" ON "journal_lines" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_ownerAccountId" ON "partner_allocations" USING btree ("ownerAccountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_ownerBusinessId" ON "partner_allocations" USING btree ("ownerBusinessId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_partnerAccountId" ON "partner_allocations" USING btree ("partnerAccountId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_partnerUserId" ON "partner_allocations" USING btree ("partnerUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partner_allocations_inviteId" ON "partner_allocations" USING btree ("inviteId");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_status" ON "partner_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partner_allocations_deletedAt" ON "partner_allocations" USING btree ("deletedAt");--> statement-breakpoint
CREATE INDEX "idx_revenue_category_business" ON "revenue_categories" USING btree ("businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_code" ON "accounts" USING btree ("accountCode");--> statement-breakpoint
CREATE INDEX "idx_accounts_type" ON "accounts" USING btree ("accountType");--> statement-breakpoint
CREATE INDEX "idx_accounts_business" ON "accounts" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_expense_category_business" ON "expense_categories" USING btree ("businessId");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_accountCode_unique" UNIQUE("accountCode");