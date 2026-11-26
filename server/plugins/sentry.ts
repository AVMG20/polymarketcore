import * as Sentry from '@sentry/bun'
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import { reportError } from '#server/utils/report-error'

/**
 * Server errors go to Rustrak (Sentry-compatible) when NUXT_PUBLIC_SENTRY_DSN is set.
 * Only 5xx are reported: 4xx are the API answering a bad request (`Not enough gems`,
 * a bad app key), not faults. better-auth catches its own errors: `server/utils/auth.ts`
 * reports those. Uncaught exceptions and unhandled rejections are reported too.
 */
export default defineNitroPlugin((nitroApp) => {
    const { sentryDsn, sentryEnvironment } = useRuntimeConfig().public
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
            return event
        }
        // No tracesSampleRate: any value, 0 included, turns tracing on.
    })

    nitroApp.hooks.hook('error', (error, { event }) => {
        const status = (error as { statusCode?: number }).statusCode ?? 500
        if (status < 500) return
        // The h3 error itself: its message and stack are the original's, and the cause chain
        // (a DrizzleQueryError with its SQL) comes along as linked errors.
        reportError(error, event ? { method: event.method, path: event.path.split('?')[0]! } : undefined)
    })
})
