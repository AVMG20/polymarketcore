import { refDebounced } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { AdminPlayersResponse } from '#shared/types/api'

export const ADMIN_PLAYERS_PAGE = 50

/** Admin player list with a debounced name/email search, one-time reset links and admin roles. */
export function useAdminPlayers() {
    const search = ref('')
    const q = refDebounced(search, 250)
    const page = ref(1)
    watch(q, () => (page.value = 1))

    const { data, pending, error, refresh } = useAsyncData(
        'pnx-admin-players',
        () => apiFetch<AdminPlayersResponse>('/api/admin/players', {
            query: { q: q.value.trim() || undefined, limit: ADMIN_PLAYERS_PAGE, offset: (page.value - 1) * ADMIN_PLAYERS_PAGE }
        }),
        { watch: [q, page] }
    )

    const players = computed(() => data.value?.players ?? [])
    const total = computed(() => data.value?.total ?? 0)
    const pages = computed(() => Math.max(1, Math.ceil(total.value / ADMIN_PLAYERS_PAGE)))

    const resetting = ref<string | null>(null)
    /** A one-time password reset link for a player; null (and a toast) on failure. */
    async function resetLink(email: string): Promise<string | null> {
        resetting.value = email
        try {
            const res = await apiFetch<{ url: string }>('/api/admin/password-reset', { method: 'POST', body: { email } })
            return res.url
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not create a reset link'))
            return null
        } finally {
            resetting.value = null
        }
    }

    const changingRole = ref<string | null>(null)
    /** Make a player an admin or a player again; refreshes the list. */
    async function setAdmin(id: string, admin: boolean): Promise<void> {
        changingRole.value = id
        try {
            await apiFetch(`/api/admin/players/${id}/admin`, { method: 'PUT', body: { admin } })
            await refresh()
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not change the role'))
        } finally {
            changingRole.value = null
        }
    }

    return { search, page, pages, players, total, pending, error, refresh, resetting, resetLink, changingRole, setAdmin }
}
