import { defineEventHandler } from 'h3'
import { requireUser } from '#server/utils/auth'
import { claimDaily } from '#server/utils/claim'
import { enforceRateLimit, LIMITS } from '#server/utils/rate-limit'
import type { ClaimResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<ClaimResponse> => {
    const u = await requireUser(event)
    enforceRateLimit(event, `claim:${u.id}`, { ...LIMITS.claim, label: 'claiming' })
    return claimDaily(u.id)
})
