/**
 * Hello Game: the reference Polynux integration. One Bun server, one HTML page,
 * no framework. Copy it, then replace the "game" (a point counter) with yours.
 *
 *   PNX_HUB_URL=http://localhost:3100 PNX_APP_ID=my-app PNX_APP_KEY=pnx_… bun server.ts
 *
 * It shows every rule an app must follow: verify the launch token (jose +
 * JWKS), keep its own session, push the manifest on boot, spend gems with an
 * idempotency key, set star levels from server-side state with an increasing
 * seq, and tell the hub iframe about wallet and star changes.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'

const HUB = (process.env.PNX_HUB_URL ?? 'http://localhost:3100').replace(/\/+$/, '')
const APP_ID = process.env.PNX_APP_ID ?? ''
const APP_KEY = process.env.PNX_APP_KEY ?? ''
const GAME = process.env.PNX_GAME_SLUG || APP_ID
// Optional: where this game's code lives (https), shown to players on its hub page.
const REPO_URL = process.env.PNX_REPO_URL || undefined
const PORT = Number(process.env.PORT ?? 3300)
// 'none' when the app runs on a different site than the hub (SameSite=None; Secure; Partitioned).
const SAMESITE = process.env.PNX_COOKIE_SAMESITE === 'none' ? 'none' : 'lax'
if (!APP_ID || !APP_KEY) throw new Error('Set PNX_APP_ID and PNX_APP_KEY (from POST /api/v1/developer/apps)')

// ─── Hub client ──────────────────────────────────────────────────────────────

class HubError extends Error {
    constructor(readonly status: number, message: string) {
        super(message)
    }
}

async function hub<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${HUB}/api/v1${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${APP_KEY}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({})) as { statusMessage?: string }
    if (!res.ok) throw new HubError(res.status, data.statusMessage ?? res.statusText)
    return data as T
}

// The game declares its levels once per boot. Level n is "what it takes to hold ★n".
// Omitting repoUrl leaves the one set through the developer API as it is.
await hub('PUT', '/manifest', {
    repoUrl: REPO_URL,
    games: [{
        slug: GAME,
        name: 'Hello Game',
        tagline: 'The reference integration',
        playPath: '/',
        icon: 'lucide:sparkles',
        stars: [
            { key: 'points-2', name: 'Warming up', description: 'Hold 2 points' },
            { key: 'points-4', name: 'On a roll', description: 'Hold 4 points' },
            { key: 'points-6', name: 'Hello, world', description: 'Hold 6 points' }
        ]
    }]
})

// ─── Launch tokens and sessions ──────────────────────────────────────────────

const jwks = createRemoteJWKSet(new URL(`${HUB}/.well-known/jwks.json`))
const usedJti = new Map<string, number>() // jti -> exp (ms): each token is accepted once

interface Session { playerId: string, name: string }
// Demo storage: a real game keeps sessions and game state in its database.
const sessions = new Map<string, Session>()
// Game state per player (not per session: a player can have several tabs or devices).
const pointsByPlayer = new Map<string, number>()
// Spends already turned into points. The hub answers a replayed idempotency key with the
// original spendId and charges nothing, so grant each spendId once (a DB unique key in production).
const fulfilledSpends = new Set<string>()

async function verifyLaunchToken(token: string) {
    const { payload } = await jwtVerify(token, jwks, { issuer: HUB, audience: APP_ID, clockTolerance: 30 })
    const now = Date.now()
    for (const [jti, exp] of usedJti) if (exp < now) usedJti.delete(jti)
    if (!payload.jti || usedJti.has(payload.jti)) throw new Error('token already used')
    usedJti.set(payload.jti, (payload.exp ?? 0) * 1000 + 30_000)
    return { playerId: String(payload.sub), name: String(payload.name ?? 'Player') }
}

function sessionCookie(id: string, req: Request) {
    // Secure whenever this app is served over https (directly or behind a TLS proxy).
    const https = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'
    const attrs = SAMESITE === 'none' ? 'SameSite=None; Secure; Partitioned' : `SameSite=Lax${https ? '; Secure' : ''}`
    return `hello_sid=${id}; Path=/; HttpOnly; Max-Age=604800; ${attrs}`
}

function sessionOf(req: Request): Session | null {
    const sid = /(?:^|;\s*)hello_sid=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1]
    return sid ? sessions.get(sid) ?? null : null
}

// ─── Game logic (server-side: the client never decides an outcome) ───────────

// seq must grow with every change for a player and game; a ms clock that never repeats works.
let lastSeq = 0
const nextSeq = () => (lastSeq = Math.max(Date.now(), lastSeq + 1))
const levelFor = (points: number) => Math.min(3, Math.floor(points / 2))
const pointsOf = (playerId: string) => pointsByPlayer.get(playerId) ?? 0

async function reportStars(playerId: string) {
    return hub<{ stars: number, bounty: number }>('PUT', '/stars', { playerId, game: GAME, stars: levelFor(pointsOf(playerId)), seq: nextSeq() })
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url)
        try {
            if (req.method === 'GET' && url.pathname === '/') {
                return new Response(Bun.file(new URL('./index.html', import.meta.url)), {
                    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `frame-ancestors 'self' ${HUB}` }
                })
            }
            if (req.method === 'GET' && url.pathname === '/api/config') return json({ hub: HUB, appId: APP_ID, game: GAME })

            if (req.method === 'POST' && url.pathname === '/api/session') {
                const { token } = await req.json().catch(() => ({})) as { token?: unknown }
                const player = typeof token === 'string' ? await verifyLaunchToken(token).catch(() => null) : null
                if (!player) return json({ error: 'invalid launch token' }, 401)
                const sid = crypto.randomUUID()
                sessions.set(sid, player)
                return json({ name: player.name }, 200, { 'Set-Cookie': sessionCookie(sid, req) })
            }

            const s = sessionOf(req)
            if (!s) return json({ error: 'no session' }, 401)

            if (req.method === 'GET' && url.pathname === '/api/me') {
                const player = await hub<{ gems: number }>('GET', `/players/${encodeURIComponent(s.playerId)}`)
                const points = pointsOf(s.playerId)
                return json({ name: s.name, gems: player.gems, points, stars: levelFor(points) })
            }
            if (req.method === 'POST' && url.pathname === '/api/spend') {
                // One idempotency key per purchase, from the client so a retried click reuses it.
                // Scope it to the player: the hub keys spends per app, not per player.
                const { key } = await req.json().catch(() => ({})) as { key?: unknown }
                if (typeof key !== 'string' || !/^[\w-]{8,64}$/.test(key)) return json({ error: 'key must be 8-64 letters, digits, - or _' }, 400)
                const spend = await hub<{ spendId: string, gems: number }>('POST', '/gems/spend', {
                    playerId: s.playerId, amount: 1, game: GAME, reason: 'Hello Game: 1 bonus point', idempotencyKey: `${s.playerId}:${key}`
                })
                if (!fulfilledSpends.has(spend.spendId)) {
                    fulfilledSpends.add(spend.spendId)
                    pointsByPlayer.set(s.playerId, pointsOf(s.playerId) + 1)
                }
                const stars = await reportStars(s.playerId)
                return json({ gems: spend.gems, points: pointsOf(s.playerId), stars: stars.stars })
            }
            if (req.method === 'POST' && (url.pathname === '/api/play' || url.pathname === '/api/reset')) {
                pointsByPlayer.set(s.playerId, url.pathname === '/api/play' ? pointsOf(s.playerId) + 1 : 0)
                const stars = await reportStars(s.playerId)
                return json({ points: pointsOf(s.playerId), stars: stars.stars, bounty: stars.bounty })
            }
            return json({ error: 'not found' }, 404)
        } catch (err) {
            if (err instanceof HubError) return json({ error: err.message }, err.status === 400 ? 400 : 502)
            throw err
        }
    }
})

console.log(`Hello Game on http://localhost:${PORT} (app ${APP_ID}, game ${GAME}, hub ${HUB})`)
