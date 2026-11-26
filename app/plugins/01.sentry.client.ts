import { scrubEvent, scrubSpan } from '#shared/sentry-scrub'

// Browser errors, page-load and navigation timings and Web Vitals go to Rustrak (Sentry-compatible)
// when NUXT_PUBLIC_SENTRY_DSN is set; NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE is the share of page
// loads and navigations traced. Only the player's id is attached: no IP, no component props, no
// query strings. The SDK is loaded on demand, so a build without a DSN ships none of it.
export default defineNuxtPlugin({
    name: 'sentry',
    parallel: true,
    async setup(nuxtApp) {
        const { sentryDsn, sentryEnvironment, sentryTracesSampleRate } = useRuntimeConfig().public
        if (!sentryDsn) return

        const Sentry = await import('@sentry/vue')
        const router = nuxtApp.$router
        Sentry.init({
            app: nuxtApp.vueApp,
            dsn: sentryDsn,
            environment: sentryEnvironment || (import.meta.dev ? 'development' : 'production'),
            dataCollection: { userInfo: false, urlQueryParams: false },
            attachProps: false,
            // Sentry's own errorHandler would stop Nuxt from removing its startup handler, which
            // then turns every later component error into the full-page error screen.
            attachErrorHandler: false,
            integrations: integrations => [
                // No release health: its session envelope asks the server to fill in the IP.
                ...integrations.filter(i => i.name !== 'BrowserSession'),
                // Page loads, navigations (named by route, `/players/:id()`) and Web Vitals.
                Sentry.browserTracingIntegration({ router, routeLabel: 'path' })
            ],
            tracesSampleRate: Number(sentryTracesSampleRate) || 0,
            beforeSend: event => scrubEvent(event),
            beforeSendSpan: span => scrubSpan(span)
        })

        // The SDK loads after the first navigation, which its router hook then never sees:
        // name the page load by its route here.
        const span = Sentry.getActiveSpan()
        const root = span && Sentry.getRootSpan(span)
        const route = router.currentRoute.value.matched.at(-1)?.path
        if (root && route && Sentry.spanToJSON(root).attributes?.['sentry.op'] === 'pageload') {
            root.updateName(route)
            root.setAttribute('sentry.source', 'route')
        }

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
