import { describe, expect, it } from 'vitest'
import {
    addDays,
    bountyForLevels,
    claimPile,
    CLAIM_CAP_GEMS,
    amsterdamDay,
    CLAIM_MAX_DAYS,
    claimableDays,
    daysBetween,
    nextTitle,
    starBounty,
    titleFor
} from '#shared/economy'

describe('amsterdamDay', () => {
    it('rolls over at Amsterdam midnight in winter (UTC+1)', () => {
        expect(amsterdamDay(new Date('2026-01-14T22:59:59Z'))).toBe('2026-01-14')
        expect(amsterdamDay(new Date('2026-01-14T23:00:00Z'))).toBe('2026-01-15')
    })

    it('rolls over at Amsterdam midnight in summer (UTC+2)', () => {
        expect(amsterdamDay(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14')
        expect(amsterdamDay(new Date('2026-07-14T22:00:00Z'))).toBe('2026-07-15')
    })

    it('handles the DST switch days', () => {
        // Spring forward: 2026-03-29 02:00 CET -> 03:00 CEST
        expect(amsterdamDay(new Date('2026-03-28T22:59:59Z'))).toBe('2026-03-28')
        expect(amsterdamDay(new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29')
        expect(amsterdamDay(new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-29')
        expect(amsterdamDay(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30')
        // Fall back: 2026-10-25 03:00 CEST -> 02:00 CET
        expect(amsterdamDay(new Date('2026-10-24T21:59:59Z'))).toBe('2026-10-24')
        expect(amsterdamDay(new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25')
        expect(amsterdamDay(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-25')
        expect(amsterdamDay(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26')
    })
})

describe('day math', () => {
    it('adds and diffs calendar days across DST and month ends', () => {
        expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
        expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
        expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
        expect(daysBetween('2026-10-26', '2026-10-24')).toBe(-2)
    })
})

describe('claimableDays', () => {
    it('makes day one claimable for a new account (claimed through yesterday)', () => {
        const today = '2026-11-21'
        expect(claimableDays(addDays(today, -1), today)).toBe(1)
    })

    it('is zero once claimed today, and never negative', () => {
        expect(claimableDays('2026-11-21', '2026-11-21')).toBe(0)
        expect(claimableDays('2026-11-22', '2026-11-21')).toBe(0)
    })

    it('piles up to CLAIM_MAX_DAYS', () => {
        expect(claimableDays('2026-11-18', '2026-11-21')).toBe(3)
        expect(claimableDays('2026-11-01', '2026-11-21')).toBe(CLAIM_MAX_DAYS)
    })

    it('flips at Amsterdam midnight, not UTC midnight', () => {
        const before = amsterdamDay(new Date('2026-07-14T21:59:00Z'))
        const after = amsterdamDay(new Date('2026-07-14T22:01:00Z'))
        expect(claimableDays('2026-07-14', before)).toBe(0)
        expect(claimableDays('2026-07-14', after)).toBe(1)
    })

    it('counts one day across the short spring-forward night', () => {
        const through = amsterdamDay(new Date('2026-03-28T12:00:00Z'))
        expect(claimableDays(through, amsterdamDay(new Date('2026-03-28T23:30:00Z')))).toBe(1)
    })
})

describe('titles', () => {
    it('uses fixed star thresholds', () => {
        expect(titleFor(0)).toBe('Newcomer')
        expect(titleFor(4)).toBe('Newcomer')
        expect(titleFor(5)).toBe('Rookie')
        expect(titleFor(10)).toBe('Regular')
        expect(titleFor(29)).toBe('Contender')
        expect(titleFor(30)).toBe('Veteran')
        expect(titleFor(80)).toBe('Legend')
        expect(titleFor(99)).toBe('Mythic')
        expect(titleFor(100)).toBe('Immortal')
        expect(titleFor(500)).toBe('Immortal')
    })

    it('reports the next title and the stars it takes', () => {
        expect(nextTitle(3)).toEqual({ name: 'Rookie', stars: 5, remaining: 2 })
        expect(nextTitle(99)).toEqual({ name: 'Immortal', stars: 100, remaining: 1 })
        expect(nextTitle(100)).toBeNull()
    })
})

describe('claimPile', () => {
    it('fills toward the cap and says when it is full', () => {
        expect(claimPile('2026-11-20', '2026-11-21')).toEqual({ days: 1, gems: 10, cap: CLAIM_CAP_GEMS, fullInDays: 9 })
        expect(claimPile('2026-11-01', '2026-11-21')).toEqual({ days: 10, gems: CLAIM_CAP_GEMS, cap: CLAIM_CAP_GEMS, fullInDays: 0 })
        expect(claimPile('2026-11-21', '2026-11-21')).toMatchObject({ gems: 0, fullInDays: 10 })
    })
})

describe('bountyForLevels', () => {
    it('sums the new levels only', () => {
        expect(bountyForLevels(0, 10)).toBe(55)
        expect(bountyForLevels(3, 5)).toBe(4 + 5)
        expect(bountyForLevels(5, 5)).toBe(0)
        expect(bountyForLevels(5, 2)).toBe(0)
    })
})

describe('starBounty', () => {
    it('pays n gems for level n (1-10) and nothing otherwise', () => {
        expect(starBounty(1)).toBe(1)
        expect(starBounty(10)).toBe(10)
        expect(starBounty(0)).toBe(0)
        expect(starBounty(11)).toBe(0)
        expect(starBounty(2.5)).toBe(0)
    })
})
