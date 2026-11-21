import { describe, expect, it } from 'vitest'
import { isCrossSiteWrite } from '#server/utils/csrf'

const hub = new Set(['https://core.avmg.nl'])

describe('isCrossSiteWrite', () => {
    it('lets reads and the hub\'s own writes through', () => {
        expect(isCrossSiteWrite({ method: 'GET', path: '/api/me', secFetchSite: 'cross-site' }, hub)).toBe(false)
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/gems/claim', secFetchSite: 'same-origin' }, hub)).toBe(false)
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/gems/claim', origin: 'https://core.avmg.nl' }, hub)).toBe(false)
    })

    it('refuses writes from a game on the same site or another site', () => {
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/admin/apps/x/verify', secFetchSite: 'same-site', origin: 'https://casino.avmg.nl' }, hub)).toBe(true)
        expect(isCrossSiteWrite({ method: 'DELETE', path: '/api/developer/tokens/1', secFetchSite: 'cross-site' }, hub)).toBe(true)
        expect(isCrossSiteWrite({ method: 'PATCH', path: '/api/admin/apps/x', origin: 'https://casino.avmg.nl' }, hub)).toBe(true)
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/gems/claim', origin: 'null' }, hub)).toBe(true)
    })

    it('leaves bearer and better-auth routes and non-browser clients alone', () => {
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/v1/gems/spend', secFetchSite: 'cross-site' }, hub)).toBe(false)
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/auth/sign-in/email', secFetchSite: 'cross-site' }, hub)).toBe(false)
        expect(isCrossSiteWrite({ method: 'POST', path: '/api/gems/claim' }, hub)).toBe(false)
    })
})
