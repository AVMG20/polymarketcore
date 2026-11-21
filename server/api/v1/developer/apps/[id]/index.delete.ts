import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo, getOwnedApp, updateApp } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import type { AppInfo } from '#shared/types/api'

/**
 * Disable the app (never deleted: players' stars stay). Its key stops working
 * and its games leave the hub. An admin can enable it again.
 */
export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const dev = requireDeveloper(event)
    const app = await getOwnedApp(dev.userId, getRouterParam(event, 'id') ?? '')
    if (app.status !== 'disabled') await updateApp(app, { status: 'disabled' })
    return { app: await getAppInfo(app.id) }
})
