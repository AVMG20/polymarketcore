import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, rotateAppKey } from '#server/utils/app-registry'
import { requireAdmin } from '#server/utils/auth'
import type { AppKeyResponse } from '#shared/types/api'

/** Replace the app's API key. The old key stops working at once. */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    await requireAdmin(event)
    const { app, apiKey } = await rotateAppKey(getRouterParam(event, 'id') ?? '')
    return { app: await getAppInfo(app.id), apiKey }
})
