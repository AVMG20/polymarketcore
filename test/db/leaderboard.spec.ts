import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { getLeaderboard, listPlayersForAdmin } from '#server/utils/hub'
import { applyManifest } from '#server/utils/manifest'
import { setStars } from '#server/utils/stars'
import { createAppWithGame, createConnectedPlayer, createPlayer } from './helpers'

describe('leaderboard', () => {
    it('lists every player, most stars first', async () => {
        const { appId, game } = await createAppWithGame(3)
        const ranked = await createConnectedPlayer(appId)
        const idle = await createPlayer()
        await setStars({ appId, playerId: ranked, game, stars: 2, seq: 1 })

        const board = await getLeaderboard(idle, 200, 0)
        const ids = board.entries.map(e => e.id)
        expect(board.me).toMatchObject({ id: idle, stars: 0 })
        expect(board.me!.rank).toBeGreaterThan(board.entries.find(e => e.id === ranked)?.rank ?? 0)
        if (ids.includes(idle)) expect(ids.indexOf(ranked)).toBeLessThan(ids.indexOf(idle))
        const stars = board.entries.map(e => e.stars)
        expect(stars).toEqual([...stars].sort((a, b) => b - a))
    })

    it('includes only public, verified, active, non-retired games a player made', async () => {
        const maker = await createPlayer()
        const pub = await createAppWithGame(2, { ownerUserId: maker, verified: true, visibility: 'public' })
        await createAppWithGame(2, { ownerUserId: maker, verified: true, visibility: 'draft' })
        await createAppWithGame(2, { ownerUserId: maker, verified: false, visibility: 'public' })
        const disabled = await createAppWithGame(2, { ownerUserId: maker, verified: true, visibility: 'public' })
        await db.update(apps).set({ status: 'disabled' }).where(eq(apps.id, disabled.appId))
        const retired = await createAppWithGame(2, { ownerUserId: maker, verified: true, visibility: 'public' })
        await applyManifest(retired.appId, { games: [] })

        const board = await getLeaderboard(maker, 1, 0)
        expect(board.me?.madeGames.map(g => g.slug)).toEqual([pub.game])
    })

    it('admin player list searches by email', async () => {
        const id = await createPlayer(5)
        const found = await listPlayersForAdmin({ q: id, limit: 10, offset: 0 })
        expect(found.players).toHaveLength(1)
        expect(found.players[0]).toMatchObject({ id, gems: 5, stars: 0 })
        expect((await listPlayersForAdmin({ q: '%', limit: 10, offset: 0 })).total).toBe(0)
    })
})
