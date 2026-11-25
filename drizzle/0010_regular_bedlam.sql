ALTER TABLE "player_stars" DROP CONSTRAINT "player_stars_range";--> statement-breakpoint
ALTER TABLE "player_stars" ADD CONSTRAINT "player_stars_range" CHECK ("player_stars"."stars" between 0 and 10 and "player_stars"."best_stars" between 0 and 10 and "player_stars"."paid_best" between 0 and 10);--> statement-breakpoint
-- The casino replaced its wealth-based levels with goal stars (a level that never drops), so the old
-- bests no longer mean anything: reset them to the current level. paid_best stays, so the levels
-- already paid never pay again.
UPDATE "player_stars" SET "best_stars" = "stars" WHERE "game" = 'casino' AND "best_stars" > "stars";
