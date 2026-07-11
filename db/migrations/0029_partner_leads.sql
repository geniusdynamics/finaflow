-- ABOUTME: Adds the concrete leads table used for signup attribution, referral tracking, and invitation history.
-- ABOUTME: Extends email logging so lead invitation emails are logged like other outbound messages.
ALTER TYPE "public"."email_log_type" ADD VALUE IF NOT EXISTS 'lead_invitation';--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."lead_commission_status" AS ENUM('pending', 'eligible', 'info_only', 'ineligible');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "creatorUserId" bigint NOT NULL REFERENCES "users"("id") ON DELETE NO ACTION,
  "creatorAccountRefId" bigint REFERENCES "customer_accounts"("id") ON DELETE NO ACTION,
  "creatorBusinessId" bigint REFERENCES "businesses"("id") ON DELETE NO ACTION,
  "businessName" varchar(255) NOT NULL,
  "contactName" varchar(255) NOT NULL,
  "email" varchar(320),
  "normalizedEmail" varchar(320),
  "phone" varchar(20),
  "normalizedPhone" varchar(20),
  "status" "leadStatus" DEFAULT 'new' NOT NULL,
  "matchedUserId" bigint REFERENCES "users"("id") ON DELETE NO ACTION,
  "matchedAccountRefId" bigint REFERENCES "customer_accounts"("id") ON DELETE NO ACTION,
  "matchedBusinessId" bigint REFERENCES "businesses"("id") ON DELETE NO ACTION,
  "joinedAt" timestamp,
  "joinedViaReferral" boolean DEFAULT false NOT NULL,
  "referralCodeUsed" varchar(50),
  "referredByBusinessId" bigint REFERENCES "businesses"("id") ON DELETE NO ACTION,
  "referredByUserId" bigint REFERENCES "users"("id") ON DELETE NO ACTION,
  "commissionStatus" "lead_commission_status" DEFAULT 'pending' NOT NULL,
  "commissionEligible" boolean DEFAULT false NOT NULL,
  "emailInvitedAt" timestamp,
  "smsPreparedAt" timestamp,
  "lastInvitationChannel" varchar(20),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_creator_user" ON "leads" USING btree ("creatorUserId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_creator_account" ON "leads" USING btree ("creatorAccountRefId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_creator_business" ON "leads" USING btree ("creatorBusinessId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_normalized_email" ON "leads" USING btree ("normalizedEmail");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_normalized_phone" ON "leads" USING btree ("normalizedPhone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_matched_account" ON "leads" USING btree ("matchedAccountRefId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_leads_deleted_at" ON "leads" USING btree ("deletedAt");--> statement-breakpoint
