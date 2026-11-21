import { toast } from 'vue-sonner'
import type { CreatedDeveloperToken, DeveloperTokensResponse } from '#shared/types/api'

/**
 * The player's developer tokens (`/api/developer/tokens`). `revealed` holds the
 * plaintext of the token just created: shown once, never retrievable again.
 */
export function useDeveloperTokens() {
    const { data, pending, refresh } = useAsyncData('pnx-dev-tokens', () => apiFetch<DeveloperTokensResponse>('/api/developer/tokens'))
    const revealed = ref<CreatedDeveloperToken | null>(null)
    const busy = ref(false)

    const tokens = computed(() => data.value?.tokens ?? [])
    const max = computed(() => data.value?.max ?? 10)

    async function create(name: string) {
        busy.value = true
        try {
            revealed.value = await apiFetch<CreatedDeveloperToken>('/api/developer/tokens', { method: 'POST', body: { name } })
            await refresh()
            return revealed.value
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not create the token'))
            return null
        } finally {
            busy.value = false
        }
    }

    async function revoke(id: string) {
        busy.value = true
        try {
            await apiFetch(`/api/developer/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' })
            await refresh()
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not revoke the token'))
        } finally {
            busy.value = false
        }
    }

    return { tokens, max, pending, busy, revealed, create, revoke }
}
