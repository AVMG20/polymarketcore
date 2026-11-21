import { and, eq, isNull } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { db } from '#server/database/index'
import { apps, games } from '#server/database/schema'
import { appOrigin } from '#server/utils/apps'
import { isAdmin, requireUser } from '#server/utils/auth'
import { launchTokenFor } from '#server/utils/launch'
import type { LaunchResponse } from '#shared/types/api'

/**
 * Flow A (contract §1): the iframe URL for a game with a fresh launch token in
 * the hash, and a `/connect` path to open it in its own tab. Drafts launch
 * only for the app owner and admins.
 */
export default defineEventHandler(async (event): Promise<LaunchResponse> => {
    const u = await requireUser(event)
    const slug = getRouterParam(event, 'slug') ?? ''
    const [row] = await db.select({ game: games, app: apps })
        .from(games)
        .innerJoin(apps, eq(apps.id, games.appId))
        .where(and(eq(games.slug, slug), isNull(games.retiredAt), eq(apps.status, 'active')))
    const allowed = row && (row.game.visibility === 'public' || row.app.ownerUserId === u.id || isAdmin(u))
    if (!row || !allowed) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

    const token = await launchTokenFor(u.id, row.app.id)
    const gameUrl = `${row.app.baseUrl}${row.game.playPath}`
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return {
        url: `${gameUrl}#pnx=${token}`,
        directUrl: `/connect?app=${encodeURIComponent(row.app.id)}&return=${encodeURIComponent(gameUrl)}`,
        app: { id: row.app.id, origin: appOrigin(row.app.baseUrl) },
        game: { slug: row.game.slug, name: row.game.name }
    }
})
