import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { listDeveloperTokens } from '#server/utils/developer-tokens'
import { MAX_DEVELOPER_TOKENS } from '#shared/economy'
import type { DeveloperTokensResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<DeveloperTokensResponse> => {
    const u = await requireUser(event)
    return { tokens: await listDeveloperTokens(u.id), max: MAX_DEVELOPER_TOKENS }
})
