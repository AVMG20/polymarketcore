import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { getLeaderboard } from '#server/utils/hub'
import { parseQuery } from '#server/utils/validate'
import type { LeaderboardResponse } from '#shared/types/api'

const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0)
})

export default defineEventHandler(async (event): Promise<LeaderboardResponse> => {
    const u = await requireUser(event)
    const { limit, offset } = parseQuery(event, querySchema)
    return getLeaderboard(u.id, limit, offset)
})
