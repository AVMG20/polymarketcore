import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { getAppInfo, setOwnAppRepo, setOwnAppStatus } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import { repoUrlField } from '#server/utils/manifest'
import { verifyApp } from '#server/utils/stars'
import { parseBody } from '#server/utils/validate'
import type { AppInfo } from '#shared/types/api'

const bodySchema = z.object({
    status: z.enum(['active', 'disabled'], { error: "status must be 'active' or 'disabled'" }).optional(),
    repoUrl: repoUrlField.optional()
}).refine(b => b.status !== undefined || b.repoUrl !== undefined, { error: 'Send status or repoUrl' })

/** The owner switches their app on or off (not one an admin disabled) and sets or clears its repo URL. */
export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    const { status, repoUrl } = await parseBody(event, bodySchema)
    if (repoUrl !== undefined) await setOwnAppRepo(user.id, id, repoUrl)
    if (status) {
        const wasOff = (await getAppInfo(id).catch(() => null))?.status === 'disabled'
        const app = await setOwnAppStatus(user.id, id, status)
        // Back on and verified: pay what a verification while it was off could not (once, by CAS).
        if (wasOff && app.status === 'active' && app.verified) await verifyApp(id)
    }
    return { app: await getAppInfo(id) }
})
