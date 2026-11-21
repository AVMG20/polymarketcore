CREATE TABLE "emblem_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"emblem" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "emblem" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "prestige" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "emblem_history" ADD CONSTRAINT "emblem_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emblem_history_user_created_idx" ON "emblem_history" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_prestige_range" CHECK ("user"."prestige" between 0 and 4);