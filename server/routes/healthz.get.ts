import { sql } from 'drizzle-orm'
import { defineEventHandler, setResponseStatus } from 'h3'
import { db } from '#server/database/index'

/** Liveness and readiness: 200 when the database answers, 503 otherwise. */
export default defineEventHandler(async (event) => {
    try {
        await db.execute(sql`select 1`)
        return { ok: true }
    } catch {
        setResponseStatus(event, 503)
        return { ok: false, error: 'database unreachable' }
    }
})
