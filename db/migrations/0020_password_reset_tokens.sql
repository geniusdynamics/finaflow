CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"tokenHash" varchar(255) NOT NULL UNIQUE,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" USING btree ("expiresAt");