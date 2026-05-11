CREATE TABLE "business_logos" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"fileData" text NOT NULL,
	"width" integer,
	"height" integer,
	"sizeBytes" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"uploadedBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"accountId" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"maxBusinesses" integer DEFAULT 1 NOT NULL,
	"maxUsers" integer DEFAULT 1 NOT NULL,
	"maxTransactionsPerMonth" integer DEFAULT 100 NOT NULL,
	"features" json,
	"subscriptionStatus" varchar(20) DEFAULT 'active' NOT NULL,
	"subscriptionExpiry" date,
	"isActive" boolean DEFAULT true NOT NULL,
	"migratedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "businesses" DROP CONSTRAINT "businesses_accountId_unique";--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "nextBillNumber" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "nextExpenseNumber" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "accountRefId" bigint;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "accountRefId" bigint;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "businessId" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "locationId" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accountRefId" bigint;--> statement-breakpoint
CREATE INDEX "idx_business_logos_businessId" ON "business_logos" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "idx_business_logos_isActive" ON "business_logos" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_business_logos_uploadedBy" ON "business_logos" USING btree ("uploadedBy");--> statement-breakpoint
CREATE INDEX "idx_business_logos_deletedAt" ON "business_logos" USING btree ("deletedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_customer_accounts_accountId" ON "customer_accounts" USING btree ("accountId");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_accountRefId_customer_accounts_id_fk" FOREIGN KEY ("accountRefId") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_idx" ON "suppliers" USING btree ("businessId");--> statement-breakpoint
CREATE INDEX "location_idx" ON "suppliers" USING btree ("locationId");--> statement-breakpoint
CREATE INDEX "deleted_idx" ON "suppliers" USING btree ("deletedAt");