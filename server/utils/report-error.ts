import * as Sentry from '@sentry/bun'

/**
 * Sends a server fault to Rustrak (Sentry-compatible). A no-op until `server/plugins/sentry.ts` has
 * initialised the SDK, so tests and scripts that import this send nothing.
 */
export function reportError(error: unknown, tags?: Record<string, string>) {
    Sentry.withScope((scope) => {
        if (tags) scope.setTags(tags)
        Sentry.captureException(error)
    })
}
