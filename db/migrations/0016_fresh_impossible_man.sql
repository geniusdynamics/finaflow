CREATE TYPE "public"."broadcast_channel" AS ENUM('email', 'notification', 'banner');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'quarterly', 'half-yearly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."budget_plan_status" AS ENUM('draft', 'active', 'locked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."email_log_type" AS ENUM('welcome', 'new_signup_notification', 'password_reset', 'owner_broadcast', 'smtp_test');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_cleared_reason" AS ENUM('user_dismissed', 'bill_paid', 'action_completed', 'manual_clear_all', 'system_resolved');--> statement-breakpoint
CREATE TYPE "public"."notification_highlight" AS ENUM('highlighted', 'faded', 'archived');--> statement-breakpoint
ALTER TYPE "public"."accountSubType" ADD VALUE 'bank_charges';--> statement-breakpoint
ALTER TYPE "public"."action" ADD VALUE 'DOWNLOAD';--> statement-breakpoint
ALTER TYPE "public"."paymentMethod2" ADD VALUE 'wallet';--> statement-breakpoint
ALTER TYPE "public"."paymentMethod" ADD VALUE 'wallet';--> statement-breakpoint
ALTER TYPE "public"."transactionType" ADD VALUE 'loan_origination';--> statement-breakpoint
ALTER TYPE "public"."transactionType" ADD VALUE 'loan_disbursement';--> statement-breakpoint
CREATE TABLE "budget_bucket_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucketId" bigint NOT NULL,
	"categoryId" bigint NOT NULL,
	"amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_plan_buckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"planId" bigint NOT NULL,
	"bucketType" varchar(16) NOT NULL,
	"bucketIndex" integer NOT NULL,
	"startMonth" integer NOT NULL,
	"endMonth" integer NOT NULL,
	"label" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"fiscalYearStart" integer NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"name" varchar(255),
	"notes" text,
	"status" "budget_plan_status" DEFAULT 'draft' NOT NULL,
	"createdById" bigint,
	"legacyGroupKey" varchar(64),
	"lockedAt" timestamp,
	"lockedById" bigint,
	"archivedAt" timestamp,
	"archivedById" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "coa_subtypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtypeKey" varchar(50) NOT NULL,
	"displayName" varchar(100) NOT NULL,
	"accountType" varchar(20) NOT NULL,
	"walletSupport" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coa_subtypes_subtypeKey_unique" UNIQUE("subtypeKey")
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"locationId" bigint,
	"businessId" bigint,
	"creditorName" varchar(255) NOT NULL,
	"description" text,
	"totalAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"paidAmount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"interestRate" numeric(5, 2) DEFAULT '0.00',
	"dueDate" timestamp,
	"loanDate" timestamp DEFAULT now() NOT NULL,
	"installmentAmount" numeric(15, 2),
	"destinationAccountId" bigint,
	"loanAccountId" bigint,
	"isDisbursed" boolean DEFAULT false NOT NULL,
	"disbursementDate" timestamp,
	"disbursementFee" numeric(15, 2),
	"recurringBillTemplateId" bigint,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"paymentSchedule" varchar(50) DEFAULT 'monthly',
	"notes" text,
	"createdBy" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "email_log_type" NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_channel_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"sourceSystem" varchar(50) NOT NULL,
	"channelKey" varchar(100) NOT NULL,
	"channelLabel" varchar(255),
	"paymentMethodId" bigint NOT NULL,
	"accountId" bigint,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "owner_broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"channels" "broadcast_channel"[] DEFAULT '{"email"}' NOT NULL,
	"sentBy" bigint NOT NULL,
	"recipientCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"tokenHash" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"locationId" bigint NOT NULL,
	"isPrimary" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"assignedAt" timestamp DEFAULT now() NOT NULL,
	"assignedBy" bigint
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"accountId" varchar(100),
	"accountRefId" bigint,
	"businessId" bigint,
	"action" varchar(20) DEFAULT 'login' NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" text,
	"location" varchar(255),
	"sessionDuration" integer,
	"loginAt" timestamp DEFAULT now() NOT NULL,
	"logoutAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ALTER COLUMN "defaultAccountId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "coaId" bigint;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "debtId" bigint;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "enteredBy" bigint;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "fiscalYearStartMonth" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_sales" ADD COLUMN "source_batch_id" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkUrl" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkLabel" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkClicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "readAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dismissedAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "highlightState" "notification_highlight" DEFAULT 'highlighted' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "fadedAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "lastHighlightedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "highlightCount" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "archivedAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "clearedAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "clearedReason" "notification_cleared_reason";--> statement-breakpoint
ALTER TABLE "budget_bucket_lines" ADD CONSTRAINT "budget_bucket_lines_bucketId_budget_plan_buckets_id_fk" FOREIGN KEY ("bucketId") REFERENCES "public"."budget_plan_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_bucket_lines" ADD CONSTRAINT "budget_bucket_lines_categoryId_expense_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_plan_buckets" ADD CONSTRAINT "budget_plan_buckets_planId_budget_plans_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."budget_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_channel_mappings" ADD CONSTRAINT "external_channel_mappings_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_channel_mappings" ADD CONSTRAINT "external_channel_mappings_paymentMethodId_payment_methods_id_fk" FOREIGN KEY ("paymentMethodId") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_channel_mappings" ADD CONSTRAINT "external_channel_mappings_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_budget_bucket_lines_bucketId" ON "budget_bucket_lines" USING btree ("bucketId");--> statement-breakpoint
CREATE INDEX "idx_budget_bucket_lines_categoryId" ON "budget_bucket_lines" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "idx_budget_plan_buckets_planId" ON "budget_plan_buckets" USING btree ("planId");--> statement-breakpoint
CREATE INDEX "idx_budget_plan_buckets_bucketType" ON "budget_plan_buckets" USING btree ("bucketType");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_budget_plan_buckets_plan_index" ON "budget_plan_buckets" USING btree ("planId","bucketType","bucketIndex");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_locationId" ON "budget_plans" USING btree ("locationId");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_fiscalYearStart" ON "budget_plans" USING btree ("fiscalYearStart");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_period" ON "budget_plans" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_status" ON "budget_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_legacyGroupKey" ON "budget_plans" USING btree ("legacyGroupKey");--> statement-breakpoint
CREATE INDEX "idx_budget_plans_deletedAt" ON "budget_plans" USING btree ("deletedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coa_subtypes_key" ON "coa_subtypes" USING btree ("subtypeKey");--> statement-breakpoint
CREATE INDEX "idx_coa_subtypes_account_type" ON "coa_subtypes" USING btree ("accountType");--> statement-breakpoint
CREATE INDEX "idx_email_logs_type" ON "email_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_email_logs_status" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_logs_created_at" ON "email_logs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_external_channel_mappings_business" ON "external_channel_mappings" USING btree ("businessId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_external_channel_mappings_channel" ON "external_channel_mappings" USING btree ("businessId","sourceSystem","channelKey");--> statement-breakpoint
CREATE INDEX "idx_owner_broadcasts_sent_by" ON "owner_broadcasts" USING btree ("sentBy");--> statement-breakpoint
CREATE INDEX "idx_owner_broadcasts_created_at" ON "owner_broadcasts" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_user_locations_userId" ON "user_locations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_user_locations_locationId" ON "user_locations" USING btree ("locationId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_locations_unique" ON "user_locations" USING btree ("userId","locationId");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_account_id" ON "user_sessions" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_action" ON "user_sessions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_login_at" ON "user_sessions" USING btree ("loginAt");--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_locationId_locations_id_fk" FOREIGN KEY ("locationId") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_categoryId_expense_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_coa" ON "accounts" USING btree ("coaId");--> statement-breakpoint
CREATE INDEX "idx_notifications_entity" ON "notifications" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_highlight" ON "notifications" USING btree ("userId","highlightState");--> statement-breakpoint
CREATE INDEX "idx_notifications_archived" ON "notifications" USING btree ("userId","archivedAt");--> statement-breakpoint
CREATE INDEX "idx_notifications_priority" ON "notifications" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_notifications_banner" ON "notifications" USING btree ("userId","entityType");