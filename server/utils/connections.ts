import { and, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db, type DbExecutor } from '#server/database/index'
import { appConnections } from '#server/database/schema'

/** Record that the hub minted a launch token for this player and app. */
export async function recordConnection(userId: string, appId: string, ex: DbExecutor = db): Promise<void> {
    await ex.insert(appConnections)
        .values({ userId, appId })
        .onConflictDoUpdate({
            target: [appConnections.userId, appConnections.appId],
            set: { lastAt: sql`now()` }
        })
}

/** 403 unless the player has connected to the app (got a launch token for it). */
export async function assertConnected(appId: string, userId: string, ex: DbExecutor = db): Promise<void> {
    const [row] = await ex.select({ appId: appConnections.appId })
        .from(appConnections)
        .where(and(eq(appConnections.appId, appId), eq(appConnections.userId, userId)))
    if (!row) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Player has not connected to this app: they must open it through the hub (iframe launch or /connect) first'
        })
    }
}
