CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"return_url_prefixes" text[] DEFAULT '{}'::text[] NOT NULL,
	"api_key_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "game_stars" (
	"game" text NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"retired_at" timestamp with time zone,
	CONSTRAINT "game_stars_game_key_pk" PRIMARY KEY("game","key"),
	CONSTRAINT "game_stars_position_range" CHECK ("game_stars"."position" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "games" (
	"slug" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"play_path" text DEFAULT '/' NOT NULL,
	"icon" text,
	"cover" text,
	"accent" text,
	"position" integer DEFAULT 0 NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gem_spends" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" text NOT NULL,
	"game" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text,
	"gems_after" integer DEFAULT 0 NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gem_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"category" text NOT NULL,
	"refund" boolean DEFAULT false NOT NULL,
	"app_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signing_keys" (
	"kid" text PRIMARY KEY NOT NULL,
	"private_jwk" jsonb NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "star_unlocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game" text NOT NULL,
	"key" text NOT NULL,
	"bounty" integer DEFAULT 0 NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"gems" integer DEFAULT 0 NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"claimed_through" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_gems_non_negative" CHECK ("user"."gems" >= 0)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stars" ADD CONSTRAINT "game_stars_game_games_slug_fk" FOREIGN KEY ("game") REFERENCES "public"."games"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gem_spends" ADD CONSTRAINT "gem_spends_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gem_spends" ADD CONSTRAINT "gem_spends_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gem_transactions" ADD CONSTRAINT "gem_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gem_transactions" ADD CONSTRAINT "gem_transactions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "star_unlocks" ADD CONSTRAINT "star_unlocks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_created_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_user_created_idx" ON "activity_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "games_app_id_idx" ON "games" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gem_spends_app_key_uq" ON "gem_spends" USING btree ("app_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "gem_spends_user_idx" ON "gem_spends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gem_transactions_user_created_idx" ON "gem_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "gem_transactions_created_idx" ON "gem_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "star_unlocks_user_game_key_uq" ON "star_unlocks" USING btree ("user_id","game","key");--> statement-breakpoint
CREATE INDEX "star_unlocks_game_key_idx" ON "star_unlocks" USING btree ("game","key");--> statement-breakpoint
CREATE INDEX "star_unlocks_unlocked_at_idx" ON "star_unlocks" USING btree ("unlocked_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");