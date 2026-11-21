import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { getGemStats } from '#server/utils/gem-stats'
import { parseQuery } from '#server/utils/validate'
import { GEM_RANGES } from '#shared/gem-history'
import type { GemStatsResponse } from '#shared/types/api'

const querySchema = z.object({ range: z.enum(GEM_RANGES).default('30d') })

/** The viewer's gem flow over a range: totals, per-day buckets with the balance, and sources. */
export default defineEventHandler(async (event): Promise<GemStatsResponse> => {
    const u = await requireUser(event)
    const { range } = parseQuery(event, querySchema)
    return getGemStats(u.id, range)
})
