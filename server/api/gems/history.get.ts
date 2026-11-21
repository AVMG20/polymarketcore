import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { listGemHistory } from '#server/utils/gem-stats'
import { SLUG_PATTERN } from '#server/utils/manifest'
import { parseQuery } from '#server/utils/validate'
import { GEM_HISTORY_KINDS, GEM_RANGES } from '#shared/gem-history'
import type { GemHistoryResponse } from '#shared/types/api'

const querySchema = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    range: z.enum(GEM_RANGES).optional(),
    dir: z.enum(['in', 'out']).optional(),
    kind: z.enum(GEM_HISTORY_KINDS).optional(),
    game: z.string().regex(SLUG_PATTERN, 'game must be a game slug').optional(),
    before: z.string().min(1).max(64).optional()
})

export default defineEventHandler(async (event): Promise<GemHistoryResponse> => {
    const u = await requireUser(event)
    return listGemHistory(u.id, parseQuery(event, querySchema))
})
