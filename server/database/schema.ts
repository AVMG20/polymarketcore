import { sql } from 'drizzle-orm'
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = () => timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
const uuid = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())

export type UserRole = 'player' | 'admin'
export type AppStatus = 'active' | 'disabled'
export type ActivityType = 'star' | 'claim' | 'join' | 'title'
export type GameVisibility = 'draft' | 'public'

// ─── better-auth ────────────────────────────────────────────────────────────

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    // Moved only by server/utils/gems.ts, which logs every change in gem_transactions.
    gems: integer('gems').notNull().default(0),
    role: text('role').$type<UserRole>().notNull().default('player'),
    // Last Amsterdam day the daily claim paid for. New accounts start at yesterday.
    claimedThrough: date('claimed_through', { mode: 'string' }),
    // Flipped by the one request that pays STARTER_GEMS (server/utils/welcome.ts).
    welcomeGranted: boolean('welcome_granted').notNull().default(false),
    // The player's drawn avatar: a serialized EmblemData (shared/emblem.ts), written by server/utils/emblem.ts.
    emblem: text('emblem'),
    // Ring tier 0-4 around the avatar (shared/prestige.ts). Display only.
    prestige: integer('prestige').notNull().default(0),
    // The player's own order of the games list (slugs), set by PUT /api/me/game-order. Null: hub order.
    gameOrder: text('game_order').array(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
}, table => [
    check('user_gems_non_negative', sql`${table.gems} >= 0`),
    check('user_prestige_range', sql`${table.prestige} between 0 and 4`)
])

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
}, table => [index('session_user_id_idx').on(table.userId)])

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
}, table => [index('account_user_id_idx').on(table.userId)])

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
}, table => [index('verification_identifier_idx').on(table.identifier)])

// ─── Platform ───────────────────────────────────────────────────────────────

/** A connected deployment on one origin. Holds one API key (stored as a SHA-256 hash). */
export const apps = pgTable('apps', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    baseUrl: text('base_url').notNull(),
    returnUrlPrefixes: text('return_url_prefixes').array().notNull().default(sql`'{}'::text[]`),
    // Where the app's code lives (https), shown on its game pages. Set by the owner or an admin.
    repoUrl: text('repo_url'),
    apiKeyHash: text('api_key_hash').notNull().unique(),
    status: text('status').$type<AppStatus>().notNull().default('active'),
    // The player who registered it through the developer API (or the admin who created it).
    ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
    // Set only by an admin. Unverified apps pay no star bounties, their stars don't count
    // toward totals, and their spends are capped per player per day.
    verified: boolean('verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    // Last /api/v1 call with the app's key, written at most once a minute.
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: createdAt()
}, table => [index('apps_owner_user_id_idx').on(table.ownerUserId)])

/** A player's personal token for the developer API. Stored as a SHA-256 hash. */
export const developerTokens = pgTable('developer_tokens', {
    id: uuid(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    // The first characters of the token, so players can tell their tokens apart.
    tokenPrefix: text('token_prefix').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt()
}, table => [index('developer_tokens_user_id_idx').on(table.userId)])

/** A player who got a launch token for an app. Apps may only act on connected players. */
export const appConnections = pgTable('app_connections', {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    firstAt: timestamp('first_at', { withTimezone: true }).defaultNow().notNull(),
    lastAt: timestamp('last_at', { withTimezone: true }).defaultNow().notNull()
}, table => [
    primaryKey({ columns: [table.userId, table.appId] }),
    index('app_connections_app_id_idx').on(table.appId)
])

/** Gems an unverified app spent per player per Amsterdam day; the cap is the guard on the upsert. */
export const appDailySpends = pgTable('app_daily_spends', {
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    spent: integer('spent').notNull().default(0)
}, table => [primaryKey({ columns: [table.appId, table.userId, table.day] })])

/** A playable game, declared by its app's manifest. Never deleted: retired instead. */
export const games = pgTable('games', {
    slug: text('slug').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    playPath: text('play_path').notNull().default('/'),
    icon: text('icon'),
    cover: text('cover'),
    accent: text('accent'),
    position: integer('position').notNull().default(0),
    // Drafts are visible and playable only by the app's owner and admins, and never count.
    visibility: text('visibility').$type<GameVisibility>().notNull().default('draft'),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
}, table => [index('games_app_id_idx').on(table.appId)])

/** A game's star. `position` (1-10) sets the bounty. Retired, never deleted. */
export const gameStars = pgTable('game_stars', {
    game: text('game').notNull().references(() => games.slug, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    retiredAt: timestamp('retired_at', { withTimezone: true })
}, table => [
    primaryKey({ columns: [table.game, table.key] }),
    check('game_stars_position_range', sql`${table.position} between 1 and 10`)
])

/**
 * A player's star level in one game (0-10): the game's current verdict, which
 * can go down. `seq` orders the app's sets (only a higher seq applies);
 * `best_stars` is the highest level ever reached; `paid_best` is the level up
 * to which bounties were paid (it trails `best_stars` while the app is unverified).
 */
export const playerStars = pgTable('player_stars', {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    game: text('game').notNull().references(() => games.slug, { onDelete: 'restrict' }),
    stars: integer('stars').notNull().default(0),
    bestStars: integer('best_stars').notNull().default(0),
    paidBest: integer('paid_best').notNull().default(0),
    seq: bigint('seq', { mode: 'number' }).notNull().default(0),
    // When `stars` last changed value (the leaderboard tie-breaker).
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [
    primaryKey({ columns: [table.userId, table.game] }),
    index('player_stars_game_idx').on(table.game),
    index('player_stars_unpaid_idx').on(table.game).where(sql`${table.paidBest} < ${table.bestStars}`),
    check('player_stars_range', sql`${table.stars} between 0 and 10 and ${table.bestStars} between 0 and 10 and ${table.paidBest} between 0 and ${table.bestStars}`)
])

/** The gem ledger. Every change to `user.gems` writes exactly one row. */
export const gemTransactions = pgTable('gem_transactions', {
    id: uuid(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    // Signed: positive credits, negative debits.
    amount: integer('amount').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    // A game slug, or 'daily' / 'welcome' / 'admin'.
    category: text('category').notNull(),
    // A credit that returns the player's own gems (a refunded spend). Never income.
    refund: boolean('refund').notNull().default(false),
    appId: text('app_id').references(() => apps.id, { onDelete: 'set null' }),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: createdAt()
}, table => [
    index('gem_transactions_user_created_idx').on(table.userId, table.createdAt),
    index('gem_transactions_created_idx').on(table.createdAt)
])

/** An app's spend. Unique per (app, idempotency key) so replays never charge twice. */
export const gemSpends = pgTable('gem_spends', {
    id: uuid(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'restrict' }),
    idempotencyKey: text('idempotency_key').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    game: text('game').notNull(),
    amount: integer('amount').notNull(),
    reason: text('reason'),
    // Balance right after the spend, so a replay returns the original result.
    gemsAfter: integer('gems_after').notNull().default(0),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: createdAt()
}, table => [
    uniqueIndex('gem_spends_app_key_uq').on(table.appId, table.idempotencyKey),
    index('gem_spends_user_idx').on(table.userId)
])

/** ES256 key pairs for launch tokens. The JWKS publishes every public key. */
export const signingKeys = pgTable('signing_keys', {
    kid: text('kid').primaryKey(),
    privateJwk: jsonb('private_jwk').$type<Record<string, unknown>>().notNull(),
    publicJwk: jsonb('public_jwk').$type<Record<string, unknown>>().notNull(),
    // Set when a newer key takes over; the JWKS keeps publishing it for 10 minutes.
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    createdAt: createdAt()
})

/** Every emblem a player saved, newest kept up to EMBLEM_HISTORY_LIMIT (server/utils/emblem.ts). */
export const emblemHistory = pgTable('emblem_history', {
    id: uuid(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    emblem: text('emblem').notNull(),
    createdAt: createdAt()
}, table => [index('emblem_history_user_created_idx').on(table.userId, table.createdAt)])

/** The public activity feed. */
export const activityEvents = pgTable('activity_events', {
    id: uuid(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').$type<ActivityType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt()
}, table => [
    index('activity_events_created_idx').on(table.createdAt),
    index('activity_events_user_created_idx').on(table.userId, table.createdAt)
])
