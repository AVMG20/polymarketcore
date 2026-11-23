import { defineEventHandler, getRouterParam } from 'h3'
import { requireViewer } from '#server/utils/auth'
import { getPlayerProfile } from '#server/utils/hub'
import type { PlayerProfileResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<PlayerProfileResponse> => {
    return getPlayerProfile(getRouterParam(event, 'id') ?? '', await requireViewer(event))
})
