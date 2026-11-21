# Polynux core

The hub of Polynux: accounts, the gem wallet, star levels, the leaderboard, the activity feed and the
registry of game apps. Any player can connect their own game through the developer API. Games run in their own apps (first one: `polymarketcasino`) and connect through
[`docs/platform-contract.md`](docs/platform-contract.md).

## Setup

Needs [Bun](https://bun.sh) 1.4+ and Docker.

```sh
bun install
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d          # Postgres 17 on localhost:5433 (container pnxcore-postgres)
bun run db:migrate
bun run db:seed               # casino app + admin dev@polynux.local / devdevdev
bun run dev                   # http://localhost:3100
```

| | Port |
|---|---|
| Hub (this repo) | 3100 |
| Postgres (compose) | 5433, db/user/pass `pnxcore` |
| Casino app | 3200 (SQLite, no container) |

Ports 3000 and 5432 belong to the old site; leave them alone.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on 3100 (Bun runtime) |
| `bun run build` / `bun run preview` | Production build (Nitro `bun` preset) and serve it on 3100 |
| `bun run typecheck` | vue-tsc over app, server, shared, tests and scripts |
| `bun run test` | Vitest. DB tests create and migrate `pnxcore_test` on the compose Postgres |
| `bun run db:generate` | Generate a migration from `server/database/schema.ts` (commit it) |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed` | Idempotent dev seed (refuses in production) |
| `bun scripts/rotate-signing-key.ts` | Rotate the launch-token key (old key stays published 10 min). For production, run it from a checkout with `DATABASE_URL` set to the production database |

## Environment

| Variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public hub URL for better-auth (`http://localhost:3100`) |
| `CORE_URL` | Public hub URL used as the launch token issuer (defaults to `BETTER_AUTH_URL`; production needs one of the two) |
| `SEED_CASINO_APP_KEY` | API key the seed gives the casino app (must equal the casino's `PNX_APP_KEY`) |
| `ADMIN_EMAILS` | Comma-separated emails that are admins regardless of role. Emails aren't verified: sign the admin up right after the first deploy |
| `TRUSTED_ORIGINS` | Optional extra origins for the auth API (comma-separated) |
| `BETTER_AUTH_DISCORD_CLIENT_ID` / `_SECRET` | Optional. Discord login appears only when both are set |
| `PNX_SIGNING_JWK` | Optional ES256 private JWK (JSON). Otherwise a key pair is generated on first use and stored in `signing_keys` |
| `DATABASE_POOL_MAX` | Optional, default 20 |
| `BOOTSTRAP_APPS` | Optional JSON array of `{ id, name, baseUrl, returnUrlPrefixes?, key }`: apps created on start (verified, no owner), never overwritten. How the casino gets registered in production |
| `TEST_DATABASE_URL` | Tests only; defaults to the `DATABASE_URL` database with `_test` appended |

## Connecting a game (any player, through the API)

1. Sign in, open `/settings/developer`, create a developer token (`pnxd_…`, shown once).
2. Give your coding agent the token and the brief from `/developers` (the same text is served at
   `/developers.md`; the API is described at `/api/v1/openapi.json`, and `/llms.txt` points at both).
3. The agent registers the app (`POST /api/v1/developer/apps` → app key), pushes the manifest, and tests the
   whole loop with `POST /api/v1/developer/apps/:id/test-launch`, no browser needed.
4. New apps are unverified: playable under "New", stars don't count yet, no bounties, spends capped at 10
   gems per player a day. An admin verifies an app on `/admin/apps` (or `POST /api/admin/apps/:id/verify`);
   earned bounties are then paid once.

The reference integration is `examples/hello-game/` (one Bun file, one HTML page). Run it against the local hub:

```sh
PNX_HUB_URL=http://localhost:3100 PNX_APP_ID=<app id> PNX_APP_KEY=pnx_… bun examples/hello-game/server.ts
```

Admins can also create apps on `/admin/apps` (owned by the admin, unverified until verified), rotate keys,
enable or disable apps, and create one-time password reset links for players.

## Docker

`Dockerfile` installs, builds and serves on Bun. `docker-entrypoint.sh` runs `drizzle-kit migrate` and then
starts the server on `HOST`/`PORT` (`0.0.0.0:3000`); the image's healthcheck calls `/healthz`. Provide the
environment variables above (`.env.example` lists the production values). Never run the seed in production.

The first-party casino is registered through `BOOTSTRAP_APPS`: generate a key (`echo "pnx_$(openssl rand -hex 32)"`),
put it in the hub's `BOOTSTRAP_APPS` and in the casino's `PNX_APP_KEY`:

```sh
BOOTSTRAP_APPS='[{"id":"casino","name":"Polynux Casino","baseUrl":"https://casino.avmg.nl","key":"pnx_…"}]'
```

On start the hub creates the app, verified and without an owner (manage it on `/admin/apps`), and logs
`[bootstrap] app casino: created`. Later starts leave it untouched, so a key rotated on `/admin/apps` stays
rotated (put the new key in the casino's `PNX_APP_KEY`; the old one in `BOOTSTRAP_APPS` is then ignored). Invalid JSON or an
invalid entry stops the server.
