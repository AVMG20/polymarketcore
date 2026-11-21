import { defineEventHandler, getRouterParam } from 'h3'
import { appGames, getAppInfo, getOwnedApp } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import type { DeveloperGamesResponse } from '#shared/types/api'

/** The app's games and stars as the hub sees them (after the last manifest). */
export default defineEventHandler(async (event): Promise<DeveloperGamesResponse> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    return { app: await getAppInfo(app.id), games: await appGames(app.id) }
})
