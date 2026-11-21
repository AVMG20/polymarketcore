import { CLAIM_CAP_GEMS, DAILY_GEMS, MAX_DEVELOPER_APPS, STARTER_GEMS, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'

/** Rate limits quoted in the guide (server/utils/rate-limit.ts LIMITS, per 10 s). */
export interface GuideLimits {
    verifiedApp: number
    unverifiedApp: number
    developerToken: number
}

/**
 * Fill shared/guide/developer-guide.md for a hub URL. The same text is served
 * raw at /developers.md and shown in the copy block on /developers, so they
 * can't drift. Throws if a placeholder is left unfilled.
 */
export function renderDeveloperGuide(template: string, hubUrl: string, limits: GuideLimits): string {
    const values: Record<string, string | number> = {
        HUB: hubUrl.replace(/\/+$/, ''),
        STARTER_GEMS,
        DAILY_GEMS,
        CLAIM_CAP_GEMS,
        UNVERIFIED_DAILY_SPEND_CAP,
        MAX_DEVELOPER_APPS,
        RATE_APP_VERIFIED: limits.verifiedApp,
        RATE_APP_UNVERIFIED: limits.unverifiedApp,
        RATE_DEV: limits.developerToken
    }
    const out = template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
        if (!(key in values)) throw new Error(`developer guide: unknown placeholder ${match}`)
        return String(values[key])
    })
    return out
}

/**
 * A server asset as text. A production build bundles assets whose extension
 * Nitro doesn't treat as text (`.ts`) as bytes, so `getItem` alone returned
 * nothing for `server.ts`.
 */
export function assetText(value: unknown): string | null {
    if (typeof value === 'string') return value
    if (value instanceof Uint8Array) return new TextDecoder().decode(value)
    return null
}
