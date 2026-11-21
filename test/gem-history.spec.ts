import { describe, expect, it } from 'vitest'
import { historyKind } from '#shared/gem-history'

describe('historyKind', () => {
    it('labels ledger rows', () => {
        expect(historyKind({ category: 'daily', amount: 10, refund: false, appId: null })).toBe('daily')
        expect(historyKind({ category: 'casino', amount: -5, refund: false, appId: 'casino' })).toBe('spend')
        expect(historyKind({ category: 'casino', amount: 5, refund: true, appId: 'casino' })).toBe('refund')
        expect(historyKind({ category: 'casino', amount: 3, refund: false, appId: 'casino' })).toBe('bounty')
    })
})
