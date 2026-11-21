import { and, eq, isNull, notInArray, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { apps, games, gameStars } from '#server/database/schema'
import { checkImageUrl } from '#shared/app-urls'
import { MAX_STARS_PER_GAME } from '#shared/economy'

export const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/
export const STAR_KEY_PATTERN = /^[a-z0-9-]{1,40}$/
/** Ledger categories of the hub's own gem rows: a game slug is a category too, so these are taken. */
export const RESERVED_SLUGS: readonly string[] = ['admin', 'daily', 'welcome']

const optionalText = (field: string, max: number) => z.string().max(max, `${field} must be at most ${max} characters`).nullish().transform(v => v ?? null)

const imageUrl = (field: string) => z.string().nullish().superRefine((v, ctx) => {
    if (v == null || (field === 'icon' && /^lucide:[a-z0-9-]{1,60}$/.test(v))) return
    const check = checkImageUrl(v, field)
    if (!check.ok) ctx.addIssue({ code: 'custom', message: field === 'icon' ? `${check.error} (or a lucide icon name like lucide:dices)` : check.error })
}).transform(v => v ?? null)

export const manifestStarSchema = z.object({
    key: z.string({ error: 'key is required' }).regex(STAR_KEY_PATTERN, 'key must match [a-z0-9-]{1,40}'),
    name: z.string({ error: 'name is required' }).trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters'),
    description: optionalText('description', 300)
})

export const manifestGameSchema = z.object({
    slug: z.string({ error: 'slug is required' })
        .regex(SLUG_PATTERN, 'slug must match [a-z0-9-]{2,40}')
        .refine(slug => !RESERVED_SLUGS.includes(slug), `slug is reserved by the hub (${RESERVED_SLUGS.join(', ')}): choose another`),
    name: z.string({ error: 'name is required' }).trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters'),
    tagline: optionalText('tagline', 120),
    description: optionalText('description', 10_000),
    playPath: z.string()
        .max(500, 'playPath must be at most 500 characters')
        .startsWith('/', 'playPath must start with / (it is appended to the app baseUrl)')
        // The hub appends #pnx=<token>: a fragment of its own would hide the token.
        .regex(/^[^#\s\\]*$/, 'playPath must not contain #, spaces or backslashes')
        .default('/'),
    icon: imageUrl('icon'),
    cover: imageUrl('cover'),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a hex colour like #e0a100').nullish().transform(v => v ?? null),
    // Omitted: 'draft' for unverified apps, 'public' for verified ones.
    visibility: z.enum(['draft', 'public'], { error: "visibility must be 'draft' or 'public'" }).optional(),
    stars: z.array(manifestStarSchema).max(MAX_STARS_PER_GAME, `a game declares at most ${MAX_STARS_PER_GAME} stars (levels 1-10)`).default([])
}).superRefine((game, ctx) => {
    const keys = new Set<string>()
    for (const star of game.stars) {
        if (keys.has(star.key)) ctx.addIssue({ code: 'custom', message: `duplicate star key ${star.key}: every star key must be unique within the game`, path: ['stars'] })
        keys.add(star.key)
    }
})

export const manifestSchema = z.object({
    games: z.array(manifestGameSchema, { error: 'games must be an array' }).max(100, 'a manifest lists at most 100 games')
}).superRefine((m, ctx) => {
    const slugs = new Set<string>()
    for (const game of m.games) {
        if (slugs.has(game.slug)) ctx.addIssue({ code: 'custom', message: `duplicate slug ${game.slug}: list each game once`, path: ['games'] })
        slugs.add(game.slug)
    }
})

export type Manifest = z.infer<typeof manifestSchema>

/**
 * Apply an app's manifest (contract §2 `PUT /manifest`): upsert its games and
 * stars by slug and key, and retire whatever the manifest no longer lists.
 * The upsert only updates a slug this app owns, so a slug taken by another
 * app (even one claimed a moment ago by a parallel call) returns no row: 403.
 */
export async function applyManifest(appId: string, manifest: Manifest): Promise<{ games: { slug: string, stars: number, visibility: 'draft' | 'public' }[] }> {
    return db.transaction(async (tx) => {
        // One manifest at a time per app, so two deploys can't interleave retirements.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`pnx_manifest:${appId}`}))`)
        const [app] = await tx.select({ verified: apps.verified }).from(apps).where(eq(apps.id, appId))
        const defaultVisibility = app?.verified ? 'public' as const : 'draft' as const

        const result: { slug: string, stars: number, visibility: 'draft' | 'public' }[] = []
        for (const [index, game] of manifest.games.entries()) {
            const values = {
                name: game.name,
                tagline: game.tagline,
                description: game.description,
                playPath: game.playPath,
                icon: game.icon,
                cover: game.cover,
                accent: game.accent,
                position: index,
                visibility: game.visibility ?? defaultVisibility,
                retiredAt: null
            }
            const [row] = await tx.insert(games)
                .values({ slug: game.slug, appId, ...values })
                .onConflictDoUpdate({
                    target: games.slug,
                    set: { ...values, updatedAt: sql`now()` },
                    setWhere: eq(games.appId, appId)
                })
                .returning({ slug: games.slug })
            if (!row) throw createError({ statusCode: 403, statusMessage: `games[${index}].slug: ${game.slug} belongs to another app, choose another slug` })

            for (const [starIndex, star] of game.stars.entries()) {
                const starValues = { position: starIndex + 1, name: star.name, description: star.description, retiredAt: null }
                await tx.insert(gameStars)
                    .values({ game: game.slug, key: star.key, ...starValues })
                    .onConflictDoUpdate({ target: [gameStars.game, gameStars.key], set: starValues })
            }

            const keys = game.stars.map(s => s.key)
            await tx.update(gameStars)
                .set({ retiredAt: sql`now()` })
                .where(and(
                    eq(gameStars.game, game.slug),
                    isNull(gameStars.retiredAt),
                    keys.length ? notInArray(gameStars.key, keys) : undefined
                ))
            result.push({ slug: game.slug, stars: game.stars.length, visibility: game.visibility ?? defaultVisibility })
        }

        const slugs = manifest.games.map(g => g.slug)
        await tx.update(games)
            .set({ retiredAt: sql`now()`, updatedAt: sql`now()` })
            .where(and(
                eq(games.appId, appId),
                isNull(games.retiredAt),
                slugs.length ? notInArray(games.slug, slugs) : undefined
            ))
        return { games: result }
    })
}
