import { defineEventHandler } from 'h3'
import { getViewer } from '#server/utils/auth'
import { getGameOrder } from '#server/utils/game-order'
import { listGames } from '#server/utils/hub'
import type { GamesResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<GamesResponse> => {
    const viewer = await getViewer(event)
    const [games, order] = await Promise.all([listGames(viewer), viewer ? getGameOrder(viewer.id) : null])
    return { games, order }
})
