import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp, rotateAppKey } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import type { AppKeyResponse } from '#shared/types/api'

/** Rotate the API key of one of the signed-in player's apps; the old key stops working at once. */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    await getOwnedApp(user.id, id)
    const { apiKey } = await rotateAppKey(id)
    return { app: await getAppInfo(id), apiKey }
})
