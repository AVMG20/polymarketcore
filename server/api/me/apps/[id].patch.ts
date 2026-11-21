import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { getAppInfo, setOwnAppStatus } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import { verifyApp } from '#server/utils/stars'
import { parseBody } from '#server/utils/validate'
import type { AppInfo } from '#shared/types/api'

const bodySchema = z.object({ status: z.enum(['active', 'disabled'], { error: "status must be 'active' or 'disabled'" }) })

/** The owner switches their app on or off (not one an admin disabled). */
export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    const { status } = await parseBody(event, bodySchema)
    const wasOff = (await getAppInfo(id).catch(() => null))?.status === 'disabled'
    const app = await setOwnAppStatus(user.id, id, status)
    // Back on and verified: pay what a verification while it was off could not (once, by CAS).
    if (wasOff && app.status === 'active' && app.verified) await verifyApp(id)
    return { app: await getAppInfo(id) }
})
