CREATE TABLE "app_connections" (
	"user_id" text NOT NULL,
	"app_id" text NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_connections_user_id_app_id_pk" PRIMARY KEY("user_id","app_id")
);
--> statement-breakpoint
CREATE TABLE "app_daily_spends" (
	"app_id" text NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"spent" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "app_daily_spends_app_id_user_id_day_pk" PRIMARY KEY("app_id","user_id","day")
);
--> statement-breakpoint
CREATE TABLE "developer_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developer_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "star_unlocks" ADD COLUMN "bounty_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "welcome_granted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_connections" ADD CONSTRAINT "app_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_connections" ADD CONSTRAINT "app_connections_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_daily_spends" ADD CONSTRAINT "app_daily_spends_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_daily_spends" ADD CONSTRAINT "app_daily_spends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_tokens" ADD CONSTRAINT "developer_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_connections_app_id_idx" ON "app_connections" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "developer_tokens_user_id_idx" ON "developer_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apps_owner_user_id_idx" ON "apps" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "star_unlocks_unpaid_idx" ON "star_unlocks" USING btree ("game") WHERE "star_unlocks"."bounty_paid" = false;--> statement-breakpoint
-- Backfill: before this migration only admins registered apps and every unlock paid its bounty.
UPDATE "apps" SET "verified" = true, "verified_at" = now();--> statement-breakpoint
UPDATE "star_unlocks" SET "bounty_paid" = true;--> statement-breakpoint
UPDATE "user" SET "welcome_granted" = true WHERE EXISTS (SELECT 1 FROM "gem_transactions" t WHERE t."user_id" = "user"."id" AND t."category" = 'welcome');
