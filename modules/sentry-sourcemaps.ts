import { addVitePlugin, defineNuxtModule } from '@nuxt/kit'
import { sentryVitePlugin } from '@sentry/vite-plugin'

/**
 * Uploads the browser build's source maps to Rustrak, so minified frames in browser errors read
 * as the code we wrote. Runs only in a production build with SENTRY_AUTH_TOKEN set (a Rustrak API
 * token with `source-maps:create`; the Dockerfile passes it as a build secret). The maps are
 * `hidden` (no sourceMappingURL comment) and deleted after the upload, so they are never served.
 * Server stack traces need none of this: Bun applies the server build's own maps.
 */
export default defineNuxtModule({
    meta: { name: 'sentry-sourcemaps' },
    setup(_options, nuxt) {
        const authToken = process.env.SENTRY_AUTH_TOKEN
        if (nuxt.options.dev || nuxt.options._prepare || !authToken) return

        const sourcemap = nuxt.options.sourcemap
        nuxt.options.sourcemap = { server: typeof sourcemap === 'object' ? sourcemap.server : sourcemap, client: 'hidden' }

        addVitePlugin(sentryVitePlugin({
            url: process.env.SENTRY_URL || 'https://rustrak.bitploy.nl',
            authToken,
            // Rustrak has no organisations and ignores this, but the plugin needs one.
            org: 'polynux',
            project: process.env.SENTRY_PROJECT || 'polynux-core',
            telemetry: false,
            // Rustrak matches maps to frames by debug ID; no release needed.
            release: { create: false, finalize: false, inject: false },
            sourcemaps: { filesToDeleteAfterUpload: [`${nuxt.options.buildDir}/dist/client/**/*.map`] }
        }), { server: false, dev: false })
    }
})
