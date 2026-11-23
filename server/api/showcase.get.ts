import { defineEventHandler } from 'h3'
import { listShowcaseGames } from '#server/utils/hub'
import type { ShowcaseResponse } from '#shared/types/api'

export default defineEventHandler(async (): Promise<ShowcaseResponse> => {
    return { games: await listShowcaseGames() }
})
