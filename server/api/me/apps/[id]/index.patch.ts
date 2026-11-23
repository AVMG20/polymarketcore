import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { getAppInfo, getOwnedApp, setOwnAppStatus, updateApp, updateAppSchema } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import { verifyApp } from '#server/utils/stars'
import { parseBody } from '#server/utils/validate'
import type { AppInfo } from '#shared/types/api'

const bodySchema = updateAppSchema.extend({
    status: z.enum(['active', 'disabled'], { error: "status must be 'active' or 'disabled'" }).optional()
}).refine(
    b => Object.values(b).some(v => v !== undefined),
    { error: 'Send at least one of name, baseUrl, returnUrlPrefixes, repoUrl or status' }
)

/** The owner updates their app's details and/or switches it on or off (not one an admin disabled). */
export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    const { status, ...details } = await parseBody(event, bodySchema)
    const owned = await getOwnedApp(user.id, id)
    if (Object.values(details).some(v => v !== undefined)) {
        await updateApp(owned, details)
    }
    if (status) {
        const wasOff = owned.status === 'disabled'
        const app = await setOwnAppStatus(user.id, id, status)
        // Back on and verified: pay what a verification while it was off could not (once, by CAS).
        if (wasOff && app.status === 'active' && app.verified) await verifyApp(id)
    }
    return { app: await getAppInfo(id) }
})
