import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { searchPlayers } from '#server/utils/hub'
import { createPlayer } from './helpers'

async function named(name: string) {
    const id = await createPlayer()
    await db.update(user).set({ name }).where(eq(user.id, id))
    return id
}

describe('player search', () => {
    it('matches names, exact and prefix hits first', async () => {
        const tag = `Zq${Date.now().toString(36)}`
        const inside = await named(`Big${tag}fan`)
        const prefix = await named(`${tag}ster`)
        const exact = await named(tag)
        const ids = (await searchPlayers(tag.toLowerCase())).map(p => p.id)
        expect(ids).toEqual([exact, prefix, inside])
        expect((await searchPlayers(tag))[0]).toMatchObject({ id: exact, stars: 0 })
    })

    it('treats wildcards literally and ignores blanks', async () => {
        expect(await searchPlayers('  ')).toEqual([])
        expect(await searchPlayers('%_%_%_%')).toEqual([])
    })
})
