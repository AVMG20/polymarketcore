import * as Sentry from '@sentry/bun'
import type { H3Event } from 'h3'
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { reportError } from '#server/utils/report-error'
import { scrubEvent, scrubSpan } from '#shared/sentry-scrub'

// Health checks (every 30 s), the presence websocket and Nuxt's build files would drown out the real requests.
const UNTRACED = /^\/(healthz\b|api\/presence\b|_nuxt\/)/

/**
 * Server errors and request traces go to Rustrak (Sentry-compatible) when NUXT_PUBLIC_SENTRY_DSN
 * is set. Only 5xx are reported: 4xx are the API answering a bad request (`Not enough gems`,
 * a bad app key), not faults. better-auth catches its own errors: `server/utils/auth.ts`
 * reports those. Uncaught exceptions and unhandled rejections are reported too.
 * NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE is the share of requests traced (a trace the browser
 * started keeps the browser's decision).
 */
export default defineNitroPlugin((nitroApp) => {
    const { sentryDsn, sentryEnvironment, sentryTracesSampleRate } = useRuntimeConfig().public
    if (!sentryDsn) return

    Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment || (import.meta.dev ? 'development' : 'production'),
        // No IPs, headers, cookies, query strings or request bodies (sign-in bodies hold passwords).
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false
        },
        // Console lines can hold anything a handler logged.
        beforeBreadcrumb: breadcrumb => (breadcrumb.category === 'console' ? null : breadcrumb),
        // A DrizzleQueryError message ends in the query's bound values (emails, ids): keep the SQL only.
        beforeSend: (event) => {
            for (const exception of event.exception?.values ?? []) {
                if (exception.value) exception.value = exception.value.replace(/\nparams: [\s\S]*$/, '\nparams: [Filtered]')
            }
            return scrubEvent(event)
        },
        beforeSendSpan: span => scrubSpan(span),
        // Streamed spans are named by method only until a route is known: test the path.
        tracesSampler: ({ attributes, inheritOrSampleWith }) => (UNTRACED.test(String(attributes?.['url.path'] ?? ''))
            ? 0
            : inheritOrSampleWith(Number(sentryTracesSampleRate) || 0))
    })

    // Name each trace by its route (`GET /api/players/:id`), not its URL, so requests group.
    // A thrown error skips `beforeResponse`, so the error hook names those.
    nitroApp.hooks.hook('beforeResponse', nameRequestSpan)

    nitroApp.hooks.hook('error', (error, { event }) => {
        if (event) nameRequestSpan(event)
        const status = (error as { statusCode?: number }).statusCode ?? 500
        if (status < 500) return
        // The h3 error itself: its message and stack are the original's, and the cause chain
        // (a DrizzleQueryError with its SQL) comes along as linked errors.
        reportError(error, event ? { method: event.method, path: event.path.split('?')[0]! } : undefined)
    })
})

// Pages all match Nuxt's `/**` renderer: app/plugins/sentry-route.server.ts passes the page route.
function nameRequestSpan(event: H3Event) {
    const matched = event.context.matchedRoute?.path
    const route = matched && matched !== '/**' ? matched : event.context.sentryRoute as string | undefined
    const span = Sentry.getActiveSpan()
    if (!route || !span) return
    const root = Sentry.getRootSpan(span)
    root.updateName(`${event.method} ${route}`)
    root.setAttribute('http.route', route)
    root.setAttribute('sentry.source', 'route')
}
