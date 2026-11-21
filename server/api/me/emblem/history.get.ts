import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { listEmblemHistory } from '#server/utils/emblem'
import type { EmblemHistoryResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<EmblemHistoryResponse> => {
    const u = await requireUser(event)
    return { entries: await listEmblemHistory(u.id) }
})
