import { defineEventHandler } from 'h3'
import { getViewer } from '#server/utils/auth'
import { listGames } from '#server/utils/hub'
import type { GamesResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<GamesResponse> => {
    return { games: await listGames(await getViewer(event)) }
})
