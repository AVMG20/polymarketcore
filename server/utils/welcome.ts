import { and, eq } from 'drizzle-orm'
import { db } from '#server/database/index'
import { activityEvents, user } from '#server/database/schema'
import { STARTER_GEMS } from '#shared/economy'
import { creditGems } from '#server/utils/gems'

/**
 * Pay STARTER_GEMS once. Claim-then-reward: only the request that flips
 * `welcome_granted` pays. Called after sign-up and again lazily by `/api/me`,
 * so a failed first attempt is retried on the player's next page load.
 * Returns true when this call paid.
 */
export async function grantWelcome(userId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
        const [claimed] = await tx.update(user)
            .set({ welcomeGranted: true })
            .where(and(eq(user.id, userId), eq(user.welcomeGranted, false)))
            .returning({ id: user.id })
        if (!claimed) return false
        await creditGems(userId, STARTER_GEMS, 'welcome', {}, tx)
        await tx.insert(activityEvents).values({ userId, type: 'join', payload: {} })
        return true
    })
}
