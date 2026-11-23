import { defineEventHandler, getRouterParam } from 'h3'
import { requireViewer } from '#server/utils/auth'
import { getGameDetail } from '#server/utils/hub'
import type { GameDetailResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<GameDetailResponse> => {
    return getGameDetail(getRouterParam(event, 'slug') ?? '', await requireViewer(event))
})
