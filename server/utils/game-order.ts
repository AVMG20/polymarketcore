import { and, eq, inArray, or } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { apps, games, user } from '#server/database/schema'
import { SLUG_PATTERN } from '#server/utils/manifest'
import type { Viewer } from '#server/utils/hub'

/** Most slugs a saved game order holds. */
export const GAME_ORDER_MAX = 200

export const gameOrderSchema = z.object({
    order: z.array(z.string().regex(SLUG_PATTERN, 'order: each entry must be a game slug'), { error: 'order must be an array of game slugs' })
        .max(GAME_ORDER_MAX, `order may hold at most ${GAME_ORDER_MAX} games`)
})

/**
 * Save the viewer's own order of the games list. Duplicates keep their first
 * place; every slug must be a game the viewer can see (public, or a draft of
 * their own app; admins see all). An empty order clears it (back to the hub
 * order). One UPDATE, so parallel saves are last-write-wins and never mix.
 */
export async function saveGameOrder(viewer: Viewer, order: string[]): Promise<string[]> {
    const unique = [...new Set(order)]
    if (unique.length > 0) {
        const known = await db.select({ slug: games.slug })
            .from(games)
            .innerJoin(apps, eq(apps.id, games.appId))
            .where(and(
                inArray(games.slug, unique),
                viewer.admin ? undefined : or(eq(games.visibility, 'public'), eq(apps.ownerUserId, viewer.id))
            ))
        const seen = new Set(known.map(k => k.slug))
        const unknown = unique.find(slug => !seen.has(slug))
        if (unknown) throw createError({ statusCode: 400, statusMessage: `order: unknown game ${unknown}` })
    }
    const [row] = await db.update(user)
        .set({ gameOrder: unique.length ? unique : null })
        .where(eq(user.id, viewer.id))
        .returning({ gameOrder: user.gameOrder })
    if (!row) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    return row.gameOrder ?? []
}

/** The viewer's saved order, or null when they never set one. */
export async function getGameOrder(userId: string): Promise<string[] | null> {
    const [row] = await db.select({ gameOrder: user.gameOrder }).from(user).where(eq(user.id, userId))
    return row?.gameOrder ?? null
}
