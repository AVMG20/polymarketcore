import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { activityEvents, apps, games, gameStars, playerStars, user } from '#server/database/schema'
import { APP_OFFLINE_AFTER_HOURS, nextTitle, starBounty, titleFor } from '#shared/economy'
import type {
    FeedEvent,
    GameDetailResponse,
    GameSummary,
    LeaderboardEntry,
    LeaderboardResponse,
    PlayerProfileResponse,
    StarTrack
} from '#shared/types/api'
import { appOrigin } from '#server/utils/apps'
import { countedGame, gameCounts } from '#server/utils/stars'

/**
 * Read models for the hub UI. Every function runs a fixed number of queries,
 * never one per player or per game.
 */

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)

export interface Viewer {
    id: string
    admin: boolean
}

function isOffline(lastSeenAt: Date | null): boolean {
    return !lastSeenAt || Date.now() - lastSeenAt.getTime() > APP_OFFLINE_AFTER_HOURS * 3_600_000
}

/**
 * Games of active apps that aren't retired: public ones for everyone, drafts
 * only for the app owner and admins. Verified apps first, then "New" ones.
 */
export async function listGames(viewer: Viewer | null, onlySlug?: string): Promise<GameSummary[]> {
    const visible: SQL | undefined = viewer?.admin
        ? undefined
        : viewer
            ? or(eq(games.visibility, 'public'), eq(apps.ownerUserId, viewer.id))
            : eq(games.visibility, 'public')
    const rows = await db.select({ game: games, app: apps })
        .from(games)
        .innerJoin(apps, eq(apps.id, games.appId))
        .where(and(isNull(games.retiredAt), eq(apps.status, 'active'), visible, onlySlug ? eq(games.slug, onlySlug) : undefined))
        .orderBy(desc(apps.verified), asc(games.position), asc(games.name))
    if (rows.length === 0) return []
    const slugs = rows.map(r => r.game.slug)

    const [levels, levelRows, mine] = await Promise.all([
        db.select().from(gameStars)
            .where(and(inArray(gameStars.game, slugs), isNull(gameStars.retiredAt)))
            .orderBy(asc(gameStars.position)),
        // Players per (game, current level), to count holders of each level.
        db.select({ game: playerStars.game, stars: playerStars.stars, n: count() })
            .from(playerStars)
            .where(and(inArray(playerStars.game, slugs), gte(playerStars.stars, 1)))
            .groupBy(playerStars.game, playerStars.stars),
        viewer
            ? db.select().from(playerStars).where(and(eq(playerStars.userId, viewer.id), inArray(playerStars.game, slugs)))
            : Promise.resolve([])
    ])

    const myLevel = new Map(mine.map(m => [m.game, m]))
    return rows.map(({ game, app }) => {
        const atLevel = levelRows.filter(l => l.game === game.slug)
        const defs = levels.filter(s => s.game === game.slug).map(s => ({
            key: s.key,
            position: s.position,
            name: s.name,
            description: s.description,
            bounty: starBounty(s.position),
            holders: atLevel.filter(l => l.stars >= s.position).reduce((sum, l) => sum + l.n, 0)
        }))
        const m = myLevel.get(game.slug)
        return {
            slug: game.slug,
            name: game.name,
            tagline: game.tagline,
            description: game.description,
            playPath: game.playPath,
            icon: game.icon,
            cover: game.cover,
            accent: game.accent,
            position: game.position,
            visibility: game.visibility,
            counts: gameCounts(game, app),
            offline: isOffline(app.lastSeenAt),
            app: { id: app.id, name: app.name, origin: appOrigin(app.baseUrl), verified: app.verified },
            stars: defs,
            maxStars: defs.length,
            me: m ? { stars: m.stars, best: m.bestStars } : null
        }
    })
}

export async function getGameDetail(slug: string, viewer: Viewer | null): Promise<GameDetailResponse> {
    const [game] = await listGames(viewer, slug)
    if (!game) throw createError({ statusCode: 404, statusMessage: 'Game not found' })

    const [top, recent] = await Promise.all([
        db.select({ id: user.id, name: user.name, image: user.image, stars: playerStars.stars, best: playerStars.bestStars })
            .from(playerStars)
            .innerJoin(user, eq(user.id, playerStars.userId))
            .where(and(eq(playerStars.game, slug), gte(playerStars.stars, 1)))
            .orderBy(desc(playerStars.stars), asc(playerStars.updatedAt))
            .limit(10),
        getFeed({ game: slug, limit: 10 })
    ])
    return { game, topPlayers: top, recent }
}

interface RankedRow {
    rank: number
    total: number
    stars: number
    held_since: Date
    id: string
    name: string
    image: string | null
}

/** Totals per player over counted games; `held_since` is their last level change there. */
const totalsCte = () => sql`
    totals as (
        select ps.user_id, sum(ps.stars)::int as stars, max(ps.updated_at) as held_since
        from ${playerStars} ps
        join ${games} g on g.slug = ps.game
        join ${apps} a on a.id = g.app_id
        where g.visibility = 'public' and g.retired_at is null and a.status = 'active' and a.verified
        group by ps.user_id
        having sum(ps.stars) > 0
    ), ranked as (
        select t.*,
               (row_number() over (order by t.stars desc, t.held_since asc, t.user_id asc))::int as rank,
               (count(*) over ())::int as total
        from totals t
    )`

/**
 * Players ranked by the sum of their current levels in counted games; ties
 * go to whoever has held their total longest. Two queries: the ranked page
 * (plus the viewer's own row) and the per-game levels for those players.
 */
export async function getLeaderboard(viewerId: string | null, limit = 100, offset = 0): Promise<LeaderboardResponse> {
    const result = await db.execute<RankedRow & Record<string, unknown>>(sql`
        with ${totalsCte()}
        select r.rank, r.total, r.stars, r.held_since, u.id, u.name, u.image
        from ranked r
        join ${user} u on u.id = r.user_id
        where (r.rank > ${offset} and r.rank <= ${offset + limit}) or r.user_id = ${viewerId ?? ''}
        order by r.rank
    `)
    const rows = result.rows
    const ids = rows.map(r => r.id)
    const perGame = ids.length
        ? await db.select({ userId: playerStars.userId, game: playerStars.game, stars: playerStars.stars })
            .from(playerStars)
            .innerJoin(games, eq(games.slug, playerStars.game))
            .innerJoin(apps, eq(apps.id, games.appId))
            .where(and(inArray(playerStars.userId, ids), gte(playerStars.stars, 1), countedGame()))
        : []

    const toEntry = (r: RankedRow): LeaderboardEntry => {
        const gamesMap: Record<string, number> = {}
        for (const g of perGame) if (g.userId === r.id) gamesMap[g.game] = g.stars
        return {
            rank: r.rank,
            id: r.id,
            name: r.name,
            image: r.image,
            stars: r.stars,
            title: titleFor(r.stars),
            heldSince: iso(r.held_since)!,
            games: gamesMap
        }
    }

    const inPage = rows.filter(r => r.rank > offset && r.rank <= offset + limit)
    const mine = viewerId ? rows.find(r => r.id === viewerId) : undefined
    let total = rows[0]?.total
    if (total === undefined) {
        const counted = await db.execute<{ n: number }>(sql`with ${totalsCte()} select count(*)::int as n from totals`)
        total = counted.rows[0]?.n ?? 0
    }
    return { entries: inPage.map(toEntry), total, me: mine ? toEntry(mine) : null }
}

/** The player's leaderboard rank, or null without counted stars. */
export async function getRank(userId: string): Promise<number | null> {
    const result = await db.execute<{ rank: number }>(sql`with ${totalsCte()} select rank from ranked where user_id = ${userId}`)
    return result.rows[0]?.rank ?? null
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfileResponse> {
    const [player] = await db.select({ id: user.id, name: user.name, image: user.image, createdAt: user.createdAt })
        .from(user).where(eq(user.id, playerId))
    if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })

    const [levels, rank, recent] = await Promise.all([
        db.select({ ps: playerStars, game: games, app: apps })
            .from(playerStars)
            .innerJoin(games, eq(games.slug, playerStars.game))
            .innerJoin(apps, eq(apps.id, games.appId))
            .where(and(eq(playerStars.userId, playerId), eq(games.visibility, 'public')))
            .orderBy(desc(playerStars.stars), asc(games.name)),
        getRank(playerId),
        getFeed({ userId: playerId, limit: 10 })
    ])
    const slugs = levels.map(l => l.game.slug)
    const defs = slugs.length
        ? await db.select().from(gameStars).where(and(inArray(gameStars.game, slugs), isNull(gameStars.retiredAt))).orderBy(asc(gameStars.position))
        : []

    const tracks: StarTrack[] = levels.map(({ ps, game, app }) => {
        const gameLevels = defs.filter(d => d.game === game.slug)
        return {
            game: game.slug,
            name: game.name,
            icon: game.icon,
            accent: game.accent,
            counts: gameCounts(game, app),
            verified: app.verified,
            retired: !!game.retiredAt || app.status !== 'active',
            stars: ps.stars,
            best: ps.bestStars,
            maxStars: gameLevels.length,
            updatedAt: iso(ps.updatedAt)!,
            levels: gameLevels.map(d => ({ key: d.key, position: d.position, name: d.name, description: d.description }))
        }
    })

    const total = tracks.filter(t => t.counts).reduce((s, t) => s + t.stars, 0)
    return {
        player: {
            id: player.id,
            name: player.name,
            image: player.image,
            stars: total,
            title: titleFor(total),
            nextTitle: nextTitle(total),
            rank,
            joinedAt: iso(player.createdAt)!
        },
        tracks,
        recent
    }
}

/** Feed events, newest first: all, one player's, or one game's. */
export async function getFeed(options: { before?: Date, limit?: number, userId?: string, game?: string } = {}): Promise<FeedEvent[]> {
    const rows = await db.select({
        id: activityEvents.id,
        type: activityEvents.type,
        payload: activityEvents.payload,
        createdAt: activityEvents.createdAt,
        userId: user.id,
        name: user.name,
        image: user.image
    })
        .from(activityEvents)
        .innerJoin(user, eq(user.id, activityEvents.userId))
        .where(and(
            options.before ? lt(activityEvents.createdAt, options.before) : undefined,
            options.userId ? eq(activityEvents.userId, options.userId) : undefined,
            options.game ? sql`${activityEvents.payload}->>'game' = ${options.game}` : undefined
        ))
        .orderBy(desc(activityEvents.createdAt))
        .limit(options.limit ?? 50)
    return rows.map(r => ({
        id: r.id,
        type: r.type,
        player: { id: r.userId, name: r.name, image: r.image },
        payload: r.payload,
        createdAt: iso(r.createdAt)!
    }))
}
