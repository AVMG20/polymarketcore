import { createError, getRequestHeader, getRequestURL, type H3Event } from 'h3'

/**
 * Cross-site write guard for the hub's cookie-authenticated API (`/api/**`).
 *
 * Games run on other origins, and some share the hub's site (`*.avmg.nl`),
 * where the SameSite=Lax session cookie still rides along on a POST. Without
 * this, a game page could verify its own app or rotate keys through an
 * admin's session. A write must come from the hub's own pages:
 * `Sec-Fetch-Site: same-origin` (or `none`), or, from browsers that don't send
 * it, an `Origin` the hub trusts. A request with neither header is not from a
 * browser and carries no ambient cookie risk.
 *
 * `/api/auth/**` has better-auth's own origin check; `/api/v1/**` takes bearer
 * tokens, never cookies.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface WriteRequest {
    method: string
    path: string
    secFetchSite?: string | null
    origin?: string | null
}

/** Whether a request is a cookie-API write from somewhere other than the hub's own pages. */
export function isCrossSiteWrite(req: WriteRequest, allowedOrigins: ReadonlySet<string>): boolean {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return false
    const path = req.path.split('?')[0]!
    if (!path.startsWith('/api/') || path.startsWith('/api/v1/') || path.startsWith('/api/auth/')) return false
    if (req.secFetchSite) return req.secFetchSite !== 'same-origin' && req.secFetchSite !== 'none'
    if (req.origin) return !allowedOrigins.has(req.origin)
    return false
}

function originOf(url: string | undefined): string[] {
    if (!url) return []
    try {
        return [new URL(url).origin]
    } catch {
        return []
    }
}

/** The hub's own origin (as the proxy forwards it) plus BETTER_AUTH_URL, CORE_URL and TRUSTED_ORIGINS. */
export function hubOrigins(event: H3Event): Set<string> {
    const extra = (process.env.TRUSTED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean)
    return new Set([
        getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin,
        ...originOf(process.env.BETTER_AUTH_URL),
        ...originOf(process.env.CORE_URL),
        ...extra.flatMap(originOf)
    ])
}

/** 403 for a cross-site write to the cookie API. */
export function assertSameOriginWrite(event: H3Event) {
    const req = {
        method: event.method,
        path: event.path,
        secFetchSite: getRequestHeader(event, 'sec-fetch-site'),
        origin: getRequestHeader(event, 'origin')
    }
    if (isCrossSiteWrite(req, hubOrigins(event))) {
        throw createError({ statusCode: 403, statusMessage: 'Cross-site request refused' })
    }
}
