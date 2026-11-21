import { describe, expect, it } from 'vitest'
import { checkImageUrl, normalizeAppUrls, normalizeBaseUrl } from '#shared/app-urls'

const dev = { production: false }
const prod = { production: true }

describe('app URLs', () => {
    it('normalises base URLs', () => {
        expect(normalizeBaseUrl('https://Game.Example.com/play/', prod)).toEqual({ ok: true, url: 'https://game.example.com/play' })
        expect(normalizeBaseUrl('http://localhost:3300/', prod)).toEqual({ ok: true, url: 'http://localhost:3300' })
    })

    it('requires https in production except on localhost', () => {
        expect(normalizeBaseUrl('http://game.example.com', prod)).toMatchObject({ ok: false, error: expect.stringContaining('https') })
        expect(normalizeBaseUrl('http://game.example.com', dev)).toMatchObject({ ok: true })
        expect(normalizeBaseUrl('http://127.0.0.1:4000', prod)).toMatchObject({ ok: true })
    })

    it('rejects other schemes, credentials, queries and junk with a field name', () => {
        expect(normalizeBaseUrl('ftp://x.com', dev)).toMatchObject({ ok: false, error: expect.stringContaining('baseUrl') })
        expect(normalizeBaseUrl('https://u:p@x.com', dev)).toMatchObject({ ok: false })
        expect(normalizeBaseUrl('https://x.com/?a=1', dev)).toMatchObject({ ok: false })
        expect(normalizeBaseUrl('not a url', dev)).toMatchObject({ ok: false })
        expect(normalizeBaseUrl('', dev)).toMatchObject({ ok: false, error: 'baseUrl is required' })
    })

    it('defaults return prefixes to the base URL and keeps them on its origin', () => {
        expect(normalizeAppUrls('https://x.com/game', undefined, prod)).toEqual({ ok: true, baseUrl: 'https://x.com/game', returnUrlPrefixes: ['https://x.com/game/'] })
        expect(normalizeAppUrls('https://x.com', ['https://evil.com/'], prod))
            .toEqual({ ok: false, error: "returnUrlPrefixes[0] must share the app's baseUrl origin (https://x.com)" })
        expect(normalizeAppUrls('https://x.com', ['https://x.com', 'https://x.com/'], prod)).toMatchObject({ ok: true, returnUrlPrefixes: ['https://x.com/'] })
    })

    it('accepts https images (http only on localhost)', () => {
        expect(checkImageUrl('https://cdn.x.com/i.png?v=2', 'cover')).toMatchObject({ ok: true })
        expect(checkImageUrl('http://cdn.x.com/i.png', 'cover')).toMatchObject({ ok: false, error: expect.stringContaining('https') })
        expect(checkImageUrl('http://localhost:3300/i.png', 'icon')).toMatchObject({ ok: true })
        expect(checkImageUrl('javascript:alert(1)', 'icon')).toMatchObject({ ok: false })
    })
})
