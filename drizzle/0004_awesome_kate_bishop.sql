ALTER TABLE "apps" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "visibility" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "signing_keys" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
-- Games that existed before drafts were introduced were already public.
UPDATE "games" SET "visibility" = 'public';
