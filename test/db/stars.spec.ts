import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { activityEvents, apps, playerStars } from '#server/database/schema'
import { countStars, setStars, verifyApp } from '#server/utils/stars'
import { bountyForLevels } from '#shared/economy'
import { burst, createAppWithGame, createConnectedPlayer, createPlayer, gemsOf, ledgerSum } from './helpers'

describe('star levels', () => {
    it('ignores a set whose seq is not above the stored one', async () => {
        const { appId, game } = await createAppWithGame(5)
        const player = await createConnectedPlayer(appId)
        expect(await setStars({ appId, playerId: player, game, stars: 3, seq: 20 })).toMatchObject({ applied: true, stars: 3 })
        expect(await setStars({ appId, playerId: player, game, stars: 1, seq: 10 })).toMatchObject({ applied: false, stars: 3, best: 3, bounty: 0 })
        expect(await setStars({ appId, playerId: player, game, stars: 1, seq: 20 })).toMatchObject({ applied: false, stars: 3 })
        expect(await setStars({ appId, playerId: player, game, stars: 1, seq: 21 })).toMatchObject({ applied: true, stars: 1, best: 3 })
    })

    it('parallel sets settle on the highest seq', async () => {
        const { appId, game } = await createAppWithGame(10)
        const player = await createConnectedPlayer(appId)
        // seq i + 1 sets levels[i]; seq 10 (level 6) must win whatever order they land in.
        const levels = [4, 9, 2, 7, 1, 8, 3, 10, 5, 6]
        await burst(10, i => setStars({ appId, playerId: player, game, stars: levels[i]!, seq: i + 1 }))
        const final = await setStars({ appId, playerId: player, game, stars: 0, seq: 1 })
        expect(final).toMatchObject({ applied: false, stars: 6 })
        // Best is the highest level among the sets that applied, so at least the final one.
        expect(final.best).toBeGreaterThanOrEqual(6)
        expect(await countStars(player)).toBe(6)
    })

    it('pays a bounty only for new personal bests: regaining a lost level pays nothing', async () => {
        const { appId, game } = await createAppWithGame(5)
        const player = await createConnectedPlayer(appId)
        expect(await setStars({ appId, playerId: player, game, stars: 3, seq: 1 })).toMatchObject({ bounty: bountyForLevels(0, 3) })
        expect(await setStars({ appId, playerId: player, game, stars: 0, seq: 2 })).toMatchObject({ bounty: 0, stars: 0, best: 3, total: 0 })
        expect(await setStars({ appId, playerId: player, game, stars: 3, seq: 3 })).toMatchObject({ bounty: 0, stars: 3 })
        expect(await setStars({ appId, playerId: player, game, stars: 4, seq: 4 })).toMatchObject({ bounty: bountyForLevels(3, 4) })
        expect(await gemsOf(player)).toBe(bountyForLevels(0, 4))
        expect(await ledgerSum(player)).toBe(bountyForLevels(0, 4))
    })

    it('a best reset below the paid level never pays those levels again', async () => {
        const { appId, game } = await createAppWithGame(10)
        const player = await createConnectedPlayer(appId)
        await setStars({ appId, playerId: player, game, stars: 5, seq: 1 })
        await setStars({ appId, playerId: player, game, stars: 2, seq: 2 })
        // What migration 0010 does for the casino: the old best follows the current level, paid_best stays.
        await db.update(playerStars).set({ bestStars: 2 }).where(and(eq(playerStars.userId, player), eq(playerStars.game, game)))
        expect(await setStars({ appId, playerId: player, game, stars: 5, seq: 3 })).toMatchObject({ bounty: 0, stars: 5, best: 5 })
        expect(await setStars({ appId, playerId: player, game, stars: 7, seq: 4 })).toMatchObject({ bounty: bountyForLevels(5, 7), best: 7 })
        expect(await gemsOf(player)).toBe(bountyForLevels(0, 7))
        expect(await ledgerSum(player)).toBe(bountyForLevels(0, 7))
    })

    it('parallel sets reaching a new best pay once', async () => {
        const { appId, game } = await createAppWithGame(5)
        const player = await createConnectedPlayer(appId)
        const { ok, failed } = await burst(10, i => setStars({ appId, playerId: player, game, stars: 5, seq: 100 + i }))
        expect(failed).toHaveLength(0)
        expect(ok.reduce((s, r) => s + r.bounty, 0)).toBe(bountyForLevels(0, 5))
        expect(await gemsOf(player)).toBe(bountyForLevels(0, 5))
    })

    it('rejects levels above the declared stars and players who never connected', async () => {
        const { appId, game } = await createAppWithGame(3)
        const connected = await createConnectedPlayer(appId)
        const stranger = await createPlayer()
        await expect(setStars({ appId, playerId: connected, game, stars: 4, seq: 1 })).rejects.toMatchObject({ statusCode: 400 })
        await expect(setStars({ appId, playerId: stranger, game, stars: 1, seq: 1 })).rejects.toMatchObject({ statusCode: 403 })
        const other = await createAppWithGame(3)
        await expect(setStars({ appId: other.appId, playerId: connected, game, stars: 1, seq: 1 })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('collapses rapid changes into one feed event', async () => {
        const { appId, game } = await createAppWithGame(5)
        const player = await createConnectedPlayer(appId)
        for (const [i, stars] of [2, 4, 3].entries()) await setStars({ appId, playerId: player, game, stars, seq: i + 1 })
        const events = await db.select().from(activityEvents).where(and(eq(activityEvents.userId, player), eq(activityEvents.type, 'star')))
        expect(events).toHaveLength(1)
        expect(events[0]!.payload).toMatchObject({ from: 0, stars: 3, direction: 'up' })
        await setStars({ appId, playerId: player, game, stars: 0, seq: 10 })
        const after = await db.select().from(activityEvents).where(and(eq(activityEvents.userId, player), eq(activityEvents.type, 'star')))
        expect(after).toHaveLength(0)
    })
})

describe('unverified apps and verification', () => {
    it('stores levels and bests but pays and counts nothing until verified', async () => {
        const { appId, game } = await createAppWithGame(5, { verified: false })
        const player = await createConnectedPlayer(appId)
        expect(await setStars({ appId, playerId: player, game, stars: 4, seq: 1 })).toMatchObject({ applied: true, stars: 4, best: 4, bounty: 0, total: 0 })
        expect(await gemsOf(player)).toBe(0)
        expect(await countStars(player)).toBe(0)
    })

    it('10 parallel verifications pay outstanding bests once', async () => {
        const { appId, game } = await createAppWithGame(5, { verified: false })
        const a = await createConnectedPlayer(appId)
        const b = await createConnectedPlayer(appId)
        await setStars({ appId, playerId: a, game, stars: 5, seq: 1 })
        await setStars({ appId, playerId: a, game, stars: 2, seq: 2 })
        await setStars({ appId, playerId: b, game, stars: 3, seq: 1 })

        const { ok, failed } = await burst(10, () => verifyApp(appId))
        expect(failed).toHaveLength(0)
        expect(ok.reduce((s, r) => s + r.gems, 0)).toBe(bountyForLevels(0, 5) + bountyForLevels(0, 3))
        expect(await gemsOf(a)).toBe(bountyForLevels(0, 5))
        expect(await gemsOf(b)).toBe(bountyForLevels(0, 3))
        expect(await ledgerSum(a)).toBe(bountyForLevels(0, 5))
        // Totals use current levels, not bests.
        expect(await countStars(a)).toBe(2)
        expect(await countStars(b)).toBe(3)
        expect((await verifyApp(appId)).gems).toBe(0)
    })

    it('drafts and disabled apps do not count or pay', async () => {
        const draft = await createAppWithGame(3, { visibility: 'draft' })
        const player = await createConnectedPlayer(draft.appId)
        expect(await setStars({ appId: draft.appId, playerId: player, game: draft.game, stars: 3, seq: 1 })).toMatchObject({ bounty: 0, total: 0 })

        const live = await createAppWithGame(3)
        await createConnectedPlayer(live.appId).then(() => null)
        const p2 = await createConnectedPlayer(live.appId)
        await setStars({ appId: live.appId, playerId: p2, game: live.game, stars: 2, seq: 1 })
        expect(await countStars(p2)).toBe(2)
        await db.update(apps).set({ status: 'disabled' }).where(eq(apps.id, live.appId))
        expect(await countStars(p2)).toBe(0)
    })
})
