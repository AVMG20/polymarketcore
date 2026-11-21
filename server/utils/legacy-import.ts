import { serializeEmblem } from '#shared/emblem'
import { addDays, amsterdamDay } from '#shared/economy'
import { checkImageUrl } from '#shared/app-urls'
import { fitName } from '#server/utils/auth'

/**
 * Accounts from the old site (polymarket.avmg.nl): logins, emblems and the
 * prestige tier. `scripts/import-legacy.ts` feeds an export of its `user`,
 * `account` and `emblem_history` rows through `legacyImportStatements()`.
 *
 * Every statement is self-contained and idempotent, so the whole list can run
 * again (to pick up players who joined the old site later) and can be sent in
 * batches through a SQL console. A player is matched on email: one who already
 * signed up on the hub keeps their account, name and password, and gains the
 * old emblem, prestige and any login method (Discord) they did not have yet.
 */

export interface LegacyUser {
    id: string
    name: string
    email: string
    email_verified: boolean | string
    image: string | null
    emblem: string | null
    prestige: number
    created_at: string
}

export interface LegacyAccount {
    id: string
    account_id: string
    provider_id: string
    user_id: string
    password: string | null
    scope: string | null
    created_at: string
}

export interface LegacyEmblem {
    id: string
    user_id: string
    emblem: string
    created_at: string
}

export interface LegacyExport {
    users: LegacyUser[]
    accounts: LegacyAccount[]
    emblemHistory: LegacyEmblem[]
}

const PROVIDERS = new Set(['credential', 'discord'])

function lit(value: string | number | boolean | null): string {
    if (value === null) return 'null'
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) throw new Error(`Not an integer: ${value}`)
        return String(value)
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    return `'${value.replace(/'/g, '\'\'')}'`
}

/** The old database stored UTC wall-clock times without a zone. */
function ts(value: string): string {
    return `(${lit(value)}::timestamp at time zone 'UTC')`
}

function bool(value: boolean | string): boolean {
    return value === true || value === 'true' || value === 't'
}

/** The hub user an email belongs to, after the insert below. */
function target(email: string): string {
    return `(select id from "user" where lower(email) = lower(${lit(email)}))`
}

export function legacyImportStatements(data: LegacyExport, today = amsterdamDay()): string[] {
    const statements: string[] = []
    const users = new Map(data.users.map(u => [u.id, u]))
    const yesterday = addDays(today, -1)

    for (const u of data.users) {
        const name = fitName(u.name) || 'Player'
        const image = u.image && checkImageUrl(u.image, 'image').ok ? u.image : null
        const emblem = serializeEmblem(u.emblem)
        const prestige = Math.min(Math.max(Math.trunc(Number(u.prestige) || 0), 0), 4)

        // New on the hub: welcome_granted stays false, so /api/me pays the starter gems on the first visit.
        statements.push(`insert into "user" (id, name, email, email_verified, image, emblem, prestige, gems, role, claimed_through, welcome_granted, created_at, updated_at)
select ${lit(u.id)}, ${lit(name)}, ${lit(u.email.toLowerCase())}, ${lit(bool(u.email_verified))}, ${lit(image)}, ${lit(emblem)}, ${lit(prestige)}, 0, 'player', ${lit(yesterday)}, false, ${ts(u.created_at)}, now()
where not exists (select 1 from "user" where lower(email) = lower(${lit(u.email)}))
on conflict (id) do nothing`)

        // Already on the hub: keep what they set there, add what only the old site had.
        // The emblem only fills an empty one nobody touched on the hub (no history), so a re-run
        // doesn't bring back an emblem the player cleared.
        statements.push(`update "user" set emblem = case when emblem is null and not exists (select 1 from emblem_history h where h.user_id = "user".id) then ${lit(emblem)} else emblem end, prestige = greatest(prestige, ${lit(prestige)}), image = coalesce(image, ${lit(image)}), email_verified = email_verified or ${lit(bool(u.email_verified))}
where lower(email) = lower(${lit(u.email)})`)
    }

    for (const a of data.accounts) {
        const u = users.get(a.user_id)
        if (!u || !PROVIDERS.has(a.provider_id)) continue
        if (a.provider_id === 'credential' && !a.password) continue
        // better-auth keys a password login by the user id; a Discord login by the Discord user id.
        const accountId = a.provider_id === 'credential' ? target(u.email) : lit(a.account_id)
        statements.push(`insert into account (id, account_id, provider_id, user_id, password, scope, created_at, updated_at)
select ${lit(a.id)}, ${accountId}, ${lit(a.provider_id)}, ${target(u.email)}, ${lit(a.provider_id === 'credential' ? a.password : null)}, ${lit(a.scope)}, ${ts(a.created_at)}, now()
where ${target(u.email)} is not null
and not exists (select 1 from account where user_id = ${target(u.email)} and provider_id = ${lit(a.provider_id)})
and not exists (select 1 from account where provider_id = ${lit(a.provider_id)} and account_id = ${accountId})
on conflict (id) do nothing`)
    }

    for (const h of data.emblemHistory) {
        const u = users.get(h.user_id)
        const emblem = serializeEmblem(h.emblem)
        if (!u || !emblem) continue
        statements.push(`insert into emblem_history (id, user_id, emblem, created_at)
select ${lit(h.id)}, ${target(u.email)}, ${lit(emblem)}, ${ts(h.created_at)}
where ${target(u.email)} is not null
on conflict (id) do nothing`)
    }

    return statements
}
