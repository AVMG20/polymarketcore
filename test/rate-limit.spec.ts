import { describe, expect, it } from 'vitest'
import { RateLimiter } from '#server/utils/rate-limit'

describe('RateLimiter', () => {
    it('allows `limit` hits per window, then reports the wait', () => {
        let now = 1_000_000
        const limiter = new RateLimiter(() => now)
        for (let i = 0; i < 3; i++) expect(limiter.hit('k', 3, 10_000)).toBe(0)
        now += 4_000
        expect(limiter.hit('k', 3, 10_000)).toBe(6_000)
        expect(limiter.hit('other', 3, 10_000)).toBe(0)
        now += 6_000
        expect(limiter.hit('k', 3, 10_000)).toBe(0)
    })
})
