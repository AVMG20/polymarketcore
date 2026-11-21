import { sql, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { account, emblemHistory, user } from '#server/database/schema'
import { auth } from '#server/utils/auth'
import { legacyImportStatements, type LegacyExport } from '#server/utils/legacy-import'
import { randomToken } from '#shared/random'

const EMBLEM = JSON.stringify({ version: 1, background: '#312e81', elements: [{ kind: 'shape', shape: 'star', color: '#fbbf24', x: 50, y: 50, size: 40, rotation: 0 }] })

async function run(data: LegacyExport) {
    await db.transaction(async (tx) => {
        for (const statement of legacyImportStatements(data)) await tx.execute(sql.raw(statement))
    })
}

function legacy(tag: string, existingEmail: string): LegacyExport {
    const fresh = `legacy-${tag}@test.local`
    const hash = 'aa'.repeat(16) + ':' + 'bb'.repeat(64)
    return {
        users: [
            { id: `L1-${tag}`, name: 'O\'Brien', email: fresh.toUpperCase(), email_verified: 'true', image: 'javascript:alert(1)', emblem: EMBLEM, prestige: 2, created_at: '2026-03-23 21:14:00.212' },
            { id: `L2-${tag}`, name: 'Hub player', email: existingEmail, email_verified: false, image: null, emblem: EMBLEM, prestige: 1, created_at: '2026-04-01 10:00:00' }
        ],
        accounts: [
            { id: `A1-${tag}`, account_id: `L1-${tag}`, provider_id: 'credential', user_id: `L1-${tag}`, password: hash, scope: null, created_at: '2026-03-23 21:14:00' },
            { id: `A2-${tag}`, account_id: `discord-${tag}`, provider_id: 'discord', user_id: `L1-${tag}`, password: null, scope: 'identify,email', created_at: '2026-03-23 21:14:00' },
            { id: `A3-${tag}`, account_id: `L2-${tag}`, provider_id: 'credential', user_id: `L2-${tag}`, password: hash, scope: null, created_at: '2026-04-01 10:00:00' },
            { id: `A4-${tag}`, account_id: `discord2-${tag}`, provider_id: 'discord', user_id: `L2-${tag}`, password: null, scope: null, created_at: '2026-04-01 10:00:00' }
        ],
        emblemHistory: [
            { id: crypto.randomUUID(), user_id: `L1-${tag}`, emblem: EMBLEM, created_at: '2026-03-24 08:00:00' },
            { id: crypto.randomUUID(), user_id: `L1-${tag}`, emblem: '{"broken":true}', created_at: '2026-03-24 09:00:00' }
        ]
    }
}

describe('legacy import', () => {
    it('imports new players, merges existing ones by email, and is idempotent', async () => {
        const tag = randomToken(8).toLowerCase()
        const existingEmail = `hub-${tag}@test.local`
        const signed = await auth.api.signUpEmail({ body: { email: existingEmail, password: 'password123', name: 'Hub name' } })
        const data = legacy(tag, existingEmail.toUpperCase())

        await run(data)
        await run(data)

        const [fresh] = await db.select().from(user).where(eq(user.id, `L1-${tag}`))
        expect(fresh).toMatchObject({ email: `legacy-${tag}@test.local`, name: 'O\'Brien', emailVerified: true, image: null, emblem: EMBLEM, prestige: 2, gems: 0, role: 'player', welcomeGranted: false })
        expect(fresh!.createdAt.toISOString()).toBe('2026-03-23T21:14:00.212Z')

        const freshAccounts = await db.select().from(account).where(eq(account.userId, `L1-${tag}`))
        expect(freshAccounts.map(a => [a.providerId, a.accountId]).sort()).toEqual([['credential', `L1-${tag}`], ['discord', `discord-${tag}`]])
        expect(await db.select().from(emblemHistory).where(eq(emblemHistory.userId, `L1-${tag}`))).toHaveLength(1)

        // The hub account keeps its id, name and password, and gains the emblem, prestige and Discord.
        expect(await db.select().from(user).where(eq(user.id, `L2-${tag}`))).toHaveLength(0)
        const [merged] = await db.select().from(user).where(eq(user.id, signed.user.id))
        expect(merged).toMatchObject({ name: 'Hub name', emblem: EMBLEM, prestige: 1 })
        const mergedAccounts = await db.select().from(account).where(eq(account.userId, signed.user.id))
        expect(mergedAccounts.map(a => a.providerId).sort()).toEqual(['credential', 'discord'])
        expect(mergedAccounts.find(a => a.providerId === 'credential')!.password).not.toBe(data.accounts[2]!.password)
    })

    it('keeps an old password working on the hub', async () => {
        const tag = randomToken(8).toLowerCase()
        const { hashPassword } = await import('better-auth/crypto')
        const email = `pw-${tag}@test.local`
        await run({
            users: [{ id: `P-${tag}`, name: 'Pw', email, email_verified: true, image: null, emblem: null, prestige: 0, created_at: '2026-01-01 00:00:00' }],
            accounts: [{ id: `PA-${tag}`, account_id: `P-${tag}`, provider_id: 'credential', user_id: `P-${tag}`, password: await hashPassword('old-site-password'), scope: null, created_at: '2026-01-01 00:00:00' }],
            emblemHistory: []
        })
        const res = await auth.api.signInEmail({ body: { email, password: 'old-site-password' } })
        expect(res.user.id).toBe(`P-${tag}`)
    })
})
