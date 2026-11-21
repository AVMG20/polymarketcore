import { defineNitroPlugin } from 'nitropack/runtime'
import { bootstrapApps, parseBootstrapApps } from '#server/utils/bootstrap-apps'

/**
 * Registers the apps in BOOTSTRAP_APPS on start (server/utils/bootstrap-apps.ts).
 * Invalid JSON or an invalid entry throws here, which stops the server: a typo
 * must not boot a hub without its casino.
 */
export default defineNitroPlugin(() => {
    const list = parseBootstrapApps(process.env.BOOTSTRAP_APPS)
    if (list.length === 0) return
    bootstrapApps(list)
        .then((results) => {
            for (const { id, outcome } of results) {
                if (outcome === 'key-in-use') console.error(`[bootstrap] app ${id}: not created, its key already belongs to another app`)
                else console.log(`[bootstrap] app ${id}: ${outcome === 'created' ? 'created (verified)' : 'exists, left unchanged'}`)
            }
        })
        .catch((err) => {
            // The driver's own message: drizzle's wrapper would print the query parameters.
            const cause = (err as { cause?: unknown }).cause
            console.error('[bootstrap] BOOTSTRAP_APPS failed:', cause instanceof Error ? cause.message : err instanceof Error ? err.message : err)
        })
})
