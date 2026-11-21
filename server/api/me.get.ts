import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { effectiveRole, requireUser } from '#server/utils/auth'
import { countStars } from '#server/utils/stars'
import { grantWelcome } from '#server/utils/welcome'
import { claimPile, nextTitle, titleFor } from '#shared/economy'
import type { Me } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<Me> => {
    const session = await requireUser(event)
    let [row] = await db.select().from(user).where(eq(user.id, session.id))
    if (!row) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    // Retry a welcome grant that failed at sign-up (pays at most once).
    if (!row.welcomeGranted && await grantWelcome(row.id)) {
        [row] = await db.select().from(user).where(eq(user.id, session.id))
        if (!row) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const stars = await countStars(row.id)
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        image: row.image,
        emblem: row.emblem,
        prestige: row.prestige,
        gems: row.gems,
        stars,
        title: titleFor(stars),
        nextTitle: nextTitle(stars),
        claimable: claimPile(row.claimedThrough),
        role: effectiveRole(row),
        createdAt: row.createdAt.toISOString()
    }
})
