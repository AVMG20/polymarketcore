import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export const db = drizzle({
    connection: {
        connectionString: process.env.DATABASE_URL!,
        // Pin the session zone so `now()` and date math agree everywhere.
        options: '-c timezone=UTC',
        max: Number(process.env.DATABASE_POOL_MAX ?? 20),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000
    },
    schema
})

/**
 * Anything that can run a statement: the pool or an open transaction. Code that
 * holds a row lock MUST pass its `tx`: a write on a second pool connection
 * would wait on the lock it is holding and deadlock.
 */
export type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete' | 'query' | 'execute'>
