/**
 * A return URL an app registered (contract §1, flow B): the parsed URL without
 * its hash, or null when it isn't allowed.
 *
 * Compares parsed URLs, not raw strings: the origin must match exactly and the
 * path must sit under the prefix's path. A plain `startsWith` lets
 * `http://localhost:3200.evil.com` through a prefix registered without its
 * trailing slash, and `http://localhost:3200@evil.com` through any of them.
 */
export function normalizeReturnUrl(raw: unknown, prefixes: readonly string[]): string | null {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2000) return null
    // Control characters and backslashes have no business in a return URL, and
    // browsers read `\` as `/`, which makes the parsed and raw forms disagree.
    if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null

    let url: URL
    try {
        url = new URL(raw)
    } catch {
        return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.username || url.password) return null

    for (const prefix of prefixes) {
        let base: URL
        try {
            base = new URL(prefix)
        } catch {
            continue
        }
        if (base.origin !== url.origin) continue
        const basePath = base.pathname
        const pathOk = basePath.endsWith('/')
            ? url.pathname.startsWith(basePath)
            : url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)
        if (!pathOk) continue
        url.hash = ''
        return url.href
    }
    return null
}
