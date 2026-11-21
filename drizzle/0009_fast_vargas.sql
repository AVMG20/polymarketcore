CREATE TABLE "game_daily_peaks" (
	"game" text NOT NULL,
	"day" date NOT NULL,
	"peak" integer NOT NULL,
	CONSTRAINT "game_daily_peaks_game_day_pk" PRIMARY KEY("game","day")
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"game" text NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_sessions_game_started_idx" ON "play_sessions" USING btree ("game","started_at");