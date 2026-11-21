/**
 * Dev seed (contract "Local dev"), idempotent: `bun run db:seed`.
 * - admin user dev@polynux.local / devdevdev, created through better-auth so the
 *   password hash and the sign-up hooks (welcome gems) are the real ones
 * - app `casino`, owned by that admin, verified, with the API key from
 *   SEED_CASINO_APP_KEY (re-hashed on every run)
 *
 * Never part of the deploy path, and it refuses to run in production: there
 * the casino comes from BOOTSTRAP_APPS (or registers through the developer API).
 */
import { eq } from 'drizzle-orm'
import { db } from '#server/database/index'
import { apps, user } from '#server/database/schema'
import { hashApiKey } from '#server/utils/apps'
import { auth } from '#server/utils/auth'

const DEFAULT_KEY = 'pnx_dev_casino_key_change_me'
const CASINO_KEY = process.env.SEED_CASINO_APP_KEY || DEFAULT_KEY
const DEV_EMAIL = 'dev@polynux.local'
const DEV_PASSWORD = 'devdevdev'

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed in production: register apps through the developer API (see /developers.md).')
    if (CASINO_KEY === DEFAULT_KEY) console.error('The default casino key is public; it must never reach production.')
    process.exit(1)
}

const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, DEV_EMAIL))
if (!existing) {
    await auth.api.signUpEmail({ body: { email: DEV_EMAIL, password: DEV_PASSWORD, name: 'Dev' } })
    console.log(`user ${DEV_EMAIL}: created`)
} else {
    console.log(`user ${DEV_EMAIL}: exists`)
}
const [dev] = await db.update(user).set({ role: 'admin' }).where(eq(user.email, DEV_EMAIL)).returning({ id: user.id })
console.log(`user ${DEV_EMAIL}: admin`)

const casino = {
    id: 'casino',
    name: 'Polynux Casino',
    baseUrl: 'http://localhost:3200',
    returnUrlPrefixes: ['http://localhost:3200/'],
    apiKeyHash: hashApiKey(CASINO_KEY),
    status: 'active' as const,
    ownerUserId: dev!.id,
    verified: true,
    verifiedAt: new Date()
}
await db.insert(apps).values(casino).onConflictDoUpdate({
    target: apps.id,
    set: {
        name: casino.name,
        baseUrl: casino.baseUrl,
        returnUrlPrefixes: casino.returnUrlPrefixes,
        apiKeyHash: casino.apiKeyHash,
        status: 'active',
        ownerUserId: casino.ownerUserId,
        verified: true
    }
})
console.log(`app casino: ${casino.baseUrl}, verified, owner ${DEV_EMAIL} (key from ${process.env.SEED_CASINO_APP_KEY ? 'SEED_CASINO_APP_KEY' : 'default'})`)

await db.$client.end()
