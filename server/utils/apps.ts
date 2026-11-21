import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createError, getRequestHeader, type H3Event } from 'h3'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { randomToken } from '#shared/random'

export type AppRow = typeof apps.$inferSelect

/** SHA-256 hex of an API key. The hub stores only this. */
export function hashApiKey(key: string): string {
    return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** A fresh plaintext API key: `pnx_` + 32 random bytes. Shown to the admin once. */
export function generateApiKey(): string {
    return `pnx_${randomToken(32)}`
}

/** The app's origin (scheme + host + port) from its base URL. */
export function appOrigin(baseUrl: string): string {
    return new URL(baseUrl).origin
}

/** Resolve `Authorization: Bearer <key>` to an active app, or throw 401. */
export async function authenticateApp(event: H3Event): Promise<AppRow> {
    const header = getRequestHeader(event, 'authorization') ?? ''
    const match = /^Bearer\s+(\S+)$/i.exec(header)
    if (!match) throw createError({ statusCode: 401, statusMessage: 'Missing app API key: send "Authorization: Bearer <app api key>"' })

    const [app] = await db.select().from(apps).where(eq(apps.apiKeyHash, hashApiKey(match[1]!)))
    if (!app) throw createError({ statusCode: 401, statusMessage: 'Invalid app API key: it was rotated, mistyped, or is a developer token (pnxd_) used on an app endpoint' })
    if (app.status !== 'active') throw createError({ statusCode: 401, statusMessage: `App ${app.id} is disabled` })
    return app
}

/** The app authenticated by server/middleware/app-auth.ts for an `/api/v1/**` route. */
export function requireApp(event: H3Event): AppRow {
    const app = event.context.app as AppRow | undefined
    if (!app) throw createError({ statusCode: 401, statusMessage: 'Invalid app API key' })
    return app
}
