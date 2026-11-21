import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assetText, renderDeveloperGuide } from '#shared/developer-guide'
import { UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'

const template = readFileSync(resolve(import.meta.dirname, '../shared/guide/developer-guide.md'), 'utf8')

describe('developer guide', () => {
    it('fills every placeholder', () => {
        const out = renderDeveloperGuide(template, 'https://core.example.com/', { verifiedApp: 600, unverifiedApp: 60, developerToken: 60 })
        expect(out).not.toMatch(/\{\{/)
        expect(out).toContain('https://core.example.com/developers.md')
        expect(out).toMatch(new RegExp(`at most\\s+${UNVERIFIED_DAILY_SPEND_CAP} gems`))
    })

    it('refuses unknown placeholders', () => {
        expect(() => renderDeveloperGuide('{{NOPE}}', 'x', { verifiedApp: 1, unverifiedApp: 1, developerToken: 1 })).toThrow()
    })
})

describe('assetText', () => {
    it('reads text and byte assets, nothing else', () => {
        expect(assetText('hello')).toBe('hello')
        expect(assetText(new TextEncoder().encode('const x = 1 // ★'))).toBe('const x = 1 // ★')
        expect(assetText(null)).toBeNull()
    })
})
