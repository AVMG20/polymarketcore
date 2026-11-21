import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { playSessions } from '#server/database/schema'
import { getGameDetail, listGames } from '#server/utils/hub'
import { dbPlayStore, forgetKnownSlugs, gameActivity, hotGames } from '#server/utils/play-stats'
import { addDays, amsterdamDay } from '#shared/economy'
import { createAppWithGame, createPlayer } from './helpers'

const HOUR = 3_600_000

async function play(game: string, userId: string, activeSeconds: number, hoursAgo = 1) {
    const startedAt = new Date(Date.now() - hoursAgo * HOUR)
    await db.insert(playSessions).values({ id: crypto.randomUUID(), game, userId, startedAt, endedAt: new Date(startedAt.getTime() + activeSeconds * 1000), activeSeconds })
}

beforeEach(() => forgetKnownSlugs())

describe('play stats', () => {
    it('upserts sessions without ever losing time, and drops unknown games', async () => {
        const { game } = await createAppWithGame(1)
        const userId = await createPlayer()
        const id = crypto.randomUUID()
        const startedAt = new Date()
        const row = (activeSeconds: number, ms: number) => ({ id, game, userId, startedAt, endedAt: new Date(startedAt.getTime() + ms), activeSeconds })
        await dbPlayStore.saveSessions([row(50, 60_000)])
        await dbPlayStore.saveSessions([row(20, 30_000)]) // an older write landing late
        await dbPlayStore.saveSessions([{ ...row(5, 1000), id: crypto.randomUUID(), game: 'no-such-game-xyz' }])
        const rows = await db.select().from(playSessions).where(eq(playSessions.game, game))
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ activeSeconds: 50 })
        expect(rows[0]!.endedAt.getTime() - startedAt.getTime()).toBe(60_000)
        expect(await db.select().from(playSessions).where(eq(playSessions.game, 'no-such-game-xyz'))).toEqual([])
    })

    it('sums a game\'s days, players and peak', async () => {
        const { game } = await createAppWithGame(1)
        const [a, b] = [await createPlayer(), await createPlayer()]
        await play(game, a, 600)
        await play(game, a, 300)
        await play(game, b, 0)
        await dbPlayStore.savePeaks([{ game, day: amsterdamDay(), peak: 2 }, { game, day: amsterdamDay(), peak: 1 }])
        const act = await gameActivity(game)
        expect(act.days).toHaveLength(30)
        expect(act.days[0]!.day).toBe(addDays(amsterdamDay(), -29))
        expect(act.totals).toEqual({ opens: 3, players: 2, seconds: 900, avgSessionSeconds: 300, peak: 2 })
        expect(act.days.reduce((s, d) => s + d.seconds, 0)).toBe(900)
        expect(act.days.at(-1)!.peak).toBe(2)
    })

    it('sorts by play time and marks the busiest listed games hot', async () => {
        const busy = await createAppWithGame(1)
        const quiet = await createAppWithGame(1)
        const unverified = await createAppWithGame(1, { verified: false })
        const players = await Promise.all([1, 2, 3].map(() => createPlayer()))
        for (const p of players) {
            await play(busy.game, p, 400_000)
            await play(unverified.game, p, 500_000)
        }
        await play(quiet.game, players[0]!, 4000, 30) // over a day ago: never hot
        const hot = await hotGames()
        expect(hot.has(busy.game)).toBe(true)
        expect(hot.has(quiet.game)).toBe(false)
        expect(hot.has(unverified.game)).toBe(false)

        const listed = await listGames(null)
        const byslug = new Map(listed.map(g => [g.slug, g]))
        expect(byslug.get(busy.game)).toMatchObject({ playSeconds: 1_200_000, hot: true })
        expect(byslug.get(quiet.game)).toMatchObject({ playSeconds: 4000, hot: false })

        const detail = await getGameDetail(quiet.game, null)
        expect(detail.game.hot).toBe(false)
        expect(detail.activity.totals.seconds).toBe(4000)
    })
})
