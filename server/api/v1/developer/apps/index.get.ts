import { defineEventHandler } from 'h3'
import { listApps } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import type { AppsResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<AppsResponse> => {
    const dev = requireDeveloper(event)
    return { apps: await listApps(dev.userId) }
})
