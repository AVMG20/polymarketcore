import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { games } from '#server/database/schema'
import { applyManifest, manifestSchema } from '#server/utils/manifest'
import { randomToken } from '#shared/random'
import { burst, createAppWithGame } from './helpers'

const game = (slug: string, extra: Record<string, unknown> = {}) => manifestSchema.parse({ games: [{ slug, name: 'G', ...extra }] })

describe('manifest', () => {
    it('refuses the hub\'s ledger categories as slugs and a # in playPath', () => {
        for (const slug of ['admin', 'daily', 'welcome']) {
            expect(manifestSchema.safeParse({ games: [{ slug, name: 'G' }] }).error?.issues[0]?.message).toMatch(/reserved/)
        }
        expect(manifestSchema.safeParse({ games: [{ slug: 'ok-slug', name: 'G', playPath: '/play#x' }] }).success).toBe(false)
        expect(manifestSchema.safeParse({ games: [{ slug: 'ok-slug', name: 'G', playPath: '/play?x=1' }] }).success).toBe(true)
    })

    it('takes listed lucide icons and image URLs, refuses other icon names', () => {
        const parse = (icon: string) => manifestSchema.safeParse({ games: [{ slug: 'ok-slug', name: 'G', icon }] })
        expect(parse('lucide:crosshair').success).toBe(true)
        expect(parse('https://example.com/icon.png').success).toBe(true)
        expect(parse('lucide:not-an-icon').error?.issues[0]?.message).toMatch(/not available/)
    })

    it('10 parallel manifests from two apps claiming one slug leave one owner', async () => {
        const a = await createAppWithGame()
        const b = await createAppWithGame()
        const slug = `race-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
        // Each app also keeps its own game, so the race manifest doesn't retire it.
        const manifest = (own: string) => manifestSchema.parse({ games: [{ slug: own, name: 'Own' }, { slug, name: 'Race' }] })
        const { ok, failed } = await burst(10, i => applyManifest(i % 2 ? a.appId : b.appId, manifest(i % 2 ? a.game : b.game)))
        const [row] = await db.select({ appId: games.appId }).from(games).where(eq(games.slug, slug))
        const winner = row!.appId
        expect(failed.every(f => f.statusCode === 403)).toBe(true)
        expect(ok).toHaveLength(5)
        expect(failed).toHaveLength(5)
        // The loser can't take it over later either.
        const loser = winner === a.appId ? b : a
        await expect(applyManifest(loser.appId, game(slug))).rejects.toMatchObject({ statusCode: 403 })
    })
})
