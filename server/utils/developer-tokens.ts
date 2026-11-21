import { and, count, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { createError, getRequestHeader, type H3Event } from 'h3'
import { db } from '#server/database/index'
import { developerTokens, user } from '#server/database/schema'
import { MAX_DEVELOPER_TOKENS } from '#shared/economy'
import { randomToken } from '#shared/random'
import type { DeveloperToken } from '#shared/types/api'
import { hashApiKey } from '#server/utils/apps'

/**
 * Personal developer tokens (`pnxd_…`) for the developer API. Players create
 * them in settings; the hub stores only the SHA-256 hash.
 */

export const DEVELOPER_TOKEN_PREFIX = 'pnxd_'

type TokenRow = typeof developerTokens.$inferSelect

function toDeveloperToken(row: TokenRow): DeveloperToken {
    return {
        id: row.id,
        name: row.name,
        prefix: row.tokenPrefix,
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString()
    }
}

export async function listDeveloperTokens(userId: string): Promise<DeveloperToken[]> {
    const rows = await db.select().from(developerTokens)
        .where(and(eq(developerTokens.userId, userId), isNull(developerTokens.revokedAt)))
        .orderBy(desc(developerTokens.createdAt))
    return rows.map(toDeveloperToken)
}

/**
 * Create a token; the plaintext comes back once. Lock-then-read: the owner row
 * is locked before counting, so parallel creates can't pass the limit.
 */
export async function createDeveloperToken(userId: string, name: string): Promise<{ token: DeveloperToken, secret: string }> {
    const secret = `${DEVELOPER_TOKEN_PREFIX}${randomToken(32)}`
    const row = await db.transaction(async (tx) => {
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update')
        const [active] = await tx.select({ n: count() }).from(developerTokens)
            .where(and(eq(developerTokens.userId, userId), isNull(developerTokens.revokedAt)))
        if ((active?.n ?? 0) >= MAX_DEVELOPER_TOKENS) {
            throw createError({ statusCode: 400, statusMessage: `You have ${MAX_DEVELOPER_TOKENS} active tokens, the maximum: revoke one first` })
        }
        const [created] = await tx.insert(developerTokens).values({
            userId,
            name,
            tokenHash: hashApiKey(secret),
            tokenPrefix: secret.slice(0, DEVELOPER_TOKEN_PREFIX.length + 4)
        }).returning()
        return created!
    })
    return { token: toDeveloperToken(row), secret }
}

/** Revoke one of the player's tokens; it stops working at once. */
export async function revokeDeveloperToken(userId: string, tokenId: string): Promise<void> {
    const [revoked] = await db.update(developerTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(developerTokens.id, tokenId), eq(developerTokens.userId, userId), isNull(developerTokens.revokedAt)))
        .returning({ id: developerTokens.id })
    if (!revoked) throw createError({ statusCode: 404, statusMessage: 'Token not found (or already revoked)' })
}

export interface DeveloperContext {
    userId: string
    tokenId: string
}

/** Resolve `Authorization: Bearer pnxd_…` to its owner, or 401. */
export async function authenticateDeveloper(event: H3Event): Promise<DeveloperContext> {
    const header = getRequestHeader(event, 'authorization') ?? ''
    const match = /^Bearer\s+(\S+)$/i.exec(header)
    if (!match) {
        throw createError({ statusCode: 401, statusMessage: 'Missing developer token: send "Authorization: Bearer pnxd_…" (create one at /settings/developer)' })
    }
    if (!match[1]!.startsWith(DEVELOPER_TOKEN_PREFIX)) {
        throw createError({ statusCode: 401, statusMessage: 'Developer endpoints take a developer token (pnxd_…), not an app API key' })
    }
    const [row] = await db.select({ id: developerTokens.id, userId: developerTokens.userId })
        .from(developerTokens)
        .where(and(eq(developerTokens.tokenHash, hashApiKey(match[1]!)), isNull(developerTokens.revokedAt)))
    if (!row) throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked developer token' })

    // At most one write per token per minute.
    await db.update(developerTokens)
        .set({ lastUsedAt: sql`now()` })
        .where(and(
            eq(developerTokens.id, row.id),
            or(isNull(developerTokens.lastUsedAt), lt(developerTokens.lastUsedAt, sql`now() - interval '1 minute'`))
        ))
    return { userId: row.userId, tokenId: row.id }
}

/** The developer authenticated by server/middleware/app-auth.ts. */
export function requireDeveloper(event: H3Event): DeveloperContext {
    const dev = event.context.developer as DeveloperContext | undefined
    if (!dev) throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked developer token' })
    return dev
}
