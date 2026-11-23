import { defineEventHandler } from 'h3'
import { listApps } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import type { MyAppsResponse } from '#shared/types/api'

/** The signed-in player's registered apps. */
export default defineEventHandler(async (event): Promise<MyAppsResponse> => {
    const user = await requireUser(event)
    return { apps: await listApps(user.id) }
})
