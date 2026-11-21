import { and, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { games, playerStars } from '#server/database/schema'
import { requireApp } from '#server/utils/apps'
import { parseQuery } from '#server/utils/validate'

const querySchema = z.object({ game: z.string().min(1).max(40).optional() })

/** The player's current level per game, for this app's games only. */
export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const playerId = getRouterParam(event, 'playerId') ?? ''
    const { game } = parseQuery(event, querySchema)

    const owned = await db.select({ slug: games.slug }).from(games).where(eq(games.appId, app.id))
    const slugs = owned.map(g => g.slug)
    if (game && !slugs.includes(game)) {
        throw createError({ statusCode: 403, statusMessage: `Game ${game} is not one of this app's games` })
    }
    const filter = game ? [game] : slugs
    if (filter.length === 0) return { stars: [] }

    const rows = await db.select().from(playerStars)
        .where(and(eq(playerStars.userId, playerId), inArray(playerStars.game, filter)))
    return {
        stars: rows.map(r => ({ game: r.game, stars: r.stars, best: r.bestStars, seq: r.seq, updatedAt: r.updatedAt.toISOString() }))
    }
})
