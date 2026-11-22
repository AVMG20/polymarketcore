import { and, asc, count, eq, gte, inArray, ne } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { apps, games, gameStars, playerStars, user } from '#server/database/schema'
import { normalizeAppUrls, type UrlRules } from '#shared/app-urls'
import { MAX_DEVELOPER_APPS, starBounty } from '#shared/economy'
import type { AppInfo, DeveloperGame } from '#shared/types/api'
import { generateApiKey, hashApiKey, type AppRow } from '#server/utils/apps'
import { coreUrl } from '#server/utils/launch-token'
import { repoUrlField, SLUG_PATTERN } from '#server/utils/manifest'
import { gameCounts } from '#server/utils/stars'

/**
 * The app registry, shared by the admin pages and the developer API. Every
 * URL goes through shared/app-urls.ts; errors say which field to fix.
 */

export function appUrlRules(): UrlRules {
    return { production: process.env.NODE_ENV === 'production' }
}

const urlList = z.array(z.string()).min(1, 'returnUrlPrefixes must list at least one URL (or be omitted)').max(20, 'returnUrlPrefixes may list at most 20 URLs')

export const registerAppSchema = z.object({
    id: z.string({ error: 'id is required' }).regex(SLUG_PATTERN, 'id must match [a-z0-9-]{2,40} (lowercase letters, digits and dashes)'),
    name: z.string({ error: 'name is required' }).trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters'),
    baseUrl: z.string({ error: 'baseUrl is required' }),
    returnUrlPrefixes: urlList.optional(),
    repoUrl: repoUrlField.optional()
})

export const updateAppSchema = z.object({
    name: z.string().trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters').optional(),
    baseUrl: z.string().optional(),
    returnUrlPrefixes: urlList.optional(),
    repoUrl: repoUrlField.optional()
})

export const adminUpdateAppSchema = updateAppSchema.extend({
    status: z.enum(['active', 'disabled']).optional()
})

function urlsOrThrow(baseUrl: unknown, prefixes: string[] | undefined) {
    const result = normalizeAppUrls(baseUrl, prefixes, appUrlRules())
    if (!result.ok) throw createError({ statusCode: 400, statusMessage: result.error })
    return result
}

/** Apps as AppInfo, with game counts and owners, in two queries. */
export async function listApps(ownerUserId?: string): Promise<AppInfo[]> {
    const rows = await db.select({ app: apps, ownerName: user.name, ownerImage: user.image })
        .from(apps)
        .leftJoin(user, eq(user.id, apps.ownerUserId))
        .where(ownerUserId ? eq(apps.ownerUserId, ownerUserId) : undefined)
        .orderBy(asc(apps.createdAt))
    if (rows.length === 0) return []
    const counts = await db.select({ appId: games.appId, n: count() })
        .from(games)
        .where(inArray(games.appId, rows.map(r => r.app.id)))
        .groupBy(games.appId)
    const byApp = new Map(counts.map(c => [c.appId, c.n]))
    return rows.map(r => toAppInfo(r.app, byApp.get(r.app.id) ?? 0, r.ownerName ? { id: r.app.ownerUserId!, name: r.ownerName, image: r.ownerImage } : null))
}

export async function getAppInfo(appId: string): Promise<AppInfo> {
    const [row] = await db.select({ app: apps, ownerName: user.name, ownerImage: user.image })
        .from(apps).leftJoin(user, eq(user.id, apps.ownerUserId)).where(eq(apps.id, appId))
    if (!row) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found` })
    const [c] = await db.select({ n: count() }).from(games).where(eq(games.appId, appId))
    return toAppInfo(row.app, c?.n ?? 0, row.ownerName ? { id: row.app.ownerUserId!, name: row.ownerName, image: row.ownerImage } : null)
}

export function toAppInfo(app: AppRow, gameCount: number, owner: AppInfo['owner']): AppInfo {
    return {
        id: app.id,
        name: app.name,
        baseUrl: app.baseUrl,
        returnUrlPrefixes: app.returnUrlPrefixes,
        repoUrl: app.repoUrl,
        status: app.status,
        disabledByAdmin: app.disabledByAdmin,
        verified: app.verified,
        verifiedAt: app.verifiedAt ? app.verifiedAt.toISOString() : null,
        owner,
        createdAt: app.createdAt.toISOString(),
        games: gameCount,
        lastSeenAt: app.lastSeenAt ? app.lastSeenAt.toISOString() : null
    }
}

/** 404 unless `userId` owns the app (404, not 403, so ids of others' apps don't leak). */
export async function getOwnedApp(userId: string, appId: string): Promise<AppRow> {
    const [app] = await db.select().from(apps).where(and(eq(apps.id, appId), eq(apps.ownerUserId, userId)))
    if (!app) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found among your apps (GET /api/v1/developer/apps lists them)` })
    return app
}

export interface CreateAppInput {
    id: string
    name: string
    baseUrl: string
    returnUrlPrefixes?: string[]
    repoUrl?: string | null
    ownerUserId: string
    /** Enforce MAX_DEVELOPER_APPS active apps for the owner (developer API). */
    limitOwner: boolean
}

/**
 * Register an app; returns the plaintext key once. For the developer API the
 * owner row is locked before counting, so parallel creates can't pass the limit.
 */
export async function registerApp(input: CreateAppInput): Promise<{ app: AppRow, apiKey: string }> {
    const urls = urlsOrThrow(input.baseUrl, input.returnUrlPrefixes)
    const apiKey = generateApiKey()
    const app = await db.transaction(async (tx) => {
        if (input.limitOwner) {
            await tx.select({ id: user.id }).from(user).where(eq(user.id, input.ownerUserId)).for('update')
            const [owned] = await tx.select({ n: count() }).from(apps)
                .where(and(eq(apps.ownerUserId, input.ownerUserId), ne(apps.status, 'disabled')))
            if ((owned?.n ?? 0) >= MAX_DEVELOPER_APPS) {
                throw createError({ statusCode: 400, statusMessage: `You already have ${MAX_DEVELOPER_APPS} active apps, the maximum: DELETE one you no longer need` })
            }
        }
        const [created] = await tx.insert(apps)
            .values({
                id: input.id,
                name: input.name,
                baseUrl: urls.baseUrl,
                returnUrlPrefixes: urls.returnUrlPrefixes,
                repoUrl: input.repoUrl ?? null,
                apiKeyHash: hashApiKey(apiKey),
                ownerUserId: input.ownerUserId
            })
            .onConflictDoNothing({ target: apps.id })
            .returning()
        if (!created) throw createError({ statusCode: 409, statusMessage: `App id ${input.id} is taken: choose another id` })
        return created
    })
    return { app, apiKey }
}

/**
 * Update name, URLs and the repo URL (null clears it). A new baseUrl re-checks the stored prefixes against
 * its origin unless new prefixes come with it.
 */
export async function updateApp(app: AppRow, changes: { name?: string, baseUrl?: string, returnUrlPrefixes?: string[], repoUrl?: string | null, status?: 'active' | 'disabled', disabledByAdmin?: boolean }): Promise<AppRow> {
    const set: Partial<typeof apps.$inferInsert> = {}
    if (changes.name !== undefined) set.name = changes.name
    if (changes.repoUrl !== undefined) set.repoUrl = changes.repoUrl
    if (changes.status !== undefined) set.status = changes.status
    if (changes.disabledByAdmin !== undefined) set.disabledByAdmin = changes.disabledByAdmin
    if (changes.baseUrl !== undefined || changes.returnUrlPrefixes !== undefined) {
        const urls = urlsOrThrow(changes.baseUrl ?? app.baseUrl, changes.returnUrlPrefixes ?? app.returnUrlPrefixes)
        set.baseUrl = urls.baseUrl
        set.returnUrlPrefixes = urls.returnUrlPrefixes
    }
    if (Object.keys(set).length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Nothing to update: send at least one of name, baseUrl, returnUrlPrefixes, repoUrl' })
    }
    const [updated] = await db.update(apps).set(set).where(eq(apps.id, app.id)).returning()
    return updated!
}

/**
 * The owner switches their own app on or off. An app an admin disabled stays
 * off, and switching on counts toward MAX_DEVELOPER_APPS (owner row locked, so
 * parallel enables can't pass the limit).
 */
export async function setOwnAppStatus(userId: string, appId: string, status: 'active' | 'disabled'): Promise<AppRow> {
    return db.transaction(async (tx) => {
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update')
        const [app] = await tx.select().from(apps).where(and(eq(apps.id, appId), eq(apps.ownerUserId, userId)))
        if (!app) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found among your apps` })
        if (app.status === status) return app
        if (status === 'active') {
            if (app.disabledByAdmin) throw createError({ statusCode: 403, statusMessage: 'An admin disabled this app: ask an admin to enable it' })
            const [owned] = await tx.select({ n: count() }).from(apps)
                .where(and(eq(apps.ownerUserId, userId), ne(apps.status, 'disabled')))
            if ((owned?.n ?? 0) >= MAX_DEVELOPER_APPS) {
                throw createError({ statusCode: 400, statusMessage: `You already have ${MAX_DEVELOPER_APPS} active apps, the maximum: disable one first` })
            }
        }
        const [updated] = await tx.update(apps).set({ status }).where(eq(apps.id, appId)).returning()
        return updated!
    })
}

/** The owner sets (or, with null, clears) their app's repo URL. */
export async function setOwnAppRepo(userId: string, appId: string, repoUrl: string | null): Promise<void> {
    const [updated] = await db.update(apps).set({ repoUrl })
        .where(and(eq(apps.id, appId), eq(apps.ownerUserId, userId)))
        .returning({ id: apps.id })
    if (!updated) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found among your apps` })
}

/** Replace the app's API key; the old one stops working at once. */
export async function rotateAppKey(appId: string): Promise<{ app: AppRow, apiKey: string }> {
    const apiKey = generateApiKey()
    const [app] = await db.update(apps).set({ apiKeyHash: hashApiKey(apiKey) }).where(eq(apps.id, appId)).returning()
    if (!app) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found` })
    return { app, apiKey }
}

/** The app's games and stars as the hub sees them (developer API). */
export async function appGames(appId: string): Promise<DeveloperGame[]> {
    const rows = await db.select().from(games).where(eq(games.appId, appId)).orderBy(asc(games.position), asc(games.slug))
    if (rows.length === 0) return []
    const slugs = rows.map(r => r.slug)
    const [stars, levels, [app]] = await Promise.all([
        db.select().from(gameStars).where(inArray(gameStars.game, slugs)).orderBy(asc(gameStars.position)),
        db.select({ game: playerStars.game, stars: playerStars.stars, n: count() })
            .from(playerStars)
            .where(and(inArray(playerStars.game, slugs), gte(playerStars.stars, 1)))
            .groupBy(playerStars.game, playerStars.stars),
        db.select().from(apps).where(eq(apps.id, appId))
    ])
    const holders = (game: string, level: number) => levels
        .filter(l => l.game === game && l.stars >= level)
        .reduce((sum, l) => sum + l.n, 0)
    return rows.map(g => ({
        slug: g.slug,
        name: g.name,
        tagline: g.tagline,
        playPath: g.playPath,
        retired: !!g.retiredAt,
        playUrl: `${coreUrl()}/play/${g.slug}`,
        visibility: g.visibility,
        counts: !!app && gameCounts(g, app),
        stars: stars.filter(s => s.game === g.slug).map(s => ({
            key: s.key,
            position: s.position,
            name: s.name,
            description: s.description,
            bounty: starBounty(s.position),
            retired: !!s.retiredAt,
            holders: holders(s.game, s.position)
        }))
    }))
}
