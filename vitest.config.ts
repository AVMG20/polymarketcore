import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['test/**/*.spec.ts'],
        // Tests run on Bun like the app; Vitest's forks pool can't start workers under Bun.
        pool: 'threads',
        globalSetup: ['test/setup/global-setup.ts'],
        setupFiles: ['test/setup/env.ts'],
        // DB tests share one Postgres; keep files sequential so pools stay small.
        fileParallelism: false,
        env: { DATABASE_POOL_MAX: '15' }
    },
    resolve: {
        alias: {
            '#shared': resolve(import.meta.dirname, 'shared'),
            '#server': resolve(import.meta.dirname, 'server')
        }
    }
})
