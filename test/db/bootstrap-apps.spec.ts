import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#server/database/index'
import { apps } from '#server/database/schema'
import { hashApiKey } from '#server/utils/apps'
import { bootstrapApps, parseBootstrapApps } from '#server/utils/bootstrap-apps'
import { randomToken } from '#shared/random'

const dev = { production: false }
const key = () => `pnx_${randomToken(32)}`
const appId = () => `boot-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`

describe('BOOTSTRAP_APPS parsing', () => {
    it('is empty when unset and normalises URLs like the developer API', () => {
        expect(parseBootstrapApps(undefined, dev)).toEqual([])
        expect(parseBootstrapApps('  ', dev)).toEqual([])
        const k = key()
        const [app] = parseBootstrapApps(JSON.stringify([{ id: 'casino', name: 'Casino', baseUrl: 'https://Casino.example.com/', key: k }]), dev)
        expect(app).toEqual({ id: 'casino', name: 'Casino', baseUrl: 'https://casino.example.com', returnUrlPrefixes: ['https://casino.example.com/'], keyHash: hashApiKey(k) })
    })

    it('fails loudly, naming the entry and field, and never echoes the key', () => {
        const k = key()
        expect(() => parseBootstrapApps('[{"id":', dev)).toThrow(/BOOTSTRAP_APPS is not valid JSON/)
        expect(() => parseBootstrapApps('{}', dev)).toThrow(/must be a JSON array/)
        expect(() => parseBootstrapApps(JSON.stringify([{ id: 'casino', name: 'C', baseUrl: 'ftp://x.com', key: k }]), dev)).toThrow(/BOOTSTRAP_APPS\[0\]: baseUrl must use http or https/)
        expect(() => parseBootstrapApps(JSON.stringify([{ id: 'casino', name: 'C', baseUrl: 'https://x.com', key: 'short' }]), dev)).toThrow(/BOOTSTRAP_APPS\[0\]\.key/)
        expect(() => parseBootstrapApps(JSON.stringify([{ id: 'casino', name: 'C', baseUrl: 'http://casino.example.com', key: k }]), { production: true })).toThrow(/must use https/)
        expect(() => parseBootstrapApps(JSON.stringify([{ id: 'casino', name: 'C', baseUrl: 'https://x.com', key: 'pnx_dev_casino_key_change_me' }]), { production: true })).toThrow(/public dev key/)
        let message = ''
        try {
            parseBootstrapApps(JSON.stringify([{ id: 'Bad Id', name: 'C', baseUrl: 'https://x.com', key: k }]), dev)
        } catch (err) {
            message = (err as Error).message
        }
        expect(message).toMatch(/BOOTSTRAP_APPS\[0\]\.id/)
        expect(message).not.toContain(k)
    })
})

describe('bootstrapApps', () => {
    it('creates a verified, ownerless app once, even from 10 processes at once', async () => {
        const id = appId()
        const list = parseBootstrapApps(JSON.stringify([{ id, name: 'Casino', baseUrl: 'http://localhost:3200', key: key() }]), dev)
        const results = await Promise.all(Array.from({ length: 10 }, () => bootstrapApps(list)))
        expect(results.flat().filter(r => r.outcome === 'created')).toHaveLength(1)
        const [row] = await db.select().from(apps).where(eq(apps.id, id))
        expect(row).toMatchObject({ verified: true, status: 'active', ownerUserId: null, apiKeyHash: list[0]!.keyHash })
    })

    it('never overwrites an existing app or its key', async () => {
        const id = appId()
        const first = parseBootstrapApps(JSON.stringify([{ id, name: 'Casino', baseUrl: 'http://localhost:3200', key: key() }]), dev)
        await bootstrapApps(first)
        // The admin rotated the key and disabled the app; a restart with another config changes nothing.
        const rotated = hashApiKey(key())
        await db.update(apps).set({ status: 'disabled', apiKeyHash: rotated }).where(eq(apps.id, id))
        const second = parseBootstrapApps(JSON.stringify([{ id, name: 'Other', baseUrl: 'http://localhost:4000', key: key() }]), dev)
        expect(await bootstrapApps(second)).toEqual([{ id, outcome: 'exists' }])
        const [row] = await db.select().from(apps).where(eq(apps.id, id))
        expect(row).toMatchObject({ name: 'Casino', baseUrl: 'http://localhost:3200', status: 'disabled', apiKeyHash: rotated })
    })

    it('skips an app whose key already belongs to another app', async () => {
        const k = key()
        const [a] = parseBootstrapApps(JSON.stringify([{ id: appId(), name: 'A', baseUrl: 'http://localhost:3200', key: k }]), dev)
        const [b] = parseBootstrapApps(JSON.stringify([{ id: appId(), name: 'B', baseUrl: 'http://localhost:3201', key: k }]), dev)
        await bootstrapApps([a!])
        expect(await bootstrapApps([b!])).toEqual([{ id: b!.id, outcome: 'key-in-use' }])
    })
})
