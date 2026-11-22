# Polynux platform contract (v2)

The single source of truth for how **polymarketcore** (the hub) and every connected game app talk to each
other. `polymarketcasino` is the first app. Both repos carry an identical copy of this file in
`docs/platform-contract.md`; change it in both or not at all. The hub also serves an agent-facing version
of the app side at `{CORE_URL}/developers.md` and an OpenAPI 3.1 spec at `{CORE_URL}/api/v1/openapi.json`.

## Words

- **Hub / core**: `polymarketcore`. Owns accounts, login, the gem wallet, stars, the leaderboard, the
  activity feed and the game registry.
- **App**: one deployment on one origin (`https://casino.avmg.nl`, `http://localhost:3200`). It has one
  API key (`pnx_…`), an owner (the player who registered it) and optionally a `repoUrl` (where its code
  lives). An app hosts **one or more games**. The hub shows the owner and the repo on the app's game pages.
- **Game**: a playable thing listed in the hub. It belongs to one app, has a `slug` (globally unique,
  `[a-z0-9-]{2,40}`), a `playPath` on its app, a `visibility` (`draft` | `public`) and **0 to 10 star levels**.
- **Star level**: a number from 0 to 10 per player and game: the game's current verdict on the player, set by
  the game's server. It can go down (the casino is wealth-based: lose the money, lose the stars). The
  leaderboard ranks by the sum of current levels.
- **Gems**: the only global currency. Integers. **Only the hub creates gems.** Apps can only spend them
  (gems are burned) and refund their own spends.
- **Developer token**: a player's personal token (`pnxd_…`) for the developer API (§2a).

## Economy constants (hub)

| Constant | Value | Meaning |
|---|---|---|
| `STARTER_GEMS` | 50 | Granted once at sign-up |
| `DAILY_GEMS` | 10 | Added to the claim pile per day |
| `CLAIM_CAP_GEMS` | 100 | The unclaimed pile holds at most this (10 days) |
| `STAR_BOUNTY_BASE` | 1 | Reaching level n for the first time pays `n × 1` gems (55 for a completed game) |
| `UNVERIFIED_DAILY_SPEND_CAP` | 10 | Gems an unverified app may spend per player per day |
| Day boundary | `Europe/Amsterdam` midnight | |

Daily claim: the hub stores `claimed_through` (a date). Claimable = `min(CLAIM_CAP_GEMS, (today - claimed_through) × DAILY_GEMS)`
(a new account starts with `claimed_through = yesterday`, so day one is claimable). Claiming locks the row
(`SELECT … FOR UPDATE`), pays the pile, sets `claimed_through = today`.

Titles by total stars (fixed, never percentages): 0 Newcomer, 5 Rookie, 10 Regular, 20 Contender, 30 Veteran,
40 Expert, 50 Elite, 60 Master, 70 Champion, 80 Legend, 90 Mythic, 100 Immortal.
Titles follow the current total, so they can drop.

Price guide for apps (players earn 10 gems a day): small boost 3-5 gems, meaningful unlock 30-70, never above ~200.

## Trust: verification, drafts, connections

- **Verified apps.** Only an admin verifies an app. Unverified apps' games are listed and playable only for
  the app owner (and admins); verifying lists their public games for everyone. Their star levels don't count toward totals, titles or the leaderboard, they pay no
  bounties, and they may spend at most `UNVERIFIED_DAILY_SPEND_CAP` gems per player per Amsterdam day
  (400 beyond it). Levels and bests are stored; when the app is verified, earned bounties are paid once.
- **What counts.** Only games that are `public`, not retired, of an `active` and verified app count toward
  totals and titles. A disabled app's stars drop out automatically; nothing is deleted.
- **Drafts.** `visibility: 'draft'` games are visible and playable only by the app's owner and admins. The
  manifest default is `draft` for unverified apps and `public` for verified ones.
- **Connections.** The hub records a connection (player, app) whenever it mints a launch token for that
  pair. `GET /players/:id`, `POST /gems/spend` and `PUT /stars` return 403 for players who never connected.
- **Liveness.** Every `/api/v1` call marks the app as seen (`GET /api/v1/ping` exists for heartbeats). The
  hub shows a game as "offline?" when its app hasn't been seen for 24 h.
- **Rate limits** (per 10 s): 600 calls per verified app key, 60 per unverified app key, 60 per developer
  token. Over the limit: 429 with `Retry-After`.

## Local dev

| | Core | Casino |
|---|---|---|
| URL | `http://localhost:3100` | `http://localhost:3200` |
| Database | Postgres 17 (docker compose), `localhost:5433`, db/user/pass `pnxcore` | SQLite via `bun:sqlite`, file at `DATABASE_PATH` (default `./data/casino.sqlite`) |
| Container | `pnxcore-postgres` | none (the SQLite file is a volume in Docker) |
| Runtime | Bun for dev, build and production | Bun for dev, build and production |

Port 3000 and 5432 belong to the old `nuxtpolymarket` and must not be touched.

Dev seed (core `bun run db:seed`, idempotent, refuses to run in production): a dev admin user
`dev@polynux.local` / `devdevdev` (name `Dev`), and app `casino` (`name: "Polynux Casino"`,
`baseUrl: http://localhost:3200`, return URL prefix `http://localhost:3200/`, owner the dev admin,
**verified**) with API key from env `SEED_CASINO_APP_KEY` (default `pnx_dev_casino_key_change_me`).
The casino's `.env.example` uses the same key in `PNX_APP_KEY`. In production a first-party app is registered
either through the hub's `BOOTSTRAP_APPS` env (created verified on boot, key stored hashed; how the casino
is registered) or through the developer API (§2a) and then verified by an admin.

## 1. Identity: the launch token

The hub signs a short-lived JWT for exactly one app:

- Algorithm **ES256**. The key pair is generated once and stored in the hub DB (or env `PNX_SIGNING_JWK`).
- Public keys: `GET {CORE_URL}/.well-known/jwks.json` (standard JWKS, each key has a `kid`). Cache-friendly.
  On rotation a new `kid` signs and the old key stays published for 10 minutes.
- Claims: `iss = CORE_URL` (e.g. `http://localhost:3100`), `aud = <appId>`, `sub = <userId>`,
  `name`, `image` (string or null; always the player's current name and avatar), `title` (star title),
  `iat`, `exp = iat + 300`, `jti` (random).
- An app verifies it with `jose` (`createRemoteJWKSet` + `jwtVerify` with `issuer`, `audience` and
  `clockTolerance: 30`), then creates **its own** session. Apps never see or use the hub's session cookie. A
  `jti` may be accepted once (apps should remember used `jti`s until `exp`).
- Minting a token records the player's connection to the app.

### Flow A: inside the hub (iframe)

1. Player opens `{CORE_URL}/play/<gameSlug>` (must be logged in to the hub).
2. The hub mints a token and renders a full-height iframe of
   `{app.baseUrl}{game.playPath}#pnx=<token>` with
   `allow="fullscreen; pointer-lock; gamepad; autoplay; clipboard-write"` and
   `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads"`
   (no `allow-top-navigation`: a game can't navigate the hub). The shell also offers "open in new tab",
   which goes through flow B.
3. The app's page reads `#pnx`, strips it from the URL (`history.replaceState`), POSTs it to its own
   backend, which verifies it and sets the app session cookie.

### Flow B: on the app's own domain (redirect)

1. A player without an app session visits the app directly.
2. The app redirects to `{CORE_URL}/connect?app=<appId>&return=<urlencoded absolute url>`.
3. The hub requires login (bounces through its login page and back), checks that `return` is under one of
   the app's registered return URL prefixes (parsed: same origin, path under the prefix; otherwise 400),
   mints a token, and redirects to `<return>#pnx=<token>`.
4. Same as A.3.

### Cookies

On `*.avmg.nl` (same-site with the hub) and on `localhost`, the app's session cookie is
`SameSite=Lax; HttpOnly; Secure (in prod)`. An app on a foreign domain needs `SameSite=None; Secure; Partitioned`.
Apps make this configurable (`PNX_COOKIE_SAMESITE=lax|none`).

Apps send `Content-Security-Policy: frame-ancestors 'self' {CORE_URL}` on game pages.

### postMessage (app iframe ↔ hub parent)

The hub only accepts messages whose `event.origin` equals the app's origin and whose source is the game
iframe. Messages are `{ source: 'pnx', type, ...payload }`:

| type | payload | Hub reaction |
|---|---|---|
| `wallet` | `{ gems: number }` | Updates the gem count in the hub top bar |
| `star` | `{ game: string, stars: number }` | Refetches the player and shows the level moment |
| `title` | `{ title: string }` | Sets the document title shown in the hub top bar |
| `relaunch` | none | The app's session expired: the hub fetches a fresh launch token and reloads the iframe, at most once per 30 s |

The hub may send `{ source: 'pnx', type: 'hello', gems }` to the iframe after load. Apps must ignore
unknown types.

## 2. Server API (app → hub)

Base: `{CORE_URL}/api/v1`. Every call sends `Authorization: Bearer <app api key>`. The hub stores only a
SHA-256 hash of the key. JSON in, JSON out. Errors are `{ statusCode, statusMessage }` with 400 (bad
input / can't afford / over the unverified cap), 401 (bad key), 403 (not your game / not your spend /
player not connected), 404, 409 (idempotency key reused with different params), 429 (rate limited).
`statusMessage` names the field and what to fix.

### `PUT /manifest`

Declares this app's games and their star levels. Called by the app on boot (and on deploy). Upserts by slug.
A slug owned by another app is 403. Games or stars missing from a later manifest are marked retired
(never deleted). An optional top-level `repoUrl` sets the app's repo URL (the same field as in §2a; `null`
clears it, omitted leaves it as it is).

```json
{
  "repoUrl": "https://github.com/me/polynux-casino",
  "games": [
    {
      "slug": "casino",
      "name": "Polynux Casino",
      "tagline": "Slots, tables and high rollers",
      "description": "Markdown allowed",
      "playPath": "/",
      "icon": "https://…/icon.png or a lucide icon name like lucide:dices",
      "cover": "https image url or null",
      "accent": "#e0a100",
      "visibility": "public",
      "stars": [
        { "key": "peak-100k", "name": "Pocket change", "description": "Hold 100k coins" }
      ]
    }
  ]
}
```

Rules: 0-10 stars per game, `key` is `[a-z0-9-]{1,40}`. Entry n names **level n** (its name and what it
takes); the number declared is the game's max level, and level n pays n gems the first time a player
reaches it. `icon` and `cover` are https URLs (http only on localhost); `icon` may be `lucide:<name>`.
`visibility` defaults to `draft` for unverified apps and `public` for verified ones.
Response: `{ games: [{ slug, stars: number, visibility }] }`.

### `GET /players/:playerId`

`→ { id, name, image, gems, stars: number (counted total), title }`. 403 if the player never connected.

### `POST /gems/spend`

```json
{ "playerId": "…", "amount": 3, "game": "casino", "reason": "Convert 3 gems to 30k coins", "idempotencyKey": "uuid" }
```

- `amount` integer 1..100000. `game` must belong to this app. `idempotencyKey` 8..100 chars. The player
  must have connected (403).
- Debits atomically (`UPDATE user SET gems = gems - :a WHERE id = :p AND gems >= :a RETURNING gems`); 400
  `Not enough gems` otherwise. Ledger category is the game slug.
- Unverified apps: at most `UNVERIFIED_DAILY_SPEND_CAP` per player per Amsterdam day, enforced by a
  conditional upsert on a per-(app, player, day) counter inside the spend transaction; 400 beyond it.
  A refund frees the room again.
- Unique on `(app_id, idempotency_key)`. Replaying the same key with the same player, amount and game
  returns the original result (200, same `spendId`) without charging again; with different params → 409.
- `→ { spendId, gems }` (`gems` = balance after).

### `POST /gems/refund`

`{ "spendId": "…" }`. Only this app's spends, only within 24 h, only once (conditional update on a
`refunded_at IS NULL` row). Credits the amount back as a refund ledger row. `→ { gems }`.

### `PUT /stars`

`{ "playerId": "…", "game": "casino", "stars": 3, "seq": 1795253483123 }`

- Game must belong to this app and not be retired; `stars` is 0..(number of declared stars); the player
  must have connected (403).
- `seq` is a positive integer (≤ 2^53-1) the app increases with every change for that player and game, such
  as its ledger row id or a ms timestamp. The hub stores `(player, game) → stars, best_stars, seq,
  updated_at` and applies a set only when `seq` > the stored seq, so out-of-order or concurrent sets can't
  leave a stale value. A set with an old seq returns 200 with `applied: false` and the current value.
- **Bounty**: only when a set raises the player's personal best (`best_stars`), and only for the levels
  above what was already paid: n gems for each new level n, once. Losing and regaining levels pays nothing.
  Only games that count pay (public, not retired, active verified app); for an unverified app the best is
  stored and paid once when an admin verifies the app.
- `→ { applied, stars, best, bounty, total, title }` (`bounty` = gems paid by this call; `total` and
  `title` = the player's counted hub-wide total and title).
- Feed: the hub posts "reached ★n" / "dropped to ★n" for counted games; changes by the same player in
  the same game within 10 minutes collapse into one event.

### `GET /stars/:playerId?game=<slug>`

`→ { stars: [{ game, stars, best, seq, updatedAt }] }` (current level per game, only this app's games).

### `GET /ping`

`→ { ok, app, verified, time }`. Heartbeat; every `/api/v1` call counts as one.

## 2a. Developer API (player → hub)

Base: `{CORE_URL}/api/v1/developer`, `Authorization: Bearer pnxd_…`. Players create developer tokens in
their settings (`/settings/developer`; at most 10 active, shown once, SHA-256 hashed, revocable). Everything
else an app needs is available here, so a coding agent can do it end to end.

| Call | Body | Response |
|---|---|---|
| `GET /apps` | | `{ apps: App[] }` (the caller's apps) |
| `POST /apps` | `{ id, name, baseUrl, returnUrlPrefixes?, repoUrl? }` | 201 `{ app, apiKey }` (key shown once) |
| `GET /apps/:id` | | `{ app }` |
| `PATCH /apps/:id` | `{ name?, baseUrl?, returnUrlPrefixes?, repoUrl? }` | `{ app }` |
| `POST /apps/:id/rotate-key` | | `{ app, apiKey }` (old key stops at once) |
| `DELETE /apps/:id` | | `{ app }` (disabled, never deleted) |
| `GET /apps/:id/games` | | `{ app, games: [{ slug, name, visibility, counts, retired, playUrl, stars: [...] }] }` |
| `POST /apps/:id/test-launch` | `{ game? }` | `{ token, url, playerId, expiresIn }` |

- `App` = `{ id, name, baseUrl, returnUrlPrefixes, repoUrl, status, verified, verifiedAt, owner, createdAt, games, lastSeenAt }`.
- `id` is a slug (`[a-z0-9-]{2,40}`). At most 5 active apps per player. New apps are unverified.
- `baseUrl`: http(s), parsed and normalised (no trailing slash, no query or fragment); https is required in
  production except for localhost. `returnUrlPrefixes` default to `["{baseUrl}/"]` and must share the
  `baseUrl` origin.
- `repoUrl`: where the app's code lives, an https URL (any environment, at most 500 characters, no
  credentials or fragment), or `null`. `null` (or `""`) clears it. The hub links it from the app's game pages.
- `test-launch` mints a launch token for the token's owner (they become a connected test player) so an agent
  can exercise verify → session → spend → stars without a browser. Spends and sets against the owner follow
  the normal rules (real gems, the unverified cap, no bounty while unverified).
- Admins see and manage all apps in the hub's admin pages and verify them with
  `POST /api/admin/apps/:id/verify`.

## 3. Public hub API (for the hub UI, session-authenticated)

Not part of the app contract, listed so both sides agree on naming:
`GET /api/me`, `POST /api/gems/claim`, `GET /api/gems/history`, `GET /api/games`, `GET /api/games/:slug`,
`GET /api/leaderboard`, `GET /api/players/:id`, `GET /api/feed`, `GET /api/play/:slug/launch` (returns the
iframe URL with a fresh token), `/api/developer/tokens`, admin `GET/POST /api/admin/apps`,
`POST /api/admin/apps/:id/rotate-key`, `POST /api/admin/apps/:id/verify`.

## 4. Rules every app follows

- Fully playable with zero gems. Gems speed up, convert or decorate.
- Never let a client decide an outcome; payouts, rolls and star levels happen on the app server with a CSPRNG.
- Star levels are the game's current verdict on the player (0-10), set by the game server. The game decides
  whether they can drop. They must not be sold directly for gems.
- Report a level as soon as it changes, with an increasing `seq`; retry failed reports later with the same
  `seq` (the call is idempotent).
- Spend with one idempotency key per purchase; reuse it on retry.
- Price guide (10 gems/day): small boost 3-5, meaningful unlock 30-70, never above ~200.
