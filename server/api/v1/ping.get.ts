import { defineEventHandler } from 'h3'
import { requireApp } from '#server/utils/apps'

/** Heartbeat: any /api/v1 call marks the app as seen; this one does nothing else. */
export default defineEventHandler((event) => {
    const app = requireApp(event)
    return { ok: true, app: app.id, verified: app.verified, time: new Date().toISOString() }
})
