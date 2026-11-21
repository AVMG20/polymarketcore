// Load the signed-in player once per page load (on the server during SSR; the
// state is reused on hydration), so middleware and pages can read `useMe()`.
export default defineNuxtPlugin(async () => {
    const { me, loaded, refresh } = useMe()
    if (!loaded.value) await refresh().catch(() => null)

    // A tab left open goes stale (the claim pile rolls over at midnight, gems get
    // spent in a game): refetch when it comes back to the front, at most every 30 s.
    if (import.meta.client) {
        let last = Date.now()
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !me.value || Date.now() - last < 30_000) return
            last = Date.now()
            refresh().catch(() => null)
        })
    }
})
