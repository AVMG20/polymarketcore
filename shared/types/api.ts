/**
 * Response shapes of the hub's session API (`/api/**`, contract §3). The
 * server handlers return these, the client composables consume them.
 * Dates are ISO strings.
 */
import type { ClaimPile, TitleName } from '#shared/economy'

export type Role = 'player' | 'admin'

export interface NextTitle {
    name: TitleName
    stars: number
    remaining: number
}

/** `GET /api/me` (401 when signed out). */
export interface Me {
    id: string
    name: string
    email: string
    image: string | null
    /** Serialized emblem (shared/emblem.ts), shown before `image`. */
    emblem: string | null
    /** Ring tier 0-4 (shared/prestige.ts). */
    prestige: number
    gems: number
    stars: number
    title: TitleName
    nextTitle: NextTitle | null
    /** The daily pile: `gems / cap` ready, full in `fullInDays` days. */
    claimable: ClaimPile
    role: Role
    createdAt: string
}

/** `POST /api/gems/claim`. */
export interface ClaimResponse {
    gems: number
    claimed: number
    days: number
}

export type GemHistoryKind = 'welcome' | 'daily' | 'admin' | 'spend' | 'refund' | 'bounty'

export interface GemHistoryItem {
    id: string
    /** What the row is, for labels: spends and refunds come from apps, bounties from star levels. */
    kind: GemHistoryKind
    /** The game's slug and name when `category` is a game. */
    game: string | null
    gameName: string | null
    amount: number
    balanceAfter: number
    category: string
    refund: boolean
    appId: string | null
    meta: Record<string, unknown> | null
    createdAt: string
}

/**
 * `GET /api/gems/history?page=1&pageSize=25`, newest first. Optional filters:
 * `range` (GemRange, default all), `dir` (in | out), `kind` (GemHistoryKind),
 * `game` (slug: the ledger category). `before=<id>` continues after that row
 * (load more); `total` counts every row matching the filters.
 */
export interface GemHistoryResponse {
    items: GemHistoryItem[]
    page: number
    pageSize: number
    total: number
}

/** Periods of the gem stats: the last 7, 30 or 90 Amsterdam days (today included), or everything. */
export type GemRange = '7d' | '30d' | '90d' | 'all'

/** One day (or week, from its Monday) of gem moves. */
export interface GemStatsBucket {
    /** First Amsterdam day of the bucket, 'YYYY-MM-DD'. */
    day: string
    in: number
    out: number
    net: number
    moves: number
    /** Balance at the end of the bucket. */
    balance: number
}

/** Gems in or out of one source in the range: a kind, per game for spends. */
export interface GemStatsSource {
    kind: GemHistoryKind
    direction: 'in' | 'out'
    /** The game slug for spends, null otherwise. */
    game: string | null
    gameName: string | null
    /** Gems, always positive. */
    amount: number
    moves: number
}

/** `GET /api/gems/stats?range=30d`: the viewer's gem flow, bucketed by Europe/Amsterdam day. */
export interface GemStatsResponse {
    range: GemRange
    /** First and last day covered ('YYYY-MM-DD', Amsterdam). */
    from: string
    to: string
    /** 'week' when an all-time range spans more than GEM_STATS_MAX_DAYS days. */
    bucket: 'day' | 'week'
    /** Current balance. */
    balance: number
    /** Balance before `from`. */
    startBalance: number
    totals: { in: number, out: number, net: number, moves: number }
    /** Every bucket from `from` to `to`, empty ones included, oldest first. */
    buckets: GemStatsBucket[]
    /** Biggest first. */
    sources: GemStatsSource[]
}

/** Star level n of a game: its name and what it takes ("Hold 10k coins"). */
export interface StarLevel {
    key: string
    /** The level, 1-10. */
    position: number
    name: string
    description: string | null
    /** Gems paid the first time a player reaches this level (verified apps only). */
    bounty: number
    /** Players currently at this level or higher. */
    holders: number
}

export interface GameSummary {
    slug: string
    name: string
    tagline: string | null
    description: string | null
    playPath: string
    icon: string | null
    cover: string | null
    accent: string | null
    position: number
    /** Drafts are listed only for the app owner and admins. */
    visibility: 'draft' | 'public'
    /** Whether stars here count toward totals and titles (public, verified, active). */
    counts: boolean
    /** The app hasn't called the hub for 24 h: show "offline?". */
    offline: boolean
    /** The app that hosts it. `owner` is the player who made it (null for hub-run apps), `repoUrl` where its code lives. */
    app: { id: string, name: string, origin: string, verified: boolean, repoUrl: string | null, owner: PlayerRef | null }
    stars: StarLevel[]
    /** Number of levels (declared stars). */
    maxStars: number
    /** The viewer's level and best here, null when signed out or never played. */
    me: { stars: number, best: number } | null
    /** When the game was first registered. */
    createdAt: string
    /** Players holding at least one star here right now. */
    players: number
    /** Seconds the game was played (visible and focused) over the last 7 days. */
    playSeconds: number
    /** Among the most played games of the last day. */
    hot: boolean
}

/** `GET /api/games`: public games of active apps (verified first, then "New" ones), plus the viewer's drafts. */
export interface GamesResponse {
    games: GameSummary[]
    /** The viewer's own order of the list (slugs), null when signed out or never set. */
    order: string[] | null
}

/** `PUT /api/me/game-order` `{ order: [slug, …] }` (`[]` clears it): the saved order. */
export interface GameOrderResponse {
    order: string[]
}

export interface PlayerRef {
    id: string
    name: string
    image: string | null
    /** Serialized emblem (shared/emblem.ts): the avatar, before `image` and the initial. */
    emblem: string | null
    /** Ring tier 0-4 around the avatar (shared/prestige.ts). */
    prestige: number
}

/** `GET /api/games/:slug`. */
export interface GameDetailResponse {
    game: GameSummary
    topPlayers: (PlayerRef & { stars: number, best: number })[]
    /** Latest feed events for this game. */
    recent: FeedEvent[]
    activity: GameActivity
}

/** One Amsterdam day of a game's play: opens, distinct players, seconds played, most at once. */
export interface GameActivityDay {
    day: string
    opens: number
    players: number
    seconds: number
    peak: number
}

/** A game's play over its last 30 days. Anonymous: totals only. */
export interface GameActivity {
    from: string
    to: string
    days: GameActivityDay[]
    totals: { opens: number, players: number, seconds: number, avgSessionSeconds: number, peak: number }
}

export interface LeaderboardEntry extends PlayerRef {
    rank: number
    /** Sum of current levels in counted games. */
    stars: number
    title: TitleName
    /** When the player's levels last changed: ties go to whoever has held their total longest. */
    heldSince: string
    /** Current level per counted game slug. */
    games: Record<string, number>
}

export interface SearchPlayer extends PlayerRef {
    rank: number
    stars: number
}

/** `GET /api/search?q=`: players whose name matches (games are filtered client side). */
export interface SearchResponse {
    players: SearchPlayer[]
}

/** `GET /api/leaderboard?limit=100&offset=0`: every player, most stars first. `me` is the viewer's row when signed in. */
export interface LeaderboardResponse {
    entries: LeaderboardEntry[]
    total: number
    me: LeaderboardEntry | null
}

export interface StarTrack {
    game: string
    name: string
    icon: string | null
    accent: string | null
    /** Counted toward the total right now. */
    counts: boolean
    verified: boolean
    retired: boolean
    stars: number
    best: number
    maxStars: number
    updatedAt: string
    levels: { key: string, position: number, name: string, description: string | null }[]
}

/** `GET /api/players/:id`. */
export interface PlayerProfileResponse {
    player: PlayerRef & {
        stars: number
        title: TitleName
        nextTitle: NextTitle | null
        rank: number | null
        joinedAt: string
    }
    tracks: StarTrack[]
    /** Games of apps this player owns, visible to the viewer. */
    games: GameSummary[]
    recent: FeedEvent[]
}

export type FeedEventType = 'star' | 'claim' | 'join' | 'title'

export interface FeedEvent {
    id: string
    type: FeedEventType
    player: PlayerRef
    /**
     * star: { game, gameName, from, stars, direction: 'up' | 'down', name (level name or null), total }
     *   ("reached ★3" / "dropped to ★1"; rapid changes collapse into one event);
     * claim: { days, gems }; title: { title, stars }; join: {}
     */
    payload: Record<string, unknown>
    createdAt: string
}

/** `GET /api/feed?before=<iso>`: latest 50 events. */
export interface FeedResponse {
    events: FeedEvent[]
}

/** One saved emblem. */
export interface EmblemHistoryEntry {
    id: string
    emblem: string
    createdAt: string
}

/** `GET /api/me/emblem/history`: the viewer's saved emblems, newest first. */
export interface EmblemHistoryResponse {
    entries: EmblemHistoryEntry[]
}

/** `PUT /api/me/emblem` `{ emblem }` (null clears it). */
export interface SaveEmblemResponse {
    emblem: string | null
    /** The history row of this save, null when clearing. */
    historyId: string | null
}

/** `GET /api/play/:slug/launch`. */
export interface LaunchResponse {
    /** iframe src with the launch token in `#pnx`. */
    url: string
    /** Hub path that opens the game in its own tab through `/connect`. */
    directUrl: string
    app: { id: string, origin: string }
    game: { slug: string, name: string }
}

/** `GET /api/me/apps`: the apps the signed-in player registered. */
export interface MyAppsResponse {
    apps: AppInfo[]
}

/** A registered app as its owner and admins see it. */
export interface AppInfo {
    id: string
    name: string
    baseUrl: string
    returnUrlPrefixes: string[]
    /** Where the app's code lives (https), or null. */
    repoUrl: string | null
    status: 'active' | 'disabled'
    /** An admin disabled it; the owner can't re-enable it. */
    disabledByAdmin: boolean
    /** Set by an admin. Unverified: no star bounties, stars don't count, spends capped per player per day. */
    verified: boolean
    verifiedAt: string | null
    owner: { id: string, name: string, image: string | null } | null
    createdAt: string
    /** Games declared by the app's manifest (retired ones included). */
    games: number
    lastSeenAt: string | null
}

/** `GET /api/admin/apps`, developer `GET /api/v1/developer/apps`. */
export interface AppsResponse {
    apps: AppInfo[]
}

/** Create and rotate-key responses: the plaintext app API key, shown once. */
export interface AppKeyResponse {
    app: AppInfo
    apiKey: string
}

/** `POST /api/admin/apps/:id/verify`. */
export interface VerifyAppResponse {
    app: AppInfo
    /** Outstanding bounties this call paid. */
    paid: { players: number, gems: number }
}

/** Developer view of a game: `GET /api/v1/developer/apps/:id/games`. */
export interface DeveloperGame {
    slug: string
    name: string
    tagline: string | null
    playPath: string
    retired: boolean
    /** The hub page that launches it: `<hub>/play/<slug>`. */
    playUrl: string
    stars: {
        key: string
        position: number
        name: string
        description: string | null
        bounty: number
        retired: boolean
        /** Players currently at this level or higher. */
        holders: number
    }[]
    visibility: 'draft' | 'public'
    counts: boolean
}

export interface DeveloperGamesResponse {
    app: AppInfo
    games: DeveloperGame[]
}

/** A developer token as listed (never the token itself). */
export interface DeveloperToken {
    id: string
    name: string
    /** First characters, e.g. `pnxd_Ab12`. */
    prefix: string
    lastUsedAt: string | null
    createdAt: string
}

/** `GET /api/developer/tokens` (session). */
export interface DeveloperTokensResponse {
    tokens: DeveloperToken[]
    max: number
}

/** `POST /api/developer/tokens` (session): the plaintext token, shown once. */
export interface CreatedDeveloperToken {
    token: DeveloperToken
    secret: string
}

/** `POST /api/v1/developer/apps/:id/test-launch`. */
export interface TestLaunchResponse {
    /** A launch token for the token owner (the test player), aud = app id. */
    token: string
    /** `<baseUrl><playPath>#pnx=<token>` for the app's first active game (or `<baseUrl>/` without games). */
    url: string
    playerId: string
    expiresIn: number
}

/** `GET /api/admin/players?q&limit&offset` (admin): players newest first, `stars` is the counted total. */
export interface AdminPlayersResponse {
    /** `adminFixed`: an ADMIN_EMAILS admin, which the role can't change. */
    players: (PlayerRef & { email: string, gems: number, stars: number, admin: boolean, adminFixed: boolean, createdAt: string })[]
    total: number
}
