// Tells server/plugins/sentry.ts which page the request is for, so page traces group by route
// (`/players/:id()`) instead of one entry per URL. Resolved from the requested URL, so a page
// that redirects keeps its own name.
export default defineNuxtPlugin((nuxtApp) => {
    const event = useRequestEvent()
    if (!event) return
    const path = nuxtApp.$router.resolve(event.path).matched.at(-1)?.path
    if (path) event.context.sentryRoute = path
})
