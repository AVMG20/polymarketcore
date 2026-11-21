# Front-end handoff

The backend, auth, data layer and a minimal UI are in place. This file lists what to build on. Every
response type below is exported from `shared/types/api.ts` (import from `#shared/types/api`); the economy
constants and title helpers are in `shared/economy.ts`. Look and feel: `docs/design.md`. The app side of the
platform is in `docs/platform-contract.md`.

## Ground rules

- Toasts only for errors and failures (`toast.error` from `vue-sonner`). No success toasts.
- Every gem amount goes through `formatNumber(value, compact = true)` and shows in the gem chip; stars in the
  star chip. Numbers use the `tabular` utility (JetBrains Mono, tabular-nums).
- When a response carries the new balance, call `useMe().setGems(n)` instead of refetching.
- Keep page logic in composables; pages stay presentational.
- `bun run typecheck` and `bun run test` must pass.

## The model in one paragraph

Players get 50 gems once and 10 a day into a claim pile that holds at most 100 ("x / 100 ready, full in N
days"). Each game gives each player a **star level from 0 to 10** that can go down; the player's total is the
sum of current levels in games that **count** (public, verified app, not retired). Titles follow the total and
can drop. Games of **unverified** apps are playable in a "New" section but don't count. **Drafts** are only
visible to their owner and admins. A game is "offline?" when its app hasn't called the hub for 24 h.

## Composables (`app/composables/`, auto-imported)

| Composable | Gives you |
|---|---|
| `useMe()` | `me: Ref<Me \| null>`, `loaded`, `loggedIn`, `isAdmin`, `refresh()`, `setGems(n)`, `patch(changes)`, `clear()`. Loaded once per page load by `plugins/me.ts`. |
| `useClaim()` | `claim()`, `pending`, `canClaim`, `claimableGems`, `pile` (`{ days, gems, cap, fullInDays }` for "x / 100 ready, full in N days"), `lastClaimed` (drive the gem-flight moment from it). Toasts on failure. |
| `useAuthActions()` | `signIn`, `signUp`, `signInWithDiscord`, `signOut`, `pending`, `error`, `redirectTarget` (honours `?redirect=`; `/connect` gets a full navigation). |
| `useHubConfig()` | `GET /api/config` → `{ discord }`. |
| `useProfile()` | `name`, `image` refs, `save()` (better-auth `updateUser`; the server validates), `pending`, `error`. |
| `useDeveloperTokens()` | `tokens`, `max`, `create(name)`, `revoke(id)`, `revealed` (`{ token, secret }`: the secret is shown once), `busy`. |
| `useDeveloperGuide()` | `markdown` (the text of `/developers.md`), `copy()`, `copied`. |
| `usePnxBridge(iframeRef, appOrigin, { onStar, onRelaunch })` | The iframe postMessage bridge (contract §1), origin- and source-checked: `wallet` sets gems, `star { game, stars }` refetches `useMe` and sets `lastStar` (`{ game, stars, at }`), `title` sets `gameTitle`, `relaunch` calls `onRelaunch` at most once per 30 s. `sendHello()` on iframe `load`. |
| `useGameLaunch(slug)` | Client-only `GET /api/play/:slug/launch`: `launch` (`{ url, directUrl, app, game }`), `error`, `pending`, `reload()`. |
| `useGames()`, `useGame(slug)`, `useLeaderboard(limit, offset)`, `usePlayerProfile(id)`, `useFeed()`, `useGemHistory(page, pageSize)` | `useAsyncData` wrappers over the read endpoints below. |
| `useAdminApps()` | `apps`, `create`, `rotateKey`, `update`, `verify(id)`, `resetLink(email)`, `revealedKey`, `busy`. |

Utils (`app/utils/`, auto-imported): `apiFetch<T>(url, opts)` (SSR-safe), `apiErrorMessage(e, fallback)`,
`apiErrorStatus(e)`, `formatNumber(value, compact)`, `timeAgo(iso)`, `safeRedirect(raw)`, `authClient`.
Route middleware: `auth`, `guest`, `admin`.

## Session API (cookie auth)

All errors are `{ statusCode, statusMessage }`. Dates are ISO strings.

| Route | Auth | Response |
|---|---|---|
| `GET /api/me` | user (401 signed out) | `Me`: `{ id, name, email, image, gems, stars (counted total), title, nextTitle, claimable: { days, gems, cap, fullInDays }, role, createdAt }`. Also retries a failed welcome grant. |
| `POST /api/gems/claim` | user, 5 per 10 s | `{ gems, claimed, days }` |
| `GET /api/gems/history?page&pageSize` | user | `{ items: [{ id, kind: 'welcome'\|'daily'\|'admin'\|'spend'\|'refund'\|'bounty', gameName, amount (signed), balanceAfter, category, refund, appId, meta, createdAt }], page, pageSize, total }` |
| `GET /api/games` | public, personalised | `{ games: GameSummary[] }`, verified apps first. `GameSummary`: `{ slug, name, tagline, description (markdown), playPath, icon (url or `lucide:name`), cover, accent, position, visibility, counts, offline, app: { id, name, origin, verified }, stars: StarLevel[], maxStars, me: { stars, best } \| null }`. `StarLevel`: `{ key, position (level), name, description, bounty, holders (players at ≥ this level) }`. Split into Games (`app.verified`), New (`!app.verified`) and Your drafts (`visibility === 'draft'`). |
| `GET /api/games/:slug` | public | `{ game, topPlayers: [{ id, name, image, stars, best }], recent: FeedEvent[] }` |
| `GET /api/leaderboard?limit&offset` | public | `{ entries: [{ rank, id, name, image, stars, title, heldSince, games: { [slug]: level } }], total, me }`. Ties go to whoever has held their total longest. |
| `GET /api/players/:id` | public | `{ player: { id, name, image, stars, title, nextTitle, rank, joinedAt }, tracks: StarTrack[], recent: FeedEvent[] }`. `StarTrack`: `{ game, name, icon, accent, counts, verified, retired, stars, best, maxStars, updatedAt, levels: [{ key, position, name, description }] }` (public games the player has a level in). |
| `GET /api/feed?before=<iso>` | public | `{ events: [{ id, type: 'star'\|'claim'\|'join'\|'title', player, payload, createdAt }] }` (50). Star payload: `{ game, gameName, from, stars, direction: 'up'\|'down', name, total }` → "reached ★3" / "dropped to ★1". |
| `GET /api/play/:slug/launch` | user | `{ url (iframe src with #pnx), directUrl (/connect path for "open in new tab"), app: { id, origin }, game: { slug, name } }`. Never cache it. |
| `GET /api/config` | public | `{ discord }` |
| `GET/POST /api/developer/tokens`, `DELETE /api/developer/tokens/:id` | user | `{ tokens, max }` / `{ token, secret }` / `{ revoked: true }` |
| `GET /api/admin/apps` | admin | `{ apps: AppInfo[] }`: `{ id, name, baseUrl, returnUrlPrefixes, status, verified, verifiedAt, owner, createdAt, games, lastSeenAt }` |
| `POST /api/admin/apps` | admin | `{ id, name, baseUrl, returnUrlPrefixes? }` → `{ app, apiKey }` |
| `POST /api/admin/apps/:id/rotate-key` | admin | `{ app, apiKey }` |
| `PATCH /api/admin/apps/:id` | admin | `{ name?, baseUrl?, returnUrlPrefixes?, status? }` → `{ app }` |
| `POST /api/admin/apps/:id/verify` | admin | `{ app, paid: { players, gems } }` |
| `POST /api/admin/password-reset` | admin | `{ email }` → `{ url, expiresInMinutes }` (one-time link to `/reset-password`) |
| `/api/auth/**` | | better-auth (use `authClient`) |

Outside `/api`: `/connect`, `/.well-known/jwks.json`, `/healthz`, `/developers.md`, `/llms.txt`,
`/developers/hello-game/<file>`, and the machine API under `/api/v1` (see `/api/v1/openapi.json`).

## Components

- shadcn-vue in `app/components/ui`, auto-registered without prefix (`<Button>`, `<Card>`, …): button
  (extra variants `chunky` and `gem` with the press shadow), card, input, label, dialog, dropdown-menu,
  avatar, badge, tooltip, tabs, table, skeleton, sonner, separator, sheet, scroll-area. Add more with
  `bunx --bun shadcn-vue@latest add <name>`; it writes to `./components/ui` at the repo root, so move the
  folder into `app/components/ui` and replace the `"cn"` import with `"@/lib/utils"` and `"@lucide/vue"`
  with `"lucide-vue-next"` (then `bun remove cn @lucide/vue` if it added them).
- `app/components/pnx/` (used as `<PnxGemChip>` etc.), deliberately plain: `GemGlyph`, `StarGlyph`,
  `GemChip` (`amount`, `compact`), `StarChip` (`count`), `StarTrack` (`levels`, `stars`, `best`: filled up to
  the current level, outlined up to the best, names in tooltips), `AppHeader`.
- Tailwind tokens: `bg-gem`, `text-gem`, `bg-star`, `text-star`, `text-star-foreground`, `bg-coin`,
  `bg-success`, plus the shadcn set; fonts `font-display`, `font-sans`, `font-mono`; utility `tabular`.
- Layouts: `default` (header + centred main), `bare` (full screen, used by `/play/:slug`).

## Pages

Built (minimal, restyle them): `/login`, `/register`, `/reset-password`, `/` (player card with the claim
pile + game sections), `/leaderboard`, `/play/[slug]` (sandboxed iframe shell with a slim top bar, the
bridge, relaunch and "open in new tab"), `/settings` (name and avatar), `/settings/developer` (tokens:
create, list, revoke), `/developers` (flow, two steps, the agent brief with a copy button), `/gems` (plain
history table), `/admin/apps` (apps, verify, keys, reset links).

Still to build or polish:

- **Landing** for signed-out visitors (today `/` shows a small hero card)
- **Dashboard** for signed-in players: wallet, the claim pile filling toward 100 with the gem-flight moment,
  title progress (titles can drop), recent level changes, feed preview
- **Games grid** with covers, accents, level tracks, the "New" section (unverified: say stars don't count
  yet), "Your drafts", and "offline?" badges
- **Game detail** `/games/[slug]`: description (markdown), the levels with bounties and holders, top players,
  recent feed, play button
- **Leaderboard** proper: per-game level columns, the viewer's row pinned, paging
- **Player profile** `/players/[id]`: title, rank, level tracks per game (current and best), recent feed
- **Settings** `/settings`: polish profile; add password change and linked Discord (`authClient.changePassword`, `linkSocial`)
- **Developer tokens** `/settings/developer`: polish (it works)
- **Developers** `/developers`: polish the flow visual and the copy block (keep the human part very short)
- **Gem history** `/gems`: labels per kind, game names, refunds and bounties marked, paging
- **Activity feed** `/feed`: infinite scroll with `before`; render "reached ★n" / "dropped to ★n"
- **Level moment** on `/play/[slug]` (today a small "★n" badge driven by `lastStar`)
