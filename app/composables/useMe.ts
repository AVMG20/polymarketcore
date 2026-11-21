import type { Me } from '#shared/types/api'

/**
 * The signed-in player (`GET /api/me`), shared app-wide. `plugins/me.ts`
 * loads it once per page load (on the server during SSR), so pages and
 * middleware can read `me` synchronously.
 *
 * Update it in place from responses that carry the new value (`setGems` after
 * a claim or a `wallet` bridge message) instead of refetching.
 */
export function useMe() {
    const me = useState<Me | null>('pnx-me', () => null)
    const loaded = useState('pnx-me-loaded', () => false)

    const loggedIn = computed(() => !!me.value)
    const isAdmin = computed(() => me.value?.role === 'admin')

    async function refresh(): Promise<Me | null> {
        try {
            me.value = await apiFetch<Me>('/api/me')
        } catch (e) {
            if (apiErrorStatus(e) !== 401) throw e
            me.value = null
        }
        loaded.value = true
        return me.value
    }

    function setGems(gems: number) {
        if (me.value && Number.isFinite(gems)) me.value = { ...me.value, gems }
    }

    function patch(changes: Partial<Me>) {
        if (me.value) me.value = { ...me.value, ...changes }
    }

    function clear() {
        me.value = null
    }

    return { me, loaded, loggedIn, isAdmin, refresh, setGems, patch, clear }
}
