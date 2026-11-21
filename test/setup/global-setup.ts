import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { testDatabaseUrl } from './test-db'

// Create the test database once and bring it to the latest migration.
export default async function setup() {
    const url = new URL(testDatabaseUrl())
    const name = url.pathname.replace(/^\//, '')
    const admin = new URL(url)
    admin.pathname = '/postgres'

    const client = new pg.Client({ connectionString: admin.toString() })
    await client.connect()
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name])
    if (!rowCount) await client.query(`create database "${name.replace(/"/g, '')}"`)
    await client.end()

    const db = drizzle({ connection: { connectionString: url.toString(), max: 1 } })
    await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') })
    await db.$client.end()
}
