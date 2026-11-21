import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { adminUpdateAppSchema, getAppInfo, updateApp } from '#server/utils/app-registry'
import { requireAdmin } from '#server/utils/auth'
import { verifyApp } from '#server/utils/stars'
import { parseBody } from '#server/utils/validate'
import type { AppInfo } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<{ app: AppInfo }> => {
    await requireAdmin(event)
    const id = getRouterParam(event, 'id') ?? ''
    const [app] = await db.select().from(apps).where(eq(apps.id, id))
    if (!app) throw createError({ statusCode: 404, statusMessage: `App ${id} not found` })
    const body = await parseBody(event, adminUpdateAppSchema)
    // An admin's disable sticks: the owner can't switch the app back on.
    const updated = await updateApp(app, body.status ? { ...body, disabledByAdmin: body.status === 'disabled' } : body)
    // Re-enabling a verified app pays what a verification while it was disabled could not (once, by CAS).
    if (app.status !== 'active' && updated.status === 'active' && updated.verified) await verifyApp(id)
    return { app: await getAppInfo(id) }
})
