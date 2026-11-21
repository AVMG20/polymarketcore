import { and, desc, eq, notInArray } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { emblemHistory, user } from '#server/database/schema'
import { EMBLEM_HISTORY_LIMIT, serializeEmblem } from '#shared/emblem'
import type { EmblemHistoryEntry, SaveEmblemResponse } from '#shared/types/api'

/**
 * Set the player's emblem, or clear it with `null` (the avatar falls back to
 * their image or initial). A save also lands in their history, which keeps
 * the newest EMBLEM_HISTORY_LIMIT; saving the newest entry again adds nothing.
 *
 * The user row is updated first, which locks it for the transaction: parallel
 * saves for one player run one after another, so the trim always sees every
 * insert before it.
 */
export async function saveEmblem(userId: string, input: unknown): Promise<SaveEmblemResponse> {
    if (input === undefined) throw createError({ statusCode: 400, statusMessage: 'emblem is required (an emblem, or null to clear it)' })
    const emblem = input === null ? null : serializeEmblem(input)
    if (input !== null && !emblem) throw createError({ statusCode: 400, statusMessage: 'emblem is not a valid emblem' })

    return db.transaction(async (tx) => {
        const [updated] = await tx.update(user).set({ emblem }).where(eq(user.id, userId)).returning({ id: user.id })
        if (!updated) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
        if (!emblem) return { emblem: null, historyId: null }

        const [latest] = await tx.select({ id: emblemHistory.id, emblem: emblemHistory.emblem })
            .from(emblemHistory)
            .where(eq(emblemHistory.userId, userId))
            .orderBy(desc(emblemHistory.createdAt))
            .limit(1)
        if (latest?.emblem === emblem) return { emblem, historyId: latest.id }

        const [inserted] = await tx.insert(emblemHistory).values({ userId, emblem }).returning({ id: emblemHistory.id })
        const keep = tx.select({ id: emblemHistory.id })
            .from(emblemHistory)
            .where(eq(emblemHistory.userId, userId))
            .orderBy(desc(emblemHistory.createdAt), desc(emblemHistory.id))
            .limit(EMBLEM_HISTORY_LIMIT)
        await tx.delete(emblemHistory).where(and(eq(emblemHistory.userId, userId), notInArray(emblemHistory.id, keep)))
        return { emblem, historyId: inserted!.id }
    })
}

/** The player's saved emblems, newest first. */
export async function listEmblemHistory(userId: string): Promise<EmblemHistoryEntry[]> {
    const rows = await db.select().from(emblemHistory)
        .where(eq(emblemHistory.userId, userId))
        .orderBy(desc(emblemHistory.createdAt), desc(emblemHistory.id))
        .limit(EMBLEM_HISTORY_LIMIT)
    return rows.map(r => ({ id: r.id, emblem: r.emblem, createdAt: r.createdAt.toISOString() }))
}
