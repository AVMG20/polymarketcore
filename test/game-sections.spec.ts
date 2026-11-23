import { describe, expect, it } from 'vitest'
import { groupGameSections } from '#shared/game-sections'
import type { GameSummary } from '#shared/types/api'

function game(overrides: Partial<GameSummary> & { slug: string, ownerId?: string | null, verified?: boolean }): GameSummary {
    const { ownerId = 'owner-1', verified = true, ...rest } = overrides
    return {
        name: rest.slug,
        tagline: null,
        description: null,
        playPath: '/',
        icon: null,
        cover: null,
        accent: null,
        position: 0,
        visibility: 'public',
        counts: verified && (rest.visibility ?? 'public') === 'public',
        offline: false,
        app: {
            id: `app-${rest.slug}`,
            name: rest.slug,
            origin: 'https://example.test',
            verified,
            repoUrl: null,
            owner: ownerId ? { id: ownerId, name: ownerId, image: null, emblem: null, prestige: 0 } : null
        },
        stars: [],
        maxStars: 0,
        me: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        players: 0,
        playSeconds: 0,
        hot: false,
        ...rest
    }
}

describe('groupGameSections', () => {
    it('separates other players drafts into an admin-only section instead of Your drafts', () => {
        const sections = groupGameSections([
            game({ slug: 'casino', ownerId: 'avmg', verified: true }),
            game({ slug: 'nitro-rush', ownerId: 'cylosix', verified: false, visibility: 'draft' })
        ], 'avmg')

        expect(sections.map(s => ({ key: s.key, title: s.title, adminOnly: s.adminOnly, slugs: s.games.map(g => g.slug) }))).toEqual([
            { key: 'games', title: 'Games', adminOnly: false, slugs: ['casino'] },
            { key: 'other-drafts', title: 'Other drafts', adminOnly: true, slugs: ['nitro-rush'] }
        ])
        expect(sections[1]!.note).toContain('maker and admins')
    })

    it('keeps own drafts and own unverified games separate from other makers games', () => {
        const sections = groupGameSections([
            game({ slug: 'pub', ownerId: 'other', verified: true }),
            game({ slug: 'my-new', ownerId: 'avmg', verified: false, visibility: 'public' }),
            game({ slug: 'their-new', ownerId: 'cylosix', verified: false, visibility: 'public' }),
            game({ slug: 'my-draft', ownerId: 'avmg', verified: false, visibility: 'draft' }),
            game({ slug: 'their-draft', ownerId: 'cylosix', verified: false, visibility: 'draft' }),
            game({ slug: 'unowned-draft', ownerId: null, verified: false, visibility: 'draft' })
        ], 'avmg')

        expect(sections.map(s => ({ key: s.key, title: s.title, adminOnly: s.adminOnly, slugs: s.games.map(g => g.slug) }))).toEqual([
            { key: 'games', title: 'Games', adminOnly: false, slugs: ['pub'] },
            { key: 'new', title: 'New', adminOnly: false, slugs: ['my-new'] },
            { key: 'other-new', title: 'Unverified', adminOnly: true, slugs: ['their-new'] },
            { key: 'drafts', title: 'Your drafts', adminOnly: false, slugs: ['my-draft'] },
            { key: 'other-drafts', title: 'Other drafts', adminOnly: true, slugs: ['their-draft', 'unowned-draft'] }
        ])
    })

    it('preserves incoming order within each section', () => {
        const sections = groupGameSections([
            game({ slug: 'd2', ownerId: 'cylosix', visibility: 'draft' }),
            game({ slug: 'd1', ownerId: 'bob', visibility: 'draft' })
        ], 'avmg')

        expect(sections).toHaveLength(1)
        expect(sections[0]!.games.map(g => g.slug)).toEqual(['d2', 'd1'])
    })

    it('treats drafts as other-drafts when viewerId is null', () => {
        const sections = groupGameSections([
            game({ slug: 'd1', ownerId: 'cylosix', visibility: 'draft' })
        ], null)

        expect(sections.map(s => s.key)).toEqual(['other-drafts'])
    })
})
