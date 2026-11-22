/**
 * Hub economy constants (docs/platform-contract.md, "Economy constants").
 * Only the hub creates gems: the welcome grant, the daily claim, star bounties
 * and admin grants. Apps only spend them and refund their own spends.
 */

export const STARTER_GEMS = 50
export const DAILY_GEMS = 10
/** Unclaimed daily gems pile up to this many; players have to claim now and then. */
export const CLAIM_CAP_GEMS = 100
/** Days it takes the pile to fill: CLAIM_CAP_GEMS / DAILY_GEMS. */
export const CLAIM_MAX_DAYS = Math.floor(CLAIM_CAP_GEMS / DAILY_GEMS)
/** Star n (1-10) pays n x STAR_BOUNTY_BASE gems: 55 for a completed game. */
export const STAR_BOUNTY_BASE = 1
export const MAX_STARS_PER_GAME = 10

/** Gems an unverified app may spend per player per Amsterdam day. */
export const UNVERIFIED_DAILY_SPEND_CAP = 10

/** Developer API limits per player. */
export const MAX_DEVELOPER_TOKENS = 10
export const MAX_DEVELOPER_APPS = 5

export const DAY_TIME_ZONE = 'Europe/Amsterdam'

/** Star titles by total stars, lowest first. Fixed counts, never percentages. */
export const TITLES = [
    { name: 'Newcomer', stars: 0 },
    { name: 'Rookie', stars: 5 },
    { name: 'Regular', stars: 10 },
    { name: 'Contender', stars: 20 },
    { name: 'Veteran', stars: 30 },
    { name: 'Expert', stars: 40 },
    { name: 'Elite', stars: 50 },
    { name: 'Master', stars: 60 },
    { name: 'Champion', stars: 70 },
    { name: 'Legend', stars: 80 },
    { name: 'Mythic', stars: 90 },
    { name: 'Immortal', stars: 100 }
] as const

export type TitleName = typeof TITLES[number]['name']

/** The title a player holds with `stars` total stars. */
export function titleFor(stars: number): TitleName {
    let title: TitleName = TITLES[0].name
    for (const t of TITLES) {
        if (stars >= t.stars) title = t.name
    }
    return title
}

/** The next title up and how many stars it takes, or null at the top. */
export function nextTitle(stars: number): { name: TitleName, stars: number, remaining: number } | null {
    const next = TITLES.find(t => t.stars > stars)
    return next ? { name: next.name, stars: next.stars, remaining: next.stars - stars } : null
}

/** Gems level `level` (1-10) pays the first time a player reaches it. */
export function starBounty(level: number): number {
    if (!Number.isInteger(level) || level < 1 || level > MAX_STARS_PER_GAME) return 0
    return level * STAR_BOUNTY_BASE
}

/**
 * Gems for raising a personal best from `paidBest` to `best`: the sum of every
 * new level's bounty. Zero when `best <= paidBest` (regaining lost levels pays nothing).
 */
export function bountyForLevels(paidBest: number, best: number): number {
    let gems = 0
    for (let level = Math.max(0, paidBest) + 1; level <= Math.min(best, MAX_STARS_PER_GAME); level++) gems += starBounty(level)
    return gems
}

/** Minutes within which a player's star changes in one game collapse into one feed event. */
export const STAR_FEED_COLLAPSE_MINUTES = 10

/** An app unseen for this long shows its games as possibly offline. */
export const APP_OFFLINE_AFTER_HOURS = 24

// ─── Amsterdam days ─────────────────────────────────────────────────────────
// A "day" is a calendar date string 'YYYY-MM-DD' in Europe/Amsterdam. Day math
// runs on the date alone (UTC noon of that date), so DST shifts never move it.

const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
})

/** The Amsterdam calendar date of `at`, as 'YYYY-MM-DD'. */
export function amsterdamDay(at: Date = new Date()): string {
    return dayFormat.format(at)
}

function dayToUtcNoon(day: string): number {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!, 12)
}

/** `day` shifted by `days` calendar days. */
export function addDays(day: string, days: number): string {
    return new Date(dayToUtcNoon(day) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
    return Math.round((dayToUtcNoon(to) - dayToUtcNoon(from)) / 86_400_000)
}

/** Days a player can claim now: `min(CLAIM_MAX_DAYS, today - claimedThrough)`, never negative. */
export function claimableDays(claimedThrough: string | null | undefined, today: string = amsterdamDay()): number {
    if (!claimedThrough) return 1
    return Math.max(0, Math.min(CLAIM_MAX_DAYS, daysBetween(claimedThrough, today)))
}

export interface ClaimPile {
    /** Days in the pile. */
    days: number
    /** Gems ready to claim: `min(CLAIM_CAP_GEMS, days x DAILY_GEMS)`. */
    gems: number
    /** The most the pile holds. */
    cap: number
    /** Days until the pile is full (0 when full). */
    fullInDays: number
}

/** The daily pile for the claim UI: "gems / cap ready, full in fullInDays days". */
export function claimPile(claimedThrough: string | null | undefined, today: string = amsterdamDay()): ClaimPile {
    const days = claimableDays(claimedThrough, today)
    const gems = Math.min(CLAIM_CAP_GEMS, days * DAILY_GEMS)
    return { days, gems, cap: CLAIM_CAP_GEMS, fullInDays: Math.max(0, CLAIM_MAX_DAYS - days) }
}
