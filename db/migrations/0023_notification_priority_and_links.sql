ALTER TABLE "notifications" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkUrl" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkLabel" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "linkClicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "readAt" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dismissedAt" timestamp;--> statement-breakpoint
CREATE INDEX "idx_notifications_priority" ON "notifications" USING btree ("priority" DESC);--> statement-breakpoint
CREATE INDEX "idx_notifications_banner" ON "notifications" USING btree ("userId", "entityType");