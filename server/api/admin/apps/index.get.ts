import { defineEventHandler } from 'h3'
import { listApps } from '#server/utils/app-registry'
import { requireAdmin } from '#server/utils/auth'
import type { AppsResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<AppsResponse> => {
    await requireAdmin(event)
    return { apps: await listApps() }
})
