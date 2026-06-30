CREATE TYPE "public"."broadcast_channel" AS ENUM('email', 'notification', 'banner');--> statement-breakpoint
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
CREATE INDEX "idx_owner_broadcasts_sent_by" ON "owner_broadcasts" USING btree ("sentBy");--> statement-breakpoint
CREATE INDEX "idx_owner_broadcasts_created_at" ON "owner_broadcasts" USING btree ("createdAt");