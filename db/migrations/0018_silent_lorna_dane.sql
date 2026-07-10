CREATE TABLE "integration_connections" (
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
--> statement-breakpoint
ALTER TABLE "external_channel_mappings" DROP CONSTRAINT "external_channel_mappings_businessId_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "external_channel_mappings" DROP CONSTRAINT "external_channel_mappings_paymentMethodId_payment_methods_id_fk";
--> statement-breakpoint
ALTER TABLE "external_channel_mappings" DROP CONSTRAINT "external_channel_mappings_accountId_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "idx_external_channel_mappings_business";--> statement-breakpoint
DROP INDEX "idx_external_channel_mappings_channel";--> statement-breakpoint
ALTER TABLE "external_channel_mappings" ALTER COLUMN "paymentMethodId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_businessId_businesses_id_fk" FOREIGN KEY ("businessId") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_integration_connections_business_target" ON "integration_connections" USING btree ("businessId","targetSystem");