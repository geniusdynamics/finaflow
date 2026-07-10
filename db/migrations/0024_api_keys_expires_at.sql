ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expiresAt" timestamp;
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "source_batch_id" varchar(255);
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
