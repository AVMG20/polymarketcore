import type { LaunchResponse } from '#shared/types/api'

/**
 * Flow A (contract §1): fetch the iframe URL with a fresh launch token for a
 * game. Runs on the client only, because the token lives five minutes and
 * must not be cached in the SSR payload.
 */
export function useGameLaunch(slug: MaybeRefOrGetter<string>) {
    const launch = ref<LaunchResponse | null>(null)
    const error = ref<string | null>(null)
    const pending = ref(false)

    async function load() {
        pending.value = true
        error.value = null
        try {
            launch.value = await apiFetch<LaunchResponse>(`/api/play/${encodeURIComponent(toValue(slug))}/launch`)
        } catch (e) {
            error.value = apiErrorMessage(e, 'Could not start this game')
        } finally {
            pending.value = false
        }
    }

    onMounted(load)
    watch(() => toValue(slug), load)

    return { launch, error, pending, reload: load }
}
