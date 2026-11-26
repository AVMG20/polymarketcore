import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { requireApp } from '#server/utils/apps'
import { assertConnected } from '#server/utils/connections'
import { playerAvatarUrl } from '#server/utils/emblem'
import { coreUrl } from '#server/utils/launch-token'
import { starSummary } from '#server/utils/stars'

export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const playerId = getRouterParam(event, 'playerId') ?? ''
    const [player] = await db.select({ id: user.id, name: user.name, image: user.image, emblem: user.emblem, gems: user.gems })
        .from(user).where(eq(user.id, playerId))
    if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    await assertConnected(app.id, player.id)
    const { stars, title } = await starSummary(player.id)
    return { id: player.id, name: player.name, image: playerAvatarUrl(player, coreUrl(event)), gems: player.gems, stars, title }
})
