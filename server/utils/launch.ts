import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { apps, user } from '#server/database/schema'
import { mintLaunchToken } from '#server/utils/launch-token'
import { starSummary } from '#server/utils/stars'
import { recordConnection } from '#server/utils/connections'

/**
 * Mint a launch token for `userId` and `appId`, filling the claims from the DB,
 * and record the connection (apps may only act on connected players).
 */
export async function launchTokenFor(userId: string, appId: string): Promise<string> {
    const [player] = await db.select({ id: user.id, name: user.name, image: user.image }).from(user).where(eq(user.id, userId))
    if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    const { title } = await starSummary(userId)
    await recordConnection(userId, appId)
    return mintLaunchToken({ id: player.id, name: player.name, image: player.image ?? null, title }, appId)
}

/** An active app by id, or 404. */
export async function getActiveApp(appId: string) {
    const [app] = await db.select().from(apps).where(eq(apps.id, appId))
    if (!app || app.status !== 'active') throw createError({ statusCode: 404, statusMessage: 'App not found' })
    return app
}
