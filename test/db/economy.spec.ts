import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { claimDaily } from '#server/utils/claim'
import { recordConnection } from '#server/utils/connections'
import { creditGems, debitGems } from '#server/utils/gems'
import { refundSpend, spendGems } from '#server/utils/spends'
import { grantWelcome } from '#server/utils/welcome'
import { CLAIM_CAP_GEMS, DAILY_GEMS, STARTER_GEMS, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'
import { addDays, amsterdamDay } from '#shared/economy'
import { burst, createAppWithGame, createConnectedPlayer, createPlayer, gemsOf, ledgerSum } from './helpers'

// Every test fires a burst of parallel requests: the second of two identical
// requests must never pay or charge again.

describe('gem ledger', () => {
    it('debit throws 400 when the player cannot afford it, and logs every write', async () => {
        const player = await createPlayer()
        await creditGems(player, 50, 'admin')
        await expect(debitGems(player, 51, 'test')).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Not enough gems' })
        expect(await debitGems(player, 50, 'test')).toBe(0)
        expect(await ledgerSum(player)).toBe(0)
    })

    it('parallel debits never overdraw', async () => {
        const player = await createPlayer(100)
        const { ok, failed } = await burst(10, () => debitGems(player, 30, 'test'))
        expect(ok).toHaveLength(3)
        expect(failed.every(f => f.statusCode === 400)).toBe(true)
        expect(await gemsOf(player)).toBe(10)
        expect(await ledgerSum(player)).toBe(10)
    })
})

describe('welcome grant', () => {
    it('pays once however often it runs', async () => {
        const player = await createPlayer()
        await db.update(user).set({ welcomeGranted: false }).where(eq(user.id, player))
        const { ok } = await burst(10, () => grantWelcome(player))
        expect(ok.filter(Boolean)).toHaveLength(1)
        expect(await gemsOf(player)).toBe(STARTER_GEMS)
        expect(await ledgerSum(player)).toBe(STARTER_GEMS)
    })
})

describe('daily claim', () => {
    it('10 parallel claims pay once', async () => {
        const player = await createPlayer()
        const { ok } = await burst(10, () => claimDaily(player))
        expect(ok.filter(r => r.claimed > 0)).toHaveLength(1)
        expect(ok.reduce((s, r) => s + r.claimed, 0)).toBe(DAILY_GEMS)
        expect(await gemsOf(player)).toBe(DAILY_GEMS)
        expect(await ledgerSum(player)).toBe(DAILY_GEMS)
    })

    it('a second claim the same day pays nothing', async () => {
        const player = await createPlayer()
        await claimDaily(player)
        expect(await claimDaily(player)).toMatchObject({ claimed: 0, days: 0, gems: DAILY_GEMS })
    })

    it('a long absence pays the capped pile', async () => {
        const player = await createPlayer()
        await db.update(user).set({ claimedThrough: addDays(amsterdamDay(), -40) }).where(eq(user.id, player))
        expect(await claimDaily(player)).toMatchObject({ claimed: CLAIM_CAP_GEMS })
    })
})

describe('app spends', () => {
    it('10 parallel spends with the same idempotency key charge once', async () => {
        const { appId, game } = await createAppWithGame()
        const player = await createConnectedPlayer(appId, 500)
        const input = { appId, playerId: player, amount: 25, game, reason: 'test', idempotencyKey: 'same-key-123' }
        const { ok, failed } = await burst(10, () => spendGems(input))
        expect(failed).toHaveLength(0)
        expect(new Set(ok.map(r => r.spendId)).size).toBe(1)
        expect(ok.every(r => r.gems === 475)).toBe(true)
        expect(await gemsOf(player)).toBe(475)
        expect(await ledgerSum(player)).toBe(475)
    })

    it('replaying a key with a different amount is 409', async () => {
        const { appId, game } = await createAppWithGame()
        const player = await createConnectedPlayer(appId, 500)
        await spendGems({ appId, playerId: player, amount: 25, game, reason: null, idempotencyKey: 'key-mismatch' })
        await expect(spendGems({ appId, playerId: player, amount: 30, game, reason: null, idempotencyKey: 'key-mismatch' }))
            .rejects.toMatchObject({ statusCode: 409 })
        expect(await gemsOf(player)).toBe(475)
    })

    it('a key replayed for another player is 409, and the same key in another app is a new spend', async () => {
        const { appId, game } = await createAppWithGame()
        const other = await createAppWithGame()
        const alice = await createConnectedPlayer(appId, 100)
        const bob = await createConnectedPlayer(appId, 100)
        await recordConnection(alice, other.appId)
        await spendGems({ appId, playerId: alice, amount: 5, game, reason: null, idempotencyKey: 'key-shared-1' })
        const { ok, failed } = await burst(10, () => spendGems({ appId, playerId: bob, amount: 5, game, reason: null, idempotencyKey: 'key-shared-1' }))
        expect(ok).toHaveLength(0)
        expect(failed.every(f => f.statusCode === 409)).toBe(true)
        expect(await gemsOf(bob)).toBe(100)
        expect(await spendGems({ appId: other.appId, playerId: alice, amount: 5, game: other.game, reason: null, idempotencyKey: 'key-shared-1' }))
            .toMatchObject({ gems: 90, replayed: false })
    })

    it('a failed spend leaves the key usable', async () => {
        const { appId, game } = await createAppWithGame()
        const player = await createConnectedPlayer(appId, 10)
        const input = { appId, playerId: player, amount: 25, game, reason: null, idempotencyKey: 'key-retry-later' }
        await expect(spendGems(input)).rejects.toMatchObject({ statusCode: 400 })
        await creditGems(player, 20, 'admin')
        expect(await spendGems(input)).toMatchObject({ gems: 5, replayed: false })
    })

    it('a player who never connected to the app gets 403', async () => {
        const { appId, game } = await createAppWithGame()
        const player = await createPlayer(100)
        await expect(spendGems({ appId, playerId: player, amount: 1, game, reason: null, idempotencyKey: 'key-no-connection' }))
            .rejects.toMatchObject({ statusCode: 403 })
        expect(await gemsOf(player)).toBe(100)
    })

    it('another app cannot spend for a game it does not own', async () => {
        const { game } = await createAppWithGame()
        const other = await createAppWithGame()
        const player = await createConnectedPlayer(other.appId, 100)
        await expect(spendGems({ appId: other.appId, playerId: player, amount: 1, game, reason: null, idempotencyKey: 'key-foreign' }))
            .rejects.toMatchObject({ statusCode: 403 })
    })

    it('parallel spends of an unverified app stay under the daily cap', async () => {
        const { appId, game } = await createAppWithGame(3, { verified: false })
        const player = await createConnectedPlayer(appId, 500)
        const { ok, failed } = await burst(10, i => spendGems({ appId, playerId: player, amount: 3, game, reason: null, idempotencyKey: `cap-key-${i}` }))
        expect(ok).toHaveLength(Math.floor(UNVERIFIED_DAILY_SPEND_CAP / 3))
        expect(failed.every(f => f.statusCode === 400)).toBe(true)
        expect(await gemsOf(player)).toBe(500 - ok.length * 3)
        expect(await ledgerSum(player)).toBe(500 - ok.length * 3)
    })

    it('a refund frees room under the cap; verified apps have no cap', async () => {
        const { appId, game } = await createAppWithGame(3, { verified: false })
        const player = await createConnectedPlayer(appId, 500)
        const { spendId } = await spendGems({ appId, playerId: player, amount: UNVERIFIED_DAILY_SPEND_CAP, game, reason: null, idempotencyKey: 'cap-full' })
        await expect(spendGems({ appId, playerId: player, amount: 1, game, reason: null, idempotencyKey: 'cap-over' })).rejects.toMatchObject({ statusCode: 400 })
        await refundSpend(appId, spendId)
        await expect(spendGems({ appId, playerId: player, amount: 1, game, reason: null, idempotencyKey: 'cap-after-refund' })).resolves.toMatchObject({ replayed: false })

        const verified = await createAppWithGame(3)
        const rich = await createConnectedPlayer(verified.appId, 500)
        await expect(spendGems({ appId: verified.appId, playerId: rich, amount: 100, game: verified.game, reason: null, idempotencyKey: 'no-cap' }))
            .resolves.toMatchObject({ gems: 400 })
    })

    it('10 parallel refunds credit once', async () => {
        const { appId, game } = await createAppWithGame()
        const player = await createConnectedPlayer(appId, 100)
        const { spendId } = await spendGems({ appId, playerId: player, amount: 40, game, reason: null, idempotencyKey: 'key-refund' })
        const { ok, failed } = await burst(10, () => refundSpend(appId, spendId))
        expect(ok).toHaveLength(1)
        expect(failed.every(f => f.statusCode === 400)).toBe(true)
        expect(await gemsOf(player)).toBe(100)
        expect(await ledgerSum(player)).toBe(100)
    })

    it('only the spending app can refund', async () => {
        const { appId, game } = await createAppWithGame()
        const other = await createAppWithGame()
        const player = await createConnectedPlayer(appId, 100)
        const { spendId } = await spendGems({ appId, playerId: player, amount: 40, game, reason: null, idempotencyKey: 'key-refund-2' })
        await expect(refundSpend(other.appId, spendId)).rejects.toMatchObject({ statusCode: 403 })
    })
})
