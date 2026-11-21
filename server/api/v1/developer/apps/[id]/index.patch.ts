import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp, updateApp, updateAppSchema } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import { parseBody } from '#server/utils/validate'
import type { AppInfo } from '#shared/types/api'

/** Change name, baseUrl or returnUrlPrefixes. */
export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    const body = await parseBody(event, updateAppSchema)
    await updateApp(app, body)
    return { app: await getAppInfo(app.id) }
})
