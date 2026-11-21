import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import type { AppInfo } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    return { app: await getAppInfo(app.id) }
})
