import { resolve } from 'node:path'

/**
 * Tests never touch the dev database: they run against `<dev db>_test` on the
 * same server (or TEST_DATABASE_URL), created and migrated by global-setup.ts.
 */
export function testDatabaseUrl(): string {
    try {
        process.loadEnvFile(resolve(import.meta.dirname, '../../.env'))
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
    const url = new URL(process.env.DATABASE_URL ?? 'postgres://pnxcore:pnxcore@localhost:5433/pnxcore')
    url.pathname = `${url.pathname.replace(/^\//, '')}_test`
    return url.toString()
}
