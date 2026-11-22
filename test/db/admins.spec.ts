import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { setPlayerAdmin } from '#server/utils/admins'
import { listPlayersForAdmin, maskEmail } from '#server/utils/hub'
import { createPlayer } from './helpers'

const role = async (id: string) => (await db.select({ role: user.role }).from(user).where(eq(user.id, id)))[0]!.role
const listed = async (id: string) => (await listPlayersForAdmin({ q: id, limit: 5, offset: 0 })).players.find(p => p.id === id)!
const envBefore = process.env.ADMIN_EMAILS

afterEach(() => {
    process.env.ADMIN_EMAILS = envBefore
})

describe('admin roles', () => {
    it('lets an admin make and unmake another admin', async () => {
        const actor = await createPlayer()
        const target = await createPlayer()
        await setPlayerAdmin(actor, target, true)
        expect(await role(target)).toBe('admin')
        expect(await listed(target)).toMatchObject({ admin: true, adminFixed: false })
        await setPlayerAdmin(actor, target, false)
        expect(await role(target)).toBe('player')
    })

    it('refuses changing your own role, unknown players and ADMIN_EMAILS admins', async () => {
        const actor = await createPlayer()
        const fixed = await createPlayer()
        await expect(setPlayerAdmin(actor, actor, false)).rejects.toMatchObject({ statusCode: 400 })
        await expect(setPlayerAdmin(actor, 'nobody', true)).rejects.toMatchObject({ statusCode: 404 })
        process.env.ADMIN_EMAILS = `${fixed}@test.local`
        expect(await listed(fixed)).toMatchObject({ admin: true, adminFixed: true })
        await expect(setPlayerAdmin(actor, fixed, false)).rejects.toMatchObject({ statusCode: 400 })
    })

    it('masks emails in the player list', async () => {
        expect(maskEmail('rijstenpap1234@hotmail.com')).toBe('rij****@hotmail.com')
        expect(maskEmail('ab@x.nl')).toBe('ab****@x.nl')
        const id = await createPlayer()
        expect((await listed(id)).email).toBe(`${id.slice(0, 3)}****@test.local`)
    })
})
