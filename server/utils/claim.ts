import { eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { activityEvents, user } from '#server/database/schema'
import { amsterdamDay, claimPile } from '#shared/economy'
import { creditGems } from '#server/utils/gems'

export interface ClaimResult {
    /** Balance after the claim. */
    gems: number
    /** Gems paid by this claim (0 when nothing was claimable). */
    claimed: number
    /** Days paid by this claim. */
    days: number
}

/**
 * Pay every claimable day. Lock-then-read: the user row is locked before
 * `claimed_through` is read, so a burst of parallel claims pays exactly once.
 */
export async function claimDaily(userId: string, now: Date = new Date()): Promise<ClaimResult> {
    const today = amsterdamDay(now)
    return db.transaction(async (tx) => {
        const rows = await tx.select({ gems: user.gems, claimedThrough: user.claimedThrough })
            .from(user)
            .where(eq(user.id, userId))
            .for('update')
        const row = rows[0]
        if (!row) throw createError({ statusCode: 404, statusMessage: 'Player not found' })

        const { days, gems: claimed } = claimPile(row.claimedThrough, today)
        if (days === 0) return { gems: row.gems, claimed: 0, days: 0 }

        await tx.update(user).set({ claimedThrough: today, updatedAt: sql`now()` }).where(eq(user.id, userId))
        const gems = await creditGems(userId, claimed, 'daily', { meta: { days, through: today } }, tx)
        await tx.insert(activityEvents).values({ userId, type: 'claim', payload: { days, gems: claimed } })
        return { gems, claimed, days }
    })
}
