import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { normalizeAppUrls } from '#shared/app-urls'
import { appUrlRules } from '#server/utils/app-registry'
import { hashApiKey } from '#server/utils/apps'
import { SLUG_PATTERN } from '#server/utils/manifest'
import { formatPath } from '#server/utils/validate'

/**
 * `BOOTSTRAP_APPS`: first-party apps (the casino) registered from the
 * environment on server start, so production needs no seed and no manual
 * registration. A JSON array of `{ id, name, baseUrl, returnUrlPrefixes?, key }`.
 *
 * Each app is created verified and active, without an owner (admins manage it
 * on /admin/apps), with only the key's SHA-256 hash stored. An app whose id
 * or key already exists is left exactly as it is: rotating its key or editing
 * it afterwards is never undone by a restart.
 */

/** The dev seed's key is public; it must never become a production app key. */
export const PUBLIC_DEV_KEYS: readonly string[] = ['pnx_dev_casino_key_change_me']

const entrySchema = z.object({
    id: z.string({ error: 'id is required' }).regex(SLUG_PATTERN, 'id must match [a-z0-9-]{2,40}'),
    name: z.string({ error: 'name is required' }).trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters'),
    baseUrl: z.string({ error: 'baseUrl is required' }),
    returnUrlPrefixes: z.array(z.string()).min(1).max(20).optional(),
    key: z.string({ error: 'key is required (the app\'s PNX_APP_KEY)' })
        .regex(/^pnx_[A-Za-z0-9_-]{24,200}$/, 'key must be pnx_ followed by at least 24 letters, digits, - or _ (openssl rand -hex 32)')
}).strict()

export interface BootstrapApp {
    id: string
    name: string
    baseUrl: string
    returnUrlPrefixes: string[]
    keyHash: string
}

/** Parse and validate BOOTSTRAP_APPS. Throws an Error naming the entry and field on anything invalid. */
export function parseBootstrapApps(raw: string | undefined, options: { production: boolean } = appUrlRules()): BootstrapApp[] {
    if (raw === undefined || raw.trim() === '') return []
    let data: unknown
    try {
        data = JSON.parse(raw)
    } catch (err) {
        throw new Error(`BOOTSTRAP_APPS is not valid JSON: ${(err as Error).message}`)
    }
    const parsed = z.array(entrySchema, { error: 'BOOTSTRAP_APPS must be a JSON array' }).safeParse(data)
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(`BOOTSTRAP_APPS${formatPath(issue?.path ?? [])}: ${issue?.message ?? 'invalid'}`)
    }

    const seen = new Set<string>()
    return parsed.data.map((entry, i) => {
        if (seen.has(entry.id)) throw new Error(`BOOTSTRAP_APPS[${i}].id: ${entry.id} is listed twice`)
        seen.add(entry.id)
        if (options.production && PUBLIC_DEV_KEYS.includes(entry.key)) {
            throw new Error(`BOOTSTRAP_APPS[${i}].key: the public dev key must not be used in production`)
        }
        const urls = normalizeAppUrls(entry.baseUrl, entry.returnUrlPrefixes, options)
        if (!urls.ok) throw new Error(`BOOTSTRAP_APPS[${i}]: ${urls.error}`)
        return { id: entry.id, name: entry.name, baseUrl: urls.baseUrl, returnUrlPrefixes: urls.returnUrlPrefixes, keyHash: hashApiKey(entry.key) }
    })
}

/**
 * Create every listed app that doesn't exist yet. `ON CONFLICT DO NOTHING`
 * (on the id and on the key hash) makes it idempotent and safe when several
 * processes start at once. Returns what happened per id; never logs keys.
 */
export type BootstrapOutcome = 'created' | 'exists' | 'key-in-use'

export async function bootstrapApps(list: BootstrapApp[]): Promise<{ id: string, outcome: BootstrapOutcome }[]> {
    const out: { id: string, outcome: BootstrapOutcome }[] = []
    for (const app of list) {
        const [row] = await db.insert(apps)
            .values({
                id: app.id,
                name: app.name,
                baseUrl: app.baseUrl,
                returnUrlPrefixes: app.returnUrlPrefixes,
                apiKeyHash: app.keyHash,
                status: 'active',
                ownerUserId: null,
                verified: true,
                verifiedAt: new Date()
            })
            .onConflictDoNothing()
            .returning({ id: apps.id })
        if (row) {
            out.push({ id: app.id, outcome: 'created' })
            continue
        }
        // Nothing inserted: either the id exists (left alone) or another app holds this key.
        const [existing] = await db.select({ id: apps.id }).from(apps).where(eq(apps.id, app.id))
        out.push({ id: app.id, outcome: existing ? 'exists' : 'key-in-use' })
    }
    return out
}
