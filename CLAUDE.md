# Polynux core (the hub)

The hub of the Polynux play-money gaming site. It owns accounts and login, the **gem** wallet, **star
levels**, the leaderboard, the activity feed and the game registry. Games live in separate **apps** on their
own origins (`polymarketcasino` is the first; any player can register more through the developer API, and
most will be built by coding agents) and talk to the hub through the API in `docs/platform-contract.md`.
That contract is binding and shared with every app repo: change it only when it really improves things, and
then in every repo's copy at once. The agent-facing guide (`/developers.md`), the OpenAPI spec and the
reference game must stay in step with it.

## Stack

- Nuxt 4 (`app/` dir, SSR) + Vue 3, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`)
- shadcn-vue via `shadcn-nuxt` (components in `app/components/ui`, registered without prefix: `<Button>`),
  `lucide-vue-next`, `@vueuse/core`, `@nuxtjs/color-mode` (dark default), self-hosted fonts from `@fontsource/*` (imported in `main.css`;
  nothing is fetched from a font CDN at build or runtime)
- Drizzle ORM + PostgreSQL 17 (`node-postgres` driver), better-auth, `jose` (ES256 launch tokens), zod
- Look and feel: `docs/design.md` (tokens live in `app/assets/css/main.css`)

## Runtime: Bun everywhere

- **bun only** as package manager (`bun.lock` is the only lockfile; never npm/pnpm/yarn).
- Dev, build, tests and production all run on the Bun runtime: `bun --bun nuxt dev`, `bun --bun nuxt build`,
  `bun --bun vitest run`, `bun .output/server/index.mjs` (Nitro preset `bun`).
- The old site moved off Bun because its dev server leaked a TCP connection per request and its Nitro build
  ballooned. Checked here on 2026-11-21 (Bun 1.4.0, Nuxt 4.6.4): 1,600 sequential and parallel requests
  against the dev server and 1,100 against the production server left the open sockets flat (only the
  listener plus the Postgres pool, capped at `DATABASE_POOL_MAX`). A full `bun --bun nuxt build` peaked at
  about 2.0-2.2 GB RSS against about 1.5 GB on Node, for a 4-5 s build. A dev process showing ~30 TCP
  sockets is normal: up to `DATABASE_POOL_MAX` (20) Postgres connections under load, which close after 30 s
  idle, plus the browser's keep-alive and HMR sockets. Rechecked after 1,100 more requests: back to the
  listener plus two browser sockets once idle. If either problem appears as the
  app grows, measure it again (`lsof -nP -a -p <pid> -iTCP | wc -l`, `/usr/bin/time -l bun run build`),
  write the numbers here, and only fall back to Node for the one step that breaks (for example
  `node node_modules/nuxt/bin/nuxt.mjs build` in the Dockerfile).
- Vitest's default `forks` pool can't start workers under Bun; `vitest.config.ts` uses `pool: 'threads'`.

## Layout

- `app/`: pages, layouts, middleware, composables, utils (auto-imported), `components/ui` (shadcn),
  `components/pnx` (hub components, used as `<PnxGemChip>`)
- `server/api/`: session API for the hub UI; `server/api/v1/`: the app API (app key, contract §2) and
  `server/api/v1/developer/` (developer token, contract §2a); `server/api/v1/openapi.json.get.ts`
- `server/routes/`: `/connect` (flow B), `/.well-known/jwks.json`, `/healthz`, `/developers.md`, `/llms.txt`,
  `/developers/hello-game/<file>`
- `server/middleware/app-auth.ts`: Bearer auth, rate limits and app liveness for every `/api/v1/**` request;
  `server/middleware/csrf.ts`: refuses cookie-API writes (`/api/**` outside `/api/auth` and `/api/v1`) from
  other sites, including games on the hub's own site
- `server/plugins/`: `bootstrap-apps.ts` (creates the apps in `BOOTSTRAP_APPS` on start), `config-check.ts`
  (production refuses to start without its public URL)
- `server/utils/`: all logic; handlers stay thin. `gems.ts` (the only writer of `user.gems`), `claim.ts`,
  `welcome.ts`, `stars.ts` (levels, bounties, verification, what counts), `spends.ts` (idempotency, the
  unverified cap), `connections.ts`, `manifest.ts`, `apps.ts`, `app-registry.ts` (create/update apps,
  shared by admin and developer API), `developer-tokens.ts`, `launch-token.ts` (ES256 keys, rotation),
  `launch.ts`, `hub.ts` (read models), `rate-limit.ts`, `openapi.ts`, `developer-docs.ts`, `auth.ts`, `validate.ts`,
  `csrf.ts`, `bootstrap-apps.ts`, `emblem.ts` (save, trim and list emblem history)
- `shared/`: code for client and server. `economy.ts` (constants, titles, bounties, the claim pile,
  Amsterdam days), `app-urls.ts` (base/return/image/repo URL rules), `return-url.ts`, `random.ts`,
  `gem-history.ts`, `emblem.ts` (the drawn avatar: format, limits, `serializeEmblem`), `prestige.ts`
  (ring tiers 0-4, display only), `developer-guide.ts` + `guide/developer-guide.md` (the one source of `/developers.md`
  and the `/developers` copy block), `types/api.ts` (every session API response shape)
- `examples/hello-game/`: the reference integration (one Bun file + one HTML page), served raw to agents
- `server/database/schema.ts` + `drizzle/` (generated migrations, committed)
- `scripts/`: one-off tools and balance simulations, run with `bun scripts/<name>.ts` (`seed.ts` is the dev seed)
- `test/`: vitest. Pure logic at the top level, DB tests in `test/db/` (they run against `pnxcore_test`)
- `docs/frontend-handoff.md`: composables, routes and components for UI work

Import with `#server/…` and `#shared/…` (Nuxt aliases; `package.json#imports` makes them work in Bun scripts).
Server code imports h3 helpers (`createError`, `defineEventHandler`, …) explicitly so it also runs in tests
and scripts.

## Economy rules

- **Only the hub creates gems**: the welcome grant (`STARTER_GEMS`, claimed once through `welcome_granted`),
  the daily claim (a pile of `DAILY_GEMS` a day up to `CLAIM_CAP_GEMS`) and star bounties (`'admin'` is a
  reserved ledger category for manual grants; there is no endpoint for them yet).
  Apps only spend gems (they are burned) and refund their own spends.
- **Never update `user.gems` directly.** Use `creditGems` / `debitGems` from `server/utils/gems.ts`. Each
  write is one conditional UPDATE plus one `gem_transactions` row with the signed amount and the balance
  after it, so `sum(amount)` per player always equals `user.gems` (the tests assert this).
- `debitGems` throws 400 `Not enough gems`; don't pre-check.
- Ledger `category` is the game slug, or `'daily'`, `'welcome'`, `'admin'` (so the manifest refuses those three as slugs). A credit that returns the
  player's own gems (a refunded spend) passes `{ refund: true }`. Spends, refunds and bounties carry `appId`.
- **Stars are levels** (0-10 per player and game, `player_stars`): the game's current verdict, which can go
  down. A set applies only with a higher `seq`. Bounties pay once per level, only for new personal bests
  (`paid_best` trails `best_stars`), and only in games that count.
- **What counts** (`countedGame()` in `stars.ts`): public, not retired, active and verified app. Totals,
  titles and the leaderboard use current levels in those games only. Manifests retire, never delete.
- **Untrusted apps**: unverified apps pay no bounties (paid at verification, once), their stars don't
  count, and their spends are capped per player per day. Apps may only act on players who connected
  (got a launch token for them). Drafts are visible only to the owner and admins. Game iframes are
  sandboxed without top navigation.
- Constants live in `shared/economy.ts`. Day boundary: Europe/Amsterdam midnight (`amsterdamDay()`).

## Concurrency: never read-then-write value

Assume every endpoint that grants or spends value gets a burst of parallel requests. A `SELECT` check
followed by an `UPDATE` is always a bug; the mutation must be the guard:

- **Claim-then-reward**: a conditional write that only one request can win, then pay if a row came back.
  Refunds flip `refunded_at` with `WHERE refunded_at IS NULL`; the welcome grant flips `welcome_granted`;
  spends insert the `(app_id, idempotency_key)` row in the same transaction as the debit; bounties move
  `paid_best` with an integer compare-and-set; the unverified spend cap is an upsert whose `WHERE` holds
  `spent + amount <= cap`.
- **Lock-then-read**: `SELECT … FOR UPDATE` inside a transaction, read inside the lock (the daily claim locks
  the user row before reading `claimed_through`; star sets lock the player, then read the level row; token
  and app limits lock the owner before counting).
- **Lock order** for anything that touches apps and players: app row (`FOR SHARE` in spends and star sets,
  `FOR UPDATE` in verification) → player row → level rows. Keep it, or verification deadlocks against sets.
- **Inside a `db.transaction()`, pass `tx`** as the last argument to every helper
  (`creditGems(userId, n, category, options, tx)`). A write on a second pool connection waits on your own
  lock and deadlocks.
- **Never compare-and-swap on a timestamp column** (Postgres keeps microseconds, JS `Date` milliseconds).
  Integer, boolean and `IS NULL` guards are fine.
- Self-check: if the same request runs twice at once, the second must not pay or charge again. Every new
  value endpoint gets a burst test in `test/db/`.

## Randomness

Never `Math.random()` for ids, keys, outcomes or amounts. Use `shared/random.ts` (`randomId`, `randomToken`,
`randomInt`, `randomFloat`), which sit on `crypto`. `Math.random()` is only for cosmetic effects.

## Server conventions

- Session endpoints: `requireUser(event)` (401), `requireAdmin(event)` (403), `getSessionUserId(event)` for
  public endpoints that personalise. Admin = `role = 'admin'` or an email in `ADMIN_EMAILS`.
- App endpoints: `requireApp(event)`; developer endpoints: `requireDeveloper(event)` (the middleware
  already rejected bad credentials and rate-limited). An app may only touch its own games, spends and
  connected players (403 otherwise); a developer only their own apps (404 otherwise).
- `/api/v1` errors are read by coding agents: `statusMessage` names the field and says what to fix
  (`returnUrlPrefixes[0] must share the app's baseUrl origin (…)`). Keep it that way, and keep
  `server/utils/openapi.ts`, `shared/guide/developer-guide.md` and `examples/hello-game/` in step with any
  `/api/v1` change.
- Validate input with zod through `parseBody` / `parseQuery` (`server/utils/validate.ts`): 400 with the
  first issue as `statusMessage`.
- Errors are `createError({ statusCode, statusMessage })`; apps read `statusMessage`.
- Read models must not loop queries per row: fetch in a fixed number of queries and join in memory
  (`server/utils/hub.ts`).

## Client conventions

- `useMe()` is the signed-in player (`me`, `refresh()`, `setGems(n)`, `patch()`), loaded once per page load
  by `plugins/me.ts`. When a response carries the new balance, call `setGems`, don't refetch.
- `apiFetch<T>(url, opts)` (SSR-safe, forwards cookies) with types from `#shared/types/api`;
  `apiErrorMessage(e, fallback)` for error text; `formatNumber(value, compact = true)` for every gem amount.
- **Toasts are for errors and failures only** (`toast.error`/`toast.warning` from `vue-sonner`). Never success
  toasts: the UI updating is the feedback. The Toaster is mounted once in `app.vue`; its stylesheet is
  imported in `main.css`.
- Keep page logic in composables (`app/composables/`) so pages stay presentational.

## Schema changes

Edit `server/database/schema.ts`, run `bun run db:generate` (commit the generated `drizzle/NNNN_*.sql`) and
`bun run db:migrate`. drizzle-kit can't answer its rename prompt without a TTY: when a table is replaced,
generate the add and the drop as two steps. Data backfills are appended to the generated SQL. Deploys run `drizzle-kit migrate` in `docker-entrypoint.sh`. **Never put `db:push` in
the deploy path**: it prompts on destructive diffs, a container can't answer, and it exits 0 having applied
nothing.

## Code style

- `server/`, `shared/`, `test/`, `scripts/`: 4-space indent. Elsewhere match the file (generated shadcn
  components keep their own style).
- No semicolons, single quotes, no trailing commas, 1tbs braces.

## Production

- Docker: Bun image, `HOST=0.0.0.0`, `PORT=3000`, `/healthz` checks the database. Set `BETTER_AUTH_URL` and
  `CORE_URL` to the https URL (Secure cookies follow; production refuses to start without one of them);
  behind a proxy x-forwarded-proto/host are honoured. `TRUSTED_ORIGINS` adds auth origins.
- **The seed never runs in production** (it refuses). The casino comes from `BOOTSTRAP_APPS` (created once on
  start, verified, no owner; never overwritten, so key rotations on `/admin/apps` stick). Other apps register
  through the developer API and get verified by an admin.
- `ADMIN_EMAILS` trusts unverified emails: whoever signs up with a listed email first is admin. Sign the
  admin account up right after the first deploy.
- Launch-token keys: generated once and stored in `signing_keys`. Rotate with
  `bun scripts/rotate-signing-key.ts` from a checkout with `DATABASE_URL` pointing at the database (the image
  has no scripts): the new key signs within a minute, the old one stays in the JWKS for 10 minutes. With
  `PNX_SIGNING_JWK` set, rotate by changing the env var instead.
- There is no email provider: admins create one-time password reset links on `/admin/apps` (valid an hour,
  single use; a reset signs the player out everywhere). The public reset request route is disabled.
- Rate limits are in memory per process (`server/utils/rate-limit.ts`); with several replicas each has its own.

## Workflow

- **Before any commit**: `bun run typecheck` and `bun run test` must both pass (`nuxt build` does not
  typecheck). DB tests need the compose Postgres (`docker compose up -d`); they create and migrate
  `pnxcore_test` themselves and never touch the dev database.
- Balance checks and simulations go in `scripts/`, never in tests. Tests cover rules and correctness.
- Never run destructive commands (`drop database`, wiping tables) on the dev database unless asked.
- Commits only when asked: short imperative subject, split by concern.
- Branches: `feature/…` or `bugfix/…` in kebab-case from an up-to-date `main`. PR title is the branch name.
