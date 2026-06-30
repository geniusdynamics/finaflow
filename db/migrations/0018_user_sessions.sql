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
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_account_id" ON "user_sessions" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_action" ON "user_sessions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_login_at" ON "user_sessions" USING btree ("loginAt");