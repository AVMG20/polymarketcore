import { and, asc, eq, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { games } from '#server/database/schema'
import { getOwnedApp } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import { launchTokenFor } from '#server/utils/launch'
import { LAUNCH_TOKEN_TTL_SECONDS } from '#server/utils/launch-token'
import { parseBody } from '#server/utils/validate'
import type { TestLaunchResponse } from '#shared/types/api'

const bodySchema = z.object({
    game: z.string().optional()
}).optional()

/**
 * A launch token for the token's owner, so an agent can test its app without a
 * browser. The owner becomes a connected player of the app; spends and unlocks
 * against them follow the normal rules (real gems, the unverified cap, no bounty while unverified).
 */
export default defineEventHandler(async (event): Promise<TestLaunchResponse> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    if (app.status !== 'active') throw createError({ statusCode: 400, statusMessage: `App ${app.id} is disabled` })
    const body = await parseBody(event, bodySchema)

    const [game] = await db.select({ slug: games.slug, playPath: games.playPath })
        .from(games)
        .where(and(eq(games.appId, app.id), isNull(games.retiredAt), body?.game ? eq(games.slug, body.game) : undefined))
        .orderBy(asc(games.position))
        .limit(1)
    if (body?.game && !game) {
        throw createError({ statusCode: 404, statusMessage: `Game ${body.game} is not an active game of app ${app.id}` })
    }

    const token = await launchTokenFor(dev.userId, app.id)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return {
        token,
        url: `${app.baseUrl}${game?.playPath ?? '/'}#pnx=${token}`,
        playerId: dev.userId,
        expiresIn: LAUNCH_TOKEN_TTL_SECONDS
    }
})
