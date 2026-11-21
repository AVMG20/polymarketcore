import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db, type DbExecutor } from '#server/database/index'
import { appDailySpends, apps, gemSpends, games, user } from '#server/database/schema'
import { amsterdamDay, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'
import { assertConnected } from '#server/utils/connections'
import { creditGems, debitGems } from '#server/utils/gems'

export interface SpendInput {
    appId: string
    playerId: string
    amount: number
    game: string
    reason: string | null
    idempotencyKey: string
}

export const REFUND_WINDOW_HOURS = 24

async function assertGameOwner(appId: string, game: string) {
    const [row] = await db.select({ appId: games.appId }).from(games).where(eq(games.slug, game))
    if (!row) throw createError({ statusCode: 404, statusMessage: `Game ${game} not found: declare it with PUT /api/v1/manifest first` })
    if (row.appId !== appId) throw createError({ statusCode: 403, statusMessage: `Game ${game} belongs to another app` })
}

/**
 * Spend a player's gems for an app (contract §2 `POST /gems/spend`).
 *
 * The spend row and the debit commit together. A concurrent request with the
 * same (app, idempotency key) blocks on the unique index until the first one
 * commits, then finds the row and replays it. A failed debit rolls the spend
 * row back, so the key stays usable once the player can afford it.
 *
 * Unverified apps may spend at most UNVERIFIED_DAILY_SPEND_CAP gems per player
 * per Amsterdam day. The per-(app, player, day) counter is raised by an upsert
 * whose WHERE holds the cap, inside the same transaction, so parallel spends
 * can never pass it together.
 */
export async function spendGems(input: SpendInput, attempt = 0): Promise<{ spendId: string, gems: number, replayed: boolean }> {
    await assertGameOwner(input.appId, input.game)
    const [player] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.playerId))
    if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    await assertConnected(input.appId, input.playerId)

    const created = await db.transaction(async (tx) => {
        const [app] = await tx.select({ verified: apps.verified }).from(apps).where(eq(apps.id, input.appId)).for('share')
        const verified = app?.verified === true

        const [spend] = await tx.insert(gemSpends)
            .values({
                appId: input.appId,
                idempotencyKey: input.idempotencyKey,
                userId: input.playerId,
                game: input.game,
                amount: input.amount,
                reason: input.reason
            })
            .onConflictDoNothing({ target: [gemSpends.appId, gemSpends.idempotencyKey] })
            .returning({ id: gemSpends.id, createdAt: gemSpends.createdAt })
        if (!spend) return null

        // The spend's own day, so a refund frees room on the same counter row.
        if (!verified) await raiseDailySpend(tx, input.appId, input.playerId, input.amount, amsterdamDay(spend.createdAt))

        const gems = await debitGems(input.playerId, input.amount, input.game, {
            appId: input.appId,
            meta: { spendId: spend.id, reason: input.reason }
        }, tx)
        await tx.update(gemSpends).set({ gemsAfter: gems }).where(eq(gemSpends.id, spend.id))
        return { spendId: spend.id, gems, replayed: false }
    })
    if (created) return created

    const [existing] = await db.select().from(gemSpends)
        .where(and(eq(gemSpends.appId, input.appId), eq(gemSpends.idempotencyKey, input.idempotencyKey)))
    if (!existing) {
        // The holder of the key rolled back between our conflict and this read: try again.
        if (attempt < 3) return spendGems(input, attempt + 1)
        throw createError({ statusCode: 409, statusMessage: 'Spend in progress, retry' })
    }
    if (existing.userId !== input.playerId || existing.amount !== input.amount || existing.game !== input.game) {
        throw createError({
            statusCode: 409,
            statusMessage: `idempotencyKey was already used for a different spend (playerId, amount or game differ): use a new key for a new spend`
        })
    }
    return { spendId: existing.id, gems: existing.gemsAfter, replayed: true }
}

async function raiseDailySpend(tx: DbExecutor, appId: string, userId: string, amount: number, day: string) {
    const capError = () => createError({
        statusCode: 400,
        statusMessage: `Unverified apps may spend at most ${UNVERIFIED_DAILY_SPEND_CAP} gems per player per day (Europe/Amsterdam); this spend would pass it`
    })
    if (amount > UNVERIFIED_DAILY_SPEND_CAP) throw capError()
    const [row] = await tx.insert(appDailySpends)
        .values({ appId, userId, day, spent: amount })
        .onConflictDoUpdate({
            target: [appDailySpends.appId, appDailySpends.userId, appDailySpends.day],
            set: { spent: sql`${appDailySpends.spent} + ${amount}` },
            setWhere: sql`${appDailySpends.spent} + ${amount} <= ${UNVERIFIED_DAILY_SPEND_CAP}`
        })
        .returning({ spent: appDailySpends.spent })
    if (!row) throw capError()
}

/**
 * Refund one of the app's own spends, within 24 h, once (contract §2
 * `POST /gems/refund`). The conditional update on `refunded_at IS NULL` is the
 * guard; only the request that flips it credits the gems back.
 */
export async function refundSpend(appId: string, spendId: string): Promise<{ gems: number }> {
    const result = await db.transaction(async (tx) => {
        const [spend] = await tx.update(gemSpends)
            .set({ refundedAt: sql`now()` })
            .where(and(
                eq(gemSpends.id, spendId),
                eq(gemSpends.appId, appId),
                isNull(gemSpends.refundedAt),
                gt(gemSpends.createdAt, sql`now() - make_interval(hours => ${REFUND_WINDOW_HOURS})`)
            ))
            .returning()
        if (!spend) return null
        // A refund frees its room under the unverified daily cap (no-op when there is no counter row).
        await tx.update(appDailySpends)
            .set({ spent: sql`greatest(${appDailySpends.spent} - ${spend.amount}, 0)` })
            .where(and(
                eq(appDailySpends.appId, appId),
                eq(appDailySpends.userId, spend.userId),
                eq(appDailySpends.day, amsterdamDay(spend.createdAt))
            ))
        const gems = await creditGems(spend.userId, spend.amount, spend.game, {
            refund: true,
            appId,
            meta: { spendId: spend.id }
        }, tx)
        return { gems }
    })
    if (result) return result

    // Nothing flipped: read the row only to say why.
    const [spend] = await db.select().from(gemSpends).where(eq(gemSpends.id, spendId))
    if (!spend) throw createError({ statusCode: 404, statusMessage: `Spend ${spendId} not found` })
    if (spend.appId !== appId) throw createError({ statusCode: 403, statusMessage: `Spend ${spendId} belongs to another app` })
    if (spend.refundedAt) throw createError({ statusCode: 400, statusMessage: `Spend ${spendId} was already refunded` })
    throw createError({ statusCode: 400, statusMessage: `Spend ${spendId} is older than ${REFUND_WINDOW_HOURS} hours and can no longer be refunded` })
}
