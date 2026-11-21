import { and, count, desc, eq, gt, lt, sql, type SQL } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { games, gemTransactions, user } from '#server/database/schema'
import { addDays, amsterdamDay, DAY_TIME_ZONE, daysBetween } from '#shared/economy'
import { GEM_STATS_MAX_DAYS, historyKind, rangeDays } from '#shared/gem-history'
import type { GemHistoryKind, GemHistoryResponse, GemRange, GemStatsResponse, GemStatsSource } from '#shared/types/api'

/**
 * Read models of the gem ledger: the history list and the stats of a range.
 * Days are Europe/Amsterdam calendar days, like the rest of the economy.
 */

const TZ = sql.raw(`'${DAY_TIME_ZONE}'`)

/** `historyKind()` in SQL, so filters and groups agree with the labels. */
const kindExpr = sql<GemHistoryKind>`(case
    when ${gemTransactions.category} in ('welcome', 'daily', 'admin') then ${gemTransactions.category}
    when ${gemTransactions.refund} then 'refund'
    when ${gemTransactions.amount} < 0 then 'spend'
    when ${gemTransactions.appId} is not null then 'bounty'
    else 'admin'
end)`

/** The first day of a fixed range, null for all time. */
function rangeFrom(range: GemRange, today: string): string | null {
    const days = rangeDays(range)
    return days === null ? null : addDays(today, -(days - 1))
}

/** Amsterdam midnight at the start of `day`. */
const dayStart = (day: string) => sql`(${day}::date::timestamp at time zone ${TZ})`

export interface GemHistoryFilter {
    range?: GemRange
    dir?: 'in' | 'out'
    kind?: GemHistoryKind
    /** A game slug (the ledger category). */
    game?: string
    /** Continue after this row id (newest first). */
    before?: string
    page?: number
    pageSize?: number
    today?: string
}

/** The viewer's ledger, newest first, filtered; `total` counts the matching rows. */
export async function listGemHistory(userId: string, filter: GemHistoryFilter = {}): Promise<GemHistoryResponse> {
    const page = filter.before ? 1 : (filter.page ?? 1)
    const pageSize = filter.pageSize ?? 25
    const from = filter.range ? rangeFrom(filter.range, filter.today ?? amsterdamDay()) : null
    const where: (SQL | undefined)[] = [
        eq(gemTransactions.userId, userId),
        from ? sql`${gemTransactions.createdAt} >= ${dayStart(from)}` : undefined,
        filter.dir === 'in' ? gt(gemTransactions.amount, 0) : filter.dir === 'out' ? lt(gemTransactions.amount, 0) : undefined,
        filter.kind ? sql`${kindExpr} = ${filter.kind}` : undefined,
        filter.game ? eq(gemTransactions.category, filter.game) : undefined
    ]
    // The cursor compares inside Postgres, so microsecond timestamps never lose precision.
    const cursor = filter.before
        ? sql`(${gemTransactions.createdAt}, ${gemTransactions.id}) < (select c.created_at, c.id from ${gemTransactions} c where c.id = ${filter.before} and c.user_id = ${userId})`
        : undefined
    const [rows, [totalRow]] = await Promise.all([
        db.select({ tx: gemTransactions, gameName: games.name })
            .from(gemTransactions)
            .leftJoin(games, eq(games.slug, gemTransactions.category))
            .where(and(...where, cursor))
            .orderBy(desc(gemTransactions.createdAt), desc(gemTransactions.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(gemTransactions).where(and(...where))
    ])
    return {
        items: rows.map(({ tx, gameName }) => ({
            id: tx.id,
            kind: historyKind(tx),
            game: gameName ? tx.category : null,
            gameName: gameName ?? null,
            amount: tx.amount,
            balanceAfter: tx.balanceAfter,
            category: tx.category,
            refund: tx.refund,
            appId: tx.appId,
            meta: tx.meta ?? null,
            createdAt: tx.createdAt.toISOString()
        })),
        page,
        pageSize,
        total: totalRow?.n ?? 0
    }
}

interface SummaryRow {
    balance: number | null
    first_day: string | null
    start_balance: number
    gems_in: number
    gems_out: number
    moves: number
}

interface BucketRow {
    day: string
    gems_in: number
    gems_out: number
    moves: number
    balance: number
}

interface SourceRow {
    kind: GemHistoryKind
    direction: 'in' | 'out'
    game: string | null
    game_name: string | null
    amount: number
    moves: number
}

/**
 * Gem flow of a range: totals, one bucket per Amsterdam day (per week when an
 * all-time range spans more than GEM_STATS_MAX_DAYS) with the closing balance,
 * and where gems came from and went to. Three queries, all aggregated in SQL.
 */
export async function getGemStats(userId: string, range: GemRange, today: string = amsterdamDay()): Promise<GemStatsResponse> {
    const fixedFrom = rangeFrom(range, today)
    const start = fixedFrom ? dayStart(fixedFrom) : sql`'-infinity'::timestamptz`
    const inRange = sql`${gemTransactions.createdAt} >= ${start}`

    const summary = await db.execute<SummaryRow & Record<string, unknown>>(sql`
        select
            (select ${user.gems} from ${user} where ${user.id} = ${userId}) as balance,
            to_char(min((${gemTransactions.createdAt} at time zone ${TZ})::date), 'YYYY-MM-DD') as first_day,
            coalesce(sum(${gemTransactions.amount}) filter (where not (${inRange})), 0)::int as start_balance,
            coalesce(sum(${gemTransactions.amount}) filter (where ${inRange} and ${gemTransactions.amount} > 0), 0)::int as gems_in,
            coalesce(-sum(${gemTransactions.amount}) filter (where ${inRange} and ${gemTransactions.amount} < 0), 0)::int as gems_out,
            (count(*) filter (where ${inRange}))::int as moves
        from ${gemTransactions}
        where ${gemTransactions.userId} = ${userId}
    `)
    const s = summary.rows[0]
    if (!s || s.balance === null) throw createError({ statusCode: 404, statusMessage: 'Player not found' })

    // All time starts at the first ledger row; a day earlier than today never ends after it.
    const from = fixedFrom ?? (s.first_day && s.first_day < today ? s.first_day : today)
    const bucket = daysBetween(from, today) + 1 > GEM_STATS_MAX_DAYS ? 'week' : 'day'
    const unit = sql.raw(`'${bucket}'`)
    const step = sql.raw(`'1 ${bucket}'::interval`)

    const [buckets, sources] = await Promise.all([
        db.execute<BucketRow & Record<string, unknown>>(sql`
            with moves as (
                select date_trunc(${unit}, ${gemTransactions.createdAt} at time zone ${TZ})::date as bucket,
                    coalesce(sum(${gemTransactions.amount}) filter (where ${gemTransactions.amount} > 0), 0)::int as gems_in,
                    coalesce(-sum(${gemTransactions.amount}) filter (where ${gemTransactions.amount} < 0), 0)::int as gems_out,
                    count(*)::int as moves
                from ${gemTransactions}
                where ${gemTransactions.userId} = ${userId} and ${inRange}
                group by 1
            )
            select to_char(b.bucket, 'YYYY-MM-DD') as day,
                coalesce(m.gems_in, 0) as gems_in,
                coalesce(m.gems_out, 0) as gems_out,
                coalesce(m.moves, 0) as moves,
                (${s.start_balance}::int + sum(coalesce(m.gems_in, 0) - coalesce(m.gems_out, 0)) over (order by b.bucket))::int as balance
            from generate_series(date_trunc(${unit}, ${from}::date::timestamp), ${today}::date::timestamp, ${step}) as b(bucket)
            left join moves m on m.bucket = b.bucket::date
            order by b.bucket
        `),
        db.execute<SourceRow & Record<string, unknown>>(sql`
            select src.kind, src.direction, src.game, ${games.name} as game_name,
                sum(src.amount)::int as amount, count(*)::int as moves
            from (
                select ${kindExpr} as kind,
                    case when ${gemTransactions.amount} > 0 then 'in' else 'out' end as direction,
                    case when ${kindExpr} = 'spend' then ${gemTransactions.category} end as game,
                    abs(${gemTransactions.amount}) as amount
                from ${gemTransactions}
                where ${gemTransactions.userId} = ${userId} and ${inRange}
            ) src
            left join ${games} on ${games.slug} = src.game
            group by src.kind, src.direction, src.game, ${games.name}
            order by amount desc, src.kind, src.game
        `)
    ])

    return {
        range,
        from,
        to: today,
        bucket,
        balance: s.balance,
        startBalance: s.start_balance,
        totals: { in: s.gems_in, out: s.gems_out, net: s.gems_in - s.gems_out, moves: s.moves },
        buckets: buckets.rows.map(b => ({
            day: b.day,
            in: b.gems_in,
            out: b.gems_out,
            net: b.gems_in - b.gems_out,
            moves: b.moves,
            balance: b.balance
        })),
        sources: sources.rows.map((r): GemStatsSource => ({
            kind: r.kind,
            direction: r.direction,
            game: r.game,
            gameName: r.game_name,
            amount: r.amount,
            moves: r.moves
        }))
    }
}
