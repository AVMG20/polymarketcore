import { eq, sql } from 'drizzle-orm'
import { db } from '#server/database/index'
import { apps, gemTransactions, user } from '#server/database/schema'
import { hashApiKey } from '#server/utils/apps'
import { recordConnection } from '#server/utils/connections'
import { creditGems } from '#server/utils/gems'
import { applyManifest } from '#server/utils/manifest'
import { addDays, amsterdamDay } from '#shared/economy'
import { randomToken } from '#shared/random'

/** A throwaway player with `gems` gems (through the ledger), claimed through yesterday. */
export async function createPlayer(gems = 0) {
    const id = `test_${randomToken(12)}`
    await db.insert(user).values({
        id,
        name: 'Test',
        email: `${id}@test.local`,
        claimedThrough: addDays(amsterdamDay(), -1),
        welcomeGranted: true
    })
    if (gems > 0) await creditGems(id, gems, 'admin')
    return id
}

/** A connected player: as if the hub had minted them a launch token for the app. */
export async function createConnectedPlayer(appId: string, gems = 0) {
    const id = await createPlayer(gems)
    await recordConnection(id, appId)
    return id
}

export interface TestAppOptions {
    verified?: boolean
    visibility?: 'draft' | 'public'
    ownerUserId?: string
}

/** A throwaway app with one game (slug = app id) declaring `stars` levels. */
export async function createAppWithGame(stars = 3, options: TestAppOptions = {}) {
    const id = `t-${randomToken(9).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
    await db.insert(apps).values({
        id,
        name: 'Test app',
        baseUrl: 'http://localhost:3999',
        returnUrlPrefixes: ['http://localhost:3999/'],
        apiKeyHash: hashApiKey(randomToken(32)),
        verified: options.verified ?? true,
        ownerUserId: options.ownerUserId ?? null
    })
    await applyManifest(id, {
        games: [{
            slug: id,
            name: 'Test game',
            tagline: null,
            description: null,
            playPath: '/',
            icon: null,
            cover: null,
            accent: null,
            visibility: options.visibility ?? 'public',
            stars: Array.from({ length: stars }, (_, i) => ({ key: `s-${i + 1}`, name: `Star ${i + 1}`, description: null }))
        }]
    })
    return { appId: id, game: id }
}

export async function gemsOf(userId: string) {
    const [row] = await db.select({ gems: user.gems }).from(user).where(eq(user.id, userId))
    return row!.gems
}

/** Ledger sum for a player: must always equal their balance. */
export async function ledgerSum(userId: string) {
    const [row] = await db.select({ sum: sql<number>`coalesce(sum(${gemTransactions.amount}), 0)::int` })
        .from(gemTransactions).where(eq(gemTransactions.userId, userId))
    return row!.sum
}

/** Run `n` copies of `fn` at once and split the outcomes. */
export async function burst<T>(n: number, fn: (i: number) => Promise<T>) {
    const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)))
    return {
        ok: results.filter((r): r is PromiseFulfilledResult<Awaited<T>> => r.status === 'fulfilled').map(r => r.value),
        failed: results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason as { statusCode?: number, statusMessage?: string })
    }
}
