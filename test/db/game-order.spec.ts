import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { GAME_ORDER_MAX, gameOrderSchema, getGameOrder, saveGameOrder } from '#server/utils/game-order'
import { listGames } from '#server/utils/hub'
import { setStars } from '#server/utils/stars'
import { burst, createAppWithGame, createConnectedPlayer, createPlayer } from './helpers'

const viewer = (id: string, admin = false) => ({ id, admin })

describe('game order', () => {
    it('saves the order, deduped, and clears it with an empty list', async () => {
        const id = await createPlayer()
        const a = await createAppWithGame(1)
        const b = await createAppWithGame(1)
        expect(await getGameOrder(id)).toBeNull()
        expect(await saveGameOrder(viewer(id), [b.game, a.game, b.game])).toEqual([b.game, a.game])
        expect(await getGameOrder(id)).toEqual([b.game, a.game])
        expect(await saveGameOrder(viewer(id), [])).toEqual([])
        expect(await getGameOrder(id)).toBeNull()
    })

    it('refuses unknown games and drafts the viewer cannot see', async () => {
        const id = await createPlayer()
        const owner = await createPlayer()
        const pub = await createAppWithGame(1)
        const draft = await createAppWithGame(1, { visibility: 'draft', ownerUserId: owner })
        await saveGameOrder(viewer(id), [pub.game])

        await expect(saveGameOrder(viewer(id), [pub.game, 'no-such-game'])).rejects.toMatchObject({ statusCode: 400, statusMessage: 'order: unknown game no-such-game' })
        await expect(saveGameOrder(viewer(id), [draft.game])).rejects.toMatchObject({ statusCode: 400 })
        expect(await getGameOrder(id)).toEqual([pub.game])

        expect(await saveGameOrder(viewer(owner), [draft.game, pub.game])).toEqual([draft.game, pub.game])
        expect(await saveGameOrder(viewer(id, true), [draft.game])).toEqual([draft.game])
    })

    it('validates the body shape and the cap', () => {
        expect(gameOrderSchema.safeParse({ order: ['ok-slug'] }).success).toBe(true)
        expect(gameOrderSchema.safeParse({ order: 'ok-slug' }).success).toBe(false)
        expect(gameOrderSchema.safeParse({}).success).toBe(false)
        expect(gameOrderSchema.safeParse({ order: ['Bad Slug'] }).success).toBe(false)
        expect(gameOrderSchema.safeParse({ order: [1] }).success).toBe(false)
        expect(gameOrderSchema.safeParse({ order: Array.from({ length: GAME_ORDER_MAX + 1 }, (_, i) => `g-${i}`) }).success).toBe(false)
    })

    it('parallel saves leave exactly one of them', async () => {
        const id = await createPlayer()
        const slugs = await Promise.all(Array.from({ length: 4 }, async () => (await createAppWithGame(0)).game))
        const orders = Array.from({ length: 12 }, (_, i) => [...slugs.slice(i % 4), ...slugs.slice(0, i % 4)])
        const { ok, failed } = await burst(orders.length, i => saveGameOrder(viewer(id), orders[i]!))
        expect(failed).toHaveLength(0)
        expect(ok).toHaveLength(orders.length)
        const saved = await getGameOrder(id)
        expect(orders.map(o => o.join())).toContain(saved!.join())
    })

    it('only touches the viewer', async () => {
        const id = await createPlayer()
        const other = await createPlayer()
        const g = await createAppWithGame(0)
        await saveGameOrder(viewer(id), [g.game])
        const [row] = await db.select({ gameOrder: user.gameOrder }).from(user).where(eq(user.id, other))
        expect(row!.gameOrder).toBeNull()
    })
})

describe('games list for sorting', () => {
    it('carries createdAt and the players holding a star', async () => {
        const { appId, game } = await createAppWithGame(3)
        const p1 = await createConnectedPlayer(appId)
        const p2 = await createConnectedPlayer(appId)
        await createConnectedPlayer(appId)
        await setStars({ appId, playerId: p1, game, stars: 1, seq: 1 })
        await setStars({ appId, playerId: p2, game, stars: 3, seq: 1 })
        const [summary] = await listGames(null, { slug: game })
        expect(summary!.players).toBe(2)
        expect(Date.parse(summary!.createdAt)).toBeGreaterThan(Date.now() - 60_000)
    })
})
