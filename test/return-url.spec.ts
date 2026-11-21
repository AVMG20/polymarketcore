import { describe, expect, it } from 'vitest'
import { normalizeReturnUrl } from '#shared/return-url'

const isAllowedReturnUrl = (raw: unknown, prefixes: readonly string[]) => normalizeReturnUrl(raw, prefixes) !== null

const prefixes = ['http://localhost:3200/']

describe('isAllowedReturnUrl', () => {
    it('accepts URLs under a registered prefix', () => {
        expect(isAllowedReturnUrl('http://localhost:3200/', prefixes)).toBe(true)
        expect(isAllowedReturnUrl('http://localhost:3200/slots/aether?x=1', prefixes)).toBe(true)
    })

    it('rejects look-alike hosts and userinfo tricks', () => {
        expect(isAllowedReturnUrl('http://localhost:3200.evil.com/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('http://localhost:3200@evil.com/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('http://user:pass@localhost:3200/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('http://evil.com/http://localhost:3200/', prefixes)).toBe(false)
    })

    it('rejects a prefix without trailing slash being extended into another host', () => {
        const bare = ['http://localhost:3200']
        expect(isAllowedReturnUrl('http://localhost:3200.evil.com/', bare)).toBe(false)
        expect(isAllowedReturnUrl('http://localhost:3200/x', bare)).toBe(true)
    })

    it('rejects other ports, schemes and relative URLs', () => {
        expect(isAllowedReturnUrl('http://localhost:3201/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('https://localhost:3200/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('javascript:alert(1)//localhost:3200/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('//localhost:3200/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('/play', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('', prefixes)).toBe(false)
        expect(isAllowedReturnUrl(undefined, prefixes)).toBe(false)
    })

    it('rejects backslashes and control characters', () => {
        expect(isAllowedReturnUrl('http://localhost:3200\\@evil.com/', prefixes)).toBe(false)
        expect(isAllowedReturnUrl('http://localhost:3200/\r\nLocation: x', prefixes)).toBe(false)
    })

    it('respects path prefixes at a segment boundary', () => {
        const scoped = ['https://casino.avmg.nl/play']
        expect(isAllowedReturnUrl('https://casino.avmg.nl/play', scoped)).toBe(true)
        expect(isAllowedReturnUrl('https://casino.avmg.nl/play/slots', scoped)).toBe(true)
        expect(isAllowedReturnUrl('https://casino.avmg.nl/playground', scoped)).toBe(false)
        expect(isAllowedReturnUrl('https://casino.avmg.nl/play/../admin', scoped)).toBe(false)
    })
})

describe('normalizeReturnUrl', () => {
    it('drops an existing hash so the token fragment is the only one', () => {
        expect(normalizeReturnUrl('http://localhost:3200/a?b=1#old', prefixes)).toBe('http://localhost:3200/a?b=1')
    })
})
