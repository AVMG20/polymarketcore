// Load the signed-in player once per page load (on the server during SSR; the
// state is reused on hydration), so middleware and pages can read `useMe()`.
export default defineNuxtPlugin(async () => {
    const { loaded, refresh } = useMe()
    if (!loaded.value) await refresh().catch(() => null)
})
