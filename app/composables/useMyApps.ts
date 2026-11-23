import { toast } from 'vue-sonner'
import type { AppInfo, AppKeyResponse, MyAppDetailResponse, MyAppsResponse, OwnedGame } from '#shared/types/api'

export interface CreateOwnAppPayload {
    id: string
    name: string
    baseUrl: string
    returnUrlPrefixes?: string[]
    repoUrl?: string | null
}

export interface UpdateOwnAppPayload {
    name?: string
    baseUrl?: string
    returnUrlPrefixes?: string[]
    repoUrl?: string | null
    status?: 'active' | 'disabled'
}

export interface UpdateOwnGamePayload {
    name?: string
    tagline?: string | null
    description?: string | null
    playPath?: string
    icon?: string | null
    cover?: string | null
    accent?: string | null
    visibility?: 'draft' | 'public'
}

/** The signed-in player's registered apps (`/api/me/apps`). */
export function useMyApps() {
    const { data, pending, error, refresh } = useAsyncData('pnx-my-apps', () => apiFetch<MyAppsResponse>('/api/me/apps'))
    const apps = computed(() => data.value?.apps ?? [])
    const busy = ref<string | null>(null)
    const revealedKey = ref<{ appId: string, apiKey: string } | null>(null)

    async function create(body: CreateOwnAppPayload): Promise<AppKeyResponse | null> {
        busy.value = '__create__'
        try {
            const res = await apiFetch<AppKeyResponse>('/api/me/apps', { method: 'POST', body })
            revealedKey.value = { appId: res.app.id, apiKey: res.apiKey }
            await refresh()
            return res
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not register the app'))
            return null
        } finally {
            busy.value = null
        }
    }

    async function update(id: string, body: UpdateOwnAppPayload): Promise<AppInfo | null> {
        busy.value = id
        try {
            const res = await apiFetch<{ app: AppInfo }>(`/api/me/apps/${encodeURIComponent(id)}`, { method: 'PATCH', body })
            if (data.value) data.value = { apps: data.value.apps.map(a => (a.id === id ? res.app : a)) }
            return res.app
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not update the app'))
            return null
        } finally {
            busy.value = null
        }
    }

    return { apps, pending, error, busy, revealedKey, refresh, create, update }
}

/** One app owned by the signed-in player and all of its registered games (`/api/me/apps/:id`). */
export function useMyApp(id: MaybeRefOrGetter<string>) {
    const { data, pending, error, refresh } = useAsyncData(
        () => `pnx-my-app-${toValue(id)}`,
        () => apiFetch<MyAppDetailResponse>(`/api/me/apps/${encodeURIComponent(toValue(id))}`)
    )
    const app = computed(() => data.value?.app ?? null)
    const games = computed(() => data.value?.games ?? [])
    const busy = ref(false)
    const gameBusy = ref<string | null>(null)
    const revealedKey = ref<{ appId: string, apiKey: string } | null>(null)

    async function updateApp(body: UpdateOwnAppPayload): Promise<AppInfo | null> {
        busy.value = true
        try {
            const res = await apiFetch<{ app: AppInfo }>(`/api/me/apps/${encodeURIComponent(toValue(id))}`, { method: 'PATCH', body })
            if (data.value) data.value = { ...data.value, app: res.app }
            clearNuxtData('pnx-games')
            clearNuxtData('pnx-my-apps')
            return res.app
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not update the app'))
            return null
        } finally {
            busy.value = false
        }
    }

    async function rotateKey(): Promise<AppKeyResponse | null> {
        busy.value = true
        try {
            const res = await apiFetch<AppKeyResponse>(`/api/me/apps/${encodeURIComponent(toValue(id))}/rotate-key`, { method: 'POST' })
            revealedKey.value = { appId: res.app.id, apiKey: res.apiKey }
            if (data.value) data.value = { ...data.value, app: res.app }
            return res
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not rotate the API key'))
            return null
        } finally {
            busy.value = false
        }
    }

    async function updateGame(slug: string, body: UpdateOwnGamePayload): Promise<OwnedGame | null> {
        gameBusy.value = slug
        try {
            const res = await apiFetch<{ game: OwnedGame }>(
                `/api/me/apps/${encodeURIComponent(toValue(id))}/games/${encodeURIComponent(slug)}`,
                { method: 'PATCH', body }
            )
            if (data.value) {
                data.value = {
                    ...data.value,
                    games: data.value.games.map(g => (g.slug === slug ? res.game : g))
                }
            }
            clearNuxtData('pnx-games')
            clearNuxtData(`pnx-game-${slug}`)
            return res.game
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not update the game'))
            return null
        } finally {
            gameBusy.value = null
        }
    }

    return { app, games, pending, error, busy, gameBusy, revealedKey, refresh, updateApp, rotateKey, updateGame }
}
