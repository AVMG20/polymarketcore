import { defineConfig } from 'drizzle-kit'

try {
    process.loadEnvFile('.env')
} catch {
    // no .env: the environment provides DATABASE_URL (containers, CI)
}

export default defineConfig({
    out: './drizzle',
    schema: './server/database/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!
    }
})
