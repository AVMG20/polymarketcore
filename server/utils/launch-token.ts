import { desc, gt, isNull, or, sql } from 'drizzle-orm'
import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from 'jose'
import { getRequestURL, type H3Event } from 'h3'
import { db } from '#server/database/index'
import { signingKeys } from '#server/database/schema'
import { randomId } from '#shared/random'

/**
 * Launch tokens (contract §1): ES256 JWTs for exactly one app, valid 300 s.
 * The key pair comes from env `PNX_SIGNING_JWK` (a private JWK as JSON) or is
 * generated on first use and stored in `signing_keys`.
 */

export const LAUNCH_TOKEN_TTL_SECONDS = 300

/**
 * The hub's public URL (token issuer, absolute links), no trailing slash:
 * CORE_URL, else BETTER_AUTH_URL, else the request's own origin as forwarded
 * by the proxy (x-forwarded-proto/host), else localhost.
 */
export function coreUrl(event?: H3Event): string {
    const configured = process.env.CORE_URL || process.env.BETTER_AUTH_URL
    if (configured) return configured.replace(/\/+$/, '')
    if (event) return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
    return 'http://localhost:3100'
}

interface ActiveKey {
    kid: string
    privateKey: CryptoKey | Uint8Array
    publicJwk: JWK
}

/** How long a retired key stays in the JWKS: longer than any token it signed lives. */
export const RETIRED_KEY_GRACE_MINUTES = 10
const KEY_CACHE_MS = 60_000

let active: { at: number, key: Promise<ActiveKey> } | null = null

function publicPart(jwk: JWK): JWK {
    const { kty, crv, x, y } = jwk
    return { kty, crv, x, y }
}

async function fromPrivateJwk(jwk: JWK, kid?: string): Promise<ActiveKey> {
    const id = kid ?? jwk.kid ?? await calculateJwkThumbprint(publicPart(jwk))
    return {
        kid: id,
        privateKey: await importJWK(jwk, 'ES256'),
        publicJwk: { ...publicPart(jwk), kid: id, alg: 'ES256', use: 'sig' }
    }
}

async function generateKeyRow() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const publicJwk = await exportJWK(publicKey)
    const privateJwk = await exportJWK(privateKey)
    const kid = await calculateJwkThumbprint(publicJwk)
    return {
        kid,
        privateJwk: privateJwk as Record<string, unknown>,
        publicJwk: { ...publicJwk, kid, alg: 'ES256', use: 'sig' } as Record<string, unknown>
    }
}

async function loadOrCreateKey(): Promise<ActiveKey> {
    const envJwk = process.env.PNX_SIGNING_JWK
    if (envJwk) return fromPrivateJwk(JSON.parse(envJwk) as JWK)

    // An advisory lock makes first use race-free across requests and processes:
    // whoever holds it reads, and creates a key only when no active one exists.
    const row = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('pnx_signing_keys'))`)
        const [existing] = await tx.select().from(signingKeys).where(isNull(signingKeys.retiredAt)).orderBy(desc(signingKeys.createdAt)).limit(1)
        if (existing) return existing
        const [created] = await tx.insert(signingKeys).values(await generateKeyRow()).returning()
        return created!
    })
    return fromPrivateJwk(row.privateJwk as JWK, row.kid)
}

// Cached for a minute, so every process picks up a rotation well within the grace period.
function activeKey(): Promise<ActiveKey> {
    if (!active || Date.now() - active.at > KEY_CACHE_MS) {
        const key = loadOrCreateKey().catch((err) => {
            active = null
            throw err
        })
        active = { at: Date.now(), key }
    }
    return active.key
}

/**
 * Rotate the signing key: a new key signs from now on, and the old one stays
 * in the JWKS for RETIRED_KEY_GRACE_MINUTES so tokens it signed still verify.
 */
export async function rotateSigningKey(): Promise<{ kid: string, retired: string[] }> {
    const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('pnx_signing_keys'))`)
        const retired = await tx.update(signingKeys).set({ retiredAt: new Date() }).where(isNull(signingKeys.retiredAt)).returning({ kid: signingKeys.kid })
        const [created] = await tx.insert(signingKeys).values(await generateKeyRow()).returning({ kid: signingKeys.kid })
        return { kid: created!.kid, retired: retired.map(r => r.kid) }
    })
    active = null
    return result
}

/** The JWKS document served at `/.well-known/jwks.json`: the active key plus keys retired in the last 10 minutes. */
export async function getJwks(): Promise<{ keys: JWK[] }> {
    const key = await activeKey()
    if (process.env.PNX_SIGNING_JWK) return { keys: [key.publicJwk] }
    const rows = await db.select({ publicJwk: signingKeys.publicJwk })
        .from(signingKeys)
        .where(or(isNull(signingKeys.retiredAt), gt(signingKeys.retiredAt, sql`now() - make_interval(mins => ${RETIRED_KEY_GRACE_MINUTES})`)))
        .orderBy(desc(signingKeys.createdAt))
    return { keys: rows.map(r => r.publicJwk as JWK) }
}

export interface LaunchSubject {
    id: string
    name: string
    image: string | null
    title: string
}

/** Sign a launch token for `appId` (the `aud`). */
export async function mintLaunchToken(player: LaunchSubject, appId: string): Promise<string> {
    const key = await activeKey()
    const iat = Math.floor(Date.now() / 1000)
    return new SignJWT({ name: player.name, image: player.image ?? null, title: player.title })
        .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWT' })
        .setIssuer(coreUrl())
        .setAudience(appId)
        .setSubject(player.id)
        .setIssuedAt(iat)
        .setExpirationTime(iat + LAUNCH_TOKEN_TTL_SECONDS)
        .setJti(randomId())
        .sign(key.privateKey)
}
