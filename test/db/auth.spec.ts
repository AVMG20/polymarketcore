import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { auth, fitName, NAME_MAX_LENGTH } from '#server/utils/auth'
import { STARTER_GEMS } from '#shared/economy'
import { randomToken } from '#shared/random'
import { ledgerSum } from './helpers'

const email = () => `auth-${randomToken(9).toLowerCase()}@test.local`

describe('sign-up', () => {
    it('fits long or control-character names instead of refusing the sign-up', () => {
        expect(fitName('  Bob  ')).toBe('Bob')
        expect(fitName('Al‮ice\u0007')).toBe('Alice')
        expect(Array.from(fitName('★'.repeat(40)))).toHaveLength(NAME_MAX_LENGTH)
    })

    it('pays the welcome grant once and keeps role and gems out of the client\'s hands', async () => {
        const res = await auth.api.signUpEmail({
            body: { email: email(), password: 'password123', name: 'x'.repeat(40), gems: 1_000_000, role: 'admin', welcomeGranted: true } as never
        })
        const [row] = await db.select().from(user).where(eq(user.id, res.user.id))
        expect(row).toMatchObject({ gems: STARTER_GEMS, role: 'player', welcomeGranted: true, name: 'x'.repeat(NAME_MAX_LENGTH) })
        expect(await ledgerSum(res.user.id)).toBe(STARTER_GEMS)
    })

    it('refuses an avatar that is not an https image URL', async () => {
        await expect(auth.api.signUpEmail({ body: { email: email(), password: 'password123', name: 'Eve', image: 'javascript:alert(1)' } }))
            .rejects.toMatchObject({ statusCode: 400 })
    })
})
