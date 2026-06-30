CREATE TYPE "public"."email_log_type" AS ENUM('welcome', 'new_signup_notification', 'password_reset', 'owner_broadcast', 'smtp_test');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "email_log_type" NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_email_logs_type" ON "email_logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_email_logs_status" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_logs_created_at" ON "email_logs" USING btree ("createdAt");