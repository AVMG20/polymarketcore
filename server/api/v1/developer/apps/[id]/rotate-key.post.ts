import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp, rotateAppKey } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import type { AppKeyResponse } from '#shared/types/api'

/** Issue a new app API key; the old one stops working at once. */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    const { apiKey } = await rotateAppKey(app.id)
    return { app: await getAppInfo(app.id), apiKey }
})
