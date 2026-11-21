/**
 * Validation for an app's base URL, return URL prefixes and repo URL. Returns the
 * normalised URL or an error message that says what to fix (the reader is
 * often a coding agent).
 */

export type UrlCheck = { ok: true, url: string } | { ok: false, error: string }

export interface UrlRules {
    /** Production requires https, except for localhost. */
    production: boolean
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isLocalHost(hostname: string): boolean {
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')
}

function parse(raw: unknown, field: string, rules: UrlRules, allowQuery = false, example = 'https://mygame.example.com'): { url: URL } | { error: string } {
    if (typeof raw !== 'string' || raw.trim() === '') return { error: `${field} is required` }
    if (raw.length > 500) return { error: `${field} must be at most 500 characters` }
    if (/[\u0000-\u001f\u007f\\\s]/.test(raw.trim())) return { error: `${field} must not contain spaces, backslashes or control characters` }
    let url: URL
    try {
        url = new URL(raw.trim())
    } catch {
        return { error: `${field} must be an absolute URL like ${example}` }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: `${field} must use http or https` }
    if (url.username || url.password) return { error: `${field} must not contain a username or password` }
    if (url.hash || (url.search && !allowQuery)) return { error: `${field} must not contain a query string or #fragment` }
    if (rules.production && url.protocol === 'http:' && !isLocalHost(url.hostname)) {
        return { error: `${field} must use https (http is only allowed for localhost)` }
    }
    return { url }
}

/** `https://Game.Example.com/play/` → `https://game.example.com/play` (no trailing slash). */
export function normalizeBaseUrl(raw: unknown, rules: UrlRules, field = 'baseUrl'): UrlCheck {
    const parsed = parse(raw, field, rules)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    const path = parsed.url.pathname.replace(/\/+$/, '')
    return { ok: true, url: `${parsed.url.origin}${path}` }
}

/**
 * A return URL prefix. It must share the base URL's origin, and gets a
 * trailing slash when it is a bare origin (`https://x.com` → `https://x.com/`).
 */
export function normalizeReturnPrefix(raw: unknown, baseUrl: string, rules: UrlRules, field = 'returnUrlPrefixes[0]'): UrlCheck {
    const parsed = parse(raw, field, rules)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    const base = new URL(baseUrl)
    if (parsed.url.origin !== base.origin) {
        return { ok: false, error: `${field} must share the app's baseUrl origin (${base.origin})` }
    }
    return { ok: true, url: parsed.url.href }
}

/** Normalise a base URL and its prefixes together; prefixes default to `<baseUrl>/`. */
export function normalizeAppUrls(
    baseUrl: unknown,
    prefixes: unknown[] | undefined,
    rules: UrlRules
): { ok: true, baseUrl: string, returnUrlPrefixes: string[] } | { ok: false, error: string } {
    const base = normalizeBaseUrl(baseUrl, rules)
    if (!base.ok) return base
    const list = prefixes && prefixes.length ? prefixes : [`${base.url}/`]
    const out: string[] = []
    for (const [i, p] of list.entries()) {
        const check = normalizeReturnPrefix(p, base.url, rules, `returnUrlPrefixes[${i}]`)
        if (!check.ok) return check
        if (!out.includes(check.url)) out.push(check.url)
    }
    return { ok: true, baseUrl: base.url, returnUrlPrefixes: out }
}

/**
 * Where an app's code lives (`https://github.com/me/my-game`): https only,
 * whatever the environment, since players open it. A query is fine, a
 * #fragment is not.
 */
export function checkRepoUrl(raw: unknown, field = 'repoUrl'): UrlCheck {
    const example = 'https://github.com/me/my-game'
    const parsed = parse(raw, field, { production: false }, true, example)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    if (parsed.url.protocol !== 'https:') return { ok: false, error: `${field} must be an https URL like ${example}` }
    return { ok: true, url: parsed.url.href }
}

/** Whether a repo URL is on GitHub (shown with its icon). */
export function isGithubUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname
        return host === 'github.com' || host === 'www.github.com'
    } catch {
        return false
    }
}

/**
 * An image URL (manifest icon or cover, avatar): https, or http only on
 * localhost, whatever the environment.
 */
export function checkImageUrl(raw: unknown, field: string): UrlCheck {
    const parsed = parse(raw, field, { production: false }, true)
    if ('error' in parsed) return { ok: false, error: parsed.error }
    if (parsed.url.protocol === 'http:' && !isLocalHost(parsed.url.hostname)) {
        return { ok: false, error: `${field} must be an https URL (http is only allowed for localhost)` }
    }
    return { ok: true, url: parsed.url.href }
}
