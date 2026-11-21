import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { apps, user } from '#server/database/schema'
import { getAppInfo, getOwnedApp, registerApp, registerAppSchema, updateApp, updateAppSchema } from '#server/utils/app-registry'
import { getGameDetail, getPlayerProfile, listGames } from '#server/utils/hub'
import { applyManifest, manifestSchema } from '#server/utils/manifest'
import { randomToken } from '#shared/random'
import { createAppWithGame, createPlayer } from './helpers'

const REPO = 'https://github.com/me/my-game'
const appId = () => `m-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
const repoOf = async (id: string) => (await db.select({ repoUrl: apps.repoUrl }).from(apps).where(eq(apps.id, id)))[0]!.repoUrl

describe('app repo URL', () => {
    it('is set, normalised and cleared through the developer API', async () => {
        const owner = await createPlayer()
        const id = appId()
        const create = registerAppSchema.parse({ id, name: 'Dev app', baseUrl: 'http://localhost:3999', repoUrl: REPO })
        await registerApp({ ...create, ownerUserId: owner, limitOwner: true })
        expect((await getAppInfo(id)).repoUrl).toBe(REPO)

        // PATCH /api/v1/developer/apps/:id
        const app = await getOwnedApp(owner, id)
        await updateApp(app, updateAppSchema.parse({ repoUrl: 'https://GitLab.com/me/other' }))
        expect((await getAppInfo(id)).repoUrl).toBe('https://gitlab.com/me/other')
        // Other changes leave it alone.
        await updateApp(app, updateAppSchema.parse({ name: 'Renamed' }))
        expect(await repoOf(id)).toBe('https://gitlab.com/me/other')
        await updateApp(app, updateAppSchema.parse({ repoUrl: null }))
        expect(await repoOf(id)).toBeNull()
        await updateApp(app, updateAppSchema.parse({ repoUrl: REPO }))
        await updateApp(app, updateAppSchema.parse({ repoUrl: '' }))
        expect(await repoOf(id)).toBeNull()
    })

    it('refuses anything but an https URL and names the field', () => {
        for (const repoUrl of ['http://github.com/me/x', 'javascript:alert(1)', 'ftp://x.com/r', 42]) {
            const result = updateAppSchema.safeParse({ repoUrl })
            expect(result.success).toBe(false)
            expect(result.error?.issues[0]?.message).toMatch(/^repoUrl /)
        }
    })

    it('is set by the manifest; omitted leaves it, null clears it', async () => {
        const { appId: id, game } = await createAppWithGame()
        const manifest = (extra: Record<string, unknown>) => manifestSchema.parse({ ...extra, games: [{ slug: game, name: 'G' }] })

        await applyManifest(id, manifest({ repoUrl: REPO }))
        expect(await repoOf(id)).toBe(REPO)
        await applyManifest(id, manifest({}))
        expect(await repoOf(id)).toBe(REPO)
        await applyManifest(id, manifest({ repoUrl: null }))
        expect(await repoOf(id)).toBeNull()

        expect(manifestSchema.safeParse({ repoUrl: 'http://x.com/r', games: [] }).error?.issues[0]?.message)
            .toBe('repoUrl must be an https URL like https://github.com/me/my-game')
    })
})

describe('game maker in the read models', () => {
    it('lists the owner and repo with the game, on the game page and on the owner\'s profile', async () => {
        const owner = await createPlayer()
        await db.update(user).set({ name: 'Maker', prestige: 2 }).where(eq(user.id, owner))
        const { appId: id, game } = await createAppWithGame(3, { ownerUserId: owner })
        await db.update(apps).set({ repoUrl: REPO }).where(eq(apps.id, id))

        const [summary] = await listGames(null, { slug: game })
        expect(summary!.app).toMatchObject({ id, repoUrl: REPO, owner: { id: owner, name: 'Maker', image: null, emblem: null, prestige: 2 } })

        const detail = await getGameDetail(game, null)
        expect(detail.game.app.owner?.id).toBe(owner)
        expect(detail.game.app.repoUrl).toBe(REPO)

        const profile = await getPlayerProfile(owner, null)
        expect(profile.games.map(g => g.slug)).toEqual([game])
        expect(profile.games[0]!.app.owner?.id).toBe(owner)

        // Players who own no apps list no games.
        expect((await getPlayerProfile(await createPlayer(), null)).games).toEqual([])
    })

    it('falls back to no owner, and shows drafts only to their owner and admins', async () => {
        const { game: orphan } = await createAppWithGame()
        expect((await listGames(null, { slug: orphan }))[0]!.app).toMatchObject({ owner: null, repoUrl: null })

        const owner = await createPlayer()
        const { game: draft } = await createAppWithGame(1, { ownerUserId: owner, visibility: 'draft' })
        expect((await getPlayerProfile(owner, null)).games).toEqual([])
        expect((await getPlayerProfile(owner, { id: await createPlayer(), admin: false })).games).toEqual([])
        expect((await getPlayerProfile(owner, { id: owner, admin: false })).games.map(g => g.slug)).toEqual([draft])
        expect((await getPlayerProfile(owner, { id: 'someone', admin: true })).games.map(g => g.slug)).toEqual([draft])
    })
})
