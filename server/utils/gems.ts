import { and, eq, gte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db, type DbExecutor } from '#server/database/index'
import { gemTransactions, user } from '#server/database/schema'

/**
 * The only code that moves `user.gems`. Every write updates the balance with a
 * single conditional statement and logs one gem_transactions row with the
 * balance after it. Inside a `db.transaction()` that holds a lock, pass `tx`.
 */

export interface GemWriteOptions {
    /** The player's own gems coming back (a refunded spend). Never counts as income. */
    refund?: boolean
    /** The app the change came from, for spends, refunds and star bounties. */
    appId?: string | null
    meta?: Record<string, unknown>
}

function assertGemAmount(amount: number) {
    if (!Number.isInteger(amount) || amount < 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid gem amount' })
    }
}

async function logGems(ex: DbExecutor, userId: string, amount: number, balanceAfter: number, category: string, options: GemWriteOptions) {
    await ex.insert(gemTransactions).values({
        userId,
        amount,
        balanceAfter,
        category,
        refund: options.refund === true,
        appId: options.appId ?? null,
        meta: options.meta ?? null
    })
}

async function applyCredit(ex: DbExecutor, userId: string, amount: number, category: string, options: GemWriteOptions) {
    const [updated] = await ex.update(user)
        .set({ gems: sql`${user.gems} + ${amount}` })
        .where(eq(user.id, userId))
        .returning({ gems: user.gems })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    await logGems(ex, userId, amount, updated.gems, category, options)
    return updated.gems
}

// The `gems >= amount` guard is part of the UPDATE, so the check and the
// decrement are one statement: two concurrent spends can never both pass.
async function applyDebit(ex: DbExecutor, userId: string, amount: number, category: string, options: GemWriteOptions) {
    const [updated] = await ex.update(user)
        .set({ gems: sql`${user.gems} - ${amount}` })
        .where(and(eq(user.id, userId), gte(user.gems, amount)))
        .returning({ gems: user.gems })
    if (!updated) throw createError({ statusCode: 400, statusMessage: 'Not enough gems' })
    await logGems(ex, userId, -amount, updated.gems, category, options)
    return updated.gems
}

/** Grant gems. Returns the new balance. A zero grant writes nothing and returns the current balance. */
export async function creditGems(userId: string, amount: number, category: string, options: GemWriteOptions = {}, tx?: DbExecutor): Promise<number> {
    assertGemAmount(amount)
    if (amount === 0) return getGems(userId, tx)
    if (tx) return applyCredit(tx, userId, amount, category, options)
    return db.transaction(t => applyCredit(t, userId, amount, category, options))
}

/** Spend gems. Throws 400 `Not enough gems` when the player can't afford it; don't pre-check. */
export async function debitGems(userId: string, amount: number, category: string, options: GemWriteOptions = {}, tx?: DbExecutor): Promise<number> {
    assertGemAmount(amount)
    if (amount === 0) return getGems(userId, tx)
    if (tx) return applyDebit(tx, userId, amount, category, options)
    return db.transaction(t => applyDebit(t, userId, amount, category, options))
}

/** The player's gem balance (404 when the player doesn't exist). */
export async function getGems(userId: string, tx: DbExecutor = db): Promise<number> {
    const [row] = await tx.select({ gems: user.gems }).from(user).where(eq(user.id, userId))
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    return row.gems
}
