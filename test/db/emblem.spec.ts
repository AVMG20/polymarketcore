import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { emblemHistory, user } from '#server/database/schema'
import { listEmblemHistory, saveEmblem } from '#server/utils/emblem'
import { getFeed, getPlayerProfile } from '#server/utils/hub'
import { EMBLEM_HISTORY_LIMIT, emptyEmblem, type EmblemData } from '#shared/emblem'
import { burst, createPlayer } from './helpers'

/** A distinct valid emblem per `n`. */
const drawing = (n: number): EmblemData => ({
    ...emptyEmblem(),
    elements: [{ kind: 'shape', shape: 'circle', color: '#ffffff', x: n % 100, y: 50, size: 10, rotation: 0 }]
})

async function savedEmblem(userId: string) {
    const [row] = await db.select({ emblem: user.emblem }).from(user).where(eq(user.id, userId))
    return row!.emblem
}

async function historyCount(userId: string) {
    return (await db.select().from(emblemHistory).where(eq(emblemHistory.userId, userId))).length
}

describe('emblems', () => {
    it('saves the emblem and a history row', async () => {
        const id = await createPlayer()
        const res = await saveEmblem(id, drawing(1))
        expect(res.emblem).toBe(JSON.stringify(drawing(1)))
        expect(await savedEmblem(id)).toBe(res.emblem)
        const history = await listEmblemHistory(id)
        expect(history.map(h => h.id)).toEqual([res.historyId])
        expect(history[0]!.emblem).toBe(res.emblem)
    })

    it('accepts a serialized emblem and does not repeat the newest save', async () => {
        const id = await createPlayer()
        const first = await saveEmblem(id, JSON.stringify(drawing(2)))
        const again = await saveEmblem(id, drawing(2))
        expect(again.historyId).toBe(first.historyId)
        expect(await historyCount(id)).toBe(1)
    })

    it('refuses invalid emblems and a missing field without touching anything', async () => {
        const id = await createPlayer()
        await saveEmblem(id, drawing(3))
        await expect(saveEmblem(id, { version: 1, background: 'red', elements: [] })).rejects.toMatchObject({ statusCode: 400 })
        await expect(saveEmblem(id, 'nope')).rejects.toMatchObject({ statusCode: 400 })
        await expect(saveEmblem(id, undefined)).rejects.toMatchObject({ statusCode: 400 })
        expect(await savedEmblem(id)).toBe(JSON.stringify(drawing(3)))
        expect(await historyCount(id)).toBe(1)
    })

    it('keeps the newest EMBLEM_HISTORY_LIMIT saves', async () => {
        const id = await createPlayer()
        for (let i = 0; i < EMBLEM_HISTORY_LIMIT + 3; i++) await saveEmblem(id, drawing(i))
        const history = await listEmblemHistory(id)
        expect(history).toHaveLength(EMBLEM_HISTORY_LIMIT)
        expect(await historyCount(id)).toBe(EMBLEM_HISTORY_LIMIT)
        expect(history[0]!.emblem).toBe(JSON.stringify(drawing(EMBLEM_HISTORY_LIMIT + 2)))
        expect(history.at(-1)!.emblem).toBe(JSON.stringify(drawing(3)))
    })

    it('parallel saves never leave more than the limit', async () => {
        const id = await createPlayer()
        const { ok, failed } = await burst(EMBLEM_HISTORY_LIMIT + 10, i => saveEmblem(id, drawing(i)))
        expect(failed).toHaveLength(0)
        expect(ok).toHaveLength(EMBLEM_HISTORY_LIMIT + 10)
        expect(await historyCount(id)).toBe(EMBLEM_HISTORY_LIMIT)
    })

    it('clears the emblem but keeps the history', async () => {
        const id = await createPlayer()
        await saveEmblem(id, drawing(4))
        expect(await saveEmblem(id, null)).toEqual({ emblem: null, historyId: null })
        expect(await savedEmblem(id)).toBeNull()
        expect(await historyCount(id)).toBe(1)
    })

    it('history is per player', async () => {
        const a = await createPlayer()
        const b = await createPlayer()
        await saveEmblem(a, drawing(5))
        expect(await listEmblemHistory(b)).toEqual([])
    })

    it('read models carry the emblem and prestige', async () => {
        const id = await createPlayer()
        await db.update(user).set({ prestige: 2 }).where(eq(user.id, id))
        const { emblem } = await saveEmblem(id, drawing(6))
        const profile = await getPlayerProfile(id)
        expect(profile.player).toMatchObject({ emblem, prestige: 2 })
        await expect(db.update(user).set({ prestige: 5 }).where(eq(user.id, id))).rejects.toThrow()
        const feed = await getFeed({ limit: 200 })
        for (const event of feed) {
            expect(event.player).toHaveProperty('emblem')
            expect(typeof event.player.prestige).toBe('number')
        }
    })
})
