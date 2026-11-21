import { describe, expect, it } from 'vitest'
import { registerApp } from '#server/utils/app-registry'
import { createDeveloperToken, listDeveloperTokens, revokeDeveloperToken } from '#server/utils/developer-tokens'
import { MAX_DEVELOPER_APPS, MAX_DEVELOPER_TOKENS } from '#shared/economy'
import { randomToken } from '#shared/random'
import { burst, createPlayer } from './helpers'

describe('developer tokens', () => {
    it('parallel creates stop at the limit; revoking frees a slot', async () => {
        const owner = await createPlayer()
        const { ok, failed } = await burst(15, i => createDeveloperToken(owner, `t${i}`))
        expect(ok).toHaveLength(MAX_DEVELOPER_TOKENS)
        expect(failed.every(f => f.statusCode === 400)).toBe(true)
        expect(ok.every(t => t.secret.startsWith('pnxd_'))).toBe(true)
        await revokeDeveloperToken(owner, ok[0]!.token.id)
        await expect(revokeDeveloperToken(owner, ok[0]!.token.id)).rejects.toMatchObject({ statusCode: 404 })
        expect(await listDeveloperTokens(owner)).toHaveLength(MAX_DEVELOPER_TOKENS - 1)
        await expect(createDeveloperToken(owner, 'again')).resolves.toBeTruthy()
    })
})

describe('developer apps', () => {
    it('parallel creates stop at the per-player app limit', async () => {
        const owner = await createPlayer()
        const prefix = `d-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
        const { ok, failed } = await burst(8, i => registerApp({
            id: `${prefix}-${i}`,
            name: 'Dev app',
            baseUrl: 'http://localhost:3999',
            ownerUserId: owner,
            limitOwner: true
        }))
        expect(ok).toHaveLength(MAX_DEVELOPER_APPS)
        expect(failed.every(f => f.statusCode === 400)).toBe(true)
        expect(ok[0]!.app.returnUrlPrefixes).toEqual(['http://localhost:3999/'])
    })

    it('says which URL field to fix', async () => {
        const owner = await createPlayer()
        await expect(registerApp({
            id: `d-${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`,
            name: 'Bad',
            baseUrl: 'https://game.example.com',
            returnUrlPrefixes: ['https://elsewhere.example.com/'],
            ownerUserId: owner,
            limitOwner: true
        })).rejects.toMatchObject({ statusCode: 400, statusMessage: "returnUrlPrefixes[0] must share the app's baseUrl origin (https://game.example.com)" })
    })
})
