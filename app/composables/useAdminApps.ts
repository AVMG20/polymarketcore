import { toast } from 'vue-sonner'
import type { AppInfo, AppKeyResponse, AppsResponse, VerifyAppResponse } from '#shared/types/api'

export interface NewAppInput {
    id: string
    name: string
    baseUrl: string
    returnUrlPrefixes: string[]
}

/**
 * Admin app registry. `revealedKey` holds the plaintext key from the last
 * create or rotate: it is shown once and never retrievable again.
 */
export function useAdminApps() {
    const { data, pending, error, refresh } = useAsyncData('pnx-admin-apps', () => apiFetch<AppsResponse>('/api/admin/apps'))
    const revealedKey = ref<{ appId: string, apiKey: string } | null>(null)
    const busy = ref(false)

    async function act<T>(fn: () => Promise<T>, fallback: string): Promise<T | null> {
        busy.value = true
        try {
            const res = await fn()
            await refresh()
            return res
        } catch (e) {
            toast.error(apiErrorMessage(e, fallback))
            return null
        } finally {
            busy.value = false
        }
    }

    async function create(input: NewAppInput) {
        const res = await act(() => apiFetch<AppKeyResponse>('/api/admin/apps', { method: 'POST', body: input }), 'Could not create the app')
        if (res) revealedKey.value = { appId: res.app.id, apiKey: res.apiKey }
        return res
    }

    async function rotateKey(appId: string) {
        const res = await act(() => apiFetch<AppKeyResponse>(`/api/admin/apps/${encodeURIComponent(appId)}/rotate-key`, { method: 'POST' }), 'Could not rotate the key')
        if (res) revealedKey.value = { appId: res.app.id, apiKey: res.apiKey }
        return res
    }

    function update(appId: string, changes: Partial<Pick<AppInfo, 'name' | 'baseUrl' | 'returnUrlPrefixes' | 'status'>>) {
        return act(() => apiFetch<{ app: AppInfo }>(`/api/admin/apps/${encodeURIComponent(appId)}`, { method: 'PATCH', body: changes }), 'Could not update the app')
    }

    /** Verify an app; pays its players' outstanding bounties once. */
    function verify(appId: string) {
        return act(() => apiFetch<VerifyAppResponse>(`/api/admin/apps/${encodeURIComponent(appId)}/verify`, { method: 'POST' }), 'Could not verify the app')
    }

    /** A one-time password reset link for a player (there is no email provider). */
    async function resetLink(email: string) {
        return act(() => apiFetch<{ url: string, expiresInMinutes: number }>('/api/admin/password-reset', { method: 'POST', body: { email } }), 'Could not create a reset link')
    }

    const apps = computed(() => data.value?.apps ?? [])

    return { apps, pending, error, busy, revealedKey, refresh, create, rotateKey, update, verify, resetLink }
}
