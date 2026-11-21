/**
 * Import players from the old site (polymarket.avmg.nl): logins (passwords and
 * Discord), emblems with their history, and the prestige tier. Idempotent: run
 * it again to pick up players who joined the old site since.
 *
 *   bun scripts/import-legacy.ts export.json           apply to DATABASE_URL in one transaction
 *   bun scripts/import-legacy.ts export.json --print   print the statements as a JSON array
 *
 * `export.json` is `{ users, accounts, emblemHistory }` with the old database's
 * rows (snake_case columns), from:
 *   select id, name, email, email_verified, image, emblem, prestige, created_at from "user";
 *   select id, account_id, provider_id, user_id, password, scope, created_at from account;
 *   select id, user_id, emblem, created_at from emblem_history;
 *
 * `--print` is for a database you can only reach through a SQL console: every
 * statement stands on its own, so they can be sent in batches.
 */
import { readFile } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { legacyImportStatements, type LegacyExport } from '#server/utils/legacy-import'

const [file, flag] = process.argv.slice(2)
if (!file) {
    console.error('usage: bun scripts/import-legacy.ts export.json [--print]')
    process.exit(1)
}

const data = JSON.parse(await readFile(file, 'utf8')) as LegacyExport
const statements = legacyImportStatements(data)

if (flag === '--print') {
    console.log(JSON.stringify(statements))
    process.exit(0)
}

const { db } = await import('#server/database/index')
await db.transaction(async (tx) => {
    for (const statement of statements) await tx.execute(sql.raw(statement))
})
console.log(`Imported ${data.users.length} players, ${data.accounts.length} logins, ${data.emblemHistory.length} emblems (${statements.length} statements).`)
process.exit(0)
