import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { searchPlayers } from '#server/utils/hub'
import { parseQuery } from '#server/utils/validate'
import type { SearchResponse } from '#shared/types/api'

const querySchema = z.object({
    q: z.string().max(60).default('')
})

export default defineEventHandler(async (event): Promise<SearchResponse> => {
    await requireUser(event)
    const { q } = parseQuery(event, querySchema)
    return { players: await searchPlayers(q) }
})
