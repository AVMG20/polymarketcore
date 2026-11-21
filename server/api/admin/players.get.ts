import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '#server/utils/auth'
import { listPlayersForAdmin } from '#server/utils/hub'
import { parseQuery } from '#server/utils/validate'
import type { AdminPlayersResponse } from '#shared/types/api'

const querySchema = z.object({
    q: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0)
})

export default defineEventHandler(async (event): Promise<AdminPlayersResponse> => {
    await requireAdmin(event)
    return listPlayersForAdmin(parseQuery(event, querySchema))
})
