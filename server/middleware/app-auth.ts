import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { authenticateApp } from '#server/utils/apps'
import { authenticateDeveloper } from '#server/utils/developer-tokens'
import { enforceRateLimit, LIMITS } from '#server/utils/rate-limit'

/**
 * Bearer auth and rate limits for the machine API:
 * - `/api/v1/developer/**`: a player's developer token (`pnxd_…`)
 * - every other `/api/v1/**` route: an app API key; also marks the app as seen
 * `/api/v1/openapi.json` is public.
 */
export default defineEventHandler(async (event) => {
    const path = event.path.split('?')[0]!
    if (!path.startsWith('/api/v1/') || path === '/api/v1/openapi.json') return

    if (path.startsWith('/api/v1/developer/')) {
        const dev = await authenticateDeveloper(event)
        enforceRateLimit(event, `dev:${dev.tokenId}`, { ...LIMITS.developerToken, label: 'this developer token' })
        event.context.developer = dev
        return
    }

    const app = await authenticateApp(event)
    const rule = app.verified ? LIMITS.verifiedApp : LIMITS.unverifiedApp
    enforceRateLimit(event, `app:${app.id}`, { ...rule, label: `app ${app.id}` })
    event.context.app = app

    // Liveness, at most one write a minute.
    await db.update(apps)
        .set({ lastSeenAt: sql`now()` })
        .where(and(eq(apps.id, app.id), or(isNull(apps.lastSeenAt), lt(apps.lastSeenAt, sql`now() - interval '1 minute'`))))
})
