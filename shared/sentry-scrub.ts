/**
 * Strips query strings from what goes to Rustrak. A query can hold a secret (`/reset-password?token=…`,
 * a launch token on `/connect`), and the Sentry SDKs copy it into URLs and, for Vue router spans, into
 * raw `query.*` attributes that skip their own filtering.
 */

type Data = Record<string, unknown>

interface ScrubbableEvent {
    request?: { url?: string, query_string?: unknown }
}

function stripQuery(value: string): string {
    const i = value.search(/[?#]/)
    return i === -1 ? value : value.slice(0, i)
}

function scrubData(data: Data | undefined) {
    if (!data) return
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('query.') || key === 'url.query' || key === 'http.query') delete data[key]
        else if (typeof value === 'string' && /^(https?:\/\/|\/)/.test(value) && value.includes('?')) data[key] = stripQuery(value)
    }
}

/** For `beforeSend`: an error event's request URL. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
    if (event.request) {
        if (event.request.url) event.request.url = stripQuery(event.request.url)
        delete event.request.query_string
    }
    return event
}

/** For `beforeSendSpan`: the SDKs stream spans (v11), so traces never pass `beforeSendTransaction`. */
export function scrubSpan<T extends { attributes: Data }>(span: T): T {
    scrubData(span.attributes)
    return span
}
