import { and, eq, gt, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { gemTransactions } from '#server/database/schema'
import { getGemStats, listGemHistory } from '#server/utils/gem-stats'
import { creditGems, debitGems } from '#server/utils/gems'
import { addDays, amsterdamDay } from '#shared/economy'
import { createAppWithGame, createPlayer, gemsOf } from './helpers'

const today = amsterdamDay()

/** Move the row just written back to `time` on Amsterdam day `day` (rows are written oldest first). */
async function backdate(userId: string, day: string, time = '12:00') {
    await db.update(gemTransactions)
        .set({ createdAt: sql`(${`${day} ${time}`})::timestamp at time zone 'Europe/Amsterdam'` })
        .where(and(eq(gemTransactions.userId, userId), gt(gemTransactions.createdAt, sql`now() - interval '10 minutes'`)))
}

/** A player with a known history: welcome 40 days ago, then claims, a bounty, spends and a refund. */
async function playerWithHistory() {
    const id = await createPlayer()
    const { appId, game } = await createAppWithGame(1)
    const moves: [day: number, run: () => Promise<number>, time?: string][] = [
        [-40, () => creditGems(id, 50, 'welcome')],
        [-10, () => creditGems(id, 10, 'daily')],
        [-3, () => creditGems(id, 20, 'daily'), '10:00'],
        [-3, () => creditGems(id, 15, game, { appId }), '11:00'],
        [-2, () => debitGems(id, 30, game, { appId }), '10:00'],
        [-2, () => creditGems(id, 5, game, { appId, refund: true }), '11:00'],
        [-1, () => debitGems(id, 8, game, { appId })],
        // 00:30 in Amsterdam is still yesterday in UTC: it belongs to today.
        [0, () => creditGems(id, 10, 'daily'), '00:30']
    ]
    for (const [day, run, time] of moves) {
        await run()
        await backdate(id, addDays(today, day), time)
    }
    return { id, appId, game }
}

describe('gem stats', () => {
    it('buckets a week by Amsterdam day with the closing balance', async () => {
        const { id, game } = await playerWithHistory()
        const stats = await getGemStats(id, '7d', today)
        expect(stats).toMatchObject({ range: '7d', from: addDays(today, -6), to: today, bucket: 'day', balance: 72, startBalance: 60 })
        expect(stats.totals).toEqual({ in: 50, out: 38, net: 12, moves: 6 })
        expect(stats.buckets).toHaveLength(7)
        expect(stats.buckets.map(b => b.day)).toEqual(Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)))
        const byDay = Object.fromEntries(stats.buckets.map(b => [b.day, b]))
        expect(byDay[addDays(today, -3)]).toMatchObject({ in: 35, out: 0, net: 35, moves: 2, balance: 95 })
        expect(byDay[addDays(today, -2)]).toMatchObject({ in: 5, out: 30, net: -25, moves: 2, balance: 70 })
        expect(byDay[addDays(today, -1)]).toMatchObject({ in: 0, out: 8, balance: 62 })
        expect(byDay[today]).toMatchObject({ in: 10, out: 0, balance: 72 })
        expect(byDay[addDays(today, -6)]).toMatchObject({ in: 0, out: 0, moves: 0, balance: 60 })
        expect(stats.buckets.at(-1)!.balance).toBe(await gemsOf(id))

        expect(stats.sources).toEqual([
            { kind: 'spend', direction: 'out', game, gameName: 'Test game', amount: 38, moves: 2 },
            { kind: 'daily', direction: 'in', game: null, gameName: null, amount: 30, moves: 2 },
            { kind: 'bounty', direction: 'in', game: null, gameName: null, amount: 15, moves: 1 },
            { kind: 'refund', direction: 'in', game: null, gameName: null, amount: 5, moves: 1 }
        ])
    })

    it('all time starts at the first move and wider ranges include older rows', async () => {
        const { id } = await playerWithHistory()
        const all = await getGemStats(id, 'all', today)
        expect(all).toMatchObject({ from: addDays(today, -40), bucket: 'day', startBalance: 0 })
        expect(all.buckets).toHaveLength(41)
        expect(all.totals).toEqual({ in: 110, out: 38, net: 72, moves: 8 })
        const month = await getGemStats(id, '30d', today)
        expect(month).toMatchObject({ startBalance: 50, totals: { in: 60, out: 38, net: 22, moves: 7 } })
        expect(month.buckets).toHaveLength(30)
    })

    it('buckets long all-time ranges by week and handles an empty ledger', async () => {
        const id = await createPlayer()
        await creditGems(id, 7, 'admin')
        await backdate(id, addDays(today, -200))
        const all = await getGemStats(id, 'all', today)
        expect(all.bucket).toBe('week')
        expect(all.buckets.every(b => new Date(`${b.day}T12:00:00Z`).getUTCDay() === 1)).toBe(true)
        expect(all.buckets.reduce((s, b) => s + b.in, 0)).toBe(7)
        expect(all.buckets.at(-1)!.balance).toBe(7)

        const empty = await getGemStats(await createPlayer(), 'all', today)
        expect(empty).toMatchObject({ from: today, balance: 0, totals: { in: 0, out: 0, net: 0, moves: 0 }, sources: [] })
        expect(empty.buckets).toEqual([{ day: today, in: 0, out: 0, net: 0, moves: 0, balance: 0 }])
    })

    it('refuses an unknown player', async () => {
        await expect(getGemStats('nobody', '7d')).rejects.toMatchObject({ statusCode: 404 })
    })
})

describe('gem history filters', () => {
    it('filters by direction, kind, game and range', async () => {
        const { id, game } = await playerWithHistory()
        const amounts = async (f: Parameters<typeof listGemHistory>[1]) => (await listGemHistory(id, { today, ...f })).items.map(i => i.amount)
        expect(await amounts({})).toEqual([10, -8, 5, -30, 15, 20, 10, 50])
        expect(await amounts({ dir: 'out' })).toEqual([-8, -30])
        expect(await amounts({ dir: 'in', range: '7d' })).toEqual([10, 5, 15, 20])
        expect(await amounts({ kind: 'daily' })).toEqual([10, 20, 10])
        expect(await amounts({ kind: 'spend', game })).toEqual([-8, -30])
        expect(await amounts({ game, dir: 'in' })).toEqual([5, 15])
        const res = await listGemHistory(id, { kind: 'spend' })
        expect(res.total).toBe(2)
        expect(res.items[0]).toMatchObject({ kind: 'spend', game, gameName: 'Test game' })
    })

    it('loads more after a row without repeats', async () => {
        const { id } = await playerWithHistory()
        const first = await listGemHistory(id, { pageSize: 3 })
        const next = await listGemHistory(id, { pageSize: 3, before: first.items.at(-1)!.id })
        const last = await listGemHistory(id, { pageSize: 3, before: next.items.at(-1)!.id })
        const ids = [...first.items, ...next.items, ...last.items].map(i => i.id)
        expect(ids).toHaveLength(8)
        expect(new Set(ids).size).toBe(8)
        expect(first.total).toBe(8)
        expect((await listGemHistory(id, { before: 'not-a-row' })).items).toEqual([])
    })
})
