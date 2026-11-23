import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { ownedAppGames, setOwnAppRepo, setOwnAppStatus, updateApp, updateOwnedGame } from '#server/utils/app-registry'
import { listGames } from '#server/utils/hub'
import { applyManifest } from '#server/utils/manifest'
import { MAX_DEVELOPER_APPS } from '#shared/economy'
import { createAppWithGame, createPlayer } from './helpers'

const appRow = async (id: string) => (await db.select().from(apps).where(eq(apps.id, id)))[0]!

describe('own apps', () => {
    it('lists an unverified app\'s public game only for its owner', async () => {
        const owner = await createPlayer()
        const other = await createPlayer()
        const { appId, game } = await createAppWithGame(1, { verified: false, ownerUserId: owner })
        const slugs = async (viewer: { id: string, admin: boolean } | null) => (await listGames(viewer, { slug: game })).map(g => g.slug)
        expect(await slugs({ id: owner, admin: false })).toEqual([game])
        expect(await slugs({ id: other, admin: false })).toEqual([])
        expect(await slugs(null)).toEqual([])
        expect(await slugs({ id: other, admin: true })).toEqual([game])
        await db.update(apps).set({ verified: true }).where(eq(apps.id, appId))
        expect(await slugs({ id: other, admin: false })).toEqual([game])
        expect(await slugs(null)).toEqual([game])
    })

    it('lets the owner switch their app off and on', async () => {
        const owner = await createPlayer()
        const { appId } = await createAppWithGame(1, { ownerUserId: owner })
        expect((await setOwnAppStatus(owner, appId, 'disabled')).status).toBe('disabled')
        expect((await setOwnAppStatus(owner, appId, 'active')).status).toBe('active')
        const stranger = await createPlayer()
        await expect(setOwnAppStatus(stranger, appId, 'disabled')).rejects.toMatchObject({ statusCode: 404 })
    })

    it('keeps an admin-disabled app off', async () => {
        const owner = await createPlayer()
        const { appId } = await createAppWithGame(1, { ownerUserId: owner })
        await updateApp(await appRow(appId), { status: 'disabled', disabledByAdmin: true })
        await expect(setOwnAppStatus(owner, appId, 'active')).rejects.toMatchObject({ statusCode: 403 })
        await updateApp(await appRow(appId), { status: 'active', disabledByAdmin: false })
        expect((await appRow(appId)).status).toBe('active')
    })

    it('counts enabling toward the active app limit', async () => {
        const owner = await createPlayer()
        const { appId } = await createAppWithGame(1, { ownerUserId: owner })
        await setOwnAppStatus(owner, appId, 'disabled')
        for (let i = 0; i < MAX_DEVELOPER_APPS; i++) await createAppWithGame(1, { ownerUserId: owner })
        await expect(setOwnAppStatus(owner, appId, 'active')).rejects.toMatchObject({ statusCode: 400 })
    })

    it('lets only the owner set and clear the repo URL', async () => {
        const owner = await createPlayer()
        const { appId } = await createAppWithGame(1, { ownerUserId: owner })
        await setOwnAppRepo(owner, appId, 'https://github.com/me/my-game')
        expect((await appRow(appId)).repoUrl).toBe('https://github.com/me/my-game')
        await expect(setOwnAppRepo(await createPlayer(), appId, null)).rejects.toMatchObject({ statusCode: 404 })
        await setOwnAppRepo(owner, appId, null)
        expect((await appRow(appId)).repoUrl).toBeNull()
    })

    it('lets the owner edit their game display fields and visibility, and blocks non-owners or retired games', async () => {
        const owner = await createPlayer()
        const stranger = await createPlayer()
        const { appId, game } = await createAppWithGame(2, { ownerUserId: owner, verified: true, visibility: 'public' })

        const updated = await updateOwnedGame(owner, appId, game, {
            name: 'Renamed Game',
            tagline: 'Fresh tagline',
            description: '## Rules\nHave fun',
            playPath: '/play',
            icon: 'lucide:rocket',
            cover: 'https://example.com/banner.png',
            accent: '#7c5cff',
            visibility: 'draft'
        })
        expect(updated).toMatchObject({
            slug: game,
            name: 'Renamed Game',
            tagline: 'Fresh tagline',
            description: '## Rules\nHave fun',
            playPath: '/play',
            icon: 'lucide:rocket',
            cover: 'https://example.com/banner.png',
            accent: '#7c5cff',
            visibility: 'draft',
            counts: false
        })

        const listed = await ownedAppGames(appId)
        expect(listed).toHaveLength(1)
        expect(listed[0]?.visibility).toBe('draft')

        await expect(updateOwnedGame(stranger, appId, game, { visibility: 'public' })).rejects.toMatchObject({ statusCode: 404 })

        const republished = await updateOwnedGame(owner, appId, game, { visibility: 'public' })
        expect(republished.visibility).toBe('public')
        expect(republished.counts).toBe(true)

        await applyManifest(appId, { games: [] })
        await expect(updateOwnedGame(owner, appId, game, { name: 'After retire' })).rejects.toMatchObject({ statusCode: 400 })
    })
})
