import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp, ownedAppGames } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import type { MyAppDetailResponse } from '#shared/types/api'

/** One of the signed-in player's apps and all of its registered games (including drafts and retired). */
export default defineEventHandler(async (event): Promise<MyAppDetailResponse> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    await getOwnedApp(user.id, id)
    const [app, games] = await Promise.all([getAppInfo(id), ownedAppGames(id)])
    return { app, games }
})
