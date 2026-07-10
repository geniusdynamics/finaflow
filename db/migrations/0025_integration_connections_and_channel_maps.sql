-- ABOUTME: Additive production-safe migration for integration connections, channel mappings,
-- ABOUTME: API key expiry, and daily sales source batch tracking with FK integrity.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expiresAt" timestamp;
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "source_batch_id" varchar(255);

CREATE TABLE IF NOT EXISTS "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"targetSystem" varchar(50) NOT NULL,
	"authMode" varchar(20) DEFAULT 'api_key',
	"authData" json,
	"webhookSecret" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "external_channel_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessId" bigint NOT NULL,
	"sourceSystem" varchar(50) NOT NULL,
	"channelKey" varchar(100) NOT NULL,
	"channelLabel" varchar(255),
	"paymentMethodId" bigint,
	"accountId" bigint,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'integration_connections_businessId_businesses_id_fk'
	) THEN
		ALTER TABLE "integration_connections"
			ADD CONSTRAINT "integration_connections_businessId_businesses_id_fk"
			FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'external_channel_mappings_businessId_businesses_id_fk'
	) THEN
		ALTER TABLE "external_channel_mappings"
			ADD CONSTRAINT "external_channel_mappings_businessId_businesses_id_fk"
			FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'external_channel_mappings_paymentMethodId_payment_methods_id_fk'
	) THEN
		ALTER TABLE "external_channel_mappings"
			ADD CONSTRAINT "external_channel_mappings_paymentMethodId_payment_methods_id_fk"
			FOREIGN KEY ("paymentMethodId") REFERENCES "public"."payment_methods"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'external_channel_mappings_accountId_accounts_id_fk'
	) THEN
		ALTER TABLE "external_channel_mappings"
			ADD CONSTRAINT "external_channel_mappings_accountId_accounts_id_fk"
			FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_integration_connections_business_target"
	ON "integration_connections" USING btree ("businessId","targetSystem");
CREATE INDEX IF NOT EXISTS "idx_external_channel_mappings_business"
	ON "external_channel_mappings" USING btree ("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_external_channel_mappings_channel"
	ON "external_channel_mappings" USING btree ("businessId","sourceSystem","channelKey");
CREATE INDEX IF NOT EXISTS "idx_daily_sales_source_batch"
	ON "daily_sales" USING btree ("locationId","source_batch_id");
