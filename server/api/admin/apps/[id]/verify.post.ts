import { defineEventHandler, getRouterParam } from 'h3'
import { getAppInfo } from '#server/utils/app-registry'
import { requireAdmin } from '#server/utils/auth'
import { verifyApp } from '#server/utils/stars'
import type { VerifyAppResponse } from '#shared/types/api'

/** Verify an app and pay its players' outstanding star bounties (once, however often this is called). */
export default defineEventHandler(async (event): Promise<VerifyAppResponse> => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    const paid = await verifyApp(id)
    return { app: await getAppInfo(id), paid }
})
