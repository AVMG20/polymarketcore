import { defineEventHandler, setResponseStatus } from 'h3'
import { getAppInfo, registerApp, registerAppSchema } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import { parseBody } from '#server/utils/validate'
import type { AppKeyResponse } from '#shared/types/api'

/** Register a new app from the hub UI (same rules and active-app limit as the developer API). */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    const user = await requireUser(event)
    const body = await parseBody(event, registerAppSchema)
    const { app, apiKey } = await registerApp({ ...body, ownerUserId: user.id, limitOwner: true })
    setResponseStatus(event, 201)
    return { app: await getAppInfo(app.id), apiKey }
})
