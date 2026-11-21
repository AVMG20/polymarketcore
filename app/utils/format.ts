const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const fullFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Format a gem or coin amount: `1.2K` when compact, `1,234` otherwise. */
export function formatNumber(value: number | bigint | string, compact = true): string {
    const n = typeof value === 'string' ? Number(value) : value
    if (typeof n === 'number' && !Number.isFinite(n)) return '0'
    if (compact && typeof n === 'number' && Math.abs(n) < 10_000) return fullFormat.format(n)
    return (compact ? compactFormat : fullFormat).format(n)
}

/** Play time: `45s`, `12m`, `3h 20m`, `1.2K h` past 10K hours. */
export function formatDuration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h >= 100) return `${formatNumber(h)}h`
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 minutes ago", "yesterday". */
export function timeAgo(iso: string | Date, now: Date = new Date()): string {
    const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
        ['day', 86_400], ['hour', 3_600], ['minute', 60]
    ]
    for (const [unit, size] of steps) {
        if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
    }
    return 'just now'
}

/**
 * An in-app path to continue to after login, or `/`. Rejects absolute and
 * protocol-relative URLs, and any control or whitespace character (browsers
 * strip tabs and newlines, so `/\t/evil.com` would become `//evil.com`).
 */
export function safeRedirect(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.startsWith('/') || /[\s\x00-\x1f\x7f\\]/.test(raw) || raw.startsWith('//')) return '/'
    return raw
}
