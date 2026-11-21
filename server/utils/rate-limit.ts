import { createError, setResponseHeader, type H3Event } from 'h3'

/**
 * In-memory fixed-window rate limiter. Enough for one container; with more
 * than one replica each gets its own budget.
 */
export class RateLimiter {
    private windows = new Map<string, { start: number, count: number }>()
    private lastSweep = 0

    constructor(private readonly now: () => number = Date.now) {}

    /** Count one hit; returns how long to wait in ms when over `limit` per `windowMs`, else 0. */
    hit(key: string, limit: number, windowMs: number): number {
        const t = this.now()
        this.sweep(t, windowMs)
        const w = this.windows.get(key)
        if (!w || t - w.start >= windowMs) {
            this.windows.set(key, { start: t, count: 1 })
            return 0
        }
        w.count++
        return w.count > limit ? w.start + windowMs - t : 0
    }

    private sweep(t: number, windowMs: number) {
        if (t - this.lastSweep < 60_000) return
        this.lastSweep = t
        for (const [key, w] of this.windows) if (t - w.start >= windowMs) this.windows.delete(key)
    }
}

const limiter = new RateLimiter()

export interface Limit {
    limit: number
    windowMs: number
    /** Who is limited, for the error message ("app casino", "developer token pnxd_Ab12"). */
    label: string
}

/** Rate limits per caller. */
export const LIMITS = {
    verifiedApp: { limit: 600, windowMs: 10_000 },
    unverifiedApp: { limit: 60, windowMs: 10_000 },
    developerToken: { limit: 60, windowMs: 10_000 },
    claim: { limit: 5, windowMs: 10_000 }
} as const

/** 429 with a precise message when `key` is over its limit. */
export function enforceRateLimit(event: H3Event, key: string, rule: Limit) {
    const waitMs = limiter.hit(key, rule.limit, rule.windowMs)
    if (waitMs <= 0) return
    const seconds = Math.max(1, Math.ceil(waitMs / 1000))
    setResponseHeader(event, 'Retry-After', seconds)
    throw createError({
        statusCode: 429,
        statusMessage: `Rate limit: ${rule.label} may make ${rule.limit} requests per ${rule.windowMs / 1000} s; retry in ${seconds} s`
    })
}
