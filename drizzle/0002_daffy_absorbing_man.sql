CREATE TABLE "player_stars" (
	"user_id" text NOT NULL,
	"game" text NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"best_stars" integer DEFAULT 0 NOT NULL,
	"paid_best" integer DEFAULT 0 NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_stars_user_id_game_pk" PRIMARY KEY("user_id","game"),
	CONSTRAINT "player_stars_range" CHECK ("player_stars"."stars" between 0 and 10 and "player_stars"."best_stars" between 0 and 10 and "player_stars"."paid_best" between 0 and "player_stars"."best_stars")
);
--> statement-breakpoint
ALTER TABLE "player_stars" ADD CONSTRAINT "player_stars_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stars" ADD CONSTRAINT "player_stars_game_games_slug_fk" FOREIGN KEY ("game") REFERENCES "public"."games"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_stars_game_idx" ON "player_stars" USING btree ("game");--> statement-breakpoint
CREATE INDEX "player_stars_unpaid_idx" ON "player_stars" USING btree ("game") WHERE "player_stars"."paid_best" < "player_stars"."best_stars";--> statement-breakpoint
-- Stars became levels: carry each player's unlock count per game over as their level and best.
INSERT INTO "player_stars" ("user_id", "game", "stars", "best_stars", "paid_best", "seq", "updated_at")
SELECT u."user_id", u."game", least(count(*), 10)::int, least(count(*), 10)::int,
       least(count(*) FILTER (WHERE u."bounty_paid"), 10)::int, 0, max(u."unlocked_at")
FROM "star_unlocks" u
JOIN "games" g ON g."slug" = u."game"
GROUP BY u."user_id", u."game";
