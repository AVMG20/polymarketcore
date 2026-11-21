import { and, asc, count, desc, eq, gt, isNull, lt, sql, sum } from 'drizzle-orm'
import { createError } from 'h3'
import { db, type DbExecutor } from '#server/database/index'
import { activityEvents, apps, games, gameStars, playerStars, user } from '#server/database/schema'
import { bountyForLevels, MAX_STARS_PER_GAME, STAR_FEED_COLLAPSE_MINUTES, titleFor, type TitleName } from '#shared/economy'
import { assertConnected } from '#server/utils/connections'
import { creditGems } from '#server/utils/gems'

/**
 * Stars are a level from 0 to 10 per player and game: the game's current
 * verdict, which can go down. Only games that are public, not retired, from
 * an active and verified app count toward totals, titles and the leaderboard.
 */

/** The SQL condition for a counted game; use with `games` joined to `apps`. */
export const countedGame = () => and(
    eq(games.visibility, 'public'),
    isNull(games.retiredAt),
    eq(apps.status, 'active'),
    eq(apps.verified, true)
)

/** Whether a game counts, from already-loaded rows. */
export function gameCounts(game: { visibility: string, retiredAt: Date | null }, app: { status: string, verified: boolean }): boolean {
    return game.visibility === 'public' && !game.retiredAt && app.status === 'active' && app.verified
}

/** A player's total: the sum of their current levels in counted games. */
export async function countStars(userId: string, ex: DbExecutor = db): Promise<number> {
    const [row] = await ex.select({ total: sum(playerStars.stars).mapWith(Number) })
        .from(playerStars)
        .innerJoin(games, eq(games.slug, playerStars.game))
        .innerJoin(apps, eq(apps.id, games.appId))
        .where(and(eq(playerStars.userId, userId), countedGame()))
    return row?.total ?? 0
}

export async function starSummary(userId: string, ex: DbExecutor = db): Promise<{ stars: number, title: TitleName }> {
    const stars = await countStars(userId, ex)
    return { stars, title: titleFor(stars) }
}

export interface SetStarsInput {
    appId: string
    playerId: string
    game: string
    stars: number
    seq: number
}

export interface SetStarsResult {
    /** False when `seq` was not above the stored one (an old or repeated set): nothing changed. */
    applied: boolean
    /** The player's current level in this game. */
    stars: number
    /** Their best level ever in this game. */
    best: number
    /** Gems paid by this call for new personal-best levels (0 while the game doesn't count). */
    bounty: number
    /** The player's counted total across games. */
    total: number
    title: TitleName
}

/** The game's max level: how many active stars its manifest declares. */
async function maxLevel(game: string): Promise<number> {
    const [row] = await db.select({ n: count() }).from(gameStars).where(and(eq(gameStars.game, game), isNull(gameStars.retiredAt)))
    return Math.min(row?.n ?? 0, MAX_STARS_PER_GAME)
}

/**
 * Set a player's level in a game (contract §2 `PUT /stars`).
 *
 * Applies only when `seq` is above the stored seq. The player row is locked,
 * then the level row is read and written inside the lock (lock-then-read), so
 * concurrent sets settle on the highest seq. A bounty is paid only for levels
 * above `paid_best`, raised with an integer compare-and-set, so losing and
 * regaining levels pays nothing and no level pays twice. Lock order is
 * app (share) → player → level row, the same as verifyApp.
 */
export async function setStars(input: SetStarsInput): Promise<SetStarsResult> {
    const [gameRow] = await db.select({ appId: games.appId, retiredAt: games.retiredAt, name: games.name })
        .from(games).where(eq(games.slug, input.game))
    if (!gameRow) throw createError({ statusCode: 404, statusMessage: `Game ${input.game} not found: declare it with PUT /api/v1/manifest first` })
    if (gameRow.appId !== input.appId) throw createError({ statusCode: 403, statusMessage: `Game ${input.game} belongs to another app` })
    if (gameRow.retiredAt) throw createError({ statusCode: 400, statusMessage: `Game ${input.game} is retired: it is missing from your latest manifest` })

    const max = await maxLevel(input.game)
    if (input.stars > max) {
        throw createError({ statusCode: 400, statusMessage: `stars must be between 0 and ${max}: game ${input.game} declares ${max} stars in its manifest` })
    }

    const [player] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.playerId))
    if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    await assertConnected(input.appId, input.playerId)

    return db.transaction(async (tx) => {
        const [app] = await tx.select({ verified: apps.verified, status: apps.status }).from(apps).where(eq(apps.id, input.appId)).for('share')
        const [game] = await tx.select({ visibility: games.visibility, retiredAt: games.retiredAt }).from(games).where(eq(games.slug, input.game))
        const counts = !!app && !!game && gameCounts(game, app)

        await tx.select({ id: user.id }).from(user).where(eq(user.id, input.playerId)).for('update')
        const [current] = await tx.select().from(playerStars)
            .where(and(eq(playerStars.userId, input.playerId), eq(playerStars.game, input.game)))
            .for('update')
        const totalBefore = await countStars(input.playerId, tx)

        if (current && current.seq >= input.seq) {
            return { applied: false, stars: current.stars, best: current.bestStars, bounty: 0, total: totalBefore, title: titleFor(totalBefore) }
        }

        const previous = current?.stars ?? 0
        const changed = previous !== input.stars
        const [row] = await tx.insert(playerStars)
            .values({ userId: input.playerId, game: input.game, stars: input.stars, bestStars: input.stars, seq: input.seq })
            .onConflictDoUpdate({
                target: [playerStars.userId, playerStars.game],
                set: {
                    stars: input.stars,
                    bestStars: sql`greatest(${playerStars.bestStars}, ${input.stars})`,
                    seq: input.seq,
                    updatedAt: changed ? sql`now()` : sql`${playerStars.updatedAt}`
                },
                setWhere: lt(playerStars.seq, input.seq)
            })
            .returning()
        if (!row) {
            // Unreachable under the row lock; kept so a stale write can never pass silently.
            return { applied: false, stars: previous, best: current?.bestStars ?? 0, bounty: 0, total: totalBefore, title: titleFor(totalBefore) }
        }

        const bounty = counts ? await payNewBests(tx, input.appId, input.playerId, input.game, row.paidBest, row.bestStars) : 0
        const total = await countStars(input.playerId, tx)
        const title = titleFor(total)

        if (counts && changed) {
            const levelName = await levelNameFor(tx, input.game, input.stars)
            await recordStarEvent(tx, input.playerId, input.game, gameRow.name, previous, input.stars, levelName, total)
        }
        if (counts && total > totalBefore && titleFor(totalBefore) !== title) {
            await tx.insert(activityEvents).values({ userId: input.playerId, type: 'title', payload: { title, stars: total } })
        }
        return { applied: true, stars: row.stars, best: row.bestStars, bounty, total, title }
    })
}

/** Pay levels between `paidBest` and `best` once: integer CAS on `paid_best`. */
async function payNewBests(tx: DbExecutor, appId: string, userId: string, game: string, paidBest: number, best: number): Promise<number> {
    const gems = bountyForLevels(paidBest, best)
    if (gems === 0) return 0
    const [flipped] = await tx.update(playerStars)
        .set({ paidBest: best })
        .where(and(eq(playerStars.userId, userId), eq(playerStars.game, game), eq(playerStars.paidBest, paidBest), lt(playerStars.paidBest, best)))
        .returning({ paidBest: playerStars.paidBest })
    if (!flipped) return 0
    await creditGems(userId, gems, game, { appId, meta: { levels: [paidBest + 1, best] } }, tx)
    return gems
}

async function levelNameFor(tx: DbExecutor, game: string, level: number): Promise<string | null> {
    if (level < 1) return null
    const [star] = await tx.select({ name: gameStars.name }).from(gameStars)
        .where(and(eq(gameStars.game, game), eq(gameStars.position, level), isNull(gameStars.retiredAt)))
    return star?.name ?? null
}

/**
 * One feed event per player and game per burst of changes: a change within
 * STAR_FEED_COLLAPSE_MINUTES of the last one updates that event (keeping its
 * starting level) instead of adding another. Runs under the player lock.
 */
async function recordStarEvent(tx: DbExecutor, userId: string, game: string, gameName: string, from: number, to: number, name: string | null, total: number) {
    const [recent] = await tx.select({ id: activityEvents.id, payload: activityEvents.payload })
        .from(activityEvents)
        .where(and(
            eq(activityEvents.userId, userId),
            eq(activityEvents.type, 'star'),
            sql`${activityEvents.payload}->>'game' = ${game}`,
            gt(activityEvents.createdAt, sql`now() - make_interval(mins => ${STAR_FEED_COLLAPSE_MINUTES})`)
        ))
        .orderBy(desc(activityEvents.createdAt))
        .limit(1)

    const start = recent ? Number(recent.payload.from ?? from) : from
    if (recent && start === to) {
        await tx.delete(activityEvents).where(eq(activityEvents.id, recent.id))
        return
    }
    const payload = { game, gameName, from: start, stars: to, direction: to > start ? 'up' : 'down', name, total }
    if (recent) {
        await tx.update(activityEvents).set({ payload, createdAt: sql`now()` }).where(eq(activityEvents.id, recent.id))
    } else {
        await tx.insert(activityEvents).values({ userId, type: 'star', payload })
    }
}

export interface VerifyResult {
    /** Players paid outstanding bounties by this call. */
    players: number
    /** Gems paid by this call. */
    gems: number
}

/**
 * Mark an app verified and pay outstanding personal-best bounties in its
 * counted games, once. The app row is locked first (sets hold it in share
 * mode), and each row is paid through the same `paid_best` CAS as setStars, so
 * parallel or repeated verifications find nothing left to pay.
 */
export async function verifyApp(appId: string): Promise<VerifyResult> {
    return db.transaction(async (tx) => {
        const [app] = await tx.select().from(apps).where(eq(apps.id, appId)).for('update')
        if (!app) throw createError({ statusCode: 404, statusMessage: `App ${appId} not found` })
        if (!app.verified) {
            await tx.update(apps).set({ verified: true, verifiedAt: new Date() }).where(eq(apps.id, appId))
        }
        if (app.status !== 'active') return { players: 0, gems: 0 }

        const owed = await tx.select({ userId: playerStars.userId, game: playerStars.game, paidBest: playerStars.paidBest, best: playerStars.bestStars })
            .from(playerStars)
            .innerJoin(games, eq(games.slug, playerStars.game))
            .where(and(eq(games.appId, appId), eq(games.visibility, 'public'), isNull(games.retiredAt), lt(playerStars.paidBest, playerStars.bestStars)))
            .orderBy(asc(playerStars.userId), asc(playerStars.game))

        const players = new Set<string>()
        let gems = 0
        for (const row of owed) {
            const paid = await payNewBests(tx, appId, row.userId, row.game, row.paidBest, row.best)
            if (paid > 0) {
                players.add(row.userId)
                gems += paid
            }
        }
        return { players: players.size, gems }
    })
}
