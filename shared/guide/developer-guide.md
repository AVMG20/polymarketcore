# Polynux developer guide

You are connecting a game to **Polynux**, a play-money gaming hub at `{{HUB}}`. The hub owns accounts,
the **gem** wallet and the **star** leaderboard. Your game runs on its own server ("app"), is opened from
the hub, spends players' gems and tells the hub each player's **star level** (0-10).

- This guide: `{{HUB}}/developers.md` · OpenAPI 3.1: `{{HUB}}/api/v1/openapi.json` · Index: `{{HUB}}/llms.txt`
- Reference implementation (copy it): `{{HUB}}/developers/hello-game/server.ts` and `{{HUB}}/developers/hello-game/index.html`
- The human gave you a developer token `pnxd_…`. Everything else happens through the API.

## Rules

- You MUST keep the game fully playable with zero gems. Gems speed up, convert or decorate.
- You MUST decide every outcome, payout, roll and star level on your server (CSPRNG for randomness). The
  client only asks; it MUST NOT send results.
- Stars are your game's current verdict on the player, a level from 0 to 10, set by your server. You decide
  whether levels can drop. You MUST NOT sell star levels directly for gems.
- You MUST verify every launch token (signature, `iss`, `aud`, `exp`) and accept each `jti` once.
- You MUST NOT put the app API key (`pnx_…`) or the developer token (`pnxd_…`) in client code, URLs or logs.
- Every spend MUST carry an idempotency key, created once per purchase and reused on retries.
- A replayed idempotency key returns the original `spendId` without charging again: grant each purchase once
  per `spendId`, never once per call.
- Every star set MUST carry a `seq` that increases with every change for that player and game.
- Retry failed calls with the same idempotency key or seq; both calls are safe to repeat.
- Price guide (players earn {{DAILY_GEMS}} gems a day): small boost 3-5 gems, meaningful unlock 30-70, never above ~200.

## 1. Set up, in this order

```sh
export HUB={{HUB}}
export DEV=pnxd_…                      # the human's developer token
export BASE=https://mygame.example.com # where your app runs (http://localhost:PORT while developing)

# 1. Register the app. The response holds the app API key ONCE: store it as a secret (PNX_APP_KEY).
curl -s -X POST $HUB/api/v1/developer/apps -H "Authorization: Bearer $DEV" -H 'Content-Type: application/json' \
  -d "{\"id\":\"my-game\",\"name\":\"My Game\",\"baseUrl\":\"$BASE\"}"
# → 201 { "app": { "id": "my-game", "verified": false, "returnUrlPrefixes": ["$BASE/"], … }, "apiKey": "pnx_…" }
export KEY=pnx_…

# 2. Declare the game and its star levels (your server does this on every boot).
curl -s -X PUT $HUB/api/v1/manifest -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{
  "games": [{
    "slug": "my-game", "name": "My Game", "tagline": "One line", "playPath": "/",
    "icon": "lucide:sparkles", "cover": null, "accent": "#7c5cff", "visibility": "draft",
    "stars": [
      { "key": "level-1", "name": "Rookie", "description": "Win 1 round" },
      { "key": "level-2", "name": "Regular", "description": "Win 10 rounds" },
      { "key": "level-3", "name": "Champion", "description": "Win 100 rounds" }
    ]
  }]
}'
# → { "games": [{ "slug": "my-game", "stars": 3, "visibility": "draft" }] }

# 3. Check what the hub sees.
curl -s $HUB/api/v1/developer/apps/my-game/games -H "Authorization: Bearer $DEV"

# 4. Test without a browser: a launch token for the token owner (you become a connected test player).
curl -s -X POST $HUB/api/v1/developer/apps/my-game/test-launch -H "Authorization: Bearer $DEV"
# → { "token": "eyJ…", "url": "$BASE/#pnx=eyJ…", "playerId": "…", "expiresIn": 300 }

# 5. Trade it for a session at YOUR app (your endpoint, see section 2), then exercise spend and stars.
curl -s -c jar -X POST $BASE/api/session -H 'Content-Type: application/json' -d '{"token":"eyJ…"}'

# 6. The calls your server makes for that player (playerId = the token's sub):
curl -s -X POST $HUB/api/v1/gems/spend -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"playerId":"…","amount":3,"game":"my-game","reason":"Extra life","idempotencyKey":"8f0e…uuid"}'
curl -s -X PUT $HUB/api/v1/stars -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"playerId":"…","game":"my-game","stars":2,"seq":1795253483123}'
```

The test player spends real gems and follows every rule below (unverified cap, no bounty while unverified).

## 2. Code to add to your repo

A framework-agnostic server module (TypeScript, `bun add jose` / `npm i jose`). Wire its functions to your
routes; keep the key in `PNX_APP_KEY`.

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

const HUB = process.env.PNX_HUB_URL ?? '{{HUB}}'
const APP_ID = process.env.PNX_APP_ID!   // e.g. 'my-game'
const APP_KEY = process.env.PNX_APP_KEY! // pnx_…, server-side only
const jwks = createRemoteJWKSet(new URL(`${HUB}/.well-known/jwks.json`))
const usedJti = new Map<string, number>() // use your DB or cache in production

/** POST /api/session { token }: verify the launch token, then create YOUR session (cookie). */
export async function verifyLaunchToken(token: string) {
    const { payload } = await jwtVerify(token, jwks, { issuer: HUB, audience: APP_ID, clockTolerance: 30 })
    if (!payload.jti || usedJti.has(payload.jti)) throw new Error('launch token already used')
    usedJti.set(payload.jti, payload.exp! * 1000)
    // sub = Polynux player id (store it on your user row), plus display data:
    return { playerId: payload.sub!, name: payload.name as string, image: payload.image as string | null, title: payload.title as string }
}

export class HubError extends Error {
    constructor(readonly status: number, message: string) { super(message) }
}

async function hub<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${HUB}/api/v1${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${APP_KEY}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new HubError(res.status, data.statusMessage ?? res.statusText) // statusMessage says what to fix
    return data as T
}

/** Call on boot. */
export const pushManifest = (games: unknown[]) => hub('PUT', '/manifest', { games })

/**
 * Spend gems. Create `idempotencyKey` once per purchase (store it with the pending purchase), reuse it on retry.
 * A replay answers with the original spendId: deliver the purchase once per spendId.
 */
export const spendGems = (playerId: string, amount: number, game: string, reason: string, idempotencyKey: string) =>
    hub<{ spendId: string, gems: number }>('POST', '/gems/spend', { playerId, amount, game, reason, idempotencyKey })

/** Undo your own spend within 24 h (e.g. the purchase failed on your side). */
export const refundSpend = (spendId: string) => hub<{ gems: number }>('POST', '/gems/refund', { spendId })

/** Report the player's level whenever your server's state changes it. seq: strictly increasing per player+game. */
let lastSeq = 0
export const setStars = (playerId: string, game: string, stars: number) =>
    hub<{ applied: boolean, stars: number, best: number, bounty: number, total: number, title: string }>(
        'PUT', '/stars', { playerId, game, stars, seq: (lastSeq = Math.max(Date.now(), lastSeq + 1)) })
// With several server processes use a DB sequence or the row version of the state the level comes from.

export const getPlayer = (playerId: string) =>
    hub<{ id: string, name: string, image: string | null, gems: number, stars: number, title: string }>('GET', `/players/${playerId}`)
```

On the game page (browser):

```js
const HUB = '{{HUB}}', APP_ID = 'my-game'
const inHub = window.parent !== window
// 1. Launch token in the URL hash: remove it, trade it for your session.
const token = new URLSearchParams(location.hash.slice(1)).get('pnx')
if (token) {
    history.replaceState(null, '', location.pathname + location.search)
    await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
}
// 2. No session (401 from your API): ask the hub for a fresh token, or go through /connect on your own domain.
function needLogin() {
    if (inHub) window.parent.postMessage({ source: 'pnx', type: 'relaunch' }, HUB)
    else location.href = `${HUB}/connect?app=${APP_ID}&return=${encodeURIComponent(location.href)}`
}
// 3. Keep the hub's top bar current after your server answers.
const tellHub = msg => inHub && window.parent.postMessage({ source: 'pnx', ...msg }, HUB)
// tellHub({ type: 'wallet', gems })   after a spend
// tellHub({ type: 'star', game: 'my-game', stars }) after a level change
```

Serve game pages with `Content-Security-Policy: frame-ancestors 'self' {{HUB}}`. Session cookie:
`HttpOnly; SameSite=Lax` (`Secure` on https) when your app shares a site with the hub (`*.avmg.nl`,
`localhost`); on another domain it MUST be `SameSite=None; Secure; Partitioned` or the iframe loses it.

## 3. Verify before you finish

- [ ] `PUT /manifest` runs on boot and returns your games; `GET /developer/apps/{id}/games` shows them.
- [ ] `test-launch` → `POST /api/session` at your app sets a session; replaying the same token is rejected.
- [ ] A wrong `aud` or an expired token is rejected; verification uses `clockTolerance: 30`.
- [ ] The game page strips `#pnx` from the URL and works inside an iframe (sandboxed: no top navigation).
- [ ] A spend retried with the same `idempotencyKey` returns the same `spendId`, charges once and delivers once.
- [ ] The game works with 0 gems; a 400 `Not enough gems` is shown to the player, not swallowed.
- [ ] Star levels come from server state; an older `seq` returns `applied: false` and changes nothing.
- [ ] No `pnx_` or `pnxd_` secret appears in client code, URLs or logs.
- [ ] Your app calls the hub (any call, or `GET /api/v1/ping`) at least daily, or the hub shows it as offline.

## 4. How players reach your game

- **Inside the hub**: `{{HUB}}/play/{slug}` renders `{baseUrl}{playPath}#pnx={token}` in a sandboxed iframe
  (`allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock
  allow-downloads`; no top navigation).
- **On your domain**: send players without a session to `{{HUB}}/connect?app={appId}&return={url}`. The hub
  logs them in and redirects to `{url}#pnx={token}`. `return` MUST start with one of your
  `returnUrlPrefixes` (same origin as `baseUrl`), or the hub answers 400.
- Either way the hub records a **connection** between the player and your app. `players/{id}`, `gems/spend`
  and `stars` answer 403 for players who never connected.

Launch token (ES256, verify against `{{HUB}}/.well-known/jwks.json`): `iss` = `{{HUB}}`, `aud` = your app
id, `sub` = player id, `name`, `image`, `title`, `iat`, `exp` = `iat` + 300, `jti`. It always carries the
player's current name and avatar. Keys rotate: a new `kid` appears and the old key stays published for 10
minutes, so cache the JWKS but refetch on an unknown `kid` (`createRemoteJWKSet` does this).

postMessage between your iframe and the hub (`{ source: 'pnx', type, … }`, origin-checked both ways):

| From | type | payload | Effect |
|---|---|---|---|
| app | `wallet` | `{ gems }` | Hub top bar shows the new gem count |
| app | `star` | `{ game, stars }` | Hub refetches the player and shows the level moment |
| app | `title` | `{ title }` | Hub top bar shows this title |
| app | `relaunch` | none | Hub fetches a fresh token and reloads the iframe (at most once per 30 s) |
| hub | `hello` | `{ gems }` | Sent after the iframe loads |

Ignore unknown types.

## 5. API reference

Base `{{HUB}}/api/v1`, JSON. Errors: `{ statusCode, statusMessage }`; `statusMessage` names the field and the
fix. 400 bad input or can't afford, 401 bad credentials, 403 not yours / not connected, 404 not found,
409 idempotency key reused with other params, 429 rate limited (`Retry-After` header).

### Developer endpoints: `Authorization: Bearer pnxd_…`

| Call | Body | Response |
|---|---|---|
| `GET /developer/apps` | | `{ apps: App[] }` |
| `POST /developer/apps` | `{ id, name, baseUrl, returnUrlPrefixes? }` | 201 `{ app: App, apiKey }` (key shown once) |
| `GET /developer/apps/{id}` | | `{ app: App }` |
| `PATCH /developer/apps/{id}` | `{ name?, baseUrl?, returnUrlPrefixes? }` | `{ app: App }` |
| `POST /developer/apps/{id}/rotate-key` | | `{ app: App, apiKey }` (old key stops at once) |
| `DELETE /developer/apps/{id}` | | `{ app: App }` (disabled, never deleted) |
| `GET /developer/apps/{id}/games` | | `{ app: App, games: [{ slug, name, visibility, counts, retired, playUrl, stars: [{ key, position, name, bounty, holders }] }] }` |
| `POST /developer/apps/{id}/test-launch` | `{ game? }` | `{ token, url, playerId, expiresIn }` |

`App` = `{ id, name, baseUrl, returnUrlPrefixes, status: 'active'|'disabled', verified, verifiedAt, owner, createdAt, games, lastSeenAt }`.
`id`: `[a-z0-9-]{2,40}`. `baseUrl`: https (http only for localhost), no query or fragment.
`returnUrlPrefixes` default to `["{baseUrl}/"]` and must share the `baseUrl` origin. At most {{MAX_DEVELOPER_APPS}} active apps per player.

### App endpoints: `Authorization: Bearer pnx_…`

| Call | Body | Response |
|---|---|---|
| `PUT /manifest` | `{ games: Game[] }` | `{ games: [{ slug, stars, visibility }] }` |
| `GET /players/{playerId}` | | `{ id, name, image, gems, stars, title }` |
| `POST /gems/spend` | `{ playerId, amount, game, reason?, idempotencyKey }` | `{ spendId, gems }` |
| `POST /gems/refund` | `{ spendId }` | `{ gems }` |
| `PUT /stars` | `{ playerId, game, stars, seq }` | `{ applied, stars, best, bounty, total, title }` |
| `GET /stars/{playerId}?game=` | | `{ stars: [{ game, stars, best, seq, updatedAt }] }` |
| `GET /ping` | | `{ ok, app, verified, time }` |

- **Game**: `slug` (`[a-z0-9-]{2,40}`, globally unique, first app to claim it owns it; `admin`, `daily`
  and `welcome` are reserved), `name`, `tagline?`, `description?` (Markdown), `playPath` (starts with `/`,
  no `#`), `icon?` (https image or `lucide:name`), `cover?` (https image), `accent?` (`#rrggbb`),
  `visibility?` (`draft`|`public`; default `draft` for unverified apps, `public` for verified ones), `stars`
  (0-10 `{ key, name, description? }`; entry n names level n, the count is the game's max level). Games or stars missing from a later manifest are retired, never deleted.
- **spend**: `amount` 1-100000 integer; `idempotencyKey` 8-100 chars. Same key + same params replays the
  original result without charging; different params → 409. Not enough gems → 400 `Not enough gems`.
- **refund**: only your own spends, within 24 h, once.
- **stars**: `stars` 0..(declared count); `seq` positive integer up to 2^53-1, strictly increasing per player
  and game (a ms timestamp or your ledger row id). A set with `seq` ≤ the stored one returns 200
  `applied: false` with the current value. `best` is the player's highest level ever; `bounty` is gems the
  hub paid the player now (n gems for each new personal-best level n, once); `total` and `title` are the
  player's hub-wide stars and title.
- Rate limits: {{RATE_APP_UNVERIFIED}} requests per 10 s per unverified app key, {{RATE_APP_VERIFIED}} per verified
  app key, {{RATE_DEV}} per developer token.

## 6. Verification, drafts and the economy

- New apps are **unverified**. Their games are playable and listed under "New", but their stars don't count
  toward the leaderboard or titles, they pay no star bounties, and they may spend at most
  {{UNVERIFIED_DAILY_SPEND_CAP}} gems per player per day (Europe/Amsterdam; 400 beyond it). Levels and bests are
  stored; when a Polynux admin verifies the app, the earned bounties are paid once.
- **Drafts** (`visibility: "draft"`) are visible and playable only by the app owner and admins. Use them while
  building; push `"public"` when it's ready.
- Only public, non-retired games of active, verified apps count toward totals and titles. A disabled app's
  stars drop out; nothing is deleted.
- Players start with {{STARTER_GEMS}} gems and earn {{DAILY_GEMS}} a day (the unclaimed pile holds up to
  {{CLAIM_CAP_GEMS}}). Only the hub creates gems: apps spend them (they are burned) and refund their own spends.
