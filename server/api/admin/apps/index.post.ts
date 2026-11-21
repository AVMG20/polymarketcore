import { defineEventHandler } from 'h3'
import { registerApp, registerAppSchema, getAppInfo } from '#server/utils/app-registry'
import { requireAdmin } from '#server/utils/auth'
import { parseBody } from '#server/utils/validate'
import type { AppKeyResponse } from '#shared/types/api'

/** Register an app owned by the admin (unverified until verified). The plaintext key is in this response only. */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    const admin = await requireAdmin(event)
    const body = await parseBody(event, registerAppSchema)
    const { app, apiKey } = await registerApp({ ...body, ownerUserId: admin.id, limitOwner: false })
    return { app: await getAppInfo(app.id), apiKey }
})
