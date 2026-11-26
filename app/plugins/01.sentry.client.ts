// Browser errors go to Rustrak (Sentry-compatible) when NUXT_PUBLIC_SENTRY_DSN is set.
// Only the player's id is attached: no IP, no component props. The SDK is loaded on demand,
// so a build without a DSN ships none of it to the browser.
export default defineNuxtPlugin({
    name: 'sentry',
    parallel: true,
    async setup(nuxtApp) {
        const { sentryDsn, sentryEnvironment } = useRuntimeConfig().public
        if (!sentryDsn) return

        const Sentry = await import('@sentry/vue')
        Sentry.init({
            app: nuxtApp.vueApp,
            dsn: sentryDsn,
            environment: sentryEnvironment || (import.meta.dev ? 'development' : 'production'),
            dataCollection: { userInfo: false },
            attachProps: false,
            // Sentry's own errorHandler would stop Nuxt from removing its startup handler, which
            // then turns every later component error into the full-page error screen.
            attachErrorHandler: false,
            // No release health: its session envelope asks the server to fill in the IP.
            integrations: integrations => integrations.filter(i => i.name !== 'BrowserSession')
            // No tracesSampleRate: any value, 0 included, turns tracing on.
        })

        // Errors Nuxt sees itself; the SDK skips an error it already captured.
        nuxtApp.hook('vue:error', (error) => {
            Sentry.captureException(error)
        })
        nuxtApp.hook('app:error', (error) => {
            Sentry.captureException(error)
        })

        const { me } = useMe()
        watch(() => me.value?.id, id => Sentry.setUser(id ? { id } : null), { immediate: true })
    }
})
