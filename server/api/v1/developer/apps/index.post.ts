import { defineEventHandler, setResponseStatus } from 'h3'
import { registerApp, registerAppSchema, getAppInfo } from '#server/utils/app-registry'
import { requireDeveloper } from '#server/utils/developer-tokens'
import { parseBody } from '#server/utils/validate'
import type { AppKeyResponse } from '#shared/types/api'

/** Register an app owned by the token's player. The app API key is in this response only. */
export default defineEventHandler(async (event): Promise<AppKeyResponse> => {
    const dev = requireDeveloper(event)
    const body = await parseBody(event, registerAppSchema)
    const { app, apiKey } = await registerApp({ ...body, ownerUserId: dev.userId, limitOwner: true })
    setResponseStatus(event, 201)
    return { app: await getAppInfo(app.id), apiKey }
})
