import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '#server/database/index'
import { apps, gameDailyPeaks, games, playSessions } from '#server/database/schema'
import { addDays, amsterdamDay, DAY_TIME_ZONE } from '#shared/economy'
import type { GameActivity } from '#shared/types/api'

/**
 * Play tracking: how often a game is opened and how long its /play page is
 * visible and focused. Presence (server/utils/presence.ts) feeds it; only
 * per-game totals ever leave this file.
 */

const TZ = sql.raw(`'${DAY_TIME_ZONE}'`)

/** Days on a game's activity chart. */
export const ACTIVITY_DAYS = 30
/** Hot games: the top few by play time over the last day, with at least this much play and this many players. */
export const HOT_GAMES = 3
export const HOT_MIN_SECONDS = 30 * 60
export const HOT_MIN_PLAYERS = 3

export interface SessionRow {
    id: string
    game: string
    userId: string
    startedAt: Date
    endedAt: Date
    activeSeconds: number
}

export interface PeakRow {
    game: string
    day: string
    peak: number
}

/** Where presence writes; tests swap in a memory store. */
export interface PlayStore {
    saveSessions(rows: SessionRow[]): Promise<void>
    savePeaks(rows: PeakRow[]): Promise<void>
}

let known: { slugs: Set<string>, at: number } | null = null

/**
 * Slugs of registered games, cached a minute (refetched sooner when an unknown
 * one shows up): sessions for anything else are dropped.
 */
async function knownSlugs(want: string[]): Promise<Set<string>> {
    const age = known ? Date.now() - known.at : Infinity
    if (age > 60_000 || (age > 2_000 && want.some(slug => !known!.slugs.has(slug)))) {
        const rows = await db.select({ slug: games.slug }).from(games)
        known = { slugs: new Set(rows.map(r => r.slug)), at: Date.now() }
    }
    return known!.slugs
}

/** Tests only. */
export function forgetKnownSlugs() {
    known = null
}

/**
 * Upserts are idempotent and only ever grow a row, so writes that land out of
 * order (a periodic flush racing the close) never lose time.
 */
export const dbPlayStore: PlayStore = {
    async saveSessions(all) {
        if (!all.length) return
        const slugs = await knownSlugs(all.map(r => r.game))
        const rows = all.filter(r => slugs.has(r.game))
        if (!rows.length) return
        await db.insert(playSessions).values(rows).onConflictDoUpdate({
            target: playSessions.id,
            set: {
                endedAt: sql`greatest(${playSessions.endedAt}, excluded.ended_at)`,
                activeSeconds: sql`greatest(${playSessions.activeSeconds}, excluded.active_seconds)`
            }
        })
    },
    async savePeaks(all) {
        const slugs = await knownSlugs(all.map(r => r.game))
        // One row per (game, day), the highest: a single upsert can't touch a row twice.
        const top = new Map<string, PeakRow>()
        for (const r of all) {
            const key = `${r.game}|${r.day}`
            if (slugs.has(r.game) && r.peak > (top.get(key)?.peak ?? -1)) top.set(key, r)
        }
        const rows = [...top.values()]
        if (!rows.length) return
        await db.insert(gameDailyPeaks).values(rows).onConflictDoUpdate({
            target: [gameDailyPeaks.game, gameDailyPeaks.day],
            set: { peak: sql`greatest(${gameDailyPeaks.peak}, excluded.peak)` }
        })
    }
}

/** Seconds played per game over the last 7 days (the popular sort). One query. */
export async function weekPlaySeconds(slugs: string[]): Promise<Map<string, number>> {
    if (!slugs.length) return new Map()
    const rows = await db.select({
        game: playSessions.game,
        seconds: sql<number>`coalesce(sum(${playSessions.activeSeconds}), 0)::int`
    })
        .from(playSessions)
        .where(and(inArray(playSessions.game, slugs), gte(playSessions.startedAt, sql`now() - interval '7 days'`)))
        .groupBy(playSessions.game)
    return new Map(rows.map(r => [r.game, r.seconds]))
}

/**
 * The hot games: the most played over the last day, above both floors. Only
 * listed games compete (public, verified, active, not retired), so the label
 * is the same for every viewer.
 */
export async function hotGames(): Promise<Set<string>> {
    const rows = await db.select({ game: playSessions.game })
        .from(playSessions)
        .innerJoin(games, eq(games.slug, playSessions.game))
        .innerJoin(apps, eq(apps.id, games.appId))
        .where(and(
            gte(playSessions.endedAt, sql`now() - interval '1 day'`),
            sql`${playSessions.activeSeconds} > 0`,
            eq(games.visibility, 'public'),
            isNull(games.retiredAt),
            eq(apps.verified, true),
            eq(apps.status, 'active')
        ))
        .groupBy(playSessions.game)
        .having(sql`sum(${playSessions.activeSeconds}) >= ${HOT_MIN_SECONDS} and count(distinct ${playSessions.userId}) >= ${HOT_MIN_PLAYERS}`)
        .orderBy(sql`sum(${playSessions.activeSeconds}) desc`)
        .limit(HOT_GAMES)
    return new Set(rows.map(r => r.game))
}

interface DayRow {
    day: string
    opens: number
    players: number
    seconds: number
    peak: number
}

interface TotalRow {
    opens: number
    players: number
    seconds: number
}

/**
 * A game's last ACTIVITY_DAYS Amsterdam days: opens, players, active seconds
 * (both by the day a session started) and the peak at once. Two queries.
 */
export async function gameActivity(slug: string, today: string = amsterdamDay()): Promise<GameActivity> {
    const from = addDays(today, -(ACTIVITY_DAYS - 1))
    const start = sql`(${from}::date::timestamp at time zone ${TZ})`
    const [days, totals] = await Promise.all([
        db.execute<DayRow & Record<string, unknown>>(sql`
            with s as (
                select (${playSessions.startedAt} at time zone ${TZ})::date as day,
                    count(*)::int as opens,
                    count(distinct ${playSessions.userId})::int as players,
                    sum(${playSessions.activeSeconds})::int as seconds
                from ${playSessions}
                where ${playSessions.game} = ${slug} and ${playSessions.startedAt} >= ${start}
                group by 1
            )
            select to_char(d, 'YYYY-MM-DD') as day,
                coalesce(s.opens, 0) as opens,
                coalesce(s.players, 0) as players,
                coalesce(s.seconds, 0) as seconds,
                coalesce(p.peak, 0) as peak
            from generate_series(${from}::date::timestamp, ${today}::date::timestamp, '1 day'::interval) as d
            left join s on s.day = d::date
            left join ${gameDailyPeaks} p on p.game = ${slug} and p.day = d::date
            order by d
        `),
        db.execute<TotalRow & Record<string, unknown>>(sql`
            select count(*)::int as opens,
                count(distinct ${playSessions.userId})::int as players,
                coalesce(sum(${playSessions.activeSeconds}), 0)::int as seconds
            from ${playSessions}
            where ${playSessions.game} = ${slug} and ${playSessions.startedAt} >= ${start}
        `)
    ])
    const t = totals.rows[0] ?? { opens: 0, players: 0, seconds: 0 }
    const list = days.rows.map(d => ({ day: d.day, opens: d.opens, players: d.players, seconds: d.seconds, peak: d.peak }))
    return {
        from,
        to: today,
        days: list,
        totals: {
            opens: t.opens,
            players: t.players,
            seconds: t.seconds,
            avgSessionSeconds: t.opens ? Math.round(t.seconds / t.opens) : 0,
            peak: Math.max(0, ...list.map(d => d.peak))
        }
    }
}
